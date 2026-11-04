/* A quick guess of a board's family rating from its make-up (Claude, 2026-11-04): what the factory learned from the
   1537 boards Codex's batches rated (learned-model.json; learn_rows.js rebuilds the data). Rank correlation 0.59 with
   the 6-game screen (the screen itself agrees 0.72 with the full meter). It never decides a level: it orders the work,
   so the boards most likely to land near their target get the bot first. The biggest levers it found: a long way to
   the clock (share of the board before it) makes a level much harder; more face-down tiles made these boards easier. */
'use strict';
const fs = require('fs'), path = require('path');
let M = null;
function model() { if (!M) M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'analysis', 'factory', 'learned-model.json'), 'utf8')); return M; }
function features(r) {
  const z = r.design, route = z.clock ? z.solution.indexOf(z.clock.i) + 1 : 0, ice = z.obst?.ice || {};
  return { ice: Object.keys(ice).length, iceH: Object.values(ice).reduce((a, b) => a + b, 0), locks: (z.obst?.locks || []).length,
    spare: z.clock ? z.clock.n - route : 0, routeShare: route / z.tiles.length, down: (z.down || []).length / z.tiles.length,
    n88: z.tiles.length / 88, luck: r.room?.tightBlind || 0, edits: (r.constructionEdits || []).length };
}
function predictTries(r) {
  const m = model(), f = features(r);
  let v = m.const; for (const k in m.num) v += m.num[k] * (f[k] || 0);
  for (const k of new Set(r.recipe || [])) v += m.recipe[k] || 0;
  return Math.min(20, Math.max(1, Math.exp(v)));
}
module.exports = { predictTries, features };
