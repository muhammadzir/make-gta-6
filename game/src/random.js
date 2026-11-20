// A small seeded random number generator (mulberry32): the same seed gives
// the same city, the same traffic and the same screenshot scenes, which is
// what makes Solmar Bay repeatable. Solmar Bay also uses pick() and range()
// so world generation reads as intent, not raw Math.random() calls.
export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random.range = (min, max) => min + random() * (max - min);
  random.int = (min, max) => Math.floor(random.range(min, max + 1));
  random.pick = (list) => list[Math.floor(random() * list.length)];
  random.chance = (p) => random() < p;
  return random;
}
