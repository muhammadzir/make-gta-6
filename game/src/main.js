// Solmar Bay 3D boot: build the Three.js world, start the game loop,
// and stage screenshot scenes when ?shot=start|play|chase|end is given
// (with &seed=N). The loop sets window.__shotReady when a shot is staged.
(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  var seedParam = Number.parseInt(params.get('seed') || '', 10);
  var seed = Number.isInteger(seedParam) ? seedParam : 1337;

  var canvas = document.getElementById('game');
  var world3d = window.SB3World.create(canvas, 'Medium');
  var game = window.SB3Game.create(canvas, world3d, window.SB3Audio);
  window.SOLMAR = game;
  window.__gameReady = true;

  if (shot) {
    // Give the title orbit / world a few frames, then stage the shot.
    var tries = 0;
    var iv = setInterval(function () {
      tries += 1;
      try {
        window.SB3Shots.stage(shot, game);
        window.__shotReady = true;
        clearInterval(iv);
      } catch (e) {
        if (tries > 10) { window.__shotReady = true; window.__shotError = String(e); clearInterval(iv); }
      }
    }, 400);
  }
})();
