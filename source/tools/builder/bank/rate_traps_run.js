#!/usr/bin/env node
'use strict';
// One bounded heavy job, up to eight workers; interrupted stages resume from cards/cache.
// With the shared scheduler, reserve the worker count explicitly:
// node source/tools/builder/loop/heavy.js --cores 4 --label rate-traps -- node source/tools/builder/bank/rate_traps_run.js --workers 4 --phase measure
const { spawn } = require('child_process');
const path = require('path');
const args = process.argv.slice(2), i = args.indexOf('--workers');
const workers = Math.max(1, Math.min(8, i < 0 ? 8 : +args[i + 1]));
if (i >= 0) args.splice(i, 2);
let left = workers, failed = false;
const children = [];
const timer = setTimeout(() => { failed = true; console.error('14 minute bound reached; rerun to resume.'); for (const c of children) c.kill(); }, 14 * 60000);
for (let n = 0; n < workers; n++) {
  const c = spawn(process.execPath, [path.join(__dirname, 'rate_traps.js'), ...args, '--shard', `${n}/${workers}`], { stdio: 'inherit' });
  children.push(c);
  c.on('exit', code => { if (code !== 0) failed = true; if (--left === 0) { clearTimeout(timer); process.exitCode = failed ? 1 : 0; } });
}
