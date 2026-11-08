'use strict';
// E4 step 1: rate live levels (decoded from www/levels-hard.js via Hard.get, read only) on the pinned family ruler and the
// reference bot at the live clock, and the planner on the priority levels. Incremental output: process-v1/e4-live-ratings.jsonl.
// usage: node e4_live.js survey | run [--planner] [--lo 85 --hi 199]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'source/www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const Hard = require(path.join(ROOT, 'source/www/hard.js'));
const { createYardstick } = require('../yardstick.js');
const OUT = path.join(ROOT, 'source/analysis/builder/process-v1/e4-live-ratings.jsonl');
const ys = createYardstick();
const PRIORITY = [...Array(25).keys()].map(i => 175 + i).concat([91, 132, 150]);
const mode = process.argv[2] || 'survey';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const lo = arg('--lo', 85), hi = arg('--hi', 199);
const levels = [...new Set([...PRIORITY, ...Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)])].filter(l => l >= lo && l <= hi || PRIORITY.includes(l)).sort((a, b) => a - b);
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map(l => { const r = JSON.parse(l); return r.lv + ':' + r.what; }) : []);
const emit = r => { fs.appendFileSync(OUT, JSON.stringify(r) + '\n'); done.add(r.lv + ':' + r.what); };
if (mode === 'survey') {
  let fam = 0, ref = 0; const miss = [];
  for (const lv of levels) { const d = Hard.get(lv); const f = ys.cached(d, 'CURVE', 'family'), r = ys.cached(d, 'CURVE', 'reference'); fam += f; ref += r; if (!f || !r) miss.push(lv + (f ? '' : 'F') + (r ? '' : 'R')); }
  console.log(levels.length, 'levels; cached family', fam, 'reference', ref, 'missing', miss.join(' '));
} else {
  const t00 = Date.now();
  for (const lv of levels) {
    const d = Hard.get(lv);
    for (const bot of ['family', 'reference']) {
      if (done.has(lv + ':' + bot)) continue;
      const t0 = Date.now(), r = ys.rate(d, { block: 'CURVE', bot, allResults: false });
      emit({ lv, what: bot, D: r.D, pHat: r.pHat, se: r.se, n: r.n, valid: r.valid, clock: d.clock, tiles: d.tiles.length, fp: r.fingerprint.slice(0, 8), sec: (Date.now() - t0) / 1000 });
    }
    if (process.argv.includes('--planner') && PRIORITY.includes(lv) && !done.has(lv + ':planner')) {
      const t0 = Date.now(), p = ys.planner(d);
      emit({ lv, what: 'planner', S: p.S, styles: p.styles, valid: p.valid, firstTryRate: p.firstTryRate, clock: d.clock, fp: p.fingerprint.slice(0, 8), sec: (Date.now() - t0) / 1000 });
    }
    console.log(lv, ((Date.now() - t00) / 1000).toFixed(0) + 's');
  }
}
