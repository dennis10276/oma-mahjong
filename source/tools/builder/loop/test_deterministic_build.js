/* Deterministic builds (process v1 step 0b, Claude 2026-11-07): node --test source/tools/builder/loop/test_deterministic_build.js
   A brief and a seed must give the same board however busy the PC is. Ten briefs from briefs-v1.json (all stories but
   two, a 3-4 s build, a 2.9 s build and two that fail) are built three times in this process:
     1. normally;
     2. while a worker_thread burns a CPU core in a busy loop;
     3. with Date.now() jumping 10 s per call, so any engine search still on an ms budget would give up early.
   The designs (or the failure and its detail) must be byte-identical. Plus: the wall-clock safety cap fails a build,
   it never returns another board. About 25 s on a free PC. */
'use strict';
const test = require('node:test'), assert = require('node:assert');
const path = require('path');
const { Worker } = require('worker_threads');
const B = require('../builder.js');
const BRIEFS = require('../briefs-v1.json');

const PICK = [0, 5, 10, 15, 19, 20, 25, 30, 37, 45];
const briefs = PICK.map(i => BRIEFS[i]);

// what must not change: the full design of a built board, or the failure with its detail; plus the work counted
const fingerprint = r => JSON.stringify(r.design ? { design: r.design, work: r.work } : { fail: r.fail, detail: r.detail || null, work: r.work });
const buildAll = () => briefs.map(b => fingerprint(B.build(b, {})));

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

test('the same briefs give byte-identical boards: normal, with a CPU-burning worker, and with a jumping Date.now', async () => {
  const normal = buildAll();
  assert.ok(normal.some(f => f.includes('"design"')), 'at least one brief builds');
  assert.ok(normal.some(f => f.includes('"fail"')), 'at least one brief fails (failures must be deterministic too)');

  const worker = await startBusy();
  let busy;
  try { busy = buildAll(); } finally { worker.postMessage('stop'); await worker.terminate(); }
  for (let k = 0; k < briefs.length; k++) assert.strictEqual(busy[k], normal[k], briefs[k].id + ': another board with a busy CPU');

  // a clock that runs fast: every Date.now() call 10 s later than the last (engine and exact.js ms checks use it)
  const realNow = Date.now; let fake = realNow();
  Date.now = () => (fake += 10000);
  let jumpy;
  try { jumpy = buildAll(); } finally { Date.now = realNow; }
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

test('a work budget is deterministic: the same small hardWork gives the same result twice', () => {
  const b = BRIEFS[30];   // chainReaction-steps-1: the slowest brief (about 0.6 M nodes)
  const a = B.build(b, { hardWork: 100000 }), c = B.build(b, { hardWork: 100000 });
  assert.strictEqual(fingerprint(a), fingerprint(c));
  assert.ok(a.work >= 100000 || a.fail, 'the cap was reached or the build failed honestly');
});
