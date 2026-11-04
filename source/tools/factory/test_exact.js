'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const L = require('../../www/layouts.js');
const { makeLowerBound, exactRoute } = require('../lab/exact.js');
test('key/ice clock bound never exceeds exhaustive legal search on small boards', () => {
  const tiles = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [0, 2, 0], [2, 2, 0], [4, 2, 0], [1, 1, 1], [3, 1, 1]]
    .map(([x, y, z]) => ({ x, y, z }));
  const faces = [0, 1, 2, 0, 1, 2, 3, 3], nb = L.neighbors(tiles), iceNb = L.iceNeighbors(tiles), initial = new Uint8Array(8).fill(1);
  let checked = 0;
  for (const clock of [0, 2, 4, 7]) for (const ice of [{}, { 6: 1 }, { 6: 1, 2: 1 }]) for (const locked of [false, true]) {
    const rules = { ice, iceNb, locks: new Set(locked ? [clock] : []), keys: [0, 3] };
    const g = { tiles, faces, nb, rules }, bound = makeLowerBound(g, clock), memo = new Map();
    function exhaustive(alive, tray) {
      const key = alive.join('') + '|' + tray.slice().sort().join(',');
      if (memo.has(key)) return memo.get(key);
      let best = Infinity;
      for (let i = 0; i < 8; i++) {
        if (!alive[i] || !L.takeable(i, alive, nb, rules, initial)) continue;
        const q = tray.indexOf(faces[i]); if (q < 0 && tray.length >= 3) continue;
        if (i === clock) { best = 1; break; }
        const a = alive.slice(); a[i] = 0;
        const t = q >= 0 ? tray.filter((_, k) => k !== q) : tray.concat(faces[i]);
        best = Math.min(best, 1 + exhaustive(a, t));
      }
      if (Number.isFinite(best)) { assert(bound(alive) <= best, 'Clock dependency bound must be admissible'); checked++; }
      memo.set(key, best); return best;
    }
    exhaustive(initial, []);
  }
  assert(checked > 100);
});

test('a locked clock search includes the required keys without changing its answer', () => {
  const tiles = [0, 4, 8, 12, 16, 20].map(x => ({ x, y: 0, z: 0 }));
  const rules = { locks: new Set([5]), keys: [0, 1], ice: {}, iceNb: L.iceNeighbors(tiles) };
  const g = { tiles, faces: [0, 0, 1, 1, 2, 2], nb: L.neighbors(tiles), rules };
  assert.equal(makeLowerBound(g, 5)(new Uint8Array(6).fill(1)), 3);
  assert.equal(exactRoute(g, 5).k, 3);
});
