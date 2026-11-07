'use strict';
const E = require('./engine.js'), { tileVisibility } = require('../sim/refit/human_board_visibility.js');
function visibleKeys(g, s) {
  const keys = g.design.obst?.keys || [], state = { alive: s.alive, down: g.down, openPeek: -1 }, v = tileVisibility(g.tiles, state, g.clock, keys).tiles;
  return keys.filter(k => s.alive[k] && v[k]?.role && !(g.iceH[k] && g.iceNb[k].filter(i => !s.alive[i]).length < g.iceH[k]));
}
function features(design) {
  const g = E.game(design), keys = design.obst?.keys || []; let s = E.start(g);
  const shown = visibleKeys(g, s), ever = new Set(shown), each = Object.fromEntries(shown.map(k => [k, 0]));
  let both = keys.length && keys.every(k => ever.has(k)) ? 0 : null;
  const p = design.solution;
  for (let k = 0; k < p.length && both == null && keys.length; k++) {
    let act = p[k], next = E.step(g, s, act);
    if (!next || g.after && p[k + 1] === g.clock?.i && s.moves + 1 >= g.clock.n) {
      const pair = E.legal(g, s).find(a => typeof a === 'object' && a.pair.includes(p[k]) && a.pair.includes(p[k + 1]));
      if (!pair) break; act = pair; next = E.step(g, s, act); k++;
    }
    if (!next) break; s = next;
    for (const key of visibleKeys(g, s)) { if (!ever.has(key)) each[key] = s.moves; ever.add(key); }
    if (keys.every(key => ever.has(key))) both = s.moves;
  }
  return { hasKeys: keys.length > 0, keysShownAtStart: shown.length, keysVisibleIndicesAtStart: shown, movesUntilBothKeysShow: both,
    bothShownBeforeClock: both == null ? null : both < design.solution.indexOf(design.clock.i) + 1,
    keyRevealAt: each, definition: 'Actual public key glyph visible in the overlay region; cumulative sightings on the stored winning route, in tile-removal moves. No-key boards use null for time-to-both, not zero.' };
}
function select(boards, n = 10) {
  const candidates = boards.filter(b => !b.fail && b.family && b.skilled && b.family.exp >= 8 && b.design?.obst?.keys?.length &&
    !b.design.obst.keys.some(k => b.design.obst.ice?.[k]) && b.design.obst.keys.every(k => b.design.solution.indexOf(k) < b.design.solution.indexOf(b.design.clock.i)) && features(b.design).keysShownAtStart === 0), counts = new Map(), structures = new Map(), out = [];
  const structure = b => JSON.stringify([b.design.tiles, b.design.clock.i, b.design.obst]);
  while (candidates.length && out.length < n) {
    const cost = b => (counts.get(b.brief.story) || 0) * 100000 + (structures.get(structure(b)) || 0) * 1000;
    candidates.sort((a, b) => cost(a) - cost(b) || a.family.exp - b.family.exp || a.id.localeCompare(b.id));
    const b = candidates.shift(); out.push(b); counts.set(b.brief.story, (counts.get(b.brief.story) || 0) + 1); structures.set(structure(b), (structures.get(structure(b)) || 0) + 1);
    for (let i = candidates.length - 1; i >= 0; i--) if (structure(candidates[i]) === structure(b)) candidates.splice(i, 1);
  }
  return out;
}
function coverCorridor(g, keys) {
  const cover = new Set(keys), todo = keys.slice();
  while (todo.length) for (const i of g.nb.above[todo.pop()]) if (!cover.has(i)) { cover.add(i); todo.push(i); }
  return cover;
}
module.exports = { features, visibleKeys, select, coverCorridor };
