#!/usr/bin/env node
'use strict';
// Easing ladders: is there a fine dial between "brutal" and "easy"? For boards the family ruler rates hard
// (D40 >= 9), measure D while (a) adding clock moves one at a time and (b) turning face-down tiles face-up in
// cumulative quarters. Family ruler, 40 campaigns, cap 40, common seed 90002. Measurement only.
//   node source/tools/builder/loop/heavy.js --label bank-ladder -- node source/tools/builder/bank/ladder.js --wall-min 25
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const M = require('../../factory/meter.js');
const C = require('../../builder-next/components.js');
const { createYardstick } = require('../../builder-next/yardstick.js');
const S = require('./specs.js');
const MS = require('./measure.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const DIR = path.join(ROOT, 'source/build/bank'), OUT = path.join(DIR, 'ladder.jsonl');
const wallMs = +arg('wall-min', 25) * 60000, t0 = Date.now();
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const census = {};
for (const f of fs.readdirSync(DIR).filter(f => /^census-\d+(-big)?\.jsonl$/.test(f))) for (const r of read(path.join(DIR, f))) census[r.id] = r;
const hard = new Map();
for (const r of read(path.join(DIR, 'dcensus.jsonl'))) if (r.D40 >= 9) hard.set(r.id, r.D40);
for (const r of Object.values(census)) if (r.dScreen && r.dScreen.D40 >= 9) hard.set(r.id, r.dScreen.D40);
const done = new Set(read(OUT).map(r => r.id));
const ys = createYardstick({ protocol: 'extended-40-v1' });
const D = d => { const m = MS.family(ys.meters.family, d, [{ runs: 40, seed: 90002 }], 40); return { D40: m.D40, D20: m.D20, cens: m.censoredShare }; };
for (const [id, d0] of hard) {
  if (done.has(id) || Date.now() - t0 > wallMs) continue;
  const r = census[id];
  const b = C.buildCandidate(r.spec.layout, r.spec.shape, r.spec.buildSeed, S.recipeOf(r.spec), { wallMs: 20000 });
  if (!b.ok || M.boardKey(b.design) !== r.boardKey) { console.log('rebuild mismatch', id); continue; }
  const base = b.design, out = { id, knobs: r.knobs, tiles: r.spec.tiles, k: r.k, clockN: r.clockN, down: base.down.length, S: r.sScreen && r.sScreen.S, d0, clock: [], reveal: [] };
  for (let e = 0; e <= 10; e++) {
    const d = JSON.parse(JSON.stringify(base)); d.clock.n = base.clock.n + e;
    const m = D(d); out.clock.push({ extra: e, ...m });
    if (m.D40 < 2) break;
  }
  if (base.down.length >= 4) for (let q = 1; q <= 4; q++) {
    const d = JSON.parse(JSON.stringify(base)); d.down = base.down.slice(Math.round(base.down.length * q / 4));
    out.reveal.push({ revealed: base.down.length - d.down.length, ...D(d) });
  }
  fs.appendFileSync(OUT, JSON.stringify(out) + '\n');
  console.log(id, r.knobs.story, 'k', r.k, 'n', r.clockN, 'down', out.down, 'S', out.S, '| clock+e:', out.clock.map(c => c.D40).join(' '), '| reveal:', out.reveal.map(c => c.D40).join(' '));
}
