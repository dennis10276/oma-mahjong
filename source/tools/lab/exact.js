/* The fewest moves to take one tile off the board (best-first search over every legal order: the tray
   with its 4 slots, ice, locks), for an honest alarm clock: Dennis found clocks "too loose" because the
   older search (hard.js clockRoute, a beam search) often found a way much longer than the shortest.
   exactRoute(g, ci) -> { k, path } with path a whole way through the level (the rest by the solver),
   taking ci at move k; the first prefix (in order of length) that can also be finished. */
'use strict';
const path = require('path');
const L = require(path.join(__dirname, '..', '..', 'www', 'layouts.js'));
function exactRoute(g, ci, limit = 400000) {
  const n = g.tiles.length, F = g.faces, init = new Uint8Array(n).fill(1);
  const can = (i, alive) => alive[i] && (g.rules ? L.takeable(i, alive, g.nb, g.rules, init) : L.isFree(i, alive, g.nb));
  const rulesNow = alive => { if (!g.rules) return null; const ice = {}; for (const k in g.rules.ice) { const gone = g.rules.iceNb[k].filter(i => !alive[i]).length; if (g.rules.ice[k] > gone) ice[k] = g.rules.ice[k] - gone; } return { ...g.rules, ice }; };
  // a lower bound on the moves still needed: the tiles above ci, plus the shorter side chain, plus ci
  const lower = alive => {
    const up = new Set(), st = [ci];
    while (st.length) for (const j of g.nb.above[st.pop()]) if (alive[j] && !up.has(j)) { up.add(j); st.push(j); }
    const side = name => { const set = new Set(), st2 = [ci], seen = new Set(); while (st2.length) { const k = st2.pop(); if (seen.has(k)) continue; seen.add(k); for (const j of g.nb[name][k]) if (alive[j] && !up.has(j)) { set.add(j); st2.push(j); } } return set.size; };
    return up.size + Math.min(side('left'), side('right')) + 1;
  };
  // a small binary heap on f = moves + lower bound
  const heap = [], push = x => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a].f < heap[m].f) m = a; if (b < heap.length && heap[b].f < heap[m].f) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const seen = new Set(); let nodes = 0;
  push({ alive: init, tray: [], path: [], f: lower(init) });
  while (heap.length && nodes < limit) {
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
module.exports = { exactRoute };
