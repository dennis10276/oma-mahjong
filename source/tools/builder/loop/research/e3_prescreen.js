#!/usr/bin/env node
// E3 step 1: pick the board pool. Screens unique puzzles (ladder v3, knobs-v1, qualified 200-225) at spare 2 with
// 20 campaigns on seed 4711 (the SCREEN prefix; E3 itself uses other seeds), writes e3-pool.jsonl incrementally.
//   node heavy.js --label e3-prescreen -- node research/e3_prescreen.js [--max 170]
'use strict';
const fs = require('fs'), path = require('path');
const WT = path.resolve(__dirname, '../../../../..'), SRC = path.join(WT, 'source');
const Y = require('../yardstick.js'), K = require('../../knobs.js');
const OUT = path.join(SRC, 'build/e3/e3-pool.jsonl');
const max = +(process.argv[process.argv.indexOf('--max') + 1]) || 170;
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const pool = [];
for (const x of rd(path.join(SRC, 'analysis/builder/why-hard-v1/v3-reference/ladder-readable/boards.json'))) if (x.design) pool.push({ src: 'ladder:' + x.id, design: x.design });
for (const x of rd(path.join(SRC, 'analysis/builder/knobs-v1/boards.json'))) if (x.design) pool.push({ src: 'knobs-v1:' + x.id, design: x.design });
for (const l of fs.readFileSync(path.join(SRC, 'analysis/builder/data/qualified-200-225.jsonl'), 'utf8').trim().split('\n')) { const r = JSON.parse(l); pool.push({ src: 'qualified:' + r.id + '@' + r.level, design: r.design }); }
const seen = new Map();
for (const p of pool) { try { const k = Y.puzzleKey(p.design); if (!seen.has(k)) seen.set(k, { ...p, key: k }); } catch { /* skip */ } }
let list = [...seen.values()];
let s = 12345; const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
list = list.slice(0, max);
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).key) : []);
const ys = Y.createYardstick({ ledgerFile: false });
console.error('unique puzzles', seen.size, 'screening', list.length);
for (const p of list) {
  if (done.has(p.key)) continue;
  const t = K.clockSpare(p.design, 2);
  let row;
  if (t.fail) row = { key: p.key, src: p.src, fail: t.fail };
  else {
    const r = ys.rateCalls(t.design, [{ runs: 20, seeds: 1, seed: 4711 }], {});
    row = { key: p.key, src: p.src, D2screen: r.D, clockN: t.design.clock.n, valid: r.valid, design: p.design };
  }
  fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
}
console.error('done');
