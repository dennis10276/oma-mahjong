'use strict';
// Rate live levels lo..hi: family ruler at 80 campaigns under cap 20 and cap 40, and skilled B3 (planner) at 40.
// Resumable: appends to source/build/real-v2/ratings.jsonl. usage: node real_v2_rate.js <lo> <hi> [maxSeconds]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'source/www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'source/www/hard.js'));
const { createYardstick } = require('../../../builder-next/yardstick.js');
const OUT = path.join(ROOT, 'source/build/real-v2/ratings.jsonl');
const [lo, hi, maxSec = 330] = process.argv.slice(2).map(Number);
const ys20 = createYardstick({ protocol: 'standard-20-v1' }), ys40 = createYardstick({ protocol: 'extended-40-v1' });
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map(l => { const r = JSON.parse(l); return r.lv + ':' + r.what; }) : []);
const t00 = Date.now();
const emit = r => { fs.appendFileSync(OUT, JSON.stringify(r) + '\n'); done.add(r.lv + ':' + r.what); };
for (let lv = lo; lv <= hi; lv++) {
  const d = Hard.get(lv);
  for (const what of ['D20', 'D40', 'S']) {
    if (done.has(lv + ':' + what)) continue;
    if ((Date.now() - t00) / 1000 > maxSec) { console.log('time budget reached before', lv, what); process.exit(0); }
    const t0 = Date.now();
    if (what === 'S') { const p = ys20.planner(d); emit({ lv, what, S: p.S, styles: p.styles, valid: p.valid, firstTryRate: p.firstTryRate, tiles: d.tiles.length, clock: d.clock, sec: (Date.now() - t0) / 1000 }); }
    else { const r = (what === 'D20' ? ys20 : ys40).rate(d, { block: 'CURVE', allResults: false }); emit({ lv, what, D: r.D, pHat: r.pHat, se: r.se, n: r.n, valid: r.valid, perCampaign: r.perCampaign, tiles: d.tiles.length, sec: (Date.now() - t0) / 1000 }); }
  }
  console.log(lv, ((Date.now() - t00) / 1000).toFixed(0) + 's');
}
console.log('all done', lo, hi);
