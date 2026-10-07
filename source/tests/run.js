#!/usr/bin/env node
/* Runs the tests for Oma's Mahjong.

     node tests/run.js              all offline tests (a fake database, nothing is sent anywhere)
     node tests/run.js rescue       only tests whose name contains "rescue"
     node tests/run.js --online     also the tests against the real database (test- players only,
                                    cleaned up afterwards)

   Needs Node and Playwright with Chromium (set CHROME=/path/to/chrome if it is not found). */
'use strict';
const fs = require('fs'), path = require('path');
const lib = require('./lib');

const args = process.argv.slice(2);
const online = args.includes('--online');
const filter = args.find(a => !a.startsWith('--'));

const tests = [];
for (const f of fs.readdirSync(__dirname).filter(f => /^t_.*\.js$/.test(f)).sort()) {
  for (const t of [].concat(require(path.join(__dirname, f)))) tests.push({ ...t, file: f });
}

(async () => {
  await lib.setup();
  const results = [];
  const t0 = Date.now();
  for (const test of tests) {
    if (filter && !test.name.toLowerCase().includes(filter.toLowerCase()) && !test.file.includes(filter)) continue;
    if (test.online && !online) continue;
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
    const secs = ((Date.now() - s) / 1000).toFixed(1);
    results.push({ name: test.name, fails });
    console.log(`${fails.length ? '✗ FAIL' : '✓ ok  '}  ${test.name}  (${secs}s)`);
    for (const f of fails) console.log('         ' + f);
  }
  await lib.teardown();
  const bad = results.filter(r => r.fails.length);
  console.log(`\n${results.length - bad.length}/${results.length} tests passed in ${Math.round((Date.now() - t0) / 1000)}s` + (online ? '' : ' (offline; add --online for the real-database tests)'));
  process.exit(bad.length ? 1 : 0);
})();
