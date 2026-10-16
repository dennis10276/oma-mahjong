/* For every level a person played: the move-based test player's chance per try (tries 1-4, retries
   remembering the lost tries) for every care level x memory, with the person's habits at the time
   they first played that level (kinds.js). Cached in mbot/chains-<name>.json for mbot_walk.js.
     node mbot_chains.js <name> [runs=24] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { triesOf } = require('./pdata.js');
const { kindsAt } = require('./kinds.js');
const [name, runsS = '24'] = process.argv.slice(2), runs = +runsS;
const TEMPS = [1, 1.5, 2, 3, 4, 6, 9, 13];
const MEMS = { none: [0, 0, 0], low: [0.3, 0.15, 0.3], half: [0.5, 0.3, 0.5], high: [0.75, 0.5, 0.75], full: [1, 1, 1] };
const mbot = (kinds, temp, mem) => ({ ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp })), allMoves: true, flips: true, kinds, peek: 0, end: 12, plan: 10, memory: mem });
const byLv = new Map();
for (const x of triesOf(name)) { if (!byLv.has(x.lv)) byLv.set(x.lv, { lv: x.lv, t: x.t, g: x.g, src: x.src, tries: [] }); byLv.get(x.lv).tries.push({ at: x.at, won: x.won, t: x.t }); }
const levels = [...byLv.values()].sort((a, b) => a.t - b.t);
const out = { name, runs, temps: TEMPS, mems: MEMS, levels: [] };
for (const l of levels) {
  const k = kindsAt(name, l.t), ch = {};
  for (const temp of TEMPS) for (const [mk, mem] of Object.entries(MEMS)) { const c = Hard.rateChain(l.g, runs, 5, mbot(k, temp, mem), mem, 4); ch[temp + '|' + mk] = { cond: c.cond.map(v => v === null ? null : +v.toFixed(3)), within: c.within.map(v => +v.toFixed(3)) }; }
  out.levels.push({ lv: l.lv, t: l.t, src: l.src, tries: l.tries, chains: ch });
  process.stderr.write(`${name} L${l.lv} `);
}
fs.mkdirSync(path.join(__dirname, 'mbot'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'mbot', `chains-${name.replace(/[^A-Za-z]/g, '')}.json`), JSON.stringify(out));
console.log(`\n${name}: ${levels.length} levels done`);
