// Solmar Bay's city: a road grid, building blocks, parks, a beach and a
// marina, all generated from a seed so the same seed always builds the
// same city. Roads are the avenues the traffic follows; buildings are
// solid rectangles the player, cars and pedestrians collide with.
import { WORLD, PALETTE } from './config.js';

// Road centre lines: vertical avenues and horizontal streets, every 360 px.
export const ROADS_X = [];
export const ROADS_Y = [];
for (let x = 180; x < WORLD.width; x += 360) ROADS_X.push(x);
for (let y = 180; y < WORLD.height - 600; y += 360) ROADS_Y.push(y);

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const landmarks = {};
  // One building per block, with a seeded colour, height (drawn as shade)
  // and a few windows; some blocks become parks instead.
  // Blocks sit between the roads: roads are centred at 180 + 360k with a
  // 96 px width, so a block's interior is 264 px wide, from offset 228 to
  // 492 of its 360 px cell. Buildings start at offset 240 and stay inside
  // it — an earlier offset of 120 put them on the roads, where cars drove
  // straight into them.
  for (let bx = 0; bx < 10; bx += 1) {
    for (let by = 0; by < 6; by += 1) {
      const x0 = bx * 360 + 240, y0 = by * 360 + 240;
      if (random.chance(0.14)) { parks.push({ x: x0, y: y0, w: 240, h: 240 }); continue; }
      const w = random.range(130, 200), h = random.range(120, 200);
      buildings.push({
        x: x0 + (240 - w) / 2, y: y0 + (240 - h) / 2, w, h,
        color: random.pick(PALETTE.building), roof: random.pick(PALETTE.roof),
        floors: random.int(2, 9), seed: random.int(0, 9999),
      });
    }
  }
  // Landmarks the missions use, all on roads so cars can reach them.
  landmarks.garage = { x: 1980, y: 540, label: "Lena's Garage" };
  landmarks.cafe = { x: 540, y: 1260, label: 'Coral Cafe' };
  landmarks.marina = { x: 3420, y: 1620, label: 'Marina Pier' };
  landmarks.harbour = { x: 1620, y: 1620, label: 'Old Harbour' };
  landmarks.bank = { x: 1620, y: 180, label: 'Solmar Trust' };
  landmarks.hideout = { x: 3420, y: 540, label: 'Hideout' };
  landmarks.lockup = { x: 180, y: 180, label: 'North Lockup' };
  landmarks.beach = { x: 1800, y: 2700, label: 'Bayfront Beach' };
  return { buildings, parks, landmarks };
}

export function isRoad(x, y) {
  if (y > WORLD.height - 600) return false; // beach, no roads
  return ROADS_X.some((rx) => Math.abs(x - rx) < WORLD.road / 2)
    || ROADS_Y.some((ry) => Math.abs(y - ry) < WORLD.road / 2);
}
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const rx of ROADS_X) for (const ry of ROADS_Y) {
    const d = Math.hypot(x - rx, y - ry);
    if (d < bd) { bd = d; best = { x: rx, y: ry }; }
  }
  return best;
}
// Snap a point onto the nearest road centre line (for traffic spawning).
export function snapToRoad(x, y) {
  const rx = ROADS_X.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  const ry = ROADS_Y.reduce((a, b) => Math.abs(b - y) < Math.abs(a - y) ? b : a);
  return Math.abs(rx - x) < Math.abs(ry - y) ? { x: rx, y, axis: 'v' } : { x, y: ry, axis: 'h' };
}
export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function clampWorld(x, y, r) {
  return {
    x: Math.max(r, Math.min(WORLD.width - r, x)),
    y: Math.max(r, Math.min(WORLD.height - r, y)),
  };
}
export function districtAt(x, y) {
  if (y > 2400) return 'Bayfront Beach';
  if (y > 1800) return 'South Solmar';
  if (x < 1200) return y < 900 ? 'North Lockup' : 'Coral Row';
  if (x < 2400) return y < 900 ? 'Downtown' : 'Old Harbour';
  return y < 900 ? 'Marlin Quarter' : 'Marina';
}
