#!/usr/bin/env node
'use strict';
// Family-D census of candidates the skilled screen dropped (S < 1.8): what would the bank hold if the
// skilled band were lower? Rebuilds each board from its spec (deterministic) and runs the same D screen
// (family ruler, 40 campaigns, cap 40, seed 90002). Measurement only; nothing is banked.
//   node source/tools/builder/loop/heavy.js --label bank-dcensus -- node source/tools/builder/bank/dcensus.js --max 300 --wall-min 25
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const M = require('../../factory/meter.js');
const C = require('../../builder-next/components.js');
const { createYardstick } = require('../../builder-next/yardstick.js');
const S = require('./specs.js');
const MS = require('./measure.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const DIR = path.join(ROOT, 'source/build/bank'), OUT = path.join(DIR, 'dcensus.jsonl');
const max = +arg('max', 300), wallMs = +arg('wall-min', 25) * 60000, t0 = Date.now();
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
const rows = [];
for (const f of fs.readdirSync(DIR).filter(f => /^census-\d+(-big)?\.jsonl$/.test(f)).sort())
  for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) if (l.trim()) rows.push(JSON.parse(l));
const todo = rows.filter(r => r.failStage === 'sScreen' && /^S</.test(r.failReason) && !done.has(r.id));
const ys = createYardstick({ protocol: 'extended-40-v1' });
let n = 0;
for (const r of todo) {
  if (n >= max || Date.now() - t0 > wallMs) break;
  const b = C.buildCandidate(r.spec.layout, r.spec.shape, r.spec.buildSeed, S.recipeOf(r.spec), { wallMs: 20000 });
  if (!b.ok || M.boardKey(b.design) !== r.boardKey) { console.log(`[dcensus] ${r.id} rebuild mismatch`); continue; }
  const d = MS.family(ys.meters.family, b.design, [{ runs: 40, seed: 90002 }], 40);
  fs.appendFileSync(OUT, JSON.stringify({ id: r.id, boardKey: r.boardKey, knobs: r.knobs, tiles: r.spec.tiles, clockN: r.clockN, k: r.k,
    downCount: r.downCount, S: r.sScreen.S, ok: d.ok, D20: d.D20, D40: d.D40, median: d.median, censoredShare: d.censoredShare, raw: d.raw.map(c => c.tries) }) + '\n');
  n++;
  if (n % 25 === 0) console.log(`[dcensus] ${n} done`);
}
console.log(`[dcensus] finished ${n}`);
