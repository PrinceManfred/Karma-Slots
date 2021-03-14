/**

Copyright (c) 2012 Clint Bellanger

MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


Sounds by Brandon Morris (CC-BY 3.0)
Art by Clint Bellanger (CC-BY 3.0)

*/

var FPS = 60;
setInterval(function() {
  ruby_logic();
  ruby_render();
}, 1000/FPS);

// html elements
var ruby_can;     // canvas
var ruby_ctx;     // context
var ruby_log_p;   // log paragraph
var ruby_cred_p;  // credits paragraph

var ruby_symbols_loaded = false;
var ruby_reels_bg_loaded = false;

// art
var ruby_symbols = new Image();
var ruby_reels_bg = new Image();
var ruby_snd_reel_stop = new Array();
var ruby_snd_win;

ruby_symbols.src = "images/reddit_icons_small.png";
ruby_reels_bg.src = "images/reels_bg.png";

ruby_snd_win = new Audio("sounds/win.wav");
ruby_snd_reel_stop[0] = new Audio("sounds/reel_stop.wav");
ruby_snd_reel_stop[1] = new Audio("sounds/reel_stop.wav");
ruby_snd_reel_stop[2] = new Audio("sounds/reel_stop.wav");

// enums
var ruby_STATE_REST = 0;
var ruby_STATE_SPINUP = 1;
var ruby_STATE_SPINDOWN = 2;
var ruby_STATE_REWARD = 3;

// config
var ruby_reel_count = 3;
var ruby_reel_positions = 32;
var ruby_symbol_size = 32;
var ruby_symbol_count = 11;
var ruby_reel_pixel_length = ruby_reel_positions * ruby_symbol_size;
var ruby_row_count = 3;
var ruby_stopping_distance = 528;
var ruby_max_reel_speed = 32;
var ruby_spinup_acceleration = 2;
var ruby_spindown_acceleration = 1;
var ruby_starting_credits = 100;
var ruby_reward_delay = 3; // how many frames between each credit tick
var ruby_reward_delay_grand = 1; // delay for grand-prize winning
var ruby_reward_grand_threshhold = 25; // count faster if the reward is over this size

var ruby_match_payout = new Array(ruby_symbol_count);
ruby_match_payout[7] = 4; // 3Down
ruby_match_payout[6] = 6; // 2Down
ruby_match_payout[5] = 8; // 1Down
ruby_match_payout[1] = 10; // 1Up
ruby_match_payout[2] = 15; // 2Up
ruby_match_payout[3] = 20; // 3Up
ruby_match_payout[4] = 25; // OrangeRed
ruby_match_payout[0] = 50; // AlienHead
ruby_match_payout[9] = 75; // Bacon
ruby_match_payout[10] = 100; // Narwhal
ruby_match_payout[8] = 250; // CakeDay

var ruby_payout_ups = 6; // Any 3 Ups
var ruby_payout_downs = 2; // Any 3 Downs

var ruby_reel_area_left = 32;
var ruby_reel_area_top = 32;
var ruby_reel_area_width = 96;
var ruby_reel_area_height = 96;

// set up reels
var ruby_reels = new Array(ruby_reel_count);
ruby_reels[0] = new Array(2,1,7,1,2,7,6,7,3,10,1,6,1,7,3,4,3,2,4,5,0,6,10,5,6,5,8,3,0,9,5,4);
ruby_reels[1] = new Array(6,0,10,3,6,7,9,2,5,2,3,1,5,2,1,10,4,5,8,4,7,6,0,1,7,6,3,1,5,9,7,4);
ruby_reels[2] = new Array(1,4,2,7,5,6,4,10,7,5,2,0,6,4,10,1,7,6,3,0,5,7,2,3,9,3,5,6,1,8,1,3);

var ruby_reel_position = new Array(ruby_reel_count);
for (var i=0; i<ruby_reel_count; i++) {
  ruby_reel_position[i] = Math.floor(Math.random() * ruby_reel_positions) * ruby_symbol_size;
}

var ruby_stopping_position = new Array(ruby_reel_count);
var ruby_start_slowing = new Array(ruby_reel_count);

// reel spin speed in pixels per frame
var ruby_reel_speed = new Array(ruby_reel_count);
for (var i=0; i<ruby_reel_count; i++) {
  ruby_reel_speed[i] = 0;
}

var ruby_result = new Array(ruby_reel_count);
for (var i=0; i<ruby_reel_count; i++) {
  ruby_result[i] = new Array(ruby_row_count);
}

var ruby_game_state = ruby_STATE_REST;
var ruby_credits = ruby_starting_credits;
var ruby_payout = 0;
var ruby_reward_delay_counter = 0;
var ruby_playing_lines;

//---- Render Functions ---------------------------------------------

function ruby_draw_symbol(symbol_index, x, y) {
  var symbol_pixel = symbol_index * ruby_symbol_size;
  ruby_ctx.drawImage(ruby_symbols, 0,symbol_pixel,ruby_symbol_size,ruby_symbol_size, x+ruby_reel_area_left,y+ruby_reel_area_top,ruby_symbol_size,ruby_symbol_size);
}

function ruby_render_reel() {

  // clear reel
  ruby_ctx.drawImage(ruby_reels_bg, ruby_reel_area_left, ruby_reel_area_top);

  // set clipping area
  ruby_ctx.beginPath();
  ruby_ctx.rect(ruby_reel_area_left, ruby_reel_area_top, ruby_reel_area_width, ruby_reel_area_height);
  ruby_ctx.clip();

  var reel_index;
  var symbol_offset;
  var symbol_index;
  var x;
  var y;

  for (var i=0; i<ruby_reel_count; i++) {
    for (var j=0; j<ruby_row_count +1; j++) {

      reel_index = Math.floor(ruby_reel_position[i] / ruby_symbol_size) + j;
      symbol_offset = ruby_reel_position[i] % ruby_symbol_size;
 
      // reel wrap
      if (reel_index >= ruby_reel_positions) reel_index -= ruby_reel_positions;

      // symbol lookup
      symbol_index = ruby_reels[i][reel_index];

      x = i * ruby_symbol_size;
      y = j * ruby_symbol_size - symbol_offset;

      ruby_draw_symbol(symbol_index, x, y);

    }
  }
}

function ruby_highlight_line(line_num) {

  ruby_ctx.strokeStyle = "orange";
  var ss = ruby_symbol_size;

  // top row
  if (line_num == 2 || line_num == 4) {
    ruby_ctx.strokeRect(ruby_reel_area_left, ruby_reel_area_top, ruby_symbol_size-1, ruby_symbol_size-1); // top left
  }
  if (line_num == 2) {
    ruby_ctx.strokeRect(ruby_reel_area_left + ss, ruby_reel_area_top, ss-1, ss-1); // top middle
  }
  if (line_num == 2 || line_num == 5) {
    ruby_ctx.strokeRect(ruby_reel_area_left + ss + ss, ruby_reel_area_top, ss-1, ss-1); // top right
  }

  // middle row
  if (line_num == 1) {
    ruby_ctx.strokeRect(ruby_reel_area_left, ruby_reel_area_top + ss, ss-1, ss-1); // top left
  }
  if (line_num == 1 || line_num == 4 || line_num == 5) {
    ruby_ctx.strokeRect(ruby_reel_area_left + ss, ruby_reel_area_top + ss, ss-1, ss-1); // top middle
  }
  if (line_num == 1) {
    ruby_ctx.strokeRect(ruby_reel_area_left + ss + ss, ruby_reel_area_top + ss, ss-1, ss-1); // top right
  }

  // bottom row
  if (line_num == 3 || line_num == 5) {
    ruby_ctx.strokeRect(ruby_reel_area_left, ruby_reel_area_top + ss + ss, ss-1, ss-1); // top left
  }
  if (line_num == 3) {
    ruby_ctx.strokeRect(ruby_reel_area_left + ss, ruby_reel_area_top + ss + ss, ss-1, ss-1); // top middle
  }
  if (line_num == 3 || line_num == 4) {
    ruby_ctx.strokeRect(ruby_reel_area_left + ss + ss, ruby_reel_area_top + ss + ss, ss-1, ss-1); // top right
  }

}

// render all art needed in the current frame
function ruby_render() {

  if (ruby_game_state == ruby_STATE_SPINUP || ruby_game_state == ruby_STATE_SPINDOWN) {
    ruby_render_reel();
  }

}


//---- Logic Functions ---------------------------------------------

function ruby_set_stops() {
  for (var i=0; i<ruby_reel_count; i++) {

    ruby_start_slowing[i] = false;

    stop_index = Math.floor(Math.random() * ruby_reel_positions);
    ruby_stopping_position[i] = stop_index * ruby_symbol_size;

    ruby_stopping_position[i] += ruby_stopping_distance;
    if (ruby_stopping_position[i] >= ruby_reel_pixel_length) ruby_stopping_position[i] -= ruby_reel_pixel_length;

    // convenient here to remember the winning positions
    for (var j=0; j<ruby_row_count; j++) {
      ruby_result[i][j] = stop_index + j;
      if (ruby_result[i][j] >= ruby_reel_positions) ruby_result[i][j] -= ruby_reel_positions;

      // translate reel positions into symbol
      ruby_result[i][j] = ruby_reels[i][ruby_result[i][j]];
    }
  }
}

function ruby_move_reel(i) {
  ruby_reel_position[i] -= ruby_reel_speed[i];

  // wrap
  if (ruby_reel_position[i] < 0) {
    ruby_reel_position[i] += ruby_reel_pixel_length;
  }
}

// handle reels accelerating to full speed
function ruby_logic_spinup() {

  for (var i=0; i<ruby_reel_count; i++) {

    // move reel at current speed
    ruby_move_reel(i);

    // accelerate speed
    ruby_reel_speed[i] += ruby_spinup_acceleration;

  }

  // if reels at max speed, begin spindown
  if (ruby_reel_speed[0] == ruby_max_reel_speed) {

    // calculate the final results now, so that spindown is ready
    ruby_set_stops();

    ruby_game_state = ruby_STATE_SPINDOWN;
  }
}

// handle reel movement as the reels are coming to rest
function ruby_logic_spindown() {

  // if reels finished moving, begin rewards
  if (ruby_reel_speed[ruby_reel_count-1] == 0) {

    ruby_calc_reward();
    ruby_game_state = ruby_STATE_REWARD;
  }

  for (var i=0; i<ruby_reel_count; i++) {

    // move reel at current speed
    ruby_move_reel(i);

    // start slowing this reel?
    if (ruby_start_slowing[i] == false) {

      // if the first reel, or the previous reel is already slowing
      var check_position = false;
      if (i == 0) check_position = true;
      else if (ruby_start_slowing[i-1]) check_position = true;

      if (check_position) {
      
        if (ruby_reel_position[i] == ruby_stopping_position[i]) {
          ruby_start_slowing[i] = true;          
        }
      }
    }
    else {
      if (ruby_reel_speed[i] > 0) {
        ruby_reel_speed[i] -= ruby_spindown_acceleration;

        if (ruby_reel_speed[i] == 0) {
          try {
            ruby_snd_reel_stop[i].currentTime = 0;
            ruby_snd_reel_stop[i].play();
          } catch(err) {};
        }

      }
    }
  }

}

// count up the reward credits, play sound effects, etc.
function ruby_logic_reward() {

  if (ruby_payout == 0) {
    ruby_game_state = ruby_STATE_REST;
    return;
  }

  // don't tick up rewards each frame, too fast
  if (ruby_reward_delay_counter > 0) {
    ruby_reward_delay_counter--;
    return;
  }

  ruby_payout--;
  ruby_credits++;
  ruby_cred_p.innerHTML = "Karma (" + ruby_credits + ")";
  
  if (ruby_payout < ruby_reward_grand_threshhold) {
    ruby_reward_delay_counter = ruby_reward_delay;
  }
  else { // speed up big rewards
    ruby_reward_delay_counter += ruby_reward_delay_grand;
  }

}

// update all logic in the current frame
function ruby_logic() {

  // REST to SPINUP happens on an input event

  if (ruby_game_state == ruby_STATE_SPINUP) {
    ruby_logic_spinup();
  }
  else if (ruby_game_state == ruby_STATE_SPINDOWN) {
    ruby_logic_spindown();
  }
  else if (ruby_game_state == ruby_STATE_REWARD) {
    ruby_logic_reward();
  }
  
}

// given an input line of symbols, determine the payout
function ruby_calc_line(s1, s2, s3) {

  // perfect match
  if (s1 == s2 && s2 == s3) {
    return ruby_match_payout[s1];
  }

  // special case #1: triple ups
  if ((s1 == 1 || s1 == 2 || s1 == 3) &&
      (s2 == 1 || s2 == 2 || s2 == 3) &&
      (s3 == 1 || s3 == 2 || s3 == 3)) {
    return ruby_payout_ups;
  }

  // special case #2: triple down
  if ((s1 == 5 || s1 == 6 || s1 == 7) &&
      (s2 == 5 || s2 == 6 || s2 == 7) &&
      (s3 == 5 || s3 == 6 || s3 == 7)) {
    return ruby_payout_downs;
  }

  // special case #3: bacon goes with everything
  if (s1 == 9) {
    if (s2 == s3) return ruby_match_payout[s2];

    // wildcard trip ups
    if ((s2 == 1 || s2 == 2 || s2 == 3) &&
        (s3 == 1 || s3 == 2 || s3 == 3)) return ruby_payout_ups;

    // wildcard trip downs
    if ((s2 == 5 || s2 == 6 || s2 == 7) &&
        (s3 == 5 || s3 == 6 || s3 == 7)) return ruby_payout_downs;
  
  }
  if (s2 == 9) {
    if (s1 == s3) return ruby_match_payout[s1];

    // wildcard trip ups
    if ((s1 == 1 || s1 == 2 || s1 == 3) &&
        (s3 == 1 || s3 == 2 || s3 == 3)) return ruby_payout_ups;

    // wildcard trip downs
    if ((s1 == 5 || s1 == 6 || s1 == 7) &&
        (s3 == 5 || s3 == 6 || s3 == 7)) return ruby_payout_downs;

  }
  if (s3 == 9) {
    if (s1 == s2) return ruby_match_payout[s1];

    // wildcard trip ups
    if ((s1 == 1 || s1 == 2 || s1 == 3) &&
        (s2 == 1 || s2 == 2 || s2 == 3)) return ruby_payout_ups;

    // wildcard trip downs
    if ((s1 == 5 || s1 == 6 || s1 == 7) &&
        (s2 == 5 || s2 == 6 || s2 == 7)) return ruby_payout_downs;
  }

  // check double-bacon
  if (s2 == 9 && s3 == 9) return ruby_match_payout[s1];
  if (s1 == 9 && s3 == 9) return ruby_match_payout[s2];
  if (s1 == 9 && s2 == 9) return ruby_match_payout[s3];

  // no reward
  return 0;
}

// calculate the reward
function ruby_calc_reward() {
  ruby_payout = 0;
  
  var partial_payout;

  // Line 1
  partial_payout = ruby_calc_line(ruby_result[0][1], ruby_result[1][1], ruby_result[2][1]);
  if (partial_payout > 0) {
    ruby_log_p.innerHTML += "Line 1 pays " + partial_payout + "<br />\n";
    ruby_payout += partial_payout;
    ruby_highlight_line(1);
  }

  if (ruby_playing_lines > 1) {

    // Line 2
    partial_payout = ruby_calc_line(ruby_result[0][0], ruby_result[1][0], ruby_result[2][0]);
    if (partial_payout > 0) {
      ruby_log_p.innerHTML += "Line 2 pays " + partial_payout + "<br />\n";
      ruby_payout += partial_payout;
      ruby_highlight_line(2);
    }

    // Line 3
    partial_payout = ruby_calc_line(ruby_result[0][2], ruby_result[1][2], ruby_result[2][2]);
    if (partial_payout > 0) {
      ruby_log_p.innerHTML += "Line 3 pays " + partial_payout + "<br />\n";
      ruby_payout += partial_payout;
      ruby_highlight_line(3);
    }
  }


  if (ruby_playing_lines > 3) {

    // Line 4
    partial_payout = ruby_calc_line(ruby_result[0][0], ruby_result[1][1], ruby_result[2][2]);
    if (partial_payout > 0) {
      ruby_log_p.innerHTML += "Line 4 pays " + partial_payout + "<br />\n";
      ruby_payout += partial_payout;
      ruby_highlight_line(4);
    }

    // Line 5
    partial_payout = ruby_calc_line(ruby_result[0][2], ruby_result[1][1], ruby_result[2][0]);
    if (partial_payout > 0) {
      ruby_log_p.innerHTML += "Line 5 pays " + partial_payout + "<br />\n";
      ruby_payout += partial_payout;
      ruby_highlight_line(5);
    }
  }

  
  if (ruby_payout > 0) {
    try {
      ruby_snd_win.currentTime = 0;
      ruby_snd_win.play();
    }
    catch(err) {};
  }

}

//---- Input Functions ---------------------------------------------

function ruby_handleKey(evt) {
  if (evt.keyCode == 32) { // spacebar
    if (ruby_game_state != ruby_STATE_REST) return;

    if (ruby_credits >= 5) ruby_spin(5);
    else if (ruby_credits >= 3) ruby_spin(3);
    else if (ruby_credits >= 1) ruby_spin(1);

  }
}

function ruby_spin(line_choice) {
  
  if (ruby_game_state != ruby_STATE_REST) return;
  if (ruby_credits < line_choice) return;

  ruby_credits -= line_choice;
  ruby_playing_lines = line_choice;

  ruby_cred_p.innerHTML = "Karma (" + ruby_credits + ")";
  ruby_log_p.innerHTML = "";

  ruby_game_state = ruby_STATE_SPINUP;

}

//---- Init Functions -----------------------------------------------

function ruby_init() {
  ruby_can = document.getElementById("slots"); 
  ruby_ctx = ruby_can.getContext("2d");
  ruby_log_p = document.getElementById("log");
  ruby_cred_p = document.getElementById("credits");

  ruby_cred_p.innerHTML = "Karma (" + ruby_credits + ")"

  window.addEventListener('keydown', ruby_handleKey, true);

  ruby_symbols.onload = function() {
    ruby_symbols_loaded = true;
    if (ruby_symbols_loaded && ruby_reels_bg_loaded) ruby_render_reel();
  };

  ruby_reels_bg.onload = function() {
    ruby_reels_bg_loaded = true;
    if (ruby_symbols_loaded && ruby_reels_bg_loaded) ruby_render_reel();
  };

}


