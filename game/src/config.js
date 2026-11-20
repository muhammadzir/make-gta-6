// Solmar Bay — tuning, palette and story data. All numbers in one place.
// The world is a 3600x3000 open city; the camera follows the player and the
// renderer scales the 1280x720 view to the window, so no rule below depends
// on the screen size.
export const WORLD = { width: 3600, height: 3000, road: 96, block: 264 };
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best';

export const PLAYER = {
  radius: 14, walkSpeed: 230, runSpeed: 340, health: 100,
  punchDamage: 20, shootDamage: 34, fireRate: 0.28, ammo: 24, maxAmmo: 48,
};
export const CAR = {
  // Turn rate 3.4 at 540 top speed gives a ~160 px turning circle, tight
  // enough to turn at a 96 px-wide intersection without sliding into the
  // buildings on its corner; 2.6 at 620 gave a 238 px circle and the car
  // scraped every corner it turned.
  accel: 520, reverseAccel: 320, maxSpeed: 540, maxReverse: 220,
  turn: 3.4, grip: 0.92, brake: 900, health: 200,
};
export const TRAFFIC_COUNT = 18;
export const PED_COUNT = 28;
export const POLICE_MAX = 6;

export const WANTED = {
  decay: 0.012, // stars per second while unseen and not committing crimes
  steal: 1, hitPed: 1, shoot: 1, killPed: 2, killCop: 2,
};

export const PALETTE = {
  backdrop: '#0e1420', water: '#1d6f8f', sand: '#d9c27a', grass: '#3f7d4a',
  park: '#2e6b3a', road: '#2b2f38', roadLine: '#c9a227', sidewalk: '#4a4f5a',
  building: ['#7a5a8c', '#8c6a4a', '#4a7a8c', '#9c7a5a', '#5a6b8c', '#b08a4a'],
  roof: ['#3a2f4a', '#4a3a2f', '#2f4a3a', '#5a4a2f'],
  player: '#e8b23a', playerShirt: '#2f6fb2', cop: '#2b4a8c', copCar: '#e8e8e8',
  car: ['#c23a3a', '#3a7ac2', '#c2a23a', '#3ac27a', '#8c3ac2', '#e8e8e8', '#2b2b2b'],
  text: '#f2f0e8', muted: '#9aa3ad', gold: '#f2c94c', red: '#e5534b',
  panel: 'rgba(16, 20, 32, 0.88)', hud: 'rgba(10, 14, 24, 0.72)',
  marker: '#ffcf3a', health: '#4ac25a', wanted: '#ffcf3a',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// The story: Rico Vale, a wheelman fresh out of Solmar Bay's north lockup,
// owes the harbour crew and has one week to buy his sister's garage back.
export const STORY = {
  city: 'Solmar Bay',
  hero: 'Rico Vale',
  intro: 'Rico Vale is out of the north lockup and owes the harbour crew $40,000. One week to buy back his sister Lena’s garage — or lose it for good.',
};
export const MISSIONS = [
  { id: 1, name: 'First Wheels', giver: 'Lena Vale', pay: 500,
    brief: 'Lena needs a car, fast. Steal any parked or traffic car (E) and bring it to the garage on Marlin Street.',
    done: 'Lena: "It runs! You still drive like you stole it — because you did."' },
  { id: 2, name: 'Bayfront Pickup', giver: 'Marco Hale', pay: 900,
    brief: 'Marco left a package at the marina pier. Pick it up on foot, then deliver it to the Coral Cafe on Solmar Avenue. Stay out of trouble.',
    done: 'Marco: "Clean delivery. The crew is starting to trust you, Rico."' },
  { id: 3, name: 'Harbor Heat', giver: 'Dana Cross', pay: 1500,
    brief: 'The Tide Rats are shaking down the harbour. Take out 3 of their enforcers (F to fight, mouse to aim) — then lose the cops.',
    done: 'Dana: "Harbour’s quiet tonight. That was you, wasn’t it?"' },
  { id: 4, name: 'The Solmar Heist', giver: 'Lena Vale', pay: 4000,
    brief: 'The big one: grab the cash from the Solmar Trust vault, then lose a 3-star wanted level and reach the hideout. This buys the garage back.',
    done: 'Lena: "The garage is ours again. Solmar Bay is yours, Rico."' },
];
export const DISTRICTS = [
  { name: 'North Lockup', x: 0, y: 0, w: 1200, h: 600 },
  { name: 'Downtown', x: 1200, y: 0, w: 1200, h: 900 },
  { name: 'Marlin Quarter', x: 2400, y: 0, w: 1200, h: 900 },
  { name: 'Coral Row', x: 0, y: 900, w: 1200, h: 900 },
  { name: 'Old Harbour', x: 1200, y: 900, w: 1200, h: 900 },
  { name: 'Marina', x: 2400, y: 900, w: 1200, h: 900 },
  { name: 'Bayfront Beach', x: 0, y: 1800, w: 3600, h: 1200 },
];
