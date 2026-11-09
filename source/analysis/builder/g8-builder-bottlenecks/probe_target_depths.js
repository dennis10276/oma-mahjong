'use strict';
// probe_target_depths.js
// Evaluates candidate key/lock/thaw plans on Layouts 22 (U), 0 (Arch), 20 (Castle), 14 (Hourglass)
// across clock depths k in [10, 16] to measure the relationship between k, spare, S, and D.

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

const outDir = path.join(__dirname, 'probe-depths-output');
fs.mkdirSync(outDir, { recursive: true });

// Pre-build bases for the layouts:
const bases = {};
function getBase(layout, shape, stage, seed) {
  const key = `${layout}_${stage}_${seed}`;
  if (!bases[key]) {
    const brief = {
      layout, shape, story: 'deepClock', stage: stage || undefined,
      frame: { spare: 2 }, targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2 },
      seed, mode: 'visibleChoice'
    };
    bases[key] = VC.build(brief);
  }
  return bases[key];
}

const candidates = [
  // Layout 22 (ushape)
  { id: 'u-k15-ice44-s1', layout: 22, shape: 'ushape', stage: 'edge', seed: 1, keys: [12, 16], ice: { tile: 44, h: 2 }, spare: 1 },
  { id: 'u-k15-ice44-s2', layout: 22, shape: 'ushape', stage: 'edge', seed: 1, keys: [12, 16], ice: { tile: 44, h: 2 }, spare: 2 },
  { id: 'u-k13-keys12-16-s1', layout: 22, shape: 'ushape', stage: 'edge', seed: 1, keys: [12, 16], spare: 1 },
  { id: 'u-k13-keys13-17-s1', layout: 22, shape: 'ushape', stage: 'edge', seed: 1, keys: [13, 17], spare: 1 },

  // Layout 0 (arch)
  { id: 'arch-k15-keys13-29-s1', layout: 0, shape: 'arch', stage: 'edge', seed: 1, keys: [13, 29], lockTile: 0, spare: 1 },
  { id: 'arch-k15-keys13-29-s2', layout: 0, shape: 'arch', stage: 'edge', seed: 1, keys: [13, 29], lockTile: 0, spare: 2 },
  { id: 'arch-k14-keys12-52-s1', layout: 0, shape: 'arch', stage: 'edge', seed: 1, keys: [12, 52], lockTile: 0, spare: 1 },
  { id: 'arch-k14-keys12-52-s2', layout: 0, shape: 'arch', stage: 'edge', seed: 1, keys: [12, 52], lockTile: 0, spare: 2 },
  { id: 'arch-k13-keys7-59-s1', layout: 0, shape: 'arch', stage: 'edge', seed: 1, keys: [7, 59], lockTile: 0, spare: 1 },

  // Layout 20 (castle)
  { id: 'castle-k14-keys39-65-s1', layout: 20, shape: 'castle · two islands', stage: 'top', seed: 2, keys: [39, 65], lockTile: 77, spare: 1 },
  { id: 'castle-k14-keys39-65-s2', layout: 20, shape: 'castle · two islands', stage: 'top', seed: 2, keys: [39, 65], lockTile: 77, spare: 2 },
  { id: 'castle-k14-keys47-62-s1', layout: 20, shape: 'castle · two islands', stage: 'top', seed: 2, keys: [47, 62], lockTile: 77, spare: 1 },

  // Layout 14 (hourglass)
  { id: 'hourglass-k10-keys1-69-s1', layout: 14, shape: 'hourglass', stage: 'edge', seed: 2, keys: [1, 69], lockTile: 76, spare: 1 }
];

console.log(`Starting probe of ${candidates.length} candidates across 4 layouts...`);
const results = [];

for (const c of candidates) {
  const base = getBase(c.layout, c.shape, c.stage, c.seed);
  if (!base.design) {
    console.log(`${c.id}: base failed (${base.fail})`);
    continue;
  }

  const proofOpts = c.lockTile != null ? { lockTile: c.lockTile } : {};
  const built = c.ice ? K.clockKeyIce(base.design, c.keys, c.ice, c.spare, proofOpts)
                      : K.clockKeys(base.design, c.keys, c.spare, proofOpts);

  if (built.fail) {
    console.log(`${c.id}: build failed (${built.fail})`);
    results.push({ id: c.id, fail: built.fail });
    continue;
  }

  const d = built.design;
  const key = L.contentKey(d);
  const strictWitness = E.replay(d, d.solution, { strict: true }).ok;
  const sg = GP.applyStatic(SG.staticGates(d, { shape: c.shape, stopEarly: false }), profile);

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
    id: c.id, layout: c.layout, shape: c.shape, k: built.proof.minimum,
    clockN: d.clock.n, spare: c.spare, key, strictWitness, staticPass: sg.pass,
    S: pl.S, D: fam.D, D_se: fam.se,
    traces: {
      D: tr.D, pass: tr.pass,
      B1: tr.B1?.value, B2: tr.B2?.value, B3: tr.B3?.value, B4: tr.B4?.value,
      B5: tr.B5?.value, B6: tr.B6?.value, B7_repeat: tr.B7?.value,
      inflated: tr.B7?.inflated, maxTarget: tr.B7?.maxTarget,
      failedTraces: Object.keys(tr).filter(k => tr[k] && tr[k].pass === false)
    }
  };

  console.log(`${c.id.padEnd(26)} | k=${String(rec.k).padEnd(2)} sp=${rec.spare} ck=${String(rec.clockN).padEnd(2)} | S=${String(rec.S).padEnd(5)} D=${String(rec.D).padEnd(6)} | B5=${rec.traces.B5} B6=${rec.traces.B6} B7=${rec.traces.B7_repeat} | tracePass=${rec.traces.pass} fails=[${rec.traces.failedTraces.join(',')}]`);

  results.push(rec);
  fs.appendFileSync(path.join(outDir, 'depths-results.jsonl'), JSON.stringify(rec) + '\n');
}

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
console.log('Done.');
