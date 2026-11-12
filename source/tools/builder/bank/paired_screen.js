#!/usr/bin/env node
'use strict';
// Paired check of --smart: rebuild the UNsmartened board of every smart census record whose board smarten changed, run the same
// D screen (family bot, 40 campaigns, seed 90002) on it and write it next to the smartened value from the census.
//   node source/tools/builder/loop/heavy.js --label paired -- node source/tools/builder/bank/par.js --workers 8 -- source/tools/builder/bank/paired_screen.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..'), DIR = path.join(ROOT, 'source/build/bank');
const C = require('../../builder-next/components.js'), { createYardstick } = require('../../builder-next/yardstick.js'), S = require('./specs.js'), MS = require('./measure.js');
const a = process.argv, sh = (a[a.indexOf('--shard') + 1] || '0/1').split('/').map(Number);
const rows = fs.readdirSync(DIR).filter(f => /^census-50\d-focus-small-smart\.jsonl$/.test(f)).flatMap(f => fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)))
  .filter(r => r.texture && r.texture.changed && r.dScreen && r.dScreen.ok);
const ys = createYardstick({ protocol: 'extended-40-v1' });
const out = path.join(DIR, 'paired-smart-' + sh[0] + '.jsonl'); fs.writeFileSync(out, '');
rows.forEach((r, i) => {
  if (i % sh[1] !== sh[0]) return;
  const b = C.buildCandidate(r.spec.layout, r.spec.shape, r.spec.buildSeed, S.recipeOf(r.spec), { wallMs: 20000 });
  if (!b.ok) return;
  const m = MS.family(ys.meters.family, b.design, [{ runs: 40, seed: 90002 }], 40);
  fs.appendFileSync(out, JSON.stringify({ id: r.id, tiles: r.spec.tiles, orig: m.ok ? m.D40 : null, smart: r.dScreen.D40, edits: r.texture.edits, J: r.texture.J }) + '\n');
});
