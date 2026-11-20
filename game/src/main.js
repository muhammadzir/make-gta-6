// Solmar Bay boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted/wasted, and story complete.
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, EVENT_BUSTED } from './world.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_FIGHT, ACTION_INTERACT, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage off */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let saved = world.load();
  if (saved) world.message = 'Save loaded — welcome back to Solmar Bay.';
  function announce(message) { status.textContent = message; }
  function startGame() {
    if (!saved) world.reset();
    saved = false;
    accumulator = 0; screen = SCREEN_PLAY;
    audio.unlock(); audio.startMusic();
    announce('Playing Solmar Bay. Mission: ' + world.missions.objective());
  }
  function endGame(busted) {
    screen = SCREEN_OVER;
    if (world.money > best) { best = world.money; saveBest(best); }
    announce(busted ? 'Busted by the Solmar Bay PD.' : 'Wasted. Money kept: $' + world.money);
  }
  function control() {
    const move = input.move();
    // Aim: mouse position in world coordinates, from the renderer's camera.
    const v = renderer.view;
    const aimX = (input.mouse.x * (window.devicePixelRatio || 1) - v.x) / v.scale + v.camX;
    const aimY = (input.mouse.y * (window.devicePixelRatio || 1) - v.y) / v.scale + v.camY;
    return {
      mx: move.x, my: move.y, run: input.keys.run,
      aimX, aimY, shoot: input.mouse.down || false,
      enter: false, fight: false, interact: false,
    };
  }
  function handleActions() {
    const actions = input.takeActions();
    const ctrl = control();
    if (actions & ACTION_MUTE) { const m = audio.toggleMute(); announce(m ? 'Sound off.' : 'Sound on.'); }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    return { ctrl, actions };
  }
  function step(ctrl) {
    if (screen === SCREEN_TITLE) { world.step(STEP, { mx: 0.3, my: 0, run: false, aimX: 0, aimY: 0, shoot: false, enter: false, fight: false, interact: false }); return; }
    const events = world.step(STEP, ctrl);
    if (events & EVENT_OVER) endGame(!!(events & EVENT_BUSTED));
    else if (world.storyDone && screen === SCREEN_PLAY) { screen = SCREEN_WIN; if (world.money > best) { best = world.money; saveBest(best); } }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const { ctrl, actions } = handleActions();
    // One-shot actions feed the next world step only.
    ctrl.enter = !!(actions & ACTION_ENTER);
    ctrl.fight = !!(actions & ACTION_FIGHT);
    ctrl.interact = !!(actions & ACTION_INTERACT);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(ctrl); accumulator -= STEP;
        ctrl.enter = false; ctrl.fight = false; ctrl.interact = false;
      }
    } else accumulator = 0;
    renderer.draw(world, screen, best);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
