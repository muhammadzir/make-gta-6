// Keyboard and mouse input for Solmar Bay. Held keys steer on foot and in
// a car; one-shot presses (start, pause, enter car, fight, interact, mute)
// are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. The mouse aims the
// pistol on foot; a click also fires.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_FIGHT = 8;
export const ACTION_INTERACT = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const FIGHT = new Set(['KeyF']);
const INTERACT = new Set(['KeyQ']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false, clicked: false };
  function set(code, on) {
    if (UP.has(code)) keys.up = on;
    else if (DOWN.has(code)) keys.down = on;
    else if (LEFT.has(code)) keys.left = on;
    else if (RIGHT.has(code)) keys.right = on;
    else if (RUN.has(code)) keys.run = on;
  }
  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) set(event.code, true);
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (FIGHT.has(event.code)) { if (!event.repeat) actions |= ACTION_FIGHT; }
    else if (INTERACT.has(event.code)) { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => set(event.code, false));
  window.addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = keys.run = false; mouse.down = false; });
  canvas.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('pointerdown', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true; mouse.clicked = true; actions |= ACTION_CONFIRM; });
  window.addEventListener('pointerup', () => { mouse.down = false; });
  return {
    keys,
    mouse,
    /** Steering vector, normalised: x -1..1, y -1..1. */
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len };
    },
    takeActions() { const t = actions; actions = 0; return t; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
  };
}
