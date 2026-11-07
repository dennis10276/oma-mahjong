/* Deterministic builds (process v1 step 0b, Claude 2026-11-07): node --test source/tools/builder/loop/test_deterministic_build.js
   A brief and a seed must give the same board however busy the PC is. Ten briefs from briefs-v1.json (every story;
   deepClock only as an incompatible brief; two that fail as unproven after real search) are built three times in
   this process:
     1. normally;
     2. while a worker_thread burns a CPU core in a busy loop;
     3. with Date.now() AND performance.now() jumping 10 s per call and the wall-clock safety cap off (wallMs:
        Infinity), so any search or builder branch that still read the clock would give up early or go another way.
   The designs (or the failure and its detail) and the work counted must be byte-identical. Plus: the wall-clock
   safety cap fails a build, it never returns another board; and a small hardWork stops a build at a bounded work
   count with the distinct failure 'workBudget', the same way twice.
   The ten briefs are fast ones (most work 0.08 M nodes). One slow build (chainReaction-steps-1 seed 1, about 4 s,
   0.63 M nodes) has its own test at the end: normal vs jumping clock. iceLockClock-diamond-30 (0.9 M) is left out. */
'use strict';
const test = require('node:test'), assert = require('node:assert');
const { Worker } = require('worker_threads');
const B = require('../builder.js');
const BRIEFS = require('../briefs-v1.json');

// keysFarSide, keysOnIsland, clockInSight, iceLockClock, lockBeside, frozenGuards, chainReaction (unproven),
// roomInTrayLocked (unproven), roomInTrayFrozen, deepClock (incompatibleBrief)
const PICK = [0, 5, 10, 15, 20, 25, 31, 37, 43, 45];
const briefs = PICK.map(i => BRIEFS[i]);

// what must not change: the full design of a built board, or the failure with its detail; plus the work counted
const fingerprint = r => JSON.stringify(r.design ? { design: r.design, work: r.work } : { fail: r.fail, detail: r.detail || null, work: r.work });
const buildAll = (opts = {}) => briefs.map(b => fingerprint(B.build(b, opts)));

function withJumpingClock(fn) {
  const realNow = Date.now, perf = globalThis.performance, ownPerf = Object.prototype.hasOwnProperty.call(perf, 'now'), realPerf = perf.now;
  let fake = realNow(), fakeP = realPerf.call(perf);
  Date.now = () => (fake += 10000);
  perf.now = () => (fakeP += 10000);
  try {
    assert.ok(performance.now() + 5000 < performance.now(), 'performance.now is patched');
    return fn();
  } finally { Date.now = realNow; if (ownPerf) perf.now = realPerf; else delete perf.now; }
}

function startBusy() {
  const w = new Worker(`
    const { parentPort } = require('worker_threads');
    let stop = false, x = 0;
    parentPort.on('message', () => { stop = true; });
    parentPort.postMessage('started');
    // burn in slices so the stop message is seen
    (function burn() { const end = Date.now() + 50; while (Date.now() < end) x = (x * 1103515245 + 12345) >>> 0; if (!stop) setImmediate(burn); else process.exit(0); })();
  `, { eval: true });
  return new Promise((resolve, reject) => { w.once('message', () => resolve(w)); w.once('error', reject); });
}

test('the same briefs give byte-identical boards: normal, with a CPU-burning worker, and with jumping clocks', async () => {
  const normal = buildAll();
  assert.ok(normal.some(f => f.includes('"design"')), 'at least one brief builds');
  assert.ok(normal.some(f => f.includes('"fail":"unproven"')), 'at least one brief fails after search (failures must be deterministic too)');

  const worker = await startBusy();
  let busy;
  try { busy = buildAll(); } finally { worker.postMessage('stop'); await worker.terminate(); }
  for (let k = 0; k < briefs.length; k++) assert.strictEqual(busy[k], normal[k], briefs[k].id + ': another board with a busy CPU');

  // clocks that run fast: every Date.now() / performance.now() call 10 s later than the last (the engine's ms checks
  // use Date.now, the builder's own clock is performance.now); the safety cap is off so only a wrong branch can show
  const jumpy = withJumpingClock(() => buildAll({ wallMs: Infinity }));
  for (let k = 0; k < briefs.length; k++) assert.strictEqual(jumpy[k], normal[k], briefs[k].id + ': another board with a jumping clock');
});

test('the wall-clock safety cap is a failure, never another board', () => {
  const b = briefs[0];
  const r = B.build(b, { wallMs: 0 });
  assert.strictEqual(r.fail, 'wallClock');
  assert.ok(!r.design);
  // afterwards the next build is untouched by the tripped cap
  assert.strictEqual(fingerprint(B.build(b, {})), fingerprint(B.build(b, {})));
});

test('a small hardWork stops the build, deterministically, and says so (workBudget)', () => {
  const b = BRIEFS[26];   // frozenGuards-oval-31: builds with about 40 k nodes when unconstrained (run1: 40,143)
  const full = B.build(b, {});
  assert.ok(full.design, 'unconstrained it builds');
  const hard = 20000;
  const a = B.build(b, { hardWork: hard }), c = B.build(b, { hardWork: hard });
  assert.strictEqual(fingerprint(a), fingerprint(c));
  assert.strictEqual(a.fail, 'workBudget', 'a build the budget cut short is not reported as a design failure');
  assert.ok(a.cause, 'the failure it would have reported is kept as cause');
  // the budget is checked between steps, not inside them. After the last check one pass can still spend: a winnable
  // search 40 k + a fewest-way search 150 k + the same at 4x 600 k (builder.js 529, 563-564), the strict exactRoute
  // 300 k (771), a reach check 60 k and one trap search 60 k (806; each later trap is checked first): 1.21 M.
  assert.ok(a.work >= hard && a.work <= hard + 1210000, 'work ' + a.work + ' is bounded by hardWork');
  assert.ok(a.work < full.work, 'the budget cut the work (' + a.work + ' < ' + full.work + ')');
});

test('a slow build (chainReaction-steps-1 seed 1, ~0.6 M nodes) is the same with a jumping clock', () => {
  const b = { ...BRIEFS.find(x => x.id === 'chainReaction-steps-1'), seed: 1 };
  const normal = fingerprint(B.build(b, {}));
  const jumped = withJumpingClock(() => fingerprint(B.build(b, { wallMs: Infinity })));
  assert.strictEqual(jumped, normal);
  assert.ok(JSON.parse(normal).work > 300000, 'it is a long build');
});
