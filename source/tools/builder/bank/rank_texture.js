#!/usr/bin/env node
'use strict';
// Rank banked puzzles by how well they match Dennis's 262 (4 stars): few obvious pairs, real choices after the clock, face-down share <= 0.30,
// late-loss share B6 in 0.3-0.6, D 5-10, skilled S 1.75-6, B7 <= 0.3.   node rank_texture.js texture-banked.json [--n 8]
const fs = require('fs'), path = require('path'), T = require('./texture.js');
const ROOT = path.resolve(__dirname, '../../../..'), DIR = path.join(ROOT, 'source/analysis/builder/bank/puzzles');
const tex = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), nTop = +(process.argv[process.argv.indexOf('--n') + 1] || 8);
const files = fs.readdirSync(DIR);
const rows = tex.map(x => {
  const f = files.find(g => g.startsWith(x.name)); const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), c = p.card, r = T.row(x);
  const B6 = c.traceGates.B6.value, B7 = c.traceGates.B7.value;
  const pass = r.down <= 0.30 && B6 >= 0.3 && B6 <= 0.6 && c.stats.D40 >= 5 && c.stats.D40 <= 10 && c.stats.S >= 1.75 && c.stats.S <= 6 && B7 <= 0.3;
  const choices = r.chA, obv = (r.obvA || 0), adj = r.adjA || 0, simul = r.simA || 0;
  // ranking score: real choices after the clock (capped), few obvious / simultaneous pairs, few gamble steps, some tray pressure
  const score = Math.min(choices, 4) * 1.0 - 6 * obv - 3 * simul - 1.5 * adj + 1.0 * Math.min(r.tray2A || 0, 0.5) * 2 - 0.15 * r.gambleA;
  return { key: c.boardKey, short: c.boardKey.slice(0, 8), pass, score: Math.round(score * 100) / 100, shape: c.shape, tiles: c.tiles, story: c.story, D40: c.stats.D40, S: c.stats.S, B6, B7, down: r.down, obvA: r.obvA, simA: r.simA, adjA: r.adjA, chA: r.chA, tray2A: r.tray2A, gambleA: r.gambleA, repOv: r.repOv, smart: !!c.texture };
});
const ok = rows.filter(r => r.pass).sort((a, b) => b.score - a.score);
console.log('banked', rows.length, 'pass all filters', ok.length);
console.log(JSON.stringify(ok.slice(0, nTop), null, 0).replace(/\},\{/g, '},\n{'));
fs.writeFileSync(path.join(ROOT, 'source/build/bank/texture-rank.json'), JSON.stringify({ rows, ranked: ok }, null, 1));
