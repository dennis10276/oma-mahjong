'use strict';
// probe_first_errors.js
// Analyzes first-error states, alternatives, and comparative ratings on Layout 22
// to understand how key depth, ice thaw, and spare affect family D and skilled S.

const fs = require('fs'), path = require('path');
const VC = require('../../../tools/builder/visible_choice.js');
const K = require('../../../tools/builder/knobs.js');
const SG = require('../../../tools/builder/loop/static_gates.js');
const GP = require('../../../tools/builder/loop/gate_profile.js');
const T = require('../../../tools/builder/loop/traces.js');
const Y = require('../../../tools/builder/loop/yardstick.js');
const E = require('../../../tools/builder/engine.js');
const L = require('../../../tools/builder/loop/library.js');

const profile = GP.loadProfile('e5-v1');
const ys = Y.createYardstick();

const outDir = path.join(__dirname, 'probe-errors-output');
fs.mkdirSync(outDir, { recursive: true });

const brief = {
  layout: 22, shape: 'ushape', story: 'deepClock', stage: 'edge',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 1, mode: 'visibleChoice'
};

const base = VC.build(brief);
if (!base.design) {
  console.error('Base build failed:', base.fail);
  process.exit(1);
}

console.log('Base Layout 22: k =', base.card.clock.fewestMoves, 'clock =', base.design.clock);

// Schedule of probes:
// 1. u-ice61 at spare 1 (known D=7.45)
// 2. u-ice61 at spare 2
// 3. u-ice42 (h=2, k=13) at spare 1
// 4. u-keys [5, 9] (k=13 without ice) at spare 1
// 5. u-keys [11, 15] (k=13 without ice) at spare 1

const probes = [
  { id: 'u-ice61-s1', keys: [0, 40], ice: { tile: 61, h: 1 }, spare: 1, traces: true },
  { id: 'u-ice61-s2', keys: [0, 40], ice: { tile: 61, h: 1 }, spare: 2, traces: true },
  { id: 'u-ice42-s1', keys: [0, 40], ice: { tile: 42, h: 2 }, spare: 1, traces: true },
  { id: 'u-keys-5-9-s1', keys: [5, 9], spare: 1, traces: true },
  { id: 'u-keys-11-15-s1', keys: [11, 15], spare: 1, traces: true }
];

const results = [];

for (const p of probes) {
  console.log(`\n========================================`);
  console.log(`Testing Probe: ${p.id}`);
  console.log(`========================================`);

  const built = p.ice ? K.clockKeyIce(base.design, p.keys, p.ice, p.spare)
                      : K.clockKeys(base.design, p.keys, p.spare);

  if (built.fail) {
    console.log(`Build failed: ${built.fail}`);
    results.push({ id: p.id, fail: built.fail });
    continue;
  }

  const d = built.design;
  const key = L.contentKey(d);
  const strictWitness = E.replay(d, d.solution, { strict: true }).ok;
  const sg = GP.applyStatic(SG.staticGates(d, { shape: brief.shape, stopEarly: false }), profile);
  const pl = ys.planner(d, { spare: p.spare });
  const fam = ys.rate(d, { block: 'CURVE', allResults: true });

  console.log(`k=${built.proof.minimum}, clock.n=${d.clock.n}, strictWitness=${strictWitness}, staticPass=${sg.pass}`);
  console.log(`Skilled S: ${pl.S} (valid: ${pl.valid}), Family D: ${fam.D} (SE: ${fam.se.toFixed(3)})`);

  let tr = null;
  if (p.traces) {
    tr = T.traceGates(d, GP.traceOptions({ ys, spare: p.spare, campaigns: 40 }, profile));
    console.log(`Traces (40 camp): D=${tr.D}, B1=${tr.B1.pass} (${tr.B1.value}), B2=${tr.B2.pass} (${tr.B2.value}), B4=${tr.B4.pass} (${tr.B4.value}), B5=${tr.B5.pass} (${tr.B5.value}), B6=${tr.B6.pass} (${tr.B6.value}), B7.repeat=${tr.B7.value} (inflated: ${tr.B7.inflated}), pass=${tr.pass}`);
  }

  const rec = {
    id: p.id, k: built.proof.minimum, clockN: d.clock.n, spare: p.spare,
    key, strictWitness, staticPass: sg.pass,
    S: pl.S, D: fam.D, D_se: fam.se,
    traces: tr ? {
      D: tr.D, pass: tr.pass,
      B1: tr.B1, B2: tr.B2, B3: tr.B3, B4: tr.B4, B5: tr.B5, B6: tr.B6, B7: tr.B7,
      lossesAtTrapShare: tr.lossesAtTrapShare, delayMedian: tr.delayMedian,
      lateSqueezeShare: tr.lateSqueezeShare, postClockShare: tr.postClockShare,
      repeatShare: tr.repeatShare
    } : null
  };
  results.push(rec);
  fs.appendFileSync(path.join(outDir, 'probe-results.jsonl'), JSON.stringify(rec) + '\n');
}

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
console.log('\nProbe completed successfully.');
