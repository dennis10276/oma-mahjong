/* Measure the levels as they ship (www/levels-hard.js): the three test players each play every
   level many times, on other games than the designer used. Writes tools/sim/measure.json.
     node tools/sim/measure.js [runs=120] [jobs=2] */
'use strict';
const { fork } = require('child_process');
const path = require('path'), fs = require('fs');
global.Layouts = require('../../www/layouts.js');
eval(fs.readFileSync(path.join(__dirname, '..', '..', 'www', 'levels-hard.js'), 'utf8').replace('const HARD_LEVELS', 'global.HARD_LEVELS'));
const H = require('../../www/hard.js'), L = global.Layouts;
const runs = +(process.argv[3] && process.argv[2] !== '--worker' ? process.argv[2] : 120);
function measure(lv, runs) {
  const d = H.get(lv), tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const down = new Uint8Array(n); d.down.forEach(i => down[i] = 1);
  const ob = d.obst, rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  const g = { tiles, nb, faces: d.faces, down, rules, clock: d.clock };
  const q = k => H.rate(g, runs, 990001 + lv, H.persona(k));   // (other games than the designer and the build check used)
  const s = q('sensible');
  return { lv, target: +H.target(lv).toFixed(2), targetStrong: +H.target(lv, 'strong').toFixed(2), sensible: s.rate, strong: q('strong').rate, average: q('average').rate, choices: +s.choices.toFixed(1), n, clock: d.clock ? d.clock.n : null };
}
if (process.argv[2] === '--worker') {
  process.on('message', ({ levels, runs }) => { for (const lv of levels) process.send(measure(lv, runs)); process.send({ done: true }); });
} else {
  const jobs = +(process.argv[3] || 2), T = global.HARD_LEVELS, from = T.from, to = T.from + T.levels.length - 1;
  const rows = []; let left = jobs;
  for (let j = 0; j < jobs; j++) {
    const w = fork(__filename, ['--worker']);
    const mine = []; for (let lv = from + j; lv <= to; lv += jobs) mine.push(lv);
    w.on('message', m => { if (m.done) { w.kill(); if (--left === 0) done(); return; } rows.push(m); process.stderr.write(`\r${rows.length}/${to - from + 1}`); });
    w.send({ levels: mine, runs });
  }
  function done() {
    rows.sort((a, b) => a.lv - b.lv);
    fs.writeFileSync(path.join(__dirname, 'measure.json'), JSON.stringify(rows));
    const band = (lo, hi) => { const r = rows.filter(x => x.lv >= lo && x.lv <= hi); const m = k => (r.reduce((a, x) => a + x[k], 0) / r.length); return `${lo}-${hi}: sensible ${m('sensible').toFixed(2)} (target ${m('target').toFixed(2)}) strong ${m('strong').toFixed(2)} (target ${m('targetStrong').toFixed(2)}) average ${m('average').toFixed(2)} | choices ${m('choices').toFixed(1)}`; };
    console.log('\n' + [[70, 74], [75, 89], [90, 104], [105, 119], [120, 134], [135, 150], [151, 200], [201, to]].map(([a, b]) => band(a, b)).join('\n'));
  }
}
