// Solmar Bay 3D — configuration and story data. Everything here is original:
// an invented coastal city on a volcanic island, invented people, places and
// money. Nothing comes from Rockstar/GTA or any commercial game.
(function () {
  'use strict';

  var WORLD = 1200; // world is WORLD x WORLD, centred on (0,0), ground y = 0
  var ROAD_STEP = 150;
  var ROADS = [-450, -300, -150, 0, 150, 300, 450];

  // 7 districts, each with a standing score 0..100 and a state name.
  var DISTRICTS = [
    { id: 'downtown', name: 'Downtown', cx: 0, cz: 0, hw: 220, hd: 220, color: '#e8b64c' },
    { id: 'marina', name: 'Marina', cx: -330, cz: 330, hw: 220, hd: 220, color: '#4cc2e8' },
    { id: 'harbour', name: 'Old Harbour', cx: -330, cz: -330, hw: 220, hd: 220, color: '#8a7a5a' },
    { id: 'coral', name: 'Coral Row', cx: -330, cz: 0, hw: 220, hd: 220, color: '#e87a9a' },
    { id: 'lockup', name: 'North Lockup', cx: 0, cz: -330, hw: 220, hd: 220, color: '#9a8ae8' },
    { id: 'beach', name: 'Bayfront Beach', cx: 330, cz: 330, hw: 220, hd: 220, color: '#f2d06b' },
    { id: 'volcano', name: 'Volcano Ridge', cx: 330, cz: -330, hw: 220, hd: 220, color: '#e85a4c' },
  ];
  function districtAt(x, z) {
    for (var i = 0; i < DISTRICTS.length; i++) {
      var d = DISTRICTS[i];
      if (Math.abs(x - d.cx) <= d.hw && Math.abs(z - d.cz) <= d.hd) return d;
    }
    return DISTRICTS[0];
  }
  function standingState(v) { return v >= 70 ? 'FRIENDLY' : v >= 40 ? 'NEUTRAL' : 'WARY'; }

  var RANKS = [
    { name: 'STREET', rp: 0 }, { name: 'HUSTLER', rp: 100 }, { name: 'RUNNER', rp: 250 },
    { name: 'FIXER', rp: 500 }, { name: 'ENFORCER', rp: 900 }, { name: 'KINGPIN', rp: 1400 },
    { name: 'BAY LORD', rp: 2100 }, { name: 'LEGEND', rp: 3000 },
  ];
  function rankFor(rp) {
    var r = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (rp >= RANKS[i].rp) r = RANKS[i];
      else { next = RANKS[i]; break; }
    }
    return { rank: r, next: next };
  }

  // Crew: recruited by finishing missions, each with a real ability.
  var CREW = [
    { id: 'lena', name: 'Lena', role: 'Mechanic', loyalty: 80,
      ability: 'Safehouse owner — heals you at home · +15% mission payouts', afterMission: 1,
      desc: 'Runs Lena\'s Garage in Downtown. Fixes cars and pays better.' },
    { id: 'dario', name: 'Dario', role: 'Getaway driver', loyalty: 65,
      ability: 'Calls in a car with G · improves vehicle handling', afterMission: 2,
      desc: 'Ex-race driver. Press G and he drops a fast car beside you.' },
    { id: 'bram', name: 'Bram', role: 'Enforcer', loyalty: 70,
      ability: 'Joins fights beside you · +10% damage', afterMission: 3,
      desc: 'Big, quiet, loyal. Fights at your side when the shooting starts.' },
  ];

  var WEAPONS = [
    { id: 'pistol', name: 'Pistol', slot: 1, damage: 34, rate: 0.32, range: 90, ammo: 60, price: 0, auto: false },
    { id: 'smg', name: 'SMG', slot: 2, damage: 18, rate: 0.09, range: 70, ammo: 180, price: 1200, auto: true },
    { id: 'shotgun', name: 'Shotgun', slot: 3, damage: 22, pellets: 6, rate: 0.9, range: 40, ammo: 40, price: 2000, auto: false },
  ];

  // Story: 3 acts, 6 missions. Objectives use a small generic language:
  // goto (reach a point), talk (press E at a point), kill (defeat N gang),
  // race (hit checkpoints in order, timed), escape (get wanted to 0).
  // Each mission pays out on completion.
  var MISSIONS = [
    { id: 'm1', act: 1, title: 'First Wheels', giver: 'Lena', payout: 500, rp: 100,
      brief: 'Rico Vale owes the harbour crew $40,000. Lena needs wheels first: steal a car and bring it to her garage.',
      objectives: [
        { type: 'goto', label: 'Steal a car (press F near one)', x: -300, z: 150, needCar: true },
        { type: 'goto', label: 'Drive to Lena\'s Garage', x: 60, z: -60, needCar: true },
      ] },
    { id: 'm2', act: 1, title: 'Bayfront Pickup', giver: 'Vera', payout: 900, rp: 150,
      brief: 'Vera has a package waiting at the Marina boatyard. Pick it up and take it to the Coral Cafe — no police.',
      objectives: [
        { type: 'goto', label: 'Go to Harbor Boatworks, Marina', x: -380, z: 380 },
        { type: 'talk', label: 'Pick up the package (press E)', x: -380, z: 380 },
        { type: 'goto', label: 'Deliver to Coral Cafe', x: -330, z: 30 },
      ] },
    { id: 'm3', act: 2, title: 'The Widow\'s Price', giver: 'Vera', payout: 1500, rp: 200,
      brief: 'The Widow\'s crew, the Ember Rats, are collecting on the harbour. Put three of them down, then lose the cops.',
      objectives: [
        { type: 'kill', label: 'Defeat the Ember Rats (0/3)', x: -330, z: -330, count: 3 },
        { type: 'escape', label: 'Lose the police (wanted to 0)' },
      ] },
    { id: 'm4', act: 2, title: 'The Lantern Run', giver: 'Dario', payout: 2000, rp: 250,
      brief: 'Dario bets you cannot win the Lantern Run. Five checkpoints, one fast car, no shortcuts through the beach.',
      objectives: [
        { type: 'race', label: 'Win the Lantern Run — hit the checkpoints', x: 0, z: 0 },
      ] },
    { id: 'm5', act: 3, title: 'The Solmar Vault', giver: 'Vera', payout: 4000, rp: 400,
      brief: 'The harbour crew\'s money sits in the Solmar Vault, Downtown. Grab it and get out at 3 stars.',
      objectives: [
        { type: 'goto', label: 'Reach the Solmar Vault', x: 225, z: 225 },
        { type: 'talk', label: 'Crack the vault (press E)', x: 225, z: 225 },
        { type: 'goto', label: 'Escape to the Hideout, Marina', x: -420, z: 420 },
      ] },
    { id: 'm6', act: 3, title: 'The Solmar Accord', giver: 'Lena', payout: 6000, rp: 500,
      brief: 'One last job. Meet Vera at the Hideout, survive the Widow\'s ambush, and the $40,000 debt is wiped clean.',
      objectives: [
        { type: 'goto', label: 'Meet Vera at the Hideout', x: -420, z: 420 },
        { type: 'kill', label: 'Survive the ambush (0/4)', x: -420, z: 420, count: 4 },
        { type: 'talk', label: 'Seal the accord (press E)', x: -420, z: 420 },
      ] },
  ];

  var RACES = [
    { id: 'r1', name: 'Lantern Run', prize: 800, cps: [[-300, -300], [0, -300], [300, -300], [300, 0], [0, 300]] },
    { id: 'r2', name: 'Marina Sprint', prize: 1000, cps: [[-450, 450], [-150, 450], [150, 450], [450, 300], [450, 0]] },
    { id: 'r3', name: 'Volcano Loop', prize: 1400, cps: [[450, -450], [150, -450], [-150, -450], [-450, -150], [0, 0]] },
    { id: 'r4', name: 'Beach Dash', prize: 1200, cps: [[-450, 300], [-150, 150], [150, 150], [450, 150], [300, 450]] },
  ];

  var JUMPS = [ // stunt jump ramps: position + facing angle
    { x: -150, z: 0, a: 0 }, { x: 150, z: -150, a: 1.57 }, { x: 0, z: 300, a: 0 },
    { x: -300, z: 300, a: 3.14 }, { x: 300, z: 150, a: -1.57 }, { x: -450, z: -150, a: 0 },
    { x: 150, z: 450, a: 3.14 }, { x: 450, z: -300, a: 1.57 },
  ];

  var EXPORT_CARS = [ // deliver a car of this colour to the boatyard
    { color: '#c23a3a', name: 'Red Comet', done: false },
    { color: '#3a7ac2', name: 'Blue Marlin', done: false },
    { color: '#e8b64c', name: 'Gold Runner', done: false },
    { color: '#7ac23a', name: 'Green Gecko', done: false },
    { color: '#c23a9a', name: 'Pink Flamingo', done: false },
  ];

  var SHOPS = [
    { id: 'arms', name: 'Bram\'s Arms', x: 225, z: -75, kind: 'weapons', blurb: 'Weapons and ammo. Pistol free, SMG $1,200, Shotgun $2,000.' },
    { id: 'respray', name: 'Sol Respray', x: -225, z: 75, kind: 'respray', blurb: 'Respray your car any colour — $300.' },
    { id: 'boatyard', name: 'Harbor Boatworks', x: -380, z: 380, kind: 'export', blurb: 'Deliver export cars here. Also the race and job board.' },
    { id: 'garage', name: 'Lena\'s Garage', x: 60, z: -60, kind: 'garage', blurb: 'Safehouse. Heal here, save your game.' },
    { id: 'cafe', name: 'Coral Cafe', x: -330, z: 30, kind: 'cafe', blurb: 'Quiet corner of Coral Row. Vera leaves jobs here.' },
  ];

  window.SB3 = {
    WORLD: WORLD, ROAD_STEP: ROAD_STEP, ROADS: ROADS,
    DISTRICTS: DISTRICTS, districtAt: districtAt, standingState: standingState,
    RANKS: RANKS, rankFor: rankFor, CREW: CREW, WEAPONS: WEAPONS,
    MISSIONS: MISSIONS, RACES: RACES, JUMPS: JUMPS, EXPORT_CARS: EXPORT_CARS, SHOPS: SHOPS,
  };
})();
