#!/usr/bin/env node
'use strict';
// Supplemental recovery, not a rerun of the original E6 pipeline. Use heavy.js.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
function main() {
  const lock = path.join(ROOT, 'source/build/heavy.lock/owner.json');
  if (!fs.existsSync(lock)) throw Error('Run this recovery through loop/heavy.js');
  process.kill(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, 0);
  const P = require('../run_pipeline.js'), L = require('../library.js'), B = require('../../builder.js');
  const DC = require('../dial_curve.js'), ys = require('../counterfactual.js').rulerYardstick();
  const output = path.join(ROOT, 'source/analysis/builder/process-v1/e6-curves.jsonl');
  const runs = new Set(read(path.join(L.LIB_DIR, 'pipeline-runs.jsonl')).filter(r => !r.dryRun && r.range[0] < 500 && r.options.seedBase === 1).map(r => r.run));
  const finalists = read(path.join(L.LIB_DIR, 'rejects.jsonl')).filter(r => runs.has(r.run) && r.gate === 'traces');
  const briefs = P.candidateBriefs(JSON.parse(fs.readFileSync(path.join(ROOT, 'source/tools/builder/briefs-v1.json'), 'utf8')));
  for (const r of finalists) {
    if (read(output).some(x => x.key === r.key && x.fingerprint === ys.fingerprint)) continue;
    const cand = P.candidateAt(briefs, r.index, 1);
    if (cand.brief.id !== r.briefId || cand.brief.seed !== r.seed) throw Error('candidate schedule changed');
    const t0 = Date.now(), cpu0 = process.cpuUsage(), built = B.build(cand.brief);
    if (!built.design || L.contentKey(built.design) !== r.key) throw Error('rebuild content mismatch at ' + r.index);
    const curve = DC.measureCurve(built.design, ys, { spares: [0, 1, 2, 3, 4] });
    const cpu = process.cpuUsage(cpu0);
    const row = { at: new Date().toISOString(), supplemental: true, index: r.index, key: r.key, briefId: r.briefId, seed: r.seed,
      fingerprint: ys.fingerprint, code: P.codeFingerprints(), cpuS: (cpu.user + cpu.system) / 1e6, wallS: (Date.now() - t0) / 1000,
      curve: { k: curve.k, points: curve.points, steps: curve.steps, verdicts: curve.verdicts, shippable: curve.shippable, monotone: curve.monotone, diallable: curve.diallable, ratio13: curve.ratio13 } };
    fs.appendFileSync(output, JSON.stringify(row) + '\n');
    console.log(JSON.stringify({ index: r.index, cpuS: row.cpuS, points: curve.points.map(p => ({ spare: p.spare, D: p.D, valid: p.valid })), shippable: curve.shippable }));
  }
}
if (require.main === module) main();
