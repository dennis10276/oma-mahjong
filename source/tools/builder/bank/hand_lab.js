#!/usr/bin/env node
'use strict';
// Put proven hand boards (analysis/builder/hand/*.board.json) into a lab ideas file.
//   node source/tools/builder/bank/hand_lab.js <out-ideas.js> [names...]
const fs = require('fs'), path = require('path'), F = require('../footprint.js'), DT = require('./detower.js');
const DIR = path.resolve(__dirname, '../../../analysis/builder/hand');
const names = process.argv.slice(3).length ? process.argv.slice(3) : fs.readdirSync(DIR).filter(f => f.endsWith('.board.json')).map(f => f.replace('.board.json', ''));
const ideas = names.map((n, k) => {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, n + '.board.json'), 'utf8')), d = j.design, sp = { ...j.spec, ...(fs.existsSync(path.join(DIR, n + '.js')) ? require(path.join(DIR, n + '.js')) : {}) };
  const px = F.measure(d, { minimum: 58 }).tilePx, k0 = d.solution.indexOf(d.clock.i) + 1;
  return { id: (+process.env.LAB_BASE || 950000) + k, lv: (+process.env.LAB_LV || 350) + k, title: (sp.title || n) + ' · ' + px.toFixed(1) + ' px', kind: 'hand',
    idea: (sp.idea || '') + ` Clock in ${d.clock.n} (${k0} needed). ${j.offers ? j.offers.biting + ' of ' + j.offers.tempting + ' tempting moves on the way lose.' : ''}`,
    tiles: d.tiles.length, board: { tiles: d.tiles, faces: d.faces, down: d.down, gold: d.gold || [], obst: d.obst, clock: d.clock, solution: d.solution },
    shape: { towers: DT.shape(d.tiles).straight } };
});
const o = { made: new Date().toISOString(), heading: 'Hand-designed traps · 350+', factory: true,
  intro: 'Hand-designed chains, each built around one new wrong idea (silver keys included). Play them; rate how hard the trap is to spot and whether there is an AHA.',
  verdict: [['easy', 'Too easy'], ['right', 'About right'], ['hard', 'Too hard']], noteHint: 'AHA? Hard to spot? Tries?', winText: 'How hard was the trap to spot?', ideas };
fs.writeFileSync(process.argv[2], 'const LAB_IDEAS = ' + JSON.stringify(o) + ';');
console.log(ideas.map(i => i.lv + ' ' + i.title + ' towers ' + i.shape.towers).join('\n'));
