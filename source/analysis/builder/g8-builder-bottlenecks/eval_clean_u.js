'use strict';
// eval_clean_u.js
// Evaluates clean key pairs and clean thaw combinations on Layout 22 under heavy.js
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

const outDir = path.join(__dirname, 'clean-u-output');
fs.mkdirSync(outDir, { recursive: true });

const baseBrief = {
  layout: 22, shape: 'ushape', story: 'deepClock', stage: 'edge',
  frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
  seed: 1, mode: 'visibleChoice'
};
const base = VC.build(baseBrief);
if (!base.design) {
  console.error('Base build failed:', base.fail);
  process.exit(1);
}

const candidates = [
  // Pure key pairs (no ice)
  { id: 'u-keys-11-15-s1', keys: [11, 15], spare: 1 },
  { id: 'u-keys-49-61-s1', keys: [49, 61], spare: 1 },
  { id: 'u-keys-49-61-s2', keys: [49, 61], spare: 2 },

  // Clean ice combinations with spare 1 and 2
  { id: 'u-keys-5-9-ice44-s1', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 1 },
  { id: 'u-keys-5-9-ice44-s2', keys: [5, 9], ice: { tile: 44, h: 2 }, spare: 2 },
  { id: 'u-keys-2-41-ice68-s1', keys: [2, 41], ice: { tile: 68, h: 2 }, spare: 1 },
  { id: 'u-keys-2-41-ice73-s1', keys: [2, 41], ice: { tile: 73, h: 2 }, spare: 1 },
  { id: 'u-keys-3-52-ice68-s1', keys: [3, 52], ice: { tile: 68, h: 2 }, spare: 1 },
  { id: 'u-keys-18-56-ice68-s1', keys: [18, 56], ice: { tile: 68, h: 2 }, spare: 1 },
  { id: 'u-keys-33-59-ice68-s1', keys: [33, 59], ice: { tile: 68, h: 2 }, spare: 1 },
  { id: 'u-keys-44-51-ice68-s1', keys: [44, 51], ice: { tile: 68, h: 2 }, spare: 1 }
];

console.log(`Evaluating ${candidates.length} clean U-shape candidates...`);
const results = [];

for (const c of candidates) {
  const t0 = Date.now();
  const built = c.ice ? K.clockKeyIce(base.design, c.keys, c.ice, c.spare)
                      : K.clockKeys(base.design, c.keys, c.spare);
  if (built.fail) {
    console.log(`${c.id}: build failed (${built.fail})`);
    results.push({ id: c.id, fail: built.fail });
    continue;
  }

  const d = built.design;
  const key = L.contentKey(d);
  const strictWitness = E.replay(d, d.solution, { strict: true }).ok;
  const sg = GP.applyStatic(SG.staticGates(d, { shape: 'ushape', stopEarly: false }), profile);

  if (!sg.pass) {
    const failedGates = Object.keys(sg.gates).filter(g => sg.gates[g].pass === false);
    console.log(`${c.id}: static gate failed: ${failedGates.join(',')}`);
    results.push({ id: c.id, fail: 'staticGate', failedGates });
    continue;
  }

  const pl = ys.planner(d, { spare: c.spare });
  const fam = ys.rate(d, { block: 'CURVE', allResults: true });
  const tr = T.traceGates(d, GP.traceOptions({ ys, spare: c.spare, campaigns: 40 }, profile));

  const rec = {
    id: c.id, k: built.proof.minimum, clockN: d.clock.n, spare: c.spare,
    strictWitness, staticPass: sg.pass,
    S: pl.S, D: fam.D, D_se: fam.se,
    traces: {
      D: tr.D, pass: tr.pass,
      B1: tr.B1?.value,
      B2: tr.B2?.value,
      B3: tr.B3?.value,
      B4: tr.B4?.value,
      B5: tr.B5?.value,
      B6: tr.B6?.value,
      B7_repeat: tr.B7?.value,
      inflated: tr.B7?.inflated,
      maxTarget: tr.B7?.maxTarget,
      failedTraces: Object.keys(tr).filter(k => tr[k] && tr[k].pass === false)
    },
    ms: Date.now() - t0
  };

  results.push(rec);
  fs.appendFileSync(path.join(outDir, 'results.jsonl'), JSON.stringify(rec) + '\n');
  console.log(`[${c.id}] k=${rec.k} s=${c.spare} ck=${rec.clockN} => S=${rec.S} D=${rec.D.toFixed(2)} (traceD=${rec.traces.D.toFixed(2)}) B5=${rec.traces.B5} B6=${rec.traces.B6} B7=${rec.traces.B7_repeat} pass=${rec.traces.pass} (${rec.ms}ms)`);
}

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
console.log('Finished clean U-shape evaluation.');
