#!/usr/bin/env node
'use strict';
/* orders.js: every winning order to the clock over the tiles that matter, for designing by hand (see skill oma-see-board).
     const O = require('./orders.js');
     O.orders({ layout, tiles: [ids that may be taken], faces: {id: picture}, clock, limit, ice, locks, keys, locks2, keys2, down: [ids] })
       -> { wins: [[moves...]], firstMoves: {id: count}, free0: [...], strictWins }
   Only the listed tiles can be taken (the others stay on the board); each listed tile without a twin in the list waits until after
   the clock (trayMax: only wins with at most that many tiles waiting after the clock). Rules as the game: tray at most 3 waiting, ice, gold and silver locks, and a face-down tile with a free twin go
   together without a slot ("[a+b]", two clock moves). strictWins: the same without face-down pairs. */
const E = require('../engine.js'), H = require('./hand.js');
global.Layouts = global.Layouts || require('../../../www/layouts.js');
const L = global.Layouts;
function orders(o) {
  const tiles = H.layouts()[o.layout].tiles.map(t => t.slice(0, 3)), n = tiles.length;
  const nb = L.neighbors(tiles.map(([x, y, z]) => ({ x, y, z }))), iceNb = L.iceNeighbors(tiles.map(([x, y, z]) => ({ x, y, z })));
  const rules = { iceNb, ice: o.ice || {}, locks: (o.locks || []).length ? new Set(o.locks) : null, keys: o.keys || [],
    locks2: (o.locks2 || []).length ? new Set(o.locks2) : null, keys2: o.keys2 || [] };
  const gone = o.gone || [], init = new Uint8Array(n).fill(1); for (const i of gone) init[i] = 0;   // gone: tiles already taken (pictures in tray0, moves counted)
  const T = o.tiles.filter(i => !gone.includes(i)).concat(o.clock), down = new Set(o.down || []), face = o.faces, limit = o.limit;
  const can = (i, a) => a[i] && L.takeable(i, a, nb, rules, init);
  const run = peek => {
    const wins = [], memo = new Set();
    const go = (a, tray, moves, path) => {
      if (!a[o.clock]) { if (o.trayMax == null || tray.length <= o.trayMax) wins.push(path); return; }   // trayMax: room left after the clock
      if (moves >= limit || wins.length >= (o.max ?? 400)) return;
      const key = T.map(i => a[i]).join('') + '|' + tray.slice().sort().join(',');
      if (!o.all && memo.has(key)) return; memo.add(key);
      const fr = T.filter(i => can(i, a));
      for (const i of fr) {
        const a2 = a.slice(); a2[i] = 0; const q = tray.indexOf(face[i]), t2 = q >= 0 ? tray.filter((_, k) => k !== q) : tray.concat(face[i]);
        if (t2.length <= 3) go(a2, t2, moves + 1, [...path, i]);
      }
      if (peek) for (let x = 0; x < fr.length; x++) for (let y = x + 1; y < fr.length; y++) {
        const i = fr[x], j = fr[y]; if (face[i] !== face[j] || !(down.has(i) || down.has(j)) || tray.includes(face[i])) continue;
        const a2 = a.slice(); a2[i] = a2[j] = 0; go(a2, tray, moves + 2, [...path, '[' + i + '+' + j + ']']);
      }
    };
    go(init.slice(), (o.tray0 || []).slice(), gone.length, []); return wins;   // tray0: pictures already waiting at the start
  };
  const wins = run(true), first = {};
  // the first moves, exact: each one played, then a fresh search from there (the state memo of one run would hide orders)
  const init0 = init.slice();
  for (const i of T.filter(i => can(i, init0))) {
    const a = init0.slice(); a[i] = 0; const sub = [];
    const memo = new Set(), go = (a, tray, moves) => {
      if (sub.length) return; if (!a[o.clock]) { if (o.trayMax == null || tray.length <= o.trayMax) sub.push(1); return; } if (moves >= limit) return;
      const key = T.map(j => a[j]).join('') + '|' + tray.slice().sort().join(','); if (memo.has(key)) return; memo.add(key);
      const fr = T.filter(j => can(j, a));
      for (const j of fr) { const a2 = a.slice(); a2[j] = 0; const q = tray.indexOf(face[j]), t2 = q >= 0 ? tray.filter((_, k) => k !== q) : tray.concat(face[j]); if (t2.length <= 3) go(a2, t2, moves + 1); }
      for (let x = 0; x < fr.length; x++) for (let y = x + 1; y < fr.length; y++) { const p = fr[x], q2 = fr[y]; if (face[p] !== face[q2] || !(down.has(p) || down.has(q2)) || tray.includes(face[p])) continue; const a2 = a.slice(); a2[p] = a2[q2] = 0; go(a2, tray, moves + 2); }
    };
    { const q = (o.tray0 || []).indexOf(face[i]), t0 = (o.tray0 || []).slice(); if (q >= 0) t0.splice(q, 1); else t0.push(face[i]); if (t0.length <= 3) go(a, t0, 1 + gone.length); }
    if (sub.length) first[i] = (wins.filter(w => w[0] === i).length) || 1;
  }
  return { wins, firstMoves: first, free0: T.filter(i => can(i, init)), strictWins: o.peek === false ? null : run(false).length, shortest: wins.length ? Math.min(...wins.map(w => w.reduce((m, x) => m + (typeof x === 'string' ? 2 : 1), 0))) : null };
}
module.exports = { orders };
if (require.main === module) {
  const spec = require(require('path').resolve(process.argv[2])), r = orders({ ...spec, all: process.argv.includes('--all') });
  console.log(`winning orders within ${spec.limit}: ${r.wins.length} (without face-down pairs: ${r.strictWins}); shortest ${r.shortest}`);
  console.log('free at the start:', r.free0.join(' '), '| first moves that can win:', JSON.stringify(r.firstMoves));
  r.wins.slice(0, 10).forEach(w => console.log('  ' + w.join(' ')));
}
