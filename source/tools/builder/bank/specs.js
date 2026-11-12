'use strict';
// Deterministic pseudo-random candidate specs for the puzzle bank. No difficulty target anywhere.
const C = require('../../builder-next/components.js');

const STORIES = ['keysFarSide', 'keysOnIsland', 'clockInSight', 'iceLockClock', 'lockBeside', 'roomInTrayLocked', 'roomInTrayFrozen', 'deepClock'];
// --focus (run 1, 1,956 measured boards): tray room 0 gives 20% at D>=7 against 2% at tray room 2; the room-in-tray stories under 1%.
const FOCUS_STORIES = ['keysFarSide', 'keysOnIsland', 'clockInSight', 'iceLockClock', 'iceLockClock', 'lockBeside', 'deepClock'];
const STAGES = ['edge', 'top'];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (seed, i) => (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul((i + 1) | 0, 0x85ebca6b)) >>> 0;

function eligibleLayouts({ big = false } = {}) {
  const out = [];
  C.LAYOUTS.forEach((l, i) => {
    const n = l.tiles.length;
    if (big ? n === 96 : (n >= 72 && n <= 96)) out.push({ layout: i, shape: l.shape, tiles: n, big: n === 96 });
  });
  return out;
}

// spec i of stream `seed`: independent of every other index (resumable).
function specAt(seed, i, opts = {}) {
  const rng = mulberry32(mix(seed, i)), pick = a => a[Math.floor(rng() * a.length)];
  // --small (Dennis 2026-11-12): favour 72-80 tiles on non-big levels; the game has 36 pictures, so every tile pair
  // above 72 repeats a picture. 82-88 stay at a low weight, 96 only for the big slots (--big).
  const el = eligibleLayouts(opts);
  const L = pick(opts.small && !opts.big ? el.flatMap(l => l.tiles <= 80 ? [l, l, l, l] : l.tiles <= 88 ? [l] : []) : el);
  const spare = pick([1, 2, 3]);
  return {
    id: `${seed}-${i}`, index: i,
    layout: L.layout, shape: L.shape, tiles: L.tiles, big: L.big,
    story: pick(opts.focus ? FOCUS_STORIES : STORIES), stage: pick(STAGES),
    spare,
    depth: pick([null, null, 2, 3, 4, 5, 6]),
    traps: pick([0, 1, 2, 3]),
    // --smart (Dennis 2026-11-12: too many face-down tiles feel like luck): at most 30% face-down
    maxDown: pick(opts.smart ? [0, 0.1, 0.2, 0.3] : [0, 0.1, 0.2, 0.3, 0.4, 0.5]),
    hiddenOnWay: pick([0, 1]),
    trayRoom: pick(opts.focus ? [0, 0, 0, 0, 1] : [0, 1, 2]),
    tailPairWidth: pick([null, 1, 2, 3]),
    buildSeed: 1 + Math.floor(rng() * 9999)
  };
}
const recipeOf = s => ({
  story: s.story, stage: s.stage, frameSpare: s.spare, spare: s.spare,
  ...(s.depth != null ? { depth: s.depth } : {}), traps: s.traps, maxDown: s.maxDown,
  hiddenOnWay: s.hiddenOnWay, trayRoom: s.trayRoom, ...(s.tailPairWidth != null ? { tailPairWidth: s.tailPairWidth } : {})
});
module.exports = { specAt, recipeOf, eligibleLayouts, STORIES };
