'use strict';
// Rate live levels lo..hi with the pinned family ruler, protocol extended-40-v1 (cap 40, 80 campaigns), in parallel workers.
// Resumable; appends to source/build/real-v2/ratings40.jsonl. Run through heavy.js:
//   node source/tools/builder/loop/heavy.js --label normal-rate -- node source/tools/builder/loop/research/normal_rate.js 70 169 8 330
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../../..');
const OUT = path.join(ROOT, 'source/build/real-v2/ratings40.jsonl');
const [lo, hi, nw = 8, maxSec = 330, wk, wn] = process.argv.slice(2).map(Number);
const doneSet = () => new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).lv) : []);
if (wk === undefined || isNaN(wk)) {
  const t0 = Date.now(); let live = 0;
  for (let k = 0; k < nw; k++) { live++; cp.fork(__filename, [lo, hi, nw, maxSec, k, nw]).on('exit', () => { if (--live === 0) console.log('workers done', ((Date.now() - t0) / 1000).toFixed(0) + 's, rated', doneSet().size); }); }
} else {
  global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'source/www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
  const Hard = require(path.join(ROOT, 'source/www/hard.js'));
  const { createYardstick } = require('../../../builder-next/yardstick.js');
  const ys = createYardstick({ protocol: 'extended-40-v1' });
  const done = doneSet(), t0 = Date.now();
  for (let lv = lo + wk; lv <= hi; lv += wn) {
    if (done.has(lv)) continue;
    if ((Date.now() - t0) / 1000 > maxSec) break;
    const d = Hard.get(lv), r = ys.rate(d, { block: 'CURVE', allResults: false });
    fs.appendFileSync(OUT, JSON.stringify({ lv, D40: r.D, pHat: r.pHat, se: r.se, n: r.n, valid: r.valid, perCampaign: r.perCampaign, tiles: d.tiles.length, clock: d.clock }) + '\n');
  }
}
