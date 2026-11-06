/* The fewest moves to take one tile off the board (best-first search over every legal order: the tray
   with its 4 slots, ice, locks), for an honest alarm clock: Dennis found clocks "too loose" because the
   older search (hard.js clockRoute, a beam search) often found a way much longer than the shortest.
   exactRoute(g, ci) -> { k, path } with path a whole way through the level (the rest by the solver),
   taking ci at move k; the first prefix (in order of length) that can also be finished.
   STRICT RULES (Claude, 2026-11-06): this search does not know the game's peek pair (a turned-over free face-down
   tile and its free twin are taken together without a tray slot), so k can be too long: by 1-2 moves on 5 of the
   18 qualified 200-225 boards. Its paths are valid under Hard.validSolution, which is why it stays. For the real
   fewest moves use tools/builder/engine.js clockShortest (peek pairs on; {strict:true} wraps this file). */
'use strict';
const path = require('path');
const L = require(path.join(__dirname, '..', '..', 'www', 'layouts.js'));
function makeLowerBound(g, ci) {
  const ancestors = g.tiles.map((_, i) => {
    const out = new Set(), todo = [i];
    while (todo.length) for (const j of g.nb.above[todo.pop()]) if (!out.has(j)) { out.add(j); todo.push(j); }
    return [...out];
  });
  return alive => {
    const required = new Set(), rules = g.rules, keysLeft = rules && (rules.keys || []).some(i => alive[i]);
    let changed = false;
    const add = i => { for (const j of [i, ...ancestors[i]]) if (alive[j] && !required.has(j)) { required.add(j); changed = true; } };
    add(ci);
    do {
      changed = false;
      for (const i of required) {
        if (keysLeft && rules.locks?.has(i)) for (const key of rules.keys) add(key);
        const need = rules?.ice?.[i] || 0;
        if (!need) continue;
        const neighbours = rules.iceNb[i], gone = neighbours.filter(j => !alive[j]).length;
        const planned = neighbours.filter(j => alive[j] && required.has(j)).length;
        const remaining = need - gone - planned;
        if (remaining <= 0) continue;
        const optional = neighbours.filter(j => alive[j] && !required.has(j));
        if (optional.length === remaining) for (const j of optional) add(j);
        // If every sufficient thaw needs a locked neighbour, its keys are
        // mandatory too. Count the dependency, not a guessed route.
        if (keysLeft && optional.filter(j => !rules.locks?.has(j)).length < remaining)
          for (const key of rules.keys) add(key);
      }
    } while (changed);
    const side = name => {
      const extra = new Set(), todo = [ci], seen = new Set();
      while (todo.length) { const i = todo.pop(); if (seen.has(i)) continue; seen.add(i);
        for (const j of g.nb[name][i]) if (alive[j]) { if (!required.has(j)) extra.add(j); todo.push(j); } }
      return extra.size;
    };
    let thaw = 0;
    for (const i of required) if (rules?.ice?.[i]) {
      const accounted = rules.iceNb[i].filter(j => !alive[j] || required.has(j)).length;
      thaw = Math.max(thaw, rules.ice[i] - accounted);
    }
    // Side work and thaw work can share tiles: max, not sum, stays a lower bound.
    return required.size + Math.max(Math.min(side('left'), side('right')), thaw);
  };
}
function exactRoute(g, ci, limit = +(process.env.EXACT_LIMIT || 400000), milliseconds = Infinity) {
  const started = Date.now();
  const n = g.tiles.length, F = g.faces, init = new Uint8Array(n).fill(1);
  const can = (i, alive) => alive[i] && (g.rules ? L.takeable(i, alive, g.nb, g.rules, init) : L.isFree(i, alive, g.nb));
  const rulesNow = alive => { if (!g.rules) return null; const ice = {}; for (const k in g.rules.ice) { const gone = g.rules.iceNb[k].filter(i => !alive[i]).length; if (g.rules.ice[k] > gone) ice[k] = g.rules.ice[k] - gone; } return { ...g.rules, ice }; };
  const lower = makeLowerBound(g, ci);
  // a small binary heap on f = moves + lower bound
  const heap = [], push = x => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a].f < heap[m].f) m = a; if (b < heap.length && heap[b].f < heap[m].f) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const seen = new Set(); let nodes = 0;
  push({ alive: init, tray: [], path: [], f: lower(init) });
  while (heap.length && nodes < limit) {
    // A budget miss is unresolved, never evidence that a longer route is exact.
    if (nodes % 64 === 0 && Date.now() - started >= milliseconds) return null;
    const s = pop(); nodes++;
    for (let i = 0; i < n; i++) {
      if (!can(i, s.alive)) continue;
      const q = s.tray.findIndex(j => F[j] === F[i]);
      if (q < 0 && s.tray.length >= 3) continue;           // a 4th single fills the tray
      const alive = s.alive.slice(); alive[i] = 0;
      const tray = q < 0 ? s.tray.concat(i) : s.tray.filter((_, k) => k !== q), p = s.path.concat(i);
      if (i === ci) {
        const rest = L.solve(g.tiles, g.nb, F, alive, tray, 30000, rulesNow(alive));
        if (rest) return { k: p.length, path: p.concat(rest), nodes };
        continue;
      }
      const key = alive.join('') + '|' + tray.map(j => F[j]).sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue; seen.add(key);
      push({ alive, tray, path: p, f: p.length + lower(alive) });
    }
  }
  return null;
}
module.exports = { exactRoute, makeLowerBound };
