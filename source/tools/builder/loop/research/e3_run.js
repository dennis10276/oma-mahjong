#!/usr/bin/env node
// E3 step 2: noise scaling. 40 boards x spare {2,3} x 8 blocks x 40 campaigns (allResults) on fresh seeds.
//   node heavy.js --label e3-run -- node research/e3_run.js [--workers 6] [--boards 40]
// Seeds: block j = meter call {runs:20, seeds:2, seed: SEED0 + 15838*j}; SEED0 = 7000003 (ACCEPT-style, far from 4711/18427/29717..).
// The ACCEPT ledger is NOT touched (no accept() call; yardstick.rateCalls only). Output: source/build/e3/e3-ratings.<shard>.jsonl
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const WT = path.resolve(__dirname, '../../../../..'), SRC = path.join(WT, 'source'), DIR = path.join(SRC, 'build/e3');
const SEED0 = 7000003, STEP = 15838, BLOCKS = 8, SPARES = [2, 3];
const argv = process.argv, arg = (k, d) => argv.includes(k) ? +argv[argv.indexOf(k) + 1] : d;
const W = arg('--workers', 6), NB = arg('--boards', 40);

function pick() {
  const rows = fs.readFileSync(path.join(DIR, 'e3-pool.jsonl'), 'utf8').trim().split(String.fromCharCode(10)).map(JSON.parse)
    .filter(r => !r.fail && r.valid && r.D2screen >= 3 && r.D2screen <= 16.5).sort((a, b) => a.D2screen - b.D2screen);
  // stratified by screen D (the pool is bottom-heavy): quota per bin, evenly spaced inside a bin, deterministic
  const bins = [[3, 4, 6], [4, 5, 6], [5, 6.5, 6], [6.5, 8, 5], [8, 10, 6], [10, 13, 5], [13, 16.6, 6]];
  const out = [];
  for (const [lo, hi, k] of bins) {
    const u = rows.filter(r => r.D2screen >= lo && r.D2screen < hi), n = Math.min(k, u.length);
    for (let i = 0; i < n; i++) out.push(u[Math.round(i * (u.length - 1) / Math.max(1, n - 1))]);
  }
  return [...new Map(out.map(r => [r.key, r])).values()];
}

if (argv.includes('--worker')) {
  const shard = arg('--worker', 0);
  const Y = require('../yardstick.js'), K = require('../../knobs.js');
  const ys = Y.createYardstick({ ledgerFile: false, cacheDir: false });
  const boards = JSON.parse(fs.readFileSync(path.join(DIR, 'e3-boards.json'), 'utf8'));
  const out = path.join(DIR, `e3-ratings.${shard}.jsonl`);
  const done = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n').filter(Boolean).map(l => { const r = JSON.parse(l); return `${r.b}|${r.spare}|${r.block}`; }) : []);
  boards.forEach((bd, bi) => {
    if (bi % W !== shard) return;
    for (const spare of SPARES) {
      const t = K.clockSpare(bd.design, spare);
      if (t.fail) { fs.appendFileSync(out, JSON.stringify({ b: bi, spare, fail: t.fail }) + '\n'); continue; }
      for (let j = 0; j < BLOCKS; j++) {
        if (done.has(`${bi}|${spare}|${j}`)) continue;
        const call = { runs: 20, seeds: 2, seed: SEED0 + STEP * j };
        const r = ys.rateCalls(t.design, [call], { block: 'E3', allResults: true });
        fs.appendFileSync(out, JSON.stringify({ b: bi, spare, block: j, clockN: t.design.clock.n, D: r.D, valid: r.valid, n: r.nVisible, per: r.perCampaign }) + '\n');
      }
    }
  });
  process.exit(0);
}

fs.mkdirSync(DIR, { recursive: true });
const boards = pick();
fs.writeFileSync(path.join(DIR, 'e3-boards.json'), JSON.stringify(boards.map(r => ({ key: r.key, src: r.src, D2screen: r.D2screen, design: r.design }))));
console.error('boards', boards.length, 'D2screen range', boards[0].D2screen, boards[boards.length - 1].D2screen);
let live = 0, failed = 0;
for (let s = 0; s < W; s++) {
  live++;
  const c = cp.spawn(process.execPath, [__filename, '--worker', String(s), '--workers', String(W)], { stdio: 'inherit' });
  c.on('exit', code => { if (code) failed++; if (--live === 0) { console.error('all workers done, failed:', failed); process.exit(failed ? 1 : 0); } });
}
