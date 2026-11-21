// Solmar Bay 3D — the Three.js world. Builds the low-poly island city
// (roads, named buildings and shops, palms, beach, sea, volcano), the
// meshes for people and cars, and the collision boxes. All original art:
// boxes, cones and canvas-texture signs made in code, no loaded models.
(function () {
  'use strict';
  var C = window.SB3;
  var THREE = window.THREE;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function textTexture(text, bg, fg, w, h) {
    var cv = document.createElement('canvas'); cv.width = w || 256; cv.height = h || 64;
    var g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = fg; g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, cv.width / 2, cv.height / 2 + 2);
    var tx = new THREE.CanvasTexture(cv); tx.anisotropy = 4; return tx;
  }
  function box(w, h, d, color, x, y, z, opts) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x, y, z);
    if (opts) { if (opts.ry) m.rotation.y = opts.ry; if (opts.rx) m.rotation.x = opts.rx; }
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function createWorld3D(canvas, quality) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'High' ? 2 : 1.25));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = quality !== 'Low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xff9e5e); // sunset sky
    scene.fog = new THREE.Fog(0xff9e5e, 260, 900);
    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

    // Sunset lighting: warm sun low in the west, soft sky fill.
    var sun = new THREE.DirectionalLight(0xffb36b, 1.15);
    sun.position.set(-300, 180, 120); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -650; sun.shadow.camera.right = 650;
    sun.shadow.camera.top = 650; sun.shadow.camera.bottom = -650;
    sun.shadow.camera.far = 1200;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffd9a0, 0x3a5a7a, 0.75));
    var sunBall = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
    sunBall.position.set(-520, 120, 260); scene.add(sunBall);

    var rng = mulberry32(1337);
    var colliders = []; // {x, z, hw, hd}
    var buildingColors = ['#7a5a8c', '#8c6a4a', '#4a7a8c', '#9c7a5a', '#5a6b8c', '#b08a4a', '#6b8c5a', '#8c4a5a'];
    var roofColors = ['#3a2f4a', '#4a3a2f', '#2f4a3a', '#5a4a2f'];

    // Ground: grass island, sand beach ring on the south, sea beyond.
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshLambertMaterial({ color: 0x4a8c4a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(1400, 130),
      new THREE.MeshLambertMaterial({ color: 0xd9c27a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 560); sand.receiveShadow = true; scene.add(sand);
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 500),
      new THREE.MeshLambertMaterial({ color: 0x1d6f8f }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, 850); scene.add(sea);

    // Roads: dark strips on the grid, with centre dashes.
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
    var dashMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
    C.ROADS.forEach(function (r) {
      var h = new THREE.Mesh(new THREE.PlaneGeometry(1200, 14), roadMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.08, r); h.receiveShadow = true; scene.add(h);
      var v = new THREE.Mesh(new THREE.PlaneGeometry(14, 1200), roadMat);
      v.rotation.x = -Math.PI / 2; v.position.set(r, 0.08, 0); v.receiveShadow = true; scene.add(v);
      for (var d = -540; d <= 540; d += 60) {
        var dh = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.2), dashMat);
        dh.rotation.x = -Math.PI / 2; dh.position.set(d, 0.12, r); scene.add(dh);
        var dv = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 18), dashMat);
        dv.rotation.x = -Math.PI / 2; dv.position.set(r, 0.12, d); scene.add(dv);
      }
    });

    // Volcano in the north-east corner, smoking.
    var volcano = new THREE.Mesh(new THREE.ConeGeometry(150, 170, 8),
      new THREE.MeshLambertMaterial({ color: 0x5a4a42 }));
    volcano.position.set(460, 85, -460); volcano.castShadow = true; scene.add(volcano);
    var crater = new THREE.Mesh(new THREE.ConeGeometry(60, 40, 8),
      new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
    crater.position.set(460, 175, -460); scene.add(crater);
    var lava = new THREE.Mesh(new THREE.CircleGeometry(34, 12),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a }));
    lava.rotation.x = -Math.PI / 2; lava.position.set(460, 196, -460); scene.add(lava);
    var smoke = new THREE.Mesh(new THREE.SphereGeometry(26, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.55 }));
    smoke.position.set(460, 230, -460); scene.add(smoke);

    // Buildings in the blocks between roads, never on a road.
    var shopSigns = {};
    function addBuilding(x, z, w, d, h, color, signText) {
      var b = box(w, h, d, color, x, h / 2, z);
      scene.add(b);
      var roof = box(w + 2, 2, d + 2, pick(rng, roofColors), x, h + 1, z);
      scene.add(roof);
      colliders.push({ x: x, z: z, hw: w / 2 + 1, hd: d / 2 + 1 });
      if (signText) {
        var sign = new THREE.Mesh(new THREE.PlaneGeometry(34, 8),
          new THREE.MeshBasicMaterial({ map: textTexture(signText, '#20242e', '#ffcf3a') }));
        sign.position.set(x, h + 6, z + d / 2 + 0.6); scene.add(sign);
        shopSigns[signText] = sign;
      }
      return b;
    }
    // Named shops (positions match config SHOPS). All sit inside a block
    // (midpoints between road lines), never on a road or an intersection.
    addBuilding(60, -60, 40, 30, 16, '#8c6a4a', "LENA'S GARAGE");
    addBuilding(225, -75, 36, 28, 20, '#5a6b8c', "BRAM'S ARMS");
    addBuilding(-225, 75, 36, 28, 14, '#7a5a8c', 'SOL RESPRAY');
    addBuilding(-380, 380, 44, 30, 18, '#4a7a8c', 'BOATWORKS');
    addBuilding(-330, 30, 34, 26, 14, '#9c7a5a', 'CORAL CAFE');
    addBuilding(225, 225, 30, 30, 26, '#8c4a5a', 'SOLMAR VAULT');
    addBuilding(-420, 420, 36, 28, 14, '#6b8c5a', 'HIDEOUT');
    // Fill the rest of the blocks with buildings. Block centres are the
    // midpoints between road lines (roads at -450..450 step 150), so no
    // building ever stands on a road.
    var blockCenters = [];
    [-525, -375, -225, -75, 75, 225, 375, 525].forEach(function (bx) {
      [-525, -375, -225, -75, 75, 225, 375, 525].forEach(function (bz) {
        blockCenters.push([bx, bz]);
      });
    });
    blockCenters.forEach(function (c) {
      var nearShop = C.SHOPS.some(function (s) { return Math.hypot(s.x - c[0], s.z - c[1]) < 60; });
      if (nearShop) return;
      if (c[0] > 380 && c[1] < -380) return; // volcano plot
      if (rng() < 0.25) return; // some blocks stay open (parks / parking)
      var w = 34 + rng() * 26, d = 30 + rng() * 24, h = 10 + rng() * 34;
      addBuilding(c[0], c[1], w, d, h, pick(rng, buildingColors), null);
    });

    // Palm trees along the beach and scattered in parks.
    function palm(x, z) {
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 16, 6),
        new THREE.MeshLambertMaterial({ color: 0x8c6a4a }));
      trunk.position.y = 8; trunk.castShadow = true; g.add(trunk);
      for (var i = 0; i < 5; i++) {
        var leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 4),
          new THREE.MeshLambertMaterial({ color: 0x3f7d4a }));
        var a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 4, 17, Math.sin(a) * 4);
        leaf.rotation.z = Math.cos(a) * 0.9; leaf.rotation.x = -Math.sin(a) * 0.9;
        g.add(leaf);
      }
      g.position.set(x, 0, z); scene.add(g); return g;
    }
    for (var px = -540; px <= 540; px += 90) palm(px + (rng() * 20 - 10), 520 + rng() * 30);
    for (var pi = 0; pi < 26; pi++) palm(-540 + rng() * 1080, -540 + rng() * 1000);

    // Stunt jump ramps (orange wedges).
    var ramps = [];
    C.JUMPS.forEach(function (j) {
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 22),
        new THREE.MeshLambertMaterial({ color: 0xe87a2a }));
      ramp.position.set(j.x, 2, j.z); ramp.rotation.y = j.a; ramp.rotation.x = -0.35;
      ramp.castShadow = true; scene.add(ramp); ramps.push(ramp);
    });

    // Golden Shell collectibles (glowing spheres, bobbing).
    var shells = [];
    for (var si = 0; si < 20; si++) {
      var sx = -500 + rng() * 1000, sz = -500 + rng() * 1000;
      var sh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd94c }));
      sh.position.set(sx, 3, sz); scene.add(sh);
      shells.push({ mesh: sh, x: sx, z: sz, taken: false, phase: rng() * 6 });
    }

    // Mission waypoint beacon: a tall yellow pillar + ground ring.
    var beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beacon.position.set(0, 45, 0); beacon.visible = false; scene.add(beacon);
    var ring = new THREE.Mesh(new THREE.RingGeometry(6, 9, 24),
      new THREE.MeshBasicMaterial({ color: 0xffcf3a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.3, 0); ring.visible = false; scene.add(ring);

    // Race checkpoint rings (reused per race).
    var checkpoints = [];
    for (var ci = 0; ci < 5; ci++) {
      var cp = new THREE.Mesh(new THREE.TorusGeometry(9, 1.2, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x4cc2e8 }));
      cp.position.set(0, 5, 0); cp.visible = false; scene.add(cp); checkpoints.push(cp);
    }

    function collides(x, z, r) {
      if (Math.abs(x) > 580 || Math.abs(z) > 580) return true;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return true;
      }
      return false;
    }
    function nearestRoad(v) {
      var best = C.ROADS[0];
      for (var i = 1; i < C.ROADS.length; i++) if (Math.abs(C.ROADS[i] - v) < Math.abs(best - v)) best = C.ROADS[i];
      return best;
    }

    // --- Mesh factories for moving things ---
    function makeCarMesh(color, police) {
      var g = new THREE.Group();
      var body = box(4.4, 1.4, 9, color, 0, 1.1, 0);
      var cabin = box(3.6, 1.2, 4.4, police ? '#e8e8e8' : '#20242e', 0, 2.3, -0.4);
      g.add(body); g.add(cabin);
      var wheelGeo = new THREE.CylinderGeometry(1, 1, 0.8, 10);
      var wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
      [[-2.1, 3], [2.1, 3], [-2.1, -3], [2.1, -3]].forEach(function (p) {
        var w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2; w.position.set(p[0], 1, p[1]); g.add(w);
      });
      if (police) {
        var bar = box(3, 0.6, 1.2, '#e5534b', 0, 3.2, -0.4); g.add(bar);
        var bar2 = box(3, 0.6, 1.2, '#4c6be8', 0, 3.2, 0.6); g.add(bar2);
        g.userData.lightBar = [bar, bar2];
      }
      g.userData.body = body;
      scene.add(g); return g;
    }
    function makePersonMesh(shirt, pants) {
      var g = new THREE.Group();
      var legs = box(1.6, 1.6, 0.9, pants || '#2b2f38', 0, 0.8, 0);
      var torso = box(1.8, 2, 1, shirt, 0, 2.6, 0);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0xd9a06b }));
      head.position.set(0, 4.3, 0); head.castShadow = true;
      var armL = box(0.6, 1.8, 0.6, shirt, -1.2, 2.6, 0);
      var armR = box(0.6, 1.8, 0.6, shirt, 1.2, 2.6, 0);
      g.add(legs); g.add(torso); g.add(head); g.add(armL); g.add(armR);
      g.userData.legs = legs; g.userData.armL = armL; g.userData.armR = armR;
      scene.add(g); return g;
    }
    function makeEnemyMesh() { return makePersonMesh('#c23a3a', '#2b2b2b'); }

    return {
      scene: scene, camera: camera, renderer: renderer, sun: sun, smoke: smoke,
      beacon: beacon, ring: ring, checkpoints: checkpoints, shells: shells,
      collides: collides, nearestRoad: nearestRoad,
      makeCarMesh: makeCarMesh, makePersonMesh: makePersonMesh, makeEnemyMesh: makeEnemyMesh,
      resize: function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      },
      setQuality: function (q) {
        renderer.shadowMap.enabled = q !== 'Low';
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'High' ? 2 : 1.25));
      },
      dispose: function () { renderer.dispose(); },
    };
  }

  window.SB3World = { create: createWorld3D };
})();
