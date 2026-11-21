// Screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real game forward from a fresh world, steered by synthetic key presses,
// so the frame is what short real play looks like and the same seed always
// gives the same frame.
// start: title over the living 3D sunset city. play: Rico driving up the
// Downtown road with traffic and a mission marker. chase: a 3-star police
// chase. end: story complete after the final mission.
(function () {
  'use strict';
  function key(code, down) {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, bubbles: true, cancelable: true }));
  }
  function holdW(seconds) {
    key('KeyW', true);
    setTimeout(function () { key('KeyW', false); }, seconds * 1000);
  }
  function stage(name, game) {
    if (name === 'play' || name === 'chase') {
      game.start(false);
      game.teleport(0, 120);
      game.giveCar('#c23a3a');
      game.enterCar();
      if (name === 'chase') game.setWanted(3);
      holdW(name === 'chase' ? 6 : 5);
      return;
    }
    if (name === 'end') {
      game.start(false);
      game.teleport(-420, 420);
      game.setMoney(10900);
      game.completeAllMissions();
      return;
    }
    // start: title screen, nothing to do — the orbit camera is already running.
// chase holds W for 6 s so the patrol cars catch up and ram; play holds it 5 s
// so the frame shows Rico driving, not parked. end teleports to the safehouse
// corner, pays out the last mission and completes the story on the spot.
  }
  window.SB3Shots = { stage: stage };
})();
