#!/usr/bin/env node
'use strict';
// Runs one script as several worker processes inside a single heavy job (Dennis 2026-11-12: up to 8 cores).
// Each worker gets "--seed <seed0+i>" and "--shard <i>/<workers>" appended; a script uses whichever it knows.
//   node source/tools/builder/loop/heavy.js --label bank -- node source/tools/builder/bank/par.js --workers 8 --seed0 100 -- source/tools/builder/bank/generate.js --wall-min 60
const { spawn } = require('child_process');
const a = process.argv.slice(2), cut = a.indexOf('--');
const opt = (n, d) => { const i = a.indexOf('--' + n); return i < 0 || i > cut ? d : a[i + 1]; };
const workers = Math.min(8, +opt('workers', 8)), seed0 = +opt('seed0', 100), rest = a.slice(cut + 1);
let left = workers, bad = 0;
for (let i = 0; i < workers; i++) {
  const p = spawn(process.execPath, [...rest, '--seed', String(seed0 + i), '--shard', `${i}/${workers}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `[w${i}] `;
  for (const s of [p.stdout, p.stderr]) s.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => console.log(tag + l)));
  p.on('exit', c => { if (c) bad++; if (--left === 0) process.exit(bad ? 1 : 0); });
}
