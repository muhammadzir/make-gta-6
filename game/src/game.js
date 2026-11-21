// Solmar Bay 3D — game logic: player, cars, police, combat, missions,
// crew, districts, rank, side content, HUD and menus. Original code and
// story; nothing from Rockstar/GTA or any commercial game.
(function () {
  'use strict';
  var C = window.SB3;
  var THREE = window.THREE;
  var SAVE_PREFIX = 'solmar-bay-3d.save.';
  var BEST_KEY = 'solmar-bay-3d.best';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function el(tag, cls, parent, text) {
    var e = document.createElement(tag); if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e); return e;
  }

  var CAR_COLORS = ['#c23a3a', '#3a7ac2', '#e8b64c', '#7ac23a', '#8c3ac2', '#e8e8e8', '#2b2b2b', '#c23a9a'];
  var PED_SHIRTS = ['#d95a8c', '#5ad9a0', '#d9c25a', '#7a9cd9', '#e8e8e8', '#e8b23a'];

  function freshState(seed) {
    var standing = {};
    C.DISTRICTS.forEach(function (d) { standing[d.id] = 50; });
    return {
      seed: seed, rng: mulberry32(seed),
      screen: 'title', paused: false, pauseTab: 'MAP',
      time: 0, clockMin: 17 * 60 + 28, // 17:28, sunset
      money: 350, wanted: 0, wantedF: 0,
      health: 100, armor: 0, rp: 0,
      player: { x: 0, z: 120, yaw: 0, vy: 0, y: 0, onGround: true, crouch: false, speed: 0, walkPhase: 0 },
      camYaw: 0, camPitch: 0.32,
      inCar: false, car: null,
      cars: [], traffic: [], peds: [], police: [], enemies: [], bullets: [], pickups: [],
      missionIndex: 0, objectiveIndex: 0, killCount: 0, raceCp: 0, raceTime: 0, raceActive: null,
      raceBest: {}, missionsDone: 0, storyDone: false, goldRatings: 0,
      standing: standing, crew: [], crewAlly: null,
      weapons: { pistol: { owned: true, ammo: 60 }, smg: { owned: false, ammo: 0 }, shotgun: { owned: false, ammo: 0 } },
      weapon: 'pistol', fireCooldown: 0,
      shellsGot: 0, jumpsDone: 0, exportDone: 0, jobsDone: 0, racesWon: 0,
      stats: { earned: 0, spent: 0, carsStolen: 0, copsEvaded: 0, maxWanted: 0, driveDist: 0, kos: 0, longestJump: 0, hiddenByLocals: 0 },
      waypoint: null, message: '', messageT: 0, toast: '', toastT: 0,
      busted: false, wasted: false, airTime: 0, maxAir: 0,
      activeJob: null, exportTarget: null,
      settings: { music: 0.6, sfx: 0.8, sensitivity: 1, quality: 'Medium', shadows: false, hudDensity: 'Full' },
    };
  }

  function createGame(canvas, world3d, audio) {
    var S = freshState(1337);
    var rng = S.rng;

    // ---------- input ----------
    var keys = {};
    var mouse = { dx: 0, dy: 0, down: false, clicked: false };
    var actions = { enter: false, interact: false, assist: false, pause: false, confirm: false, mute: false };
    var keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump', KeyC: 'crouch', KeyF: 'enter', KeyE: 'interact', KeyG: 'assist', KeyH: 'handbrake', KeyM: 'map', KeyP: 'pause', Escape: 'pause', KeyR: 'radio', Digit1: 'w1', Digit2: 'w2', Digit3: 'w3' };
    function onKey(e, down) {
      var k = keyMap[e.code];
      if (k) { keys[k] = down; if (down) e.preventDefault(); }
      if (down && e.code === 'Space') actions.confirm = true;
      if (down && e.code === 'KeyF') actions.enter = true;
      if (down && e.code === 'KeyE') actions.interact = true;
      if (down && e.code === 'KeyG') actions.assist = true;
      if (down && (e.code === 'Escape' || e.code === 'KeyP')) actions.pause = true;
      if (down && e.code === 'KeyM') actions.pause = true;
      if (down && e.code === 'Digit1') setWeapon('pistol');
      if (down && e.code === 'Digit2') setWeapon('smg');
      if (down && e.code === 'Digit3') setWeapon('shotgun');
    }
    window.addEventListener('keydown', function (e) { onKey(e, true); });
    window.addEventListener('keyup', function (e) { onKey(e, false); });
    canvas.addEventListener('mousedown', function (e) { mouse.down = true; mouse.clicked = true; audio.unlock(); });
    window.addEventListener('mouseup', function () { mouse.down = false; });
    canvas.addEventListener('mousemove', function (e) {
      if (mouse.down) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
    });
    canvas.addEventListener('click', function () { audio.unlock(); });

    function setWeapon(id) {
      var w = C.WEAPONS.filter(function (x) { return x.id === id; })[0];
      if (w && S.weapons[id].owned) { S.weapon = id; toast(w.name + ' equipped'); }
    }
    function toast(msg) { S.toast = msg; S.toastT = 3; }
    function message(msg) { S.message = msg; S.messageT = 5; }

    // ---------- save / load ----------
    function saveSlot(n) {
      try {
        window.localStorage.setItem(SAVE_PREFIX + n, JSON.stringify({
          money: S.money, missionIndex: S.missionIndex, health: S.health, armor: S.armor,
          rp: S.rp, x: S.player.x, z: S.player.z, standing: S.standing, crew: S.crew,
          shellsGot: S.shellsGot, jumpsDone: S.jumpsDone, exportDone: S.exportDone,
          jobsDone: S.jobsDone, racesWon: S.racesWon, missionsDone: S.missionsDone,
          storyDone: S.storyDone, stats: S.stats, clockMin: S.clockMin,
          weapons: S.weapons, savedAt: new Date().toISOString(),
        }));
        toast('Saved to slot ' + (n + 1));
      } catch (e) { toast('Save failed — storage off'); }
    }
    function loadSlot(n) {
      try {
        var raw = window.localStorage.getItem(SAVE_PREFIX + n);
        if (!raw) return false;
        var d = JSON.parse(raw);
        S.money = d.money || 0; S.missionIndex = d.missionIndex || 0; S.health = d.health || 100;
        S.armor = d.armor || 0; S.rp = d.rp || 0; S.player.x = d.x || 0; S.player.z = d.z || 120;
        S.standing = d.standing || S.standing; S.crew = d.crew || [];
        S.shellsGot = d.shellsGot || 0; S.jumpsDone = d.jumpsDone || 0; S.exportDone = d.exportDone || 0;
        S.jobsDone = d.jobsDone || 0; S.racesWon = d.racesWon || 0; S.missionsDone = d.missionsDone || 0;
        S.storyDone = !!d.storyDone; S.stats = d.stats || S.stats; S.clockMin = d.clockMin || 1020;
        S.weapons = d.weapons || S.weapons; S.objectiveIndex = 0; S.killCount = 0;
        return true;
      } catch (e) { return false; }
    }
    function hasSave(n) { try { return !!window.localStorage.getItem(SAVE_PREFIX + n); } catch (e) { return false; } }

    // ---------- entities ----------
    function spawnCar(x, z, color, parked) {
      var c = { x: x, z: z, yaw: parked ? 0 : (rng() < 0.5 ? 0 : Math.PI), speed: parked ? 0 : 14 + rng() * 10, color: color || CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], health: 200, police: false, driver: !parked, mesh: null, turnAt: 0, roadAxis: 'x' };
      c.mesh = world3d.makeCarMesh(c.color, false);
      S.cars.push(c); return c;
    }
    function spawnPolice(x, z) {
      var c = { x: x, z: z, yaw: 0, speed: 0, color: '#e8e8e8', health: 200, police: true, driver: false, mesh: null, turnAt: 0 };
      c.mesh = world3d.makeCarMesh('#e8e8e8', true);
      S.police.push(c); return c;
    }
    function spawnPed(x, z) {
      var p = { x: x, z: z, yaw: rng() * Math.PI * 2, speed: 2 + rng() * 2, mesh: null, flee: 0, phase: rng() * 6, shirt: PED_SHIRTS[Math.floor(rng() * PED_SHIRTS.length)] };
      p.mesh = world3d.makePersonMesh(p.shirt, '#2b2f38');
      S.peds.push(p); return p;
    }
    function spawnEnemy(x, z) {
      var e = { x: x, z: z, yaw: 0, health: 60, mesh: null, fireCd: 0.5 + rng(), speed: 6 };
      e.mesh = world3d.makeEnemyMesh();
      S.enemies.push(e); return e;
    }
    function spawnPickup(kind, x, z) {
      var color = kind === 'cash' ? 0x4ac25a : kind === 'health' ? 0xe5534b : 0x4c6be8;
      var m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshBasicMaterial({ color: color }));
      m.position.set(x, 2, z); world3d.scene.add(m);
      S.pickups.push({ kind: kind, x: x, z: z, mesh: m, t: 0 });
    }

    function resetWorld() {
      // remove old meshes
      S.cars.forEach(function (c) { if (c.mesh) world3d.scene.remove(c.mesh); });
      S.police.forEach(function (c) { if (c.mesh) world3d.scene.remove(c.mesh); });
      S.peds.forEach(function (p) { if (p.mesh) world3d.scene.remove(p.mesh); });
      S.enemies.forEach(function (e) { if (e.mesh) world3d.scene.remove(e.mesh); });
      S.pickups.forEach(function (p) { if (p.mesh) world3d.scene.remove(p.mesh); });
      var seed = S.seed;
      S = freshState(seed);
      rng = S.rng;
      // parked cars near the start + around the city
      spawnCar(-300, 150, '#c23a3a', true); spawnCar(-285, 150, '#3a7ac2', true);
      spawnCar(60, -90, '#e8b64c', true); spawnCar(-150, -150, '#7ac23a', true);
      spawnCar(300, 300, '#c23a9a', true); spawnCar(-450, 0, '#e8e8e8', true);
      for (var i = 0; i < 14; i++) {
        var road = C.ROADS[Math.floor(rng() * C.ROADS.length)];
        var along = -450 + rng() * 900;
        var c = spawnCar(rng() < 0.5 ? road : along, rng() < 0.5 ? along : road, null, false);
        c.roadAxis = rng() < 0.5 ? 'x' : 'z';
        c.yaw = c.roadAxis === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
      for (var j = 0; j < 26; j++) spawnPed(-500 + rng() * 1000, -500 + rng() * 1000);
      spawnPickup('cash', 60, 60); spawnPickup('health', -60, 60); spawnPickup('ammo', 120, -120);
      S.player.x = 0; S.player.z = 120; S.player.yaw = Math.PI; S.camYaw = Math.PI;
    }

    // ---------- wanted / standing ----------
    function addWanted(n) {
      S.wantedF = clamp(S.wantedF + n, 0, 5);
      S.wanted = Math.ceil(S.wantedF);
      if (S.wanted > S.stats.maxWanted) S.stats.maxWanted = S.wanted;
      var d = C.districtAt(S.player.x, S.player.z);
      S.standing[d.id] = clamp(S.standing[d.id] - n * 3, 0, 100);
    }
    function districtHeat() {
      var d = C.districtAt(S.player.x, S.player.z);
      return C.standingState(S.standing[d.id]);
    }

    // ---------- combat ----------
    function shoot() {
      var w = C.WEAPONS.filter(function (x) { return x.id === S.weapon; })[0];
      var ammo = S.weapons[S.weapon];
      if (S.fireCooldown > 0 || ammo.ammo <= 0) return;
      S.fireCooldown = w.rate; ammo.ammo -= 1;
      audio.shoot();
      var pellets = w.pellets || 1;
      for (var pi = 0; pi < pellets; pi++) {
        var spread = (rng() - 0.5) * (w.pellets ? 0.22 : 0.05);
        var a = S.player.yaw + spread;
        var dirX = Math.sin(a), dirZ = Math.cos(a);
        var ox = S.player.x, oz = S.player.z;
        // hit the nearest enemy / police / ped roughly in the line of fire
        var best = null, bestD = w.range;
        var targets = S.enemies.map(function (e) { return { x: e.x, z: e.z, kind: 'enemy', ref: e, r: 3 }; })
          .concat(S.police.map(function (c) { return { x: c.x, z: c.z, kind: 'cop', ref: c, r: 5 }; }))
          .concat(S.peds.map(function (p) { return { x: p.x, z: p.z, kind: 'ped', ref: p, r: 2.5 }; }));
        targets.forEach(function (t) {
          var dx = t.x - ox, dz = t.z - oz;
          var along = dx * dirX + dz * dirZ;
          var perp = Math.abs(dx * dirZ - dz * dirX);
          if (along > 0 && along < bestD && perp < t.r + 2) { best = t; bestD = along; }
        });
        if (best) {
          var dmg = w.damage * (S.crew.indexOf('bram') >= 0 ? 1.1 : 1);
          if (best.kind === 'enemy') {
            best.ref.health -= dmg;
            if (best.ref.health <= 0) killEnemy(best.ref);
          } else if (best.kind === 'cop') {
            best.ref.health -= dmg; addWanted(1);
            if (best.ref.health <= 0) { world3d.scene.remove(best.ref.mesh); S.police.splice(S.police.indexOf(best.ref), 1); }
          } else {
            addWanted(2); best.ref.flee = 3; best.ref.yaw = Math.atan2(best.ref.x - ox, best.ref.z - oz);
          }
          S.bullets.push({ x: ox, z: oz, tx: best.x, tz: best.z, t: 0, hit: true });
        } else {
          S.bullets.push({ x: ox, z: oz, tx: ox + dirX * w.range, tz: oz + dirZ * w.range, t: 0, hit: false });
        }
      }
      if (S.wanted < 1) addWanted(1);
    }
    function killEnemy(e) {
      world3d.scene.remove(e.mesh);
      S.enemies.splice(S.enemies.indexOf(e), 1);
      S.killCount += 1; S.stats.kos += 1; S.money += 120; S.stats.earned += 120;
      audio.cash();
    }
    function punch() {
      if (S.fireCooldown > 0) return;
      S.fireCooldown = 0.35; audio.punch();
      S.enemies.slice().forEach(function (e) {
        if (dist2(S.player.x, S.player.z, e.x, e.z) < 6) { e.health -= 20; if (e.health <= 0) killEnemy(e); }
      });
    }
    function hurtPlayer(dmg) {
      if (S.armor > 0) { var absorbed = Math.min(S.armor, dmg * 0.6); S.armor -= absorbed; dmg -= absorbed; }
      S.health -= dmg;
      if (S.health <= 0) { S.health = 0; S.wasted = true; S.screen = 'over'; audio.busted(); }
    }

    // ---------- vehicles ----------
    function nearestCar(maxD) {
      var best = null, bd = maxD;
      S.cars.forEach(function (c) {
        var d = dist2(S.player.x, S.player.z, c.x, c.z);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    }
    function enterCar() {
      var c = nearestCar(9);
      if (!c) { toast('No car close by'); return; }
      if (c.driver) { c.driver = false; addWanted(1); S.stats.carsStolen += 1; toast('Car stolen! The cops saw that.'); audio.crash(); }
      S.inCar = true; S.car = c; S.cars.splice(S.cars.indexOf(c), 1);
    }
    function exitCar() {
      if (!S.inCar || !S.car) return;
      var c = S.car;
      S.player.x = c.x + 5; S.player.z = c.z + 5;
      S.inCar = false; S.car = null; S.cars.push(c);
    }

    // ---------- per-frame update ----------
    function updatePlayer(dt) {
      var p = S.player;
      // camera yaw from mouse drag
      S.camYaw -= mouse.dx * 0.004 * S.settings.sensitivity;
      S.camPitch = clamp(S.camPitch + mouse.dy * 0.003, 0.08, 1.0);
      mouse.dx = 0; mouse.dy = 0;
      var fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      var strafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (S.inCar && S.car) {
        var c = S.car;
        var accel = fwd > 0 ? 26 : fwd < 0 ? -16 : 0;
        var handling = S.crew.indexOf('dario') >= 0 ? 1.15 : 1;
        c.speed = clamp(c.speed + accel * dt * (keys.handbrake ? 0.3 : 1), -14, 34 * handling);
        if (fwd === 0) c.speed *= Math.pow(0.4, dt);
        if (keys.handbrake) c.speed *= Math.pow(0.1, dt);
        if (Math.abs(c.speed) > 0.5) c.yaw += strafe * 1.9 * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 12) * handling;
        var nx = c.x + Math.sin(c.yaw) * c.speed * dt;
        var nz = c.z + Math.cos(c.yaw) * c.speed * dt;
        if (!world3d.collides(nx, nz, 3)) { c.x = nx; c.z = nz; }
        else { c.speed *= 0.4; c.health -= 1; audio.crash(); }
        c.x = clamp(c.x, -580, 580); c.z = clamp(c.z, -580, 580);
        p.x = c.x; p.z = c.z; p.yaw = c.yaw;
        S.stats.driveDist += Math.abs(c.speed) * dt;
        audio.setEngine(Math.abs(c.speed) / 34);
        // run over a pedestrian at speed: a crime
        S.peds.forEach(function (ped) {
          if (dist2(c.x, c.z, ped.x, ped.z) < 4 && Math.abs(c.speed) > 10) {
            ped.flee = 3; ped.yaw = Math.atan2(ped.x - c.x, ped.z - c.z); addWanted(1); audio.crash();
          }
        });
        if (c.health <= 0) { world3d.scene.remove(c.mesh); S.inCar = false; S.car = null; toast('Car wrecked!'); }
        return;
      }
      audio.setEngine(0);
      var speed = keys.run ? 13 : 7;
      if (keys.crouch) speed = 3.5;
      var mx = 0, mz = 0;
      if (fwd || strafe) {
        var sy = Math.sin(S.camYaw), cy = Math.cos(S.camYaw);
        mx = sy * fwd + cy * strafe; mz = cy * fwd - sy * strafe;
        var len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
        p.yaw = Math.atan2(mx, mz);
      }
      var nx2 = p.x + mx * speed * dt, nz2 = p.z + mz * speed * dt;
      if (!world3d.collides(nx2, p.z, 1.2)) p.x = nx2;
      if (!world3d.collides(p.x, nz2, 1.2)) p.z = nz2;
      p.x = clamp(p.x, -580, 580); p.z = clamp(p.z, -580, 580);
      p.speed = (fwd || strafe) ? speed : 0;
      p.walkPhase += dt * (p.speed || 0) * 1.4;
      // jump / gravity
      if (keys.jump && p.onGround) { p.vy = 11; p.onGround = false; }
      if (!p.onGround) {
        p.vy -= 30 * dt; p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
      }
      // stunt jump: driving over a ramp at speed launches the car
      if (S.inCar) { /* handled in car branch */ }
      if (mouse.clicked) { mouse.clicked = false; if (S.screen === 'play') shoot(); }
      else if (mouse.down && S.weapons[S.weapon].owned && C.WEAPONS.filter(function (w) { return w.id === S.weapon; })[0].auto) shoot();
      if (S.fireCooldown > 0) S.fireCooldown -= dt;
    }

    function updateTraffic(dt) {
      S.cars.forEach(function (c) {
        if (c === S.car) return;
        // drive along its road axis; turn at intersections sometimes
        var onRoadX = C.ROADS.some(function (r) { return Math.abs(c.z - r) < 8; });
        var onRoadZ = C.ROADS.some(function (r) { return Math.abs(c.x - r) < 8; });
        if (onRoadX && onRoadZ && rng() < 0.01) {
          c.roadAxis = c.roadAxis === 'x' ? 'z' : 'x';
          c.yaw = c.roadAxis === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        }
        c.x += Math.sin(c.yaw) * c.speed * dt;
        c.z += Math.cos(c.yaw) * c.speed * dt;
        if (c.x < -570 || c.x > 570 || c.z < -570 || c.z > 570) { c.yaw += Math.PI; c.x = clamp(c.x, -570, 570); c.z = clamp(c.z, -570, 570); }
        if (world3d.collides(c.x, c.z, 2)) c.yaw += Math.PI / 2;
      });
    }
    function updatePeds(dt) {
      S.peds.forEach(function (p) {
        p.phase += dt * 5;
        if (p.flee > 0) {
          p.flee -= dt;
          p.x += Math.sin(p.yaw) * 9 * dt; p.z += Math.cos(p.yaw) * 9 * dt;
        } else {
          if (rng() < 0.003) p.yaw = rng() * Math.PI * 2;
          p.x += Math.sin(p.yaw) * p.speed * dt; p.z += Math.cos(p.yaw) * p.speed * dt;
        }
        p.x = clamp(p.x, -570, 570); p.z = clamp(p.z, -570, 570);
        if (world3d.collides(p.x, p.z, 1)) p.yaw += Math.PI / 2;
        if (dist2(p.x, p.z, S.player.x, S.player.z) < 12 && (S.fireCooldown > 0.2 || (S.inCar && S.car && Math.abs(S.car.speed) > 15))) {
          p.flee = 1.5; p.yaw = Math.atan2(p.x - S.player.x, p.z - S.player.z);
        }
      });
    }
    function updatePolice(dt) {
      var want = Math.min(6, Math.ceil(S.wanted));
      while (S.police.length < want) {
        var a = rng() * Math.PI * 2;
        spawnPolice(S.player.x + Math.sin(a) * 90, S.player.z + Math.cos(a) * 90);
      }
      while (S.police.length > want) { var old = S.police.pop(); world3d.scene.remove(old.mesh); }
      S.police.forEach(function (cop) {
        var tx = S.player.x, tz = S.player.z;
        var wantAngle = Math.atan2(tx - cop.x, tz - cop.z);
        cop.yaw += clamp(angDiff(wantAngle, cop.yaw), -2.2 * dt, 2.2 * dt);
        cop.speed = Math.min(30, cop.speed + 18 * dt);
        cop.x += Math.sin(cop.yaw) * cop.speed * dt;
        cop.z += Math.cos(cop.yaw) * cop.speed * dt;
        if (dist2(cop.x, cop.z, tx, tz) < 6) {
          if (S.inCar && S.car) { S.car.health -= 4 * dt; S.car.speed *= 0.98; }
          else hurtPlayer(6 * dt);
          if (S.health <= 0) { S.busted = true; S.screen = 'over'; }
        }
      });
      if (S.police.length && rng() < dt * 0.7) audio.siren();
    }
    function updateEnemies(dt) {
      S.enemies.forEach(function (e) {
        var a = Math.atan2(S.player.x - e.x, S.player.z - e.z);
        e.yaw = a;
        if (dist2(e.x, e.z, S.player.x, S.player.z) > 8) {
          e.x += Math.sin(a) * e.speed * dt; e.z += Math.cos(a) * e.speed * dt;
        }
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist2(e.x, e.z, S.player.x, S.player.z) < 60) {
          e.fireCd = 1.2;
          var hit = rng() < 0.45;
          if (hit) hurtPlayer(8);
          audio.shoot();
        }
      });
      // crew ally (Bram) fights beside the player
      if (S.crewAlly && S.enemies.length) {
        var al = S.crewAlly;
        var tgt = S.enemies[0];
        al.x += Math.sin(Math.atan2(tgt.x - al.x, tgt.z - al.z)) * 8 * dt;
        al.z += Math.cos(Math.atan2(tgt.x - al.x, tgt.z - al.z)) * 8 * dt;
        al.fireCd -= dt;
        if (al.fireCd <= 0 && dist2(al.x, al.z, tgt.x, tgt.z) < 30) {
          al.fireCd = 0.8; tgt.health -= 20;
          if (tgt.health <= 0) killEnemy(tgt);
        }
      }
    }
    function updateBullets(dt) {
      S.bullets.forEach(function (b) { b.t += dt; });
      S.bullets = S.bullets.filter(function (b) { return b.t < 0.25; });
      S.pickups.forEach(function (pk) {
        pk.t += dt;
        if (dist2(S.player.x, S.player.z, pk.x, pk.z) < 4) {
          if (pk.kind === 'cash') { S.money += 80; S.stats.earned += 80; audio.cash(); }
          else if (pk.kind === 'health') { S.health = Math.min(100, S.health + 40); audio.pickup(); }
          else { S.weapons[S.weapon].ammo += 24; audio.pickup(); }
          world3d.scene.remove(pk.mesh);
          S.pickups.splice(S.pickups.indexOf(pk), 1);
        }
      });
    }

    // ---------- missions ----------
    function currentMission() { return C.MISSIONS[S.missionIndex] || null; }
    function currentObjective() {
      var m = currentMission(); if (!m) return null;
      return m.objectives[S.objectiveIndex] || null;
    }
    function objectiveText() {
      var m = currentMission();
      if (!m) return S.storyDone ? 'Story complete — Solmar Bay is yours.' : '';
      var o = currentObjective();
      if (!o) return m.title;
      var label = o.label;
      if (o.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, '(' + S.killCount + '/' + o.count + ')');
      if (o.type === 'race' && S.raceActive) label = 'Race — checkpoint ' + S.raceCp + '/' + S.raceActive.cps.length + ' (' + Math.round(S.raceTime) + 's)';
      return 'M' + (S.missionIndex + 1) + ' · ' + m.title + ' — ' + label;
    }
    function completeObjective() {
      S.objectiveIndex += 1;
      var m = currentMission();
      if (m && S.objectiveIndex >= m.objectives.length) completeMission();
      else audio.pickup();
    }
    function completeMission() {
      var m = currentMission(); if (!m) return;
      var payout = m.payout * (S.crew.indexOf('lena') >= 0 ? 1.15 : 1);
      payout = Math.round(payout);
      S.money += payout; S.stats.earned += payout;
      S.rp += m.rp; S.missionsDone += 1;
      if (S.health > 50) S.goldRatings += 1; // gold rating: finished healthy
      audio.mission(); audio.cash();
      message(m.title + ' complete! +$' + payout + (S.health > 50 ? ' · GOLD' : ''));
      var d = C.districtAt(S.player.x, S.player.z);
      S.standing[d.id] = clamp(S.standing[d.id] + 8, 0, 100);
      // recruit crew after their mission
      C.CREW.forEach(function (c) {
        if (c.afterMission === S.missionIndex + 1 && S.crew.indexOf(c.id) < 0) {
          S.crew.push(c.id); toast(c.name + ' joined your crew! ' + c.ability);
        }
      });
      S.missionIndex += 1; S.objectiveIndex = 0; S.killCount = 0;
      if (S.missionIndex >= C.MISSIONS.length) {
        S.storyDone = true; S.screen = 'win';
        try { window.localStorage.setItem(BEST_KEY, String(Math.max(S.money, Number(window.localStorage.getItem(BEST_KEY) || 0)))); } catch (e) {}
      }
      saveProgress();
    }
    function saveProgress() {
      try {
        window.localStorage.setItem(SAVE_PREFIX + 'auto', JSON.stringify({
          money: S.money, missionIndex: S.missionIndex, health: S.health, armor: S.armor,
          rp: S.rp, x: S.player.x, z: S.player.z, standing: S.standing, crew: S.crew,
          shellsGot: S.shellsGot, jumpsDone: S.jumpsDone, exportDone: S.exportDone,
          jobsDone: S.jobsDone, racesWon: S.racesWon, missionsDone: S.missionsDone,
          storyDone: S.storyDone, stats: S.stats, clockMin: S.clockMin, weapons: S.weapons,
        }));
      } catch (e) {}
    }
    function updateMissions(dt) {
      var m = currentMission(); if (!m) return;
      var o = currentObjective(); if (!o) return;
      var p = S.player;
      if (o.type === 'goto') {
        if (dist2(p.x, p.z, o.x, o.z) < 10 && (!o.needCar || S.inCar)) completeObjective();
      } else if (o.type === 'talk') {
        if (dist2(p.x, p.z, o.x, o.z) < 10 && actions.interact) { actions.interact = false; completeObjective(); }
      } else if (o.type === 'kill') {
        if (S.killCount === 0 && S.enemies.length === 0) {
          for (var i = 0; i < o.count; i++) spawnEnemy(o.x + (rng() * 30 - 15), o.z + (rng() * 30 - 15));
        }
        if (S.killCount >= o.count) completeObjective();
      } else if (o.type === 'escape') {
        if (S.wanted <= 0) completeObjective();
      } else if (o.type === 'race') {
        if (!S.raceActive) {
          S.raceActive = C.RACES[0]; S.raceCp = 0; S.raceTime = 0;
          message('Race started — hit the blue rings in order!');
        }
        S.raceTime += dt;
        var cp = S.raceActive.cps[S.raceCp];
        if (cp && dist2(p.x, p.z, cp[0], cp[1]) < 12) {
          S.raceCp += 1; audio.pickup();
          if (S.raceCp >= S.raceActive.cps.length) {
            var prize = S.raceActive.prize;
            S.money += prize; S.stats.earned += prize; S.racesWon += 1; S.rp += 60;
            S.raceBest[S.raceActive.id] = Math.round(S.raceTime);
            message('Race won in ' + Math.round(S.raceTime) + 's! +$' + prize);
            S.raceActive = null; completeObjective();
          }
        }
        if (S.raceTime > 180) { S.raceActive = null; message('Race failed — too slow. Try again.'); S.objectiveIndex = Math.max(0, S.objectiveIndex); }
      }
      // mission 5 vault: cracking it raises the heat
      if (m.id === 'm5' && S.objectiveIndex === 1 && o.type === 'talk') { /* wanted added on completion below */ }
      if (m.id === 'm5' && S.objectiveIndex === 2 && S.wanted < 3) addWanted(0.5 * dt);
    }

    // ---------- side content ----------
    function startRace(id) {
      var r = C.RACES.filter(function (x) { return x.id === id; })[0]; if (!r) return;
      if (!S.inCar) { toast('You need a car to race'); return; }
      S.raceActive = r; S.raceCp = 0; S.raceTime = 0;
      message('Race: ' + r.name + ' — hit the blue rings!');
    }
    function startJob() {
      if (S.activeJob) return;
      var d = C.districtAt(S.player.x, S.player.z);
      var tx = -450 + rng() * 900, tz = -450 + rng() * 900;
      S.activeJob = { district: d.name, x: tx, z: tz, pay: 300 };
      message('District job: deliver to ' + d.name + ' — follow the waypoint (+$300)');
    }
    function updateSide(dt) {
      // golden shells
      world3d.shells.forEach(function (sh, i) {
        if (sh.taken) return;
        sh.mesh.position.y = 3 + Math.sin(S.time * 2 + sh.phase) * 0.8;
        if (dist2(S.player.x, S.player.z, sh.x, sh.z) < 5) {
          sh.taken = true; sh.mesh.visible = false;
          S.shellsGot += 1; S.money += 50; S.stats.earned += 50; S.rp += 10; audio.pickup();
          toast('Golden Shell ' + S.shellsGot + '/20  +$50');
        }
      });
      // district job delivery
      if (S.activeJob && dist2(S.player.x, S.player.z, S.activeJob.x, S.activeJob.z) < 10) {
        S.money += S.activeJob.pay; S.stats.earned += S.activeJob.pay;
        S.jobsDone += 1; S.rp += 40;
        var d = C.districtAt(S.player.x, S.player.z);
        S.standing[d.id] = clamp(S.standing[d.id] + 5, 0, 100);
        message('Job done! +$' + S.activeJob.pay); S.activeJob = null; saveProgress();
      }
      // export car delivery at the boatyard
      if (S.inCar && S.car) {
        var ex = C.EXPORT_CARS.filter(function (e) { return !e.done && e.color === S.car.color; })[0];
        if (ex && dist2(S.player.x, S.player.z, -380, 380) < 12) {
          ex.done = true; S.exportDone += 1; S.money += 1500; S.stats.earned += 1500; S.rp += 80;
          world3d.scene.remove(S.car.mesh); S.inCar = false; S.car = null;
          message('Export delivered: ' + ex.name + '! +$1,500'); audio.cash();
        }
      }
      // stunt jumps: airborne in a car over a ramp
      if (S.inCar && S.car) {
        var onRamp = C.JUMPS.some(function (j) { return dist2(S.player.x, S.player.z, j.x, j.z) < 10; });
        if (onRamp && Math.abs(S.car.speed) > 18) {
          S.airTime += dt;
          if (S.airTime > 0.6) {
            S.jumpsDone += 1; S.rp += 30; S.money += 100;
            S.stats.longestJump = Math.max(S.stats.longestJump, Math.round(S.airTime * Math.abs(S.car.speed)));
            message('Stunt jump! +$100'); audio.jump(); S.airTime = 0;
          }
        } else S.airTime = 0;
      }
      // shops: press E near a shop
      if (actions.interact) {
        actions.interact = false;
        var shop = null;
        C.SHOPS.forEach(function (s) { if (dist2(S.player.x, S.player.z, s.x, s.z) < 14) shop = s; });
        if (shop) useShop(shop);
      }
    }
    function useShop(shop) {
      if (shop.kind === 'weapons') {
        if (!S.weapons.smg.owned && S.money >= 1200) { S.money -= 1200; S.stats.spent += 1200; S.weapons.smg.owned = true; S.weapons.smg.ammo = 180; toast('Bought SMG! Press 2 to equip.'); }
        else if (!S.weapons.shotgun.owned && S.money >= 2000) { S.money -= 2000; S.stats.spent += 2000; S.weapons.shotgun.owned = true; S.weapons.shotgun.ammo = 40; toast('Bought Shotgun! Press 3 to equip.'); }
        else if (S.weapons.smg.owned && S.weapons.shotgun.owned) { S.weapons[S.weapon].ammo += 60; S.money = Math.max(0, S.money - 200); toast('Ammo restocked (+60).'); }
        else toast(shop.blurb);
      } else if (shop.kind === 'respray') {
        if (S.inCar && S.car && S.money >= 300) {
          S.money -= 300; S.stats.spent += 300;
          var col = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
          S.car.color = col; S.car.mesh.userData.body.material.color.set(col);
          toast('Resprayed ' + col);
        } else toast(shop.blurb);
      } else if (shop.kind === 'garage') {
        S.health = 100; S.armor = 50; toast('Safehouse: healed, armor up.');
      } else if (shop.kind === 'export') {
        startRace(C.RACES[Math.floor(rng() * C.RACES.length)].id);
      } else {
        startJob();
      }
    }
    function crewAssist() {
      if (S.crew.indexOf('dario') >= 0 && !S.inCar) {
        var c = spawnCar(S.player.x + 8, S.player.z + 8, '#e8b64c', true);
        c.driver = false; toast('Dario dropped a car beside you.');
      } else if (S.crew.indexOf('lena') >= 0) {
        S.health = Math.min(100, S.health + 40); toast('Lena patched you up (+40 health).');
      } else if (S.crew.indexOf('bram') >= 0) {
        if (!S.crewAlly) {
          var al = { x: S.player.x + 4, z: S.player.z + 4, fireCd: 0, mesh: world3d.makePersonMesh('#2b4a8c', '#2b2b2b') };
          S.crewAlly = al; toast('Bram is fighting beside you.');
        }
      } else toast('No crew recruited yet — finish missions to recruit Lena, Dario and Bram.');
    }

    // ---------- wanted decay, clock, waypoint ----------
    function updateMeta(dt) {
      S.time += dt;
      S.clockMin += dt * 0.6; // 1 real second ~ 0.6 game minutes
      if (S.clockMin >= 1440) S.clockMin -= 1440;
      if (S.messageT > 0) S.messageT -= dt;
      if (S.toastT > 0) S.toastT -= dt;
      if (S.wanted > 0) {
        var seen = S.police.some(function (cop) { return dist2(cop.x, cop.z, S.player.x, S.player.z) < 90; });
        var d = C.districtAt(S.player.x, S.player.z);
        var friendly = S.standing[d.id] >= 70;
        if (!seen) {
          S.wantedF = Math.max(0, S.wantedF - dt * (friendly ? 0.06 : 0.025));
          var nw = Math.ceil(S.wantedF);
          if (nw < S.wanted) { S.stats.copsEvaded += 1; if (friendly) S.stats.hiddenByLocals += 1; }
          S.wanted = nw;
        }
      }
      // waypoint: mission objective, else race checkpoint, else job, else manual
      var o = currentObjective();
      if (o && o.x !== undefined) S.waypoint = { x: o.x, z: o.z };
      else if (S.raceActive) { var cp = S.raceActive.cps[S.raceCp]; if (cp) S.waypoint = { x: cp[0], z: cp[1] }; }
      else if (S.activeJob) S.waypoint = { x: S.activeJob.x, z: S.activeJob.z };
    }

    // ---------- 3D sync + camera ----------
    var playerMesh = null, allyMesh = null;
    function syncMeshes(dt) {
      var p = S.player;
      if (!playerMesh) playerMesh = world3d.makePersonMesh('#e8b23a', '#2f6fb2');
      playerMesh.visible = !S.inCar;
      playerMesh.position.set(p.x, p.y, p.z);
      playerMesh.rotation.y = p.yaw;
      var swing = Math.sin(p.walkPhase) * 0.5;
      playerMesh.userData.armL.rotation.x = swing;
      playerMesh.userData.armR.rotation.x = -swing;
      if (p.crouch || keys.crouch) playerMesh.scale.y = 0.8; else playerMesh.scale.y = 1;
      S.cars.forEach(function (c) {
        c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.yaw;
      });
      if (S.inCar && S.car) { S.car.mesh.position.set(S.car.x, 0, S.car.z); S.car.mesh.rotation.y = S.car.yaw; }
      S.police.forEach(function (cop, i) {
        cop.mesh.position.set(cop.x, 0, cop.z); cop.mesh.rotation.y = cop.yaw;
        if (cop.mesh.userData.lightBar) {
          var on = Math.floor(S.time * 6 + i) % 2 === 0;
          cop.mesh.userData.lightBar[0].material.color.set(on ? 0xff2222 : 0x551111);
          cop.mesh.userData.lightBar[1].material.color.set(on ? 0x111155 : 0x2244ff);
        }
      });
      S.peds.forEach(function (ped) {
        ped.mesh.position.set(ped.x, 0, ped.z); ped.mesh.rotation.y = ped.yaw;
        ped.mesh.userData.armL.rotation.x = Math.sin(ped.phase) * 0.4;
        ped.mesh.userData.armR.rotation.x = -Math.sin(ped.phase) * 0.4;
      });
      S.enemies.forEach(function (e) {
        e.mesh.position.set(e.x, 0, e.z); e.mesh.rotation.y = e.yaw;
      });
      if (S.crewAlly) {
        if (!allyMesh) allyMesh = S.crewAlly.mesh;
        allyMesh.position.set(S.crewAlly.x, 0, S.crewAlly.z);
      }
      // waypoint beacon
      if (S.waypoint) {
        world3d.beacon.visible = true; world3d.ring.visible = true;
        world3d.beacon.position.set(S.waypoint.x, 45, S.waypoint.z);
        world3d.ring.position.set(S.waypoint.x, 0.3, S.waypoint.z);
        world3d.ring.scale.setScalar(1 + Math.sin(S.time * 3) * 0.15);
      } else { world3d.beacon.visible = false; world3d.ring.visible = false; }
      // race checkpoints
      world3d.checkpoints.forEach(function (cp, i) {
        if (S.raceActive && i === S.raceCp) {
          cp.visible = true;
          var c = S.raceActive.cps[i];
          cp.position.set(c[0], 5, c[1]);
          cp.rotation.y += dt;
        } else cp.visible = false;
      });
      // camera: third-person follow
      var cam = world3d.camera;
      var dist = S.inCar ? 13 : 10;
      var cx = S.player.x - Math.sin(S.camYaw) * dist * Math.cos(S.camPitch);
      var cz = S.player.z - Math.cos(S.camYaw) * dist * Math.cos(S.camPitch);
      var cy = (S.inCar ? 4 : 3.4) + Math.sin(S.camPitch) * dist * 0.55;
      cam.position.set(cx, cy, cz);
      cam.lookAt(S.player.x + Math.sin(S.camYaw) * 6, 2.5, S.player.z + Math.cos(S.camYaw) * 6);
      // sunset smoke drift
      world3d.smoke.position.y = 230 + Math.sin(S.time * 0.5) * 6;
      world3d.smoke.position.x = 460 + Math.sin(S.time * 0.3) * 10;
    }

    // ---------- HUD + menus (DOM) ----------
    var hud = {}, titleEl = null, pauseEl = null, overEl = null, winEl = null, mapCanvas = null, miniCanvas = null;
    function buildDOM() {
      var root = document.getElementById('ui');
      hud.root = el('div', 'hud', root);
      hud.money = el('div', 'hud-money', hud.root, '$350');
      hud.bars = el('div', 'hud-bars', hud.root);
      hud.healthBar = el('div', 'bar health', hud.bars); hud.healthFill = el('div', 'fill', hud.healthBar);
      hud.armorBar = el('div', 'bar armor', hud.bars); hud.armorFill = el('div', 'fill', hud.armorBar);
      hud.stars = el('div', 'hud-stars', hud.root, '☆☆☆☆☆');
      hud.district = el('div', 'hud-district', hud.root, 'Downtown · 17:28');
      hud.objective = el('div', 'hud-objective', hud.root, '');
      hud.speed = el('div', 'hud-speed', hud.root, '');
      hud.hint = el('div', 'hud-hint', hud.root, 'WASD move · Shift run · Space jump · F enter car · E interact · G crew · Esc pause');
      hud.toast = el('div', 'hud-toast', hud.root, '');
      hud.message = el('div', 'hud-message', hud.root, '');
      hud.cross = el('div', 'crosshair', hud.root, '+');
      miniCanvas = el('canvas', 'minimap', hud.root);
      miniCanvas.width = 180; miniCanvas.height = 180;

      titleEl = el('div', 'screen title', root);
      el('h1', '', titleEl, 'SOLMAR BAY');
      el('p', 'tag', titleEl, 'A 3D open-world crime story on a volcanic island · 3D LOW-POLY · OPEN WORLD · STORY MISSIONS · CREW SYSTEM');
      var btns = el('div', 'btns', titleEl);
      var bNew = el('button', '', btns, 'NEW GAME');
      bNew.onclick = function () { startGame(false); };
      var bCont = el('button', '', btns, 'CONTINUE');
      bCont.onclick = function () { if (loadSlot(0) || hasSave(0)) startGame(true); else toast('No save in slot 1 yet'); };
      var bHow = el('button', '', btns, 'HOW TO PLAY');
      bHow.onclick = function () { showHow(); };
      el('p', 'foot', titleEl, 'v2.0 · MADE WITH MAKE.FUN · Rico Vale owes the harbour crew $40,000.');
      hud.titleButtons = { bNew: bNew, bCont: bCont };

      pauseEl = el('div', 'screen pause hidden', root);
      el('h1', '', pauseEl, 'PAUSED');
      var tabs = el('div', 'tabs', pauseEl);
      ['MAP', 'STORY', 'STATS', 'CREW', 'SETTINGS', 'CONTROLS', 'SAVE'].forEach(function (t) {
        var b = el('button', 'tab', tabs, t);
        b.onclick = function () { S.pauseTab = t; renderPause(); };
      });
      hud.pauseBody = el('div', 'pause-body', pauseEl);
      var resume = el('button', '', pauseEl, 'RESUME');
      resume.onclick = function () { togglePause(false); };

      overEl = el('div', 'screen over hidden', root);
      el('h1', '', overEl, 'BUSTED');
      el('p', '', overEl, 'The Solmar Bay PD caught you. The crew still expects its money.');
      var bRetry = el('button', '', overEl, 'TRY AGAIN');
      bRetry.onclick = function () { respawn(); };

      winEl = el('div', 'screen win hidden', root);
      el('h1', '', winEl, 'THE SOLMAR ACCORD');
      hud.winText = el('p', '', winEl, '');
      var bAgain = el('button', '', winEl, 'KEEP PLAYING');
      bAgain.onclick = function () { S.screen = 'play'; winEl.classList.add('hidden'); };
    }
    function showHow() {
      alert('WASD move · Mouse drag to look · Shift run · Space jump · C crouch · F enter/exit car · H handbrake · Click shoot · 1/2/3 weapons · E interact/talk · G crew assist · M map · Esc pause.\n\nFinish 6 story missions, win races, collect 20 Golden Shells, and raise district standing to win Solmar Bay.');
    }
    function fmtClock() {
      var h = Math.floor(S.clockMin / 60), m = Math.floor(S.clockMin % 60);
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
    function updateHUD() {
      var d = C.districtAt(S.player.x, S.player.z);
      hud.money.textContent = '$' + S.money;
      hud.healthFill.style.width = S.health + '%';
      hud.armorFill.style.width = S.armor + '%';
      hud.armorBar.style.display = S.armor > 0 ? 'block' : 'none';
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
      hud.stars.textContent = stars;
      hud.district.textContent = d.name + ' · ' + fmtClock() + ' · ' + C.standingState(S.standing[d.id]) + ' ' + S.standing[d.id];
      hud.objective.textContent = objectiveText();
      hud.speed.textContent = S.inCar && S.car ? Math.round(Math.abs(S.car.speed) * 3.6) + ' km/h' : '';
      hud.toast.textContent = S.toastT > 0 ? S.toast : '';
      hud.message.textContent = S.messageT > 0 ? S.message : '';
      hud.cross.style.display = S.inCar ? 'none' : 'block';
      hud.root.style.display = S.screen === 'play' ? 'block' : 'none';
      if (S.settings.hudDensity === 'Compact') hud.hint.style.display = 'none'; else hud.hint.style.display = 'block';
      drawMinimap();
    }
    function drawMinimap() {
      var g = miniCanvas.getContext('2d');
      var W = 180, scale = W / 1200;
      g.clearRect(0, 0, W, W);
      g.save();
      g.beginPath(); g.arc(90, 90, 88, 0, Math.PI * 2); g.clip();
      g.fillStyle = 'rgba(20, 30, 44, 0.85)'; g.fillRect(0, 0, W, W);
      // districts
      C.DISTRICTS.forEach(function (dd) {
        g.fillStyle = dd.color + '33';
        g.fillRect((dd.cx - dd.hw) * scale + 90, (dd.cz - dd.hd) * scale + 90, dd.hw * 2 * scale, dd.hd * 2 * scale);
      });
      // roads
      g.strokeStyle = '#5a6068'; g.lineWidth = 2;
      C.ROADS.forEach(function (r) {
        g.beginPath(); g.moveTo(0, r * scale + 90); g.lineTo(W, r * scale + 90); g.stroke();
        g.beginPath(); g.moveTo(r * scale + 90, 0); g.lineTo(r * scale + 90, W); g.stroke();
      });
      function dot(x, z, color, r) { g.fillStyle = color; g.beginPath(); g.arc(x * scale + 90, z * scale + 90, r, 0, Math.PI * 2); g.fill(); }
      if (S.waypoint) dot(S.waypoint.x, S.waypoint.z, '#ffcf3a', 5);
      S.police.forEach(function (c) { dot(c.x, c.z, '#ff4444', 3); });
      S.enemies.forEach(function (e) { dot(e.x, e.z, '#ff8844', 3); });
      // player arrow
      g.save();
      g.translate(S.player.x * scale + 90, S.player.z * scale + 90);
      g.rotate(S.player.yaw);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
      g.restore();
      g.restore();
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(90, 90, 88, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 13px system-ui'; g.fillText('N', 86, 16);
    }
    function renderPause() {
      var b = hud.pauseBody; b.innerHTML = '';
      var t = S.pauseTab;
      if (t === 'MAP') {
        el('p', '', b, 'Click the map to set a waypoint. Districts show standing (0–100).');
        mapCanvas = el('canvas', 'bigmap', b); mapCanvas.width = 460; mapCanvas.height = 460;
        var g = mapCanvas.getContext('2d');
        var sc = 460 / 1200;
        g.fillStyle = '#16202e'; g.fillRect(0, 0, 460, 460);
        C.DISTRICTS.forEach(function (dd) {
          g.fillStyle = dd.color + '44'; g.fillRect((dd.cx - dd.hw) * sc + 230, (dd.cz - dd.hd) * sc + 230, dd.hw * 2 * sc, dd.hd * 2 * sc);
          g.fillStyle = '#fff'; g.font = 'bold 11px system-ui'; g.textAlign = 'center';
          g.fillText(dd.name, dd.cx * sc + 230, dd.cz * sc + 226);
          g.font = '11px system-ui';
          g.fillText(S.standing[dd.id] + ' ' + C.standingState(S.standing[dd.id]), dd.cx * sc + 230, dd.cz * sc + 240);
          g.textAlign = 'left';
        });
        g.strokeStyle = '#5a6068';
        C.ROADS.forEach(function (r) {
          g.beginPath(); g.moveTo(0, r * sc + 230); g.lineTo(460, r * sc + 230); g.stroke();
          g.beginPath(); g.moveTo(r * sc + 230, 0); g.lineTo(r * sc + 230, 460); g.stroke();
        });
        C.SHOPS.forEach(function (s) { g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(s.x * sc + 230, s.z * sc + 230, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillText(s.name, s.x * sc + 238, s.z * sc + 234); });
        g.fillStyle = '#fff'; g.beginPath(); g.arc(S.player.x * sc + 230, S.player.z * sc + 230, 6, 0, Math.PI * 2); g.fill();
        mapCanvas.onclick = function (ev) {
          var rect = mapCanvas.getBoundingClientRect();
          var x = ((ev.clientX - rect.left) / rect.width) * 1200 - 600;
          var z = ((ev.clientY - rect.top) / rect.height) * 1200 - 600;
          S.waypoint = { x: x, z: z }; toast('Waypoint set');
        };
      } else if (t === 'STORY') {
        C.MISSIONS.forEach(function (m, i) {
          var done = i < S.missionIndex, cur = i === S.missionIndex;
          el('p', '', b, (done ? '✓ ' : cur ? '▶ ' : '· ') + 'Act ' + m.act + ' · ' + m.title + ' — ' + m.giver + ' · $' + m.payout + (done ? ' (done)' : ''));
          el('p', 'dim', b, '    ' + m.brief);
        });
        el('p', '', b, 'Characters: Rico Vale, Lena, Vera, Dario, Bram, Nico, Tessa, Omar · Crew ' + S.crew.length + '/3 · Missions ' + S.missionsDone + '/6');
      } else if (t === 'STATS') {
        var r = C.rankFor(S.rp);
        el('p', '', b, 'Rank: ' + r.rank.name + ' · ' + S.rp + ' RP' + (r.next ? ' (next: ' + r.next.name + ' at ' + r.next.rp + ')' : ' (max)'));
        var done = Math.round((S.missionsDone / 6 * 40) + (S.racesWon / 4 * 15) + (S.shellsGot / 20 * 15) + (S.exportDone / 5 * 10) + (S.jumpsDone / 8 * 10) + (S.jobsDone / 7 * 10));
        el('p', '', b, 'Completion: ' + Math.min(100, done) + '% · Missions ' + S.missionsDone + '/6 · Races ' + S.racesWon + '/4 · Jumps ' + S.jumpsDone + '/8 · Shells ' + S.shellsGot + '/20 · Export ' + S.exportDone + '/5 · Jobs ' + S.jobsDone + '/7 · Gold ' + S.goldRatings + '/6');
        el('p', '', b, 'Money earned $' + S.stats.earned + ' · spent $' + S.stats.spent + ' · cars stolen ' + S.stats.carsStolen + ' · cops evaded ' + S.stats.copsEvaded + ' · max wanted ' + S.stats.maxWanted + '★ · driven ' + Math.round(S.stats.driveDist) + 'm · KOs ' + S.stats.kos + ' · longest jump ' + S.stats.longestJump + 'm · hidden by locals ' + S.stats.hiddenByLocals);
      } else if (t === 'CREW') {
        C.CREW.forEach(function (c) {
          var joined = S.crew.indexOf(c.id) >= 0;
          el('p', '', b, c.name + ' — ' + c.role + ' · Loyalty ' + c.loyalty + (joined ? ' · RECRUITED' : ' · joins after mission ' + c.afterMission));
          el('p', 'dim', b, '    ' + c.ability + ' — ' + c.desc);
        });
        el('p', '', b, 'Crew assist: press G. Dario calls a car, Lena heals, Bram fights beside you.');
      } else if (t === 'SETTINGS') {
        var st = S.settings;
        function slider(label, min, max, step, val, fn) {
          var row = el('div', '', b);
          el('span', '', row, label + ' ');
          var inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
          inp.oninput = function () { fn(Number(inp.value)); };
          row.appendChild(inp);
        }
        slider('Music volume', 0, 1, 0.1, st.music, function (v) { st.music = v; audio.setMusicVol(v); });
        slider('SFX volume', 0, 1, 0.1, st.sfx, function (v) { st.sfx = v; audio.setSfxVol(v); });
        slider('Mouse sensitivity', 0.3, 2.5, 0.1, st.sensitivity, function (v) { st.sensitivity = v; });
        var q = el('div', '', b); el('span', '', q, 'Quality ');
        ['Low', 'Medium', 'High'].forEach(function (qq) {
          var qb = el('button', '', q, qq); qb.onclick = function () { st.quality = qq; world3d.setQuality(qq); };
        });
        var hd = el('div', '', b); el('span', '', hd, 'HUD density ');
        ['Full', 'Compact'].forEach(function (qq) {
          var hb = el('button', '', hd, qq); hb.onclick = function () { st.hudDensity = qq; };
        });
      } else if (t === 'CONTROLS') {
        el('p', '', b, 'WASD move · Mouse drag look · Shift run · Space jump · C crouch · F enter/exit car · H handbrake · Click shoot · 1/2/3 weapons · E interact/talk · G crew assist · R radio · M map · Esc pause');
      } else if (t === 'SAVE') {
        for (var i = 0; i < 3; i++) {
          (function (n) {
            var row = el('div', '', b);
            el('span', '', row, 'Slot ' + (n + 1) + (hasSave(n) ? ' (has save)' : ' (empty)') + ' ');
            var sb = el('button', '', row, 'SAVE'); sb.onclick = function () { saveSlot(n); renderPause(); };
            var lb = el('button', '', row, 'LOAD'); lb.onclick = function () { if (loadSlot(n)) { S.screen = 'play'; togglePause(false); } };
          })(i);
        }
      }
    }
    function togglePause(on) {
      S.paused = on;
      pauseEl.classList.toggle('hidden', !on);
      if (on) renderPause();
    }
    function respawn() {
      S.health = 100; S.armor = 0; S.wanted = 0; S.wantedF = 0; S.police = [];
      S.player.x = 0; S.player.z = 120; S.busted = false; S.wasted = false;
      S.screen = 'play'; overEl.classList.add('hidden');
    }
    function startGame(fromSave) {
      if (!fromSave) { resetWorld(); }
      S.screen = 'play'; S.paused = false;
      titleEl.classList.add('hidden'); overEl.classList.add('hidden'); winEl.classList.add('hidden'); pauseEl.classList.add('hidden');
      audio.unlock(); audio.startMusic();
      message('Mission: ' + (currentMission() ? currentMission().title : 'Free roam') + ' — ' + (currentObjective() ? currentObjective().label : ''));
    }

    // ---------- main loop ----------
    var last = 0, acc = 0;
    var STEP = 1 / 60;
    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.25, (now - last) / 1000 || 0.016);
      last = now;
      if (actions.pause) {
        actions.pause = false;
        if (S.screen === 'play') togglePause(!S.paused);
        else if (S.screen === 'title') { /* ignore */ }
      }
      if (actions.assist) { actions.assist = false; if (S.screen === 'play' && !S.paused) crewAssist(); }
      if (actions.enter) { actions.enter = false; if (S.screen === 'play' && !S.paused) { if (S.inCar) exitCar(); else enterCar(); } }
      if (S.screen === 'title') {
        // orbit the camera over the sunset city behind the title
        hud.root.style.display = 'none';
        var t = now / 1000;
        world3d.camera.position.set(Math.sin(t * 0.05) * 320, 90, Math.cos(t * 0.05) * 320);
        world3d.camera.lookAt(0, 20, 0);
        world3d.renderer.render(world3d.scene, world3d.camera);
        return;
      }
      if (S.screen === 'play' && !S.paused) {
        acc += dt;
        while (acc >= STEP) {
          updatePlayer(STEP); updateTraffic(STEP); updatePeds(STEP);
          updatePolice(STEP); updateEnemies(STEP); updateBullets(STEP);
          updateMissions(STEP); updateSide(STEP); updateMeta(STEP);
          acc -= STEP;
        }
        syncMeshes(dt);
        updateHUD();
        world3d.renderer.render(world3d.scene, world3d.camera);
      } else if (S.screen === 'over') {
        overEl.classList.remove('hidden');
        overEl.querySelector('h1').textContent = S.busted ? 'BUSTED' : 'WASTED';
        world3d.renderer.render(world3d.scene, world3d.camera);
      } else if (S.screen === 'win') {
        winEl.classList.remove('hidden');
        hud.winText.textContent = 'All 6 missions done. Rico cleared the $40,000 debt — Solmar Bay is his. Money: $' + S.money + ' · Gold ratings: ' + S.goldRatings + '/6 · Rank: ' + C.rankFor(S.rp).rank.name;
        world3d.renderer.render(world3d.scene, world3d.camera);
      } else if (S.paused) {
        world3d.renderer.render(world3d.scene, world3d.camera);
      }
    }

    // ---------- debug / test API (used by the screenshot autopilot) ----------
    var api = {
      get state() { return S; }, start: startGame, reset: resetWorld, saveSlot: saveSlot, loadSlot: loadSlot,
      teleport: function (x, z) { S.player.x = x; S.player.z = z; S.camYaw = Math.atan2(x, z); },
      giveCar: function (color) { var c = spawnCar(S.player.x, S.player.z + 8, color || '#c23a3a', true); c.driver = false; return c; },
      enterCar: enterCar, setWanted: function (n) { S.wantedF = n; S.wanted = n; },
      setMoney: function (n) { S.money = n; },
      completeAllMissions: function () { while (S.missionIndex < C.MISSIONS.length) completeMission(); },
      completeMission: completeMission,
      setMission: function (i) { S.missionIndex = i; S.objectiveIndex = 0; S.killCount = 0; },
      startRace: startRace, spawnEnemy: spawnEnemy, hurt: hurtPlayer,
    };

    buildDOM();
    resetWorld();
    window.addEventListener('resize', function () { world3d.resize(); });
    requestAnimationFrame(function (n) { last = n; requestAnimationFrame(frame); });

    return api;
  }

  window.SB3Game = { create: createGame };
})();
