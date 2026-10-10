#!/usr/bin/env node
/* Runs the tests for Oma's Mahjong.

     node tests/run.js              all offline tests (a fake database, nothing is sent anywhere)
     node tests/run.js rescue       only tests whose name (or file name) contains "rescue"
     node tests/run.js --online     also the tests against the real database (test- players only,
                                    cleaned up afterwards)
     JOBS=1 node tests/run.js       one test at a time (default: 3 at once, each in its own browser tab)

   Needs Node and Playwright with Chromium (set CHROME=/path/to/chrome if it is not found). */
'use strict';
const fs = require('fs'), path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const online = args.includes('--online');
const filter = args.find(a => !a.startsWith('--'));
const JOBS = Math.max(1, +process.env.JOBS || 3);

const tests = [];
for (const f of fs.readdirSync(__dirname).filter(f => /^t_.*\.js$/.test(f)).sort()) {
  for (const t of [].concat(require(path.join(__dirname, f)))) tests.push({ ...t, file: f });
}
const todo = tests.filter(t => (!filter || t.name.toLowerCase().includes(filter.toLowerCase()) || t.file.includes(filter)) && (!t.online || online));

async function runOne(test) {
  const fails = [], pages = [];
  const t = {
    ok(cond, msg, detail) { if (!cond) fails.push(msg + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); return !!cond; },
    eq(a, b, msg) { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fails.push(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); return ok; },
    async phone(opts) { const p = await lib.phone(opts); pages.push(p); return p; },
    log: (...a) => { if (process.env.VERBOSE) console.log('   ', ...a); },
  };
  const s = Date.now();
  try { await test.run(t, lib); }
  catch (e) { fails.push('crashed: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); }
  for (const p of pages) {
    if (!test.allowErrors && p.errors.length) fails.push('errors on the page: ' + p.errors.slice(0, 3).join(' | '));
    try { await p.ctx.close(); } catch (e) { }
  }
  console.log(`${fails.length ? '✗ FAIL' : '✓ ok  '}  ${test.name}  (${((Date.now() - s) / 1000).toFixed(1)}s)`);
  for (const f of fails) console.log('         ' + f);
  return { name: test.name, fails };
}

(async () => {
  await lib.setup();
  const t0 = Date.now(), results = [];
  // the engine tests (t_layouts) only compute, for many seconds, which keeps this process busy:
  // they go first, on their own, so they never hold up a phone page of another test
  const cpu = t => t.file === 't_layouts.js';
  for (const t of todo.filter(cpu)) results.push(await runOne(t));
  // the rest a few at the same time: most of a test is waiting for animations and timers
  const queue = todo.filter(t => !cpu(t));
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (queue.length) results.push(await runOne(queue.shift()));
  }));
  await lib.teardown();
  const bad = results.filter(r => r.fails.length);
  if (bad.length) console.log('\nFailed:\n' + bad.map(r => '  ✗ ' + r.name).join('\n'));
  console.log(`\n${results.length - bad.length}/${results.length} tests passed in ${Math.round((Date.now() - t0) / 1000)}s` + (online ? '' : ' (offline; add --online for the real-database tests)'));
  process.exit(bad.length ? 1 : 0);
})();
