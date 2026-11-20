// Solmar Bay's story missions. Each mission is a small state machine:
// a list of stages, each with a target point (or a count to reach) and
// text for the HUD. Completing a stage advances the mission; completing
// the last stage pays out, saves, and unlocks the next mission.
import { MISSIONS } from './config.js';

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function createMissions(landmarks) {
  const defs = [
    { // 1 — First Wheels: steal a car, drive it to the garage.
      stages: [
        { text: 'Steal a car — walk up to one and press E', kind: 'stealCar', target: null },
        { text: 'Drive to Lena’s Garage', kind: 'reach', target: landmarks.garage, radius: 130 },
      ],
    },
    { // 2 — Bayfront Pickup: on foot to the marina, then to the cafe.
      stages: [
        { text: 'Pick up the package at the Marina Pier (on foot)', kind: 'reach', target: landmarks.marina, radius: 110, onFoot: true },
        { text: 'Deliver the package to the Coral Cafe', kind: 'reach', target: landmarks.cafe, radius: 120 },
      ],
    },
    { // 3 — Harbor Heat: defeat 3 Tide Rats, then lose the cops.
      stages: [
        { text: 'Take out 3 Tide Rats at the Old Harbour', kind: 'defeat', target: landmarks.harbour, radius: 320, count: 3 },
        { text: 'Lose the cops — get your wanted level to zero', kind: 'loseCops', target: null },
      ],
    },
    { // 4 — The Solmar Heist: vault, then escape to the hideout at 3 stars.
      stages: [
        { text: 'Reach the Solmar Trust vault', kind: 'reach', target: landmarks.bank, radius: 120 },
        { text: 'Grab the cash! (stand in the vault)', kind: 'grab', target: landmarks.bank, radius: 120, hold: 2.5 },
        { text: 'Escape to the Hideout — the cops are coming', kind: 'reach', target: landmarks.hideout, radius: 130, wanted: 3 },
      ],
    },
  ];
  return {
    index: 0, stage: 0, holdTime: 0, defeated: 0, done: false,
    current() { return this.done ? null : MISSIONS[this.index]; },
    def() { return this.done ? null : defs[this.index]; },
    stageDef() { return this.done ? null : defs[this.index].stages[this.stage]; },
    objective() {
      if (this.done) return 'All missions complete — Solmar Bay is yours. Free roam!';
      const m = MISSIONS[this.index], s = defs[this.index].stages[this.stage];
      return `${m.id}. ${m.name}: ${s.text}`;
    },
    target() { const s = this.stageDef(); return s ? s.target : null; },
    advance(world) {
      this.stage += 1; this.holdTime = 0;
      if (this.stage >= defs[this.index].stages.length) {
        const m = MISSIONS[this.index];
        world.money += m.pay; world.message = m.done; world.messageTime = 5;
        world.audio.mission(); world.flash = m.name + ' complete! +$' + m.pay;
        this.index += 1; this.stage = 0; this.defeated = 0;
        if (this.index >= MISSIONS.length) { this.done = true; world.storyDone = true; }
        world.save();
      }
    },
    // Called every step; returns nothing, advances stages when met.
    update(world, dt) {
      if (this.done) return;
      const s = this.stageDef();
      const p = world.player;
      if (s.kind === 'stealCar' && world.inCar) this.advance(world);
      else if (s.kind === 'reach') {
        if (dist(p, s.target) < s.radius && (!s.onFoot || !world.inCar)) this.advance(world);
      } else if (s.kind === 'defeat') {
        if (this.defeated >= s.count) this.advance(world);
      } else if (s.kind === 'loseCops') {
        if (world.wanted <= 0) this.advance(world);
      } else if (s.kind === 'grab') {
        if (dist(p, s.target) < s.radius) {
          this.holdTime += dt;
          if (this.holdTime >= s.hold) { world.wanted = 3; this.advance(world); }
        } else this.holdTime = 0;
      }
      // Mission 3 spawns its enforcers when the player gets near the harbour.
      if (this.index === 2 && this.stage === 0 && world.enemies.length === 0) {
        if (dist(p, landmarks.harbour) < 500) world.spawnEnemies(3, landmarks.harbour);
      }
      // Mission 4 sets the wanted level when the vault stage starts.
      if (this.index === 3 && this.stage === 2 && world.wanted < 3) world.wanted = 3;
    },
  };
}
