/* How hard are the levels for the three test players (strong ~ Dennisisdebeste, sensible,
   average ~ Mrs. Doubtfire)? Old levels (as the game made them before) and the new ones.
     node tools/sim/survey.js 70 130 1.5,1.6 > tools/sim/survey.json */
'use strict';
const { game, L } = require('./levels.js');
const H = require('../../www/hard.js');
const [from, to] = [+(process.argv[2] || 70), +(process.argv[3] || 130)];
const aspects = (process.argv[4] || '1.5,1.6').split(',').map(Number);
const step = +(process.argv[5] || 1);
function asGame(d) {
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const down = new Uint8Array(n); d.down.forEach(i => down[i] = 1);
  const ob = d.obst;
  const rules = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
  return { tiles, nb, faces: d.faces, down, rules, clock: d.clock };
}
const rows = [];
for (let lv = from; lv <= to; lv += step) for (const a of aspects) {
  const t0 = Date.now(); const d = H.makeNow(lv, a); const ms = Date.now() - t0;
  const g = asGame(d);
  const q = k => H.rate(g, 80, 3, H.persona(k));
  const s = q('strong'), m = q('sensible'), w = q('average');
  const old = game(lv, a); const om = H.rate(old, 80, 3, H.persona('sensible'));
  const row = { lv, a, ms, n: g.tiles.length, layers: Math.max(...g.tiles.map(t => t.z)) + 1, target: d.info.target, strong: s.rate, sensible: m.rate, average: w.rate, choices: +m.choices.toFixed(1), risky: m.risky && +m.risky.toFixed(1), twins: d.info.twins, down: d.down.length, clock: d.clock, oldSensible: om.rate, oldChoices: +om.choices.toFixed(1) };
  rows.push(row);
  process.stderr.write(`${lv} ${a} ${ms}ms target ${row.target} strong ${s.rate.toFixed(2)} sensible ${m.rate.toFixed(2)} average ${w.rate.toFixed(2)} | old sensible ${om.rate.toFixed(2)} | choices ${row.choices} (old ${row.oldChoices}) risky ${row.risky} twins ${row.twins} layers ${row.layers} clock ${JSON.stringify(d.clock)}\n`);
}
console.log(JSON.stringify(rows));
