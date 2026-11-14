#!/usr/bin/env node
'use strict';
/* The easy new-idea chains that are left over below 300 (reserve of assemble_all.js), rebuilt "slightly harder to fit 300+"
   (Dennis 2026-11-14: "These can be made into slightly harder ones to fit 300+"; earlier on one of them: "around 275 or more chained to
   place later"). Same shape and layout, built again with Codex's two "harder" dials (trap_mixes.js / chained_shapes.js):
     spare 1 instead of 2, and obviousness dial 2 = the move a pair-first player makes first is itself a proven bait.
   Then finished as usual (twins apart, face-down, tail) with chained_v2_finish.js and proven by trap_mixes.prove.
     node source/tools/builder/loop/heavy.js --label harder --cores 8 -- node source/tools/builder/bank/harder_reserve.js [--workers 8] [--seeds 41,42,43,44,45,46]
   Output: source/analysis/builder/bank/chained-v3-harder/<shape>-L<layout>-s<seed>-p1.json + report.json */
const fs = require('fs'), path = require('path');
const BANK = path.resolve(__dirname, '../../../analysis/builder/bank'), OUT = path.join(BANK, 'chained-v3-harder'), RAW = path.join(OUT, 'raw');
const { job } = require('../chained_v2_run.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const md = fs.readFileSync(path.join(BANK, 'placed-all/placed.md'), 'utf8'), line = md.split('\n').find(l => /^Reserve/.test(l)) || '';
  const hosts = (arg('hosts', null) || line.replace(/^.*?: /, '')).split(',').map(s => s.trim()).filter(Boolean).map(id => ({ name: id.split('-')[0], layout: +/-L(\d+)-/.exec(id)[1] }));
  const seeds = String(arg('seeds', '41,42,43,44,45,46')).split(',').map(Number), W = +arg('workers', 8), report = [];
  let next = 0;
  const one = async h => {
    const row = { ...h, tries: [] };
    for (const dial of [2, 1]) for (const seed of seeds) {
      const b = await job({ mode: 'build', name: h.name, layout: h.layout, seed, dial, spare: 1, ms: 25000, tries: 150 });
      if (!b.design) { row.tries.push(`d${dial} s${seed}: ${b.fail || Object.entries(b.fails || {}).sort((a, c) => c[1] - a[1]).slice(0, 2).map(x => x.join(':')).join(',')}`); continue; }
      const id = `${h.name}-L${h.layout}-s${seed}-p1`, rf = path.join(RAW, id + '.json'); fs.writeFileSync(rf, JSON.stringify(b));
      const f = await job({ mode: 'finish', file: rf, ms: 150000, seed, repairMs: 30000 });
      if (!f.design) { row.tries.push(`d${dial} s${seed}: finish ${f.fail}`); continue; }
      f.brief.obviousnessDial = dial; fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(f)); row.ok = id; row.dial = dial; break;
    }
    if (row.ok) return row;
    return row;
  };
  await Promise.all(Array.from({ length: W }, async () => { while (next < hosts.length) { const h = hosts[next++]; let r; for (const pass of [0]) r = await one(h); report.push(r); console.log(r.name, 'L' + r.layout, r.ok ? 'OK dial ' + r.dial + ' ' + r.ok : 'no board: ' + r.tries.slice(0, 4).join(' | ')); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); } }));
}
main();
