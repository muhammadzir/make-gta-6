// Solmar Bay's rules and state, with no drawing and no browser in it:
// the player on foot and in cars, traffic, pedestrians, police, wanted
// level, combat, pickups, missions and saving. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound.
import { WORLD, PLAYER, CAR, TRAFFIC_COUNT, PED_COUNT, POLICE_MAX, WANTED, SAVE_KEY, PALETTE } from './config.js';
import { createCity, isRoad, snapToRoad, collidesBuilding, clampWorld, ROADS_X, ROADS_Y } from './city.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;
export const EVENT_MISSION = 8;
export const EVENT_BUSTED = 16;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

export function createWorld(random, audio) {
  const city = createCity(random);
  const missions = createMissions(city.landmarks);
  const world = {
    city, missions, audio: audio || createAudio(),
    player: { x: 180, y: 220, angle: 0, health: PLAYER.health, ammo: PLAYER.ammo, fireCooldown: 0, invulnerable: 0 },
    cars: [], peds: [], police: [], enemies: [], bullets: [], pickups: [], effects: [],
    money: 0, wanted: 0, inCar: false, car: null, elapsed: 0,
    message: '', messageTime: 0, flash: '', storyDone: false,
    busted: false, over: false, policeTimer: 0, pickupTimer: 4, sirenTimer: 0,
  };

  function makeCar(x, y, police) {
    const snapped = snapToRoad(x, y);
    return {
      x: snapped.x, y: snapped.y, angle: snapped.axis === 'v' ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI),
      speed: random.range(120, 220), color: police ? PALETTE.copCar : random.pick(PALETTE.car),
      health: CAR.health, police: !!police, driver: !police, w: 46, h: 22, turnAt: 0,
    };
  }
  function spawnTraffic() {
    world.cars = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      world.cars.push(makeCar(random.range(200, WORLD.width - 200), random.range(200, WORLD.height - 800), false));
    }
    // A few parked cars near the lockup for mission 1, facing east along
    // the road — a car facing west needs a U-turn on a 96 px road and
    // swings off it into the buildings.
    for (let i = 0; i < 4; i += 1) {
      const parked = makeCar(360 + i * 90, 180, false);
      parked.angle = 0; parked.speed = 0;
      world.cars.push(parked);
    }
  }
  function spawnPeds() {
    world.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      world.peds.push({
        x: random.range(100, WORLD.width - 100), y: random.range(100, WORLD.height - 700),
        angle: random.range(0, Math.PI * 2), speed: random.range(30, 70),
        color: random.pick(['#d95a8c', '#5ad9a0', '#d9c25a', '#7a9cd9', '#e8e8e8']),
        flee: 0, alive: true, walkPhase: random.range(0, 6),
      });
    }
  }
  function spawnPickup(kind, x, y) {
    world.pickups.push({ kind, x, y, t: 0 });
  }
  function spawnEnemies(n, at) {
    for (let i = 0; i < n; i += 1) {
      world.enemies.push({
        x: at.x + random.range(-120, 120), y: at.y + random.range(-120, 120),
        angle: 0, health: 60, fireCooldown: random.range(0.5, 1.5), alive: true, speed: 150,
      });
    }
  }
  function addEffect(x, y, kind) { world.effects.push({ x, y, kind, t: 0 }); }
  function addWanted(n) {
    world.wanted = Math.min(5, world.wanted + n);
    if (world.wanted > 0) world.messageTime = 3;
  }
  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: world.money, missionIndex: missions.index, missionStage: missions.stage,
        health: world.player.health, x: world.player.x, y: world.player.y, storyDone: world.storyDone,
      }));
    } catch { /* storage off: progress lasts this visit only */ }
  }
  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      world.money = s.money || 0; missions.index = s.missionIndex || 0; missions.stage = s.missionStage || 0;
      world.player.health = s.health || PLAYER.health;
      if (s.x) { world.player.x = s.x; world.player.y = s.y; }
      world.storyDone = !!s.storyDone; missions.done = world.storyDone;
      return true;
    } catch { return false; }
  }
  function reset() {
    world.player.x = 180; world.player.y = 220; world.player.angle = 0;
    world.player.health = PLAYER.health; world.player.ammo = PLAYER.ammo;
    world.player.fireCooldown = 0; world.player.invulnerable = 0;
    world.money = 0; world.wanted = 0; world.inCar = false; world.car = null;
    world.elapsed = 0; world.busted = false; world.over = false;
    world.message = ''; world.flash = ''; world.storyDone = false;
    world.bullets = []; world.effects = []; world.pickups = []; world.enemies = []; world.police = [];
    missions.index = 0; missions.stage = 0; missions.done = false; missions.defeated = 0;
    spawnTraffic(); spawnPeds();
    spawnPickup('cash', 540, 540); spawnPickup('health', 900, 900); spawnPickup('ammo', 1260, 540);
  }
  function moveWithCollision(obj, dx, dy, r) {
    const nx = clampWorld(obj.x + dx, obj.y, r).x;
    if (!collidesBuilding(city, nx, obj.y, r)) obj.x = nx;
    const ny = clampWorld(obj.x, obj.y + dy, r).y;
    if (!collidesBuilding(city, obj.x, ny, r)) obj.y = ny;
  }
  function nearestCar(maxD) {
    let best = null, bd = maxD;
    for (const c of world.cars) {
      if (c === world.car) continue;
      const d = dist(world.player, c);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function enterCar() {
    const c = nearestCar(70);
    if (!c) return false;
    if (c.driver) { // steal it: the driver runs off, the cops notice
      c.driver = false; addWanted(WANTED.steal);
      world.message = 'Car stolen! The cops saw that.';
      world.audio.crash();
    }
    world.inCar = true; world.car = c;
    world.player.x = c.x; world.player.y = c.y;
    return true;
  }
  function exitCar() {
    if (!world.inCar || !world.car) return;
    const c = world.car;
    world.player.x = c.x + 40; world.player.y = c.y + 30;
    world.inCar = false; world.car = null;
  }
  function shootAt(tx, ty) {
    const p = world.player;
    if (p.fireCooldown > 0 || p.ammo <= 0) return;
    p.fireCooldown = PLAYER.fireRate; p.ammo -= 1;
    p.angle = angleTo(p, { x: tx, y: ty });
    world.bullets.push({ x: p.x, y: p.y, angle: p.angle, speed: 900, fromPlayer: true, life: 0.9 });
    world.audio.shoot();
    if (world.wanted < 1) addWanted(WANTED.shoot);
  }
  function punch() {
    const p = world.player;
    if (p.fireCooldown > 0) return;
    p.fireCooldown = 0.35;
    world.audio.punch();
    const targets = [...world.enemies, ...world.peds.filter((q) => q.alive)];
    for (const t of targets) {
      if (dist(p, t) < 52 && Math.abs(((angleTo(p, t) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.1) {
        if (t.health !== undefined) { t.health -= PLAYER.punchDamage; addEffect(t.x, t.y, 'hit'); if (t.health <= 0) killEnemy(t); }
        else { t.alive = false; addWanted(WANTED.hitPed); addEffect(t.x, t.y, 'hit'); }
      }
    }
  }
  function killEnemy(e) {
    e.alive = false; missions.defeated += 1; world.money += 120;
    addEffect(e.x, e.y, 'down'); world.audio.cash();
    if (world.wanted < 2) addWanted(1);
  }
  function updateTraffic(dt) {
    for (const c of world.cars) {
      if (c === world.car) continue;
      // Drive along its road; at an intersection, sometimes turn.
      const speed = c.speed * dt;
      c.x += Math.cos(c.angle) * speed; c.y += Math.sin(c.angle) * speed;
      if (c.x < 60 || c.x > WORLD.width - 60 || c.y < 60 || c.y > WORLD.height - 640) {
        c.angle += Math.PI; // turn around at the edge
        c.x = Math.max(60, Math.min(WORLD.width - 60, c.x));
        c.y = Math.max(60, Math.min(WORLD.height - 640, c.y));
      }
      // Near an intersection, occasionally turn onto the cross road.
      const onX = ROADS_X.some((rx) => Math.abs(c.x - rx) < 8);
      const onY = ROADS_Y.some((ry) => Math.abs(c.y - ry) < 8);
      if (onX && onY && random.chance(0.02)) c.angle += random.pick([-Math.PI / 2, Math.PI / 2]);
      if (collidesBuilding(city, c.x, c.y, 20)) c.angle += Math.PI / 2;
    }
  }
  function updatePeds(dt) {
    for (const p of world.peds) {
      if (!p.alive) continue;
      p.walkPhase += dt * 6;
      if (p.flee > 0) {
        p.flee -= dt;
        p.x += Math.cos(p.angle) * 190 * dt; p.y += Math.sin(p.angle) * 190 * dt;
      } else {
        if (random.chance(0.005)) p.angle = random.range(0, Math.PI * 2);
        p.x += Math.cos(p.angle) * p.speed * dt; p.y += Math.sin(p.angle) * p.speed * dt;
      }
      const cl = clampWorld(p.x, p.y, 10); p.x = cl.x; p.y = cl.y;
      if (collidesBuilding(city, p.x, p.y, 10)) p.angle += Math.PI / 2;
      // Flee from gunfire and fast cars.
      if (dist(p, world.player) < 160 && (world.player.fireCooldown > 0.2 || (world.inCar && Math.abs(world.car.speed) > 300))) {
        p.flee = 1.5; p.angle = angleTo(world.player, p);
      }
    }
  }
  function updatePolice(dt) {
    const want = Math.min(POLICE_MAX, Math.ceil(world.wanted));
    while (world.police.length < want) {
      const a = random.range(0, Math.PI * 2);
      world.police.push(makeCar(world.player.x + Math.cos(a) * 700, world.player.y + Math.sin(a) * 700, true));
    }
    while (world.police.length > want) world.police.pop();
    for (const cop of world.police) {
      const target = world.inCar ? world.car : world.player;
      const a = angleTo(cop, target);
      let da = a - cop.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, da));
      // Police top out below a player's car (620), so a good driver can
      // outrun a 1-star chase; ramming hurts, but slowly — a chase is a
      // chase, not an execution. (An earlier 18/s ram killed the player
      // inside one 18-second screenshot drive.)
      cop.speed = Math.min(480, cop.speed + 300 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      const cl = clampWorld(cop.x, cop.y, 20); cop.x = cl.x; cop.y = cl.y;
      if (dist(cop, target) < 46) {
        // Ram / arrest: damage the player, slow the car.
        if (world.inCar) { world.car.health -= 3 * dt; world.car.speed *= 0.98; }
        else { world.player.health -= 8 * dt; }
        addEffect(target.x, target.y, 'hit');
        if (world.player.health <= 0 || (world.inCar && world.car.health <= 0)) {
          world.busted = true; world.over = true; world.audio.busted();
        }
      }
      world.sirenTimer -= dt;
      if (world.sirenTimer <= 0) { world.audio.siren(); world.sirenTimer = 1.4; }
    }
  }
  function updateBullets(dt) {
    for (const b of world.bullets) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      if (collidesBuilding(city, b.x, b.y, 4)) { b.life = 0; addEffect(b.x, b.y, 'hit'); continue; }
      if (b.fromPlayer) {
        for (const e of world.enemies) {
          if (e.alive && dist(b, e) < 22) { e.health -= PLAYER.shootDamage; b.life = 0; addEffect(e.x, e.y, 'hit'); if (e.health <= 0) killEnemy(e); break; }
        }
        for (const cop of world.police) {
          if (b.life > 0 && dist(b, cop) < 26) { cop.health -= PLAYER.shootDamage; b.life = 0; addWanted(WANTED.killCop); if (cop.health <= 0) { cop.health = 100; world.police.splice(world.police.indexOf(cop), 1); } break; }
        }
      } else if (dist(b, world.player) < 18 && world.player.invulnerable <= 0) {
        world.player.health -= 12; world.player.invulnerable = 0.6; b.life = 0; addEffect(world.player.x, world.player.y, 'hit');
        if (world.player.health <= 0) { world.over = true; world.audio.busted(); }
      }
    }
    world.bullets = world.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
  }
  function updateEnemies(dt) {
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const a = angleTo(e, world.player);
      e.angle = a;
      if (dist(e, world.player) > 60) { e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && dist(e, world.player) < 420) {
        e.fireCooldown = 1.1;
        world.bullets.push({ x: e.x, y: e.y, angle: a + random.range(-0.15, 0.15), speed: 620, fromPlayer: false, life: 1.2 });
        world.audio.shoot();
      }
    }
    world.enemies = world.enemies.filter((e) => e.alive);
  }

  // One fixed step. ctrl: {mx, my, run, aimX, aimY, shoot, enter, fight, interact}
  function step(dt, ctrl) {
    let events = 0;
    world.elapsed += dt;
    const p = world.player;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (world.messageTime > 0) world.messageTime -= dt;
    if (world.flash) {
      world.flashTime = (world.flashTime === undefined ? 4 : world.flashTime) - dt;
      if (world.flashTime <= 0) { world.flash = ''; world.flashTime = undefined; }
    }

    if (ctrl.enter) { if (world.inCar) exitCar(); else enterCar(); }
    if (world.inCar && world.car) {
      const c = world.car;
      const forward = -ctrl.my; // W/up accelerates
      if (forward > 0) c.speed = Math.min(CAR.maxSpeed, c.speed + CAR.accel * dt);
      else if (forward < 0) c.speed = Math.max(-CAR.maxReverse, c.speed - CAR.reverseAccel * dt);
      else c.speed *= Math.pow(0.4, dt);
      if (Math.abs(c.speed) > 20) c.angle += ctrl.mx * CAR.turn * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 240);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (!collidesBuilding(city, nx, ny, 22)) { c.x = nx; c.y = ny; }
      else {
        // Bumping a wall scrubs speed instead of throwing the car into
        // reverse (which made the autopilot oscillate into the same wall).
        c.speed *= 0.5;
        // Damage only once per half-second of scraping a wall, not per frame.
        c.crashCooldown = (c.crashCooldown || 0) - dt;
        if (c.crashCooldown <= 0) { c.health -= 3; c.crashCooldown = 0.5; world.audio.crash(); addEffect(c.x, c.y, 'hit'); }
      }
      const cl = clampWorld(c.x, c.y, 24); c.x = cl.x; c.y = cl.y;
      p.x = c.x; p.y = c.y; p.angle = c.angle;
      world.audio.setEngine(Math.abs(c.speed) / CAR.maxSpeed);
      // Running over a pedestrian is a crime.
      for (const ped of world.peds) {
        if (ped.alive && dist(c, ped) < 30 && Math.abs(c.speed) > 120) {
          ped.alive = false; addWanted(WANTED.hitPed); addEffect(ped.x, ped.y, 'hit'); world.audio.crash();
        }
      }
      if (c.health <= 0) { exitCar(); world.cars.splice(world.cars.indexOf(c), 1); addEffect(c.x, c.y, 'down'); }
    } else {
      world.audio.setEngine(0);
      const speed = ctrl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      if (ctrl.mx || ctrl.my) p.angle = Math.atan2(ctrl.my, ctrl.mx);
      moveWithCollision(p, ctrl.mx * speed * dt, ctrl.my * speed * dt, PLAYER.radius);
      if (ctrl.shoot) shootAt(ctrl.aimX, ctrl.aimY);
      if (ctrl.fight) punch();
    }
    if (ctrl.interact) {
      const near = world.pickups.find((pk) => dist(p, pk) < 60);
      if (near) { world.pickups.splice(world.pickups.indexOf(near), 1); }
    }
    updateTraffic(dt); updatePeds(dt); updateBullets(dt); updateEnemies(dt);
    if (world.wanted > 0) {
      updatePolice(dt);
      // Wanted decays only when no police can see the player.
      const seen = world.police.some((cop) => dist(cop, world.player) < 500);
      if (!seen) world.wanted = Math.max(0, world.wanted - WANTED.decay * dt);
    } else world.police = [];
    // Pickups: spawn cash/health/ammo around the player over time.
    world.pickupTimer -= dt;
    if (world.pickupTimer <= 0) {
      world.pickupTimer = 9;
      const kind = random.pick(['cash', 'cash', 'health', 'ammo']);
      spawnPickup(kind, p.x + random.range(-400, 400), p.y + random.range(-300, 300));
    }
    for (const pk of [...world.pickups]) {
      pk.t += dt;
      if (dist(p, pk) < 40) {
        world.pickups.splice(world.pickups.indexOf(pk), 1);
        if (pk.kind === 'cash') { world.money += 80; world.audio.cash(); events |= EVENT_COIN; }
        else if (pk.kind === 'health') { p.health = Math.min(PLAYER.health, p.health + 40); world.audio.pickup(); }
        else { p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + 12); world.audio.pickup(); }
      }
    }
    for (const fx of world.effects) fx.t += dt;
    world.effects = world.effects.filter((fx) => fx.t < 0.6);
    missions.update(world, dt);
    if (missions.done && !world.storyDone) world.storyDone = true;
    if (p.health <= 0 && !world.over) { world.over = true; events |= EVENT_OVER; }
    if (world.over) events |= EVENT_OVER;
    if (world.busted) events |= EVENT_BUSTED;
    return events;
  }

  // Attach the methods to the live world object itself (never a spread
  // copy: the loop reads money, wanted and health off this same object).
  world.spawnEnemies = spawnEnemies; world.save = save; world.load = load;
  world.reset = reset; world.step = step; world.enterCar = enterCar;
  world.exitCar = exitCar; world.shootAt = shootAt; world.punch = punch;
  world.addWanted = addWanted; world.state = world;
  reset();
  return world;
}
