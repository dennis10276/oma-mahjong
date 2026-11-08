#!/usr/bin/env node
'use strict';
// E6: run_pipeline.js with the E5-calibrated gates (library/gates-calibrated.json), resumable chunks.
//   node loop/heavy.js --label e6 -- node loop/research/e6_run.js --n 100 --start auto --max-minutes 40
// Calibration applied by wrapping deps (no loop/ tool edited):
//   static: A5 and A7 report-only (pass -> null, would-pass kept), A7 thresholds relaxed to 99 (logged only)
//   traces: opts.thresholds = B2 min .20, B3 min .08, B4 max 10, B6 max .65
// Every static / trace verdict (pass or fail) is appended to process-v1/e6-gates.jsonl so pass rates per gate can be read.
const fs = require('fs'), path = require('path');
const P = require('../run_pipeline.js'), Lb = require('../library.js');
const OUT = path.resolve(__dirname, '../../../../analysis/builder/process-v1/e6-gates.jsonl');
const REPORT_ONLY = ['A5', 'A7'];
const TH_TRACE = { B2: { min: 0.2 }, B3: { min: 0.08 }, B4: { max: 10 }, B6: { max: 0.65 } };
const TH_STATIC = { A7: { unrelieved: 99, tightBlind: 99, lostDeals: 99 } };
const log = o => fs.appendFileSync(OUT, JSON.stringify(o) + '\n');

function parse(argv) { const a = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; return a; }
function main() {
  const a = parse(process.argv.slice(2));
  const libDir = Lb.LIB_DIR, lib = Lb.createLibrary({ dir: libDir }), seedBase = +(a['seed-base'] ?? 1);
  let start = a.start === undefined ? 0 : a.start;
  if (start === 'auto') { const runs = Lb.readJsonl(path.join(libDir, 'pipeline-runs.jsonl')).filter(r => !r.dryRun && (r.options?.seedBase ?? 1) === seedBase); start = runs.length ? Math.max(...runs.map(r => r.next)) : 0; }
  const opts = { ...P.DEFAULTS, n: +(a.n ?? 100), start: +start, seedBase, maxMinutes: +(a['max-minutes'] ?? 40), targets: (a.targets || '5.4,8.5').split(',').map(Number), skilledFloor: 2.5, curveSpares: [0, 1, 2, 3, 4] };
  const B = require('../../builder.js'), CF = require('../counterfactual.js'), SG = require('../static_gates.js'), TR = require('../traces.js');
  let cur = null;
  const ys = CF.rulerYardstick();
  const deps = {
    ys,
    staticGates: (d, o) => {
      const r = SG.staticGates(d, { ...o, thresholds: TH_STATIC });
      const raw = Object.fromEntries(Object.entries(r.gates).map(([g, v]) => [g, v.pass]));
      for (const g of REPORT_ONLY) if (r.gates[g]) r.gates[g] = { ...r.gates[g], pass: null, reportOnly: true, wouldPass: r.gates[g].pass };
      const warn = (r.warnings || []).some(w => /^wallClock/.test(w));
      r.pass = ['A1', 'A2', 'A3', 'A4', 'A6', 'A9'].every(g => r.gates[g].pass === true) && !!(r.shipSpares && r.shipSpares.length);
      log({ step: 'static', i: cur, raw, k: r.k, ship: r.shipSpares, pass: r.pass, wallClock: warn, ms: r.ms, why: Object.fromEntries(Object.entries(r.gates).filter(([, v]) => v.pass === false).map(([g, v]) => [g, v.detail?.why ?? null])) });
      return r;
    },
    screenBoard: require('../screen.js').screenBoard,
    measureCurve: (d, y, o) => { const c = require('../dial_curve.js').measureCurve(d, y, o); log({ step: 'curve', i: cur, k: c.k, points: (c.points || []).map(p => ({ spare: p.spare, D: p.D, se: p.se, n: p.n, valid: p.valid, probe: p.probe ?? null, fail: p.fail ?? null })), steps: c.steps, shippable: c.shippable, monotone: c.monotone, diallable: c.diallable, ratio13: c.ratio13, verdicts: Object.fromEntries(Object.entries(c.verdicts || {}).map(([s, v]) => [s, { canShip: v.canShip, monotone: v.monotone, reasons: v.reasons }])) }); return c; },
    traceGates: (d, o) => {
      const t = TR.traceGates(d, { ...o, thresholds: TH_TRACE });
      log({ step: 'traces', i: cur, spare: o.spare, pass: t.pass, fail: t.fail ?? null, gates: Object.fromEntries(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'].map(b => [b, t[b] ? { pass: t[b].pass, v: t[b].value ?? t[b].v ?? null } : null])) });
      return t;
    },
    c1: CF.c1, c2c3: CF.c2c3,
    build: brief => { cur = brief.id + '#' + brief.seed; return B.build(brief); },
    briefs: JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../briefs-v1.json'), 'utf8')),
    library: lib, code: P.codeFingerprints(),
  };
  const s = P.runPipeline(opts, deps);
  console.log(s.text);
}
main();
