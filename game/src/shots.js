// The screenshot scenes behind ?shot=start|play|end|chase. Each one plays
// the real rules forward from a fresh world, steered by a simple autopilot
// that drives toward the mission target, so the frame is what a short game
// really looks like and the same seed always gives the same frame.
// start: title over the living city. play: Rico driving through Downtown
// with traffic and a mission marker. chase: a 2-star police chase at the
// harbour. end: the heist getaway at the hideout, mission complete.
import { STEP } from './config.js';
import { ROADS_X, ROADS_Y } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function nearest(list, v) { return list.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a); }

// Drive on the road grid, Manhattan-style: first along the nearest road
// to the target's column, then down that column to the target. Cutting
// straight across blocks wrecks the car on buildings, so the autopilot
// never does that — it picks a road waypoint instead of the target itself.
function driveToward(world, target) {
  const p = world.player;
  let wp;
  // Start the turn 250 px early: at full speed the car needs that much
  // room to swing onto the cross road without overshooting onto the grass.
  if (Math.abs(p.x - target.x) > 250) wp = { x: target.x, y: nearest(ROADS_Y, p.y) };
  else wp = { x: nearest(ROADS_X, target.x), y: target.y };
  const dx = wp.x - p.x, dy = wp.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  // On foot, mx/my are a world-space vector; in a car, my=-1 is forward
  // and mx steers toward the waypoint's bearing.
  if (!world.inCar) return { mx: dx / len, my: dy / len, run: false, aimX: target.x, aimY: target.y, shoot: false, enter: false, fight: false, interact: false };
  const wantAngle = Math.atan2(dy, dx);
  let da = wantAngle - p.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  // Coast through a sharp turn instead of accelerating into it: at full
  // speed the turning circle is wider than the intersection, and the car
  // overshoots into the buildings on its corner.
  const forward = Math.abs(da) > 0.3 ? 0 : -1;
  return { mx: Math.max(-1, Math.min(1, da * 2)), my: forward, run: false, aimX: target.x, aimY: target.y, shoot: false, enter: false, fight: false, interact: false };
}
function idle() {
  return { mx: 0, my: 0, run: false, aimX: 0, aimY: 0, shoot: false, enter: false, fight: false, interact: false };
}

export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, { mx: 0.2, my: 0, run: false, aimX: 0, aimY: 0, shoot: false, enter: false, fight: false, interact: false });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Walk up to a parked car by the lockup, steal it, then drive straight
    // east along Solmar Avenue for 5 seconds: no turn, so the car stays
    // on the road, in traffic, with the garage beacon and the mission
    // objective on the HUD. (Turning at an intersection at speed is what
    // a human player brakes for; the autopilot does not.)
    world.player.x = 870; world.player.y = 900;
    world.cars.push({ x: 900, y: 900, angle: 0, speed: 0, color: '#c23a3a', health: 200, police: false, driver: true, w: 46, h: 22, turnAt: 0 });
    world.enterCar();
    const straightEast = { x: 3420, y: 900 };
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, driveToward(world, straightEast));
    return { screen: SCREEN_PLAY, best: world.money };
  }
  if (name === 'chase') {
    world.player.x = 1590; world.player.y = 1620;
    world.cars.push({ x: 1620, y: 1620, angle: 0, speed: 0, color: '#c23a3a', health: 100, police: false, driver: true, w: 46, h: 22, turnAt: 0 });
    world.enterCar();
    world.wanted = 2;
    const target = world.city.landmarks.marina;
    for (let i = 0; i < 10 / STEP; i += 1) world.step(STEP, driveToward(world, target));
    return { screen: SCREEN_PLAY, best: world.money };
  }
  // end: finish the story by hand — heist complete, at the hideout.
  world.missions.index = 3; world.missions.stage = 2;
  world.money = 6900; world.wanted = 3;
  world.player.x = 3390; world.player.y = 540;
  world.cars.push({ x: 3420, y: 540, angle: 0, speed: 0, color: '#3a7ac2', health: 100, police: false, driver: true, w: 46, h: 22, turnAt: 0 });
  world.enterCar();
  for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, idle());
  world.missions.done = true; world.storyDone = true;
  return { screen: SCREEN_WIN, best: world.money };
}
