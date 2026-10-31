/* Level factory: move boards towards a difficulty band with the clock's spare moves (Claude, 2026-10-31).
   Dennis's +2 on 194 took it from 7.85 to 2.5 tries: for boards whose difficulty is the clock route, the
   spare is a strong knob. Spare stays 1-3 (the game's clock rule). Every variant is measured with g2.1
   (2 x 20, seed 4711) and the critic numbers (late squeeze, clock reach).
     node source/tools/factory/tune_spare.js <inventory.jsonl> <lo> <hi> <part> <parts> <out.jsonl>     */
'use strict';
const fs = require('fs');
const [invFile, lo, hi, part, parts, out] = process.argv.slice(2);
const { measureHuman } = require(process.env.HUMAN_BOT);
const inv = fs.readFileSync(invFile, 'utf8').trim().split('\n').map(JSON.parse);
const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id + '/' + JSON.parse(l).spare) : []);
inv.forEach((r, k) => {
  if (k % +parts !== +part || !r.design.clock || !r.g2) return;
  const d0 = r.design, route = d0.solution.indexOf(d0.clock.i) + 1, s0 = d0.clock.n - route, e = r.g2.exp;
  const tries = e > +hi ? [s0 + 1, s0 + 2] : e < +lo ? [s0 - 1, s0 - 2] : [];
  for (const sp of tries) {
    if (sp < 1 || sp > 3 || done.has(r.id + '/' + sp)) continue;
    const d = { ...d0, clock: { ...d0.clock, n: route + sp } }, n = d.tiles.length;
    const m = measureHuman({ tiles: d.tiles, faces: d.faces, down: d.down, obst: d.obst, clock: d.clock }, { runs: 20, setting: 'dennis', seed: 4711 });
    const at = m.results.flatMap(q => q.attempts), lost = at.filter(q => !q.win && !q.censored);
    const late = lost.filter(q => q.left <= 0.35 * n).length / Math.max(1, lost.length), reach = at.filter(q => q.clockLeft != null && q.clockLeft < n).length / Math.max(1, at.length);
    fs.appendFileSync(out, JSON.stringify({ id: r.id, spare: sp, from: { spare: s0, exp: e }, exp: m.expectedTries, first: m.firstTryRate, critic: { late: +late.toFixed(2), reach: +reach.toFixed(2), flags: [late > 0.3 && 'late squeeze', reach < 0.05 && 'clock out of reach'].filter(Boolean) } }) + '\n');
    if (m.expectedTries >= +lo && m.expectedTries <= +hi) break;
  }
});
