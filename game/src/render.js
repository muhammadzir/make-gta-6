// Drawing only: the world and the current screen in, pixels out. A camera
// follows the player across the 3600x3000 city; the 1280x720 view is scaled
// to fit the window and centred. Flat shapes, canvas text for the HUD,
// a live minimap, and panels for the title, pause, busted and story screens.
import { FIELD, FONT, PALETTE, WORLD, MISSIONS } from './config.js';
import { ROADS_X, ROADS_Y, districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 680, top: 150, line: 32, bottom: 76 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, camX: 0, camY: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }
  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size); context.fillStyle = color;
    context.textAlign = align || 'left'; context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function worldToScreen(wx, wy) {
    return { x: (wx - view.camX) * view.scale + view.x, y: (wy - view.camY) * view.scale + view.y };
  }
  function drawCar(x, y, angle, color, police, w, h) {
    context.save(); context.translate(x, y); context.rotate(angle);
    context.fillStyle = '#111'; context.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
    context.fillStyle = color; context.fillRect(-w / 2, -h / 2, w, h);
    context.fillStyle = 'rgba(20,30,50,0.85)'; context.fillRect(w * 0.05, -h / 2 + 3, w * 0.32, h - 6);
    context.fillStyle = '#ffe9a8'; context.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5); context.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
    context.fillStyle = '#ff5a4a'; context.fillRect(-w / 2, -h / 2 + 3, 3, 5); context.fillRect(-w / 2, h / 2 - 8, 3, 5);
    if (police) { context.fillStyle = '#2b4a8c'; context.fillRect(-w * 0.2, -h / 2 + 2, w * 0.4, 4); text('PD', 0, 4, 11, '#fff', 'center'); }
    context.restore();
  }
  function drawPerson(x, y, angle, color, isPlayer) {
    context.save(); context.translate(x, y); context.rotate(angle);
    context.fillStyle = '#111'; context.beginPath(); context.arc(0, 0, 15, 0, Math.PI * 2); context.fill();
    context.fillStyle = color; context.beginPath(); context.arc(0, 0, 13, 0, Math.PI * 2); context.fill();
    context.fillStyle = isPlayer ? PALETTE.playerShirt : '#222';
    context.beginPath(); context.arc(6, 0, 6, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#f2c9a0'; context.beginPath(); context.arc(0, 0, 5, 0, Math.PI * 2); context.fill();
    context.restore();
    if (isPlayer) { context.fillStyle = PALETTE.marker; context.beginPath(); context.arc(x, y - 24, 4, 0, Math.PI * 2); context.fill(); }
  }
  function drawCity(world) {
    const { city } = world;
    const cam = view;
    // Ground: grass north, sand beach south, water strip at the very south.
    context.fillStyle = PALETTE.grass; context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand; context.fillRect(0, 2400, WORLD.width, 600);
    context.fillStyle = PALETTE.water; context.fillRect(0, 2880, WORLD.width, 120);
    context.fillStyle = '#7ec8e8'; context.fillRect(0, 2880, WORLD.width, 6);
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park; context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = '#5a8c3a';
      for (let i = 0; i < 5; i += 1) { context.beginPath(); context.arc(park.x + 40 + i * 40, park.y + 60 + (i % 2) * 100, 18, 0, Math.PI * 2); context.fill(); }
    }
    // Roads and sidewalks.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) context.fillRect(rx - WORLD.road / 2 - 8, 0, WORLD.road + 16, 2400);
    for (const ry of ROADS_Y) context.fillRect(0, ry - WORLD.road / 2 - 8, WORLD.width, WORLD.road + 16);
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - WORLD.road / 2, 0, WORLD.road, 2400);
    for (const ry of ROADS_Y) context.fillRect(0, ry - WORLD.road / 2, WORLD.width, WORLD.road);
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) { for (let y = 0; y < 2400; y += 64) context.fillRect(rx - 2, y, 4, 30); }
    for (const ry of ROADS_Y) { for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 30, 4); }
    // Buildings with roofs, windows and a shadow.
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)'; context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color; context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof; context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = '#ffe9a8';
      const cols = Math.max(2, Math.floor(b.w / 42)), rows = Math.max(2, Math.floor(b.h / 42));
      for (let cx = 0; cx < cols; cx += 1) for (let cy = 0; cy < rows; cy += 1) {
        if ((cx * 7 + cy * 3 + b.seed) % 3 !== 0) context.fillRect(b.x + 14 + cx * 40, b.y + 14 + cy * 40, 14, 10);
      }
    }
    // Landmark signs.
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      context.fillStyle = PALETTE.panel; context.fillRect(lm.x - 70, lm.y - 34, 140, 26);
      context.fillStyle = PALETTE.marker; context.fillRect(lm.x - 70, lm.y - 34, 4, 26);
      text(lm.label, lm.x, lm.y - 14, 15, PALETTE.text, 'center');
    }
    // Mission target beacon.
    const target = world.missions.target();
    if (target) {
      const pulse = 18 + Math.sin(world.elapsed * 5) * 6;
      context.strokeStyle = PALETTE.marker; context.lineWidth = 4;
      context.beginPath(); context.arc(target.x, target.y, pulse + 14, 0, Math.PI * 2); context.stroke();
      context.fillStyle = PALETTE.marker; context.beginPath(); context.arc(target.x, target.y, 7, 0, Math.PI * 2); context.fill();
    }
    void cam;
  }
  function drawHud(world, best) {
    const p = world.player;
    context.textBaseline = 'top';
    // Top-left: money, health, ammo, district.
    context.fillStyle = PALETTE.hud; context.fillRect(14, 12, 250, 108);
    text('$' + world.money, 26, 40, 28, PALETTE.gold, 'left');
    text('Health ' + Math.max(0, Math.ceil(p.health)), 26, 70, 18, p.health > 30 ? PALETTE.health : PALETTE.red, 'left');
    text('Ammo ' + p.ammo + (world.inCar ? '   •   ' + Math.round(Math.abs(world.car.speed)) + ' mph' : ''), 26, 94, 18, PALETTE.text, 'left');
    text(districtAt(p.x, p.y), 26, 116, 15, PALETTE.muted, 'left');
    // Wanted stars, top centre.
    const stars = Math.round(world.wanted);
    text('★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars)), FIELD.width / 2, 44, 30, stars > 0 ? PALETTE.wanted : PALETTE.muted, 'center');
    if (stars > 0) text('WANTED', FIELD.width / 2, 74, 14, PALETTE.red, 'center');
    // Mission objective, bottom-left.
    context.fillStyle = PALETTE.hud; context.fillRect(14, FIELD.height - 86, 560, 72);
    text(world.missions.objective(), 26, FIELD.height - 56, 17, PALETTE.text, 'left');
    if (world.message && world.messageTime > 0) text(world.message, 26, FIELD.height - 30, 15, PALETTE.marker, 'left');
    if (world.flash) text(world.flash, FIELD.width / 2, 110, 24, PALETTE.gold, 'center');
    // Controls hint, bottom-right.
    text('WASD move/drive • E car • F fight • Q pickup • P pause • M sound', FIELD.width - 16, FIELD.height - 22, 13, PALETTE.muted, 'right');
    void best;
    drawMinimap(world);
  }
  function drawMinimap(world) {
    const mw = 190, mh = 158, ox = FIELD.width - mw - 14, oy = 12;
    const sx = mw / WORLD.width, sy = mh / WORLD.height;
    context.fillStyle = PALETTE.hud; context.fillRect(ox - 6, oy - 6, mw + 12, mh + 12);
    context.fillStyle = '#1d3a2a'; context.fillRect(ox, oy, mw, mh);
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(ox + rx * sx - 1, oy, 2, mh * 0.8);
    for (const ry of ROADS_Y) context.fillRect(ox, oy + ry * sy - 1, mw, 2);
    const target = world.missions.target();
    if (target) { context.fillStyle = PALETTE.marker; context.fillRect(ox + target.x * sx - 4, oy + target.y * sy - 4, 8, 8); }
    for (const cop of world.police) { context.fillStyle = '#6a9cff'; context.beginPath(); context.arc(ox + cop.x * sx, oy + cop.y * sy, 4, 0, Math.PI * 2); context.fill(); }
    context.fillStyle = PALETTE.player; context.beginPath(); context.arc(ox + world.player.x * sx, oy + world.player.y * sy, 5, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#fff'; context.lineWidth = 1.5; context.beginPath(); context.arc(ox + world.player.x * sx, oy + world.player.y * sy, 5, 0, Math.PI * 2); context.stroke();
  }
  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2, y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel; context.fillRect(x, y, PANEL.width, height);
    context.fillStyle = PALETTE.marker; context.fillRect(x, y, PANEL.width, 5);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 20, PALETTE.muted, 'center');
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center');
  }
  function draw(world, screen, best) {
    // Camera: centre on the player, clamped to the world.
    view.camX = Math.max(0, Math.min(WORLD.width - FIELD.width, world.player.x - FIELD.width / 2));
    view.camY = Math.max(0, Math.min(WORLD.height - FIELD.height, world.player.y - FIELD.height / 2));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop; context.fillRect(0, 0, canvas.width, canvas.height);
    // World space: scale so FIELD.width world units fit the view, offset by camera.
    const s = view.scale;
    context.setTransform(s, 0, 0, s, view.x - view.camX * s, view.y - view.camY * s);
    drawCity(world);
    for (const pk of world.pickups) {
      context.fillStyle = pk.kind === 'cash' ? PALETTE.gold : pk.kind === 'health' ? PALETTE.health : '#7ab8ff';
      context.beginPath(); context.arc(pk.x, pk.y, 12, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#111'; text(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + 5, 15, '#111', 'center');
    }
    for (const car of world.cars) drawCar(car.x, car.y, car.angle, car.color, car.police, car.w, car.h);
    for (const cop of world.police) drawCar(cop.x, cop.y, cop.angle, cop.color, true, 46, 22);
    for (const ped of world.peds) if (ped.alive) drawPerson(ped.x, ped.y, ped.angle, ped.color, false);
    for (const e of world.enemies) if (e.alive) { drawPerson(e.x, e.y, e.angle, '#c23a3a', false); text('!', e.x, e.y - 24, 18, PALETTE.red, 'center'); }
    for (const b of world.bullets) { context.fillStyle = '#ffe9a8'; context.beginPath(); context.arc(b.x, b.y, 4, 0, Math.PI * 2); context.fill(); }
    for (const fx of world.effects) {
      context.fillStyle = fx.kind === 'down' ? '#888' : '#ffcf3a';
      context.beginPath(); context.arc(fx.x, fx.y, 10 + fx.t * 30, 0, Math.PI * 2); context.fill();
    }
    if (world.inCar && world.car) drawCar(world.car.x, world.car.y, world.car.angle, world.car.color, false, 46, 22);
    else drawPerson(world.player.x, world.player.y, world.player.angle, '#e8b23a', true);
    // HUD in screen space.
    context.setTransform(s, 0, 0, s, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR BAY', [
        'An original open-world crime story in the spirit of GTA 6.',
        'Rico Vale is out of lockup and owes the harbour crew $40,000.',
        'Steal cars, run missions, lose the cops, buy the garage back.',
        'WASD move / drive • E enter car • F fight • Q pickup • P pause',
        'Best haul: $' + best,
      ], 'Press Space or click to start');
      return;
    }
    drawHud(world, best);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', ['Solmar Bay waits for no one — except now.', 'Progress saves after every mission.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) drawPanel(world.busted ? 'BUSTED!' : 'WASTED', [world.busted ? 'The Solmar Bay PD caught Rico Vale.' : 'Rico Vale is down — the harbour crew will hear of this.', 'Money kept: $' + world.money], 'Press Space to try again');
    else if (screen === SCREEN_WIN) drawPanel('SOLMAR BAY IS YOURS', ['All four missions complete. The garage is Lena’s again.', 'Money earned: $' + world.money + '  •  Best: $' + best], 'Press Space to keep roaming');
  }
  resize();
  window.addEventListener('resize', resize);
  return { draw, view, worldToScreen };
}
