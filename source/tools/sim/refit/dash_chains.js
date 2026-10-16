/* The dashboard's current per-person test player (players/bots.json) on every level each person played:
   chance per try 1-4 (with its memory), in the same form as mbot/chains-<name>.json (key 'dash').
     node dash_chains.js <name> [runs=24] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [name, runsS = '24'] = process.argv.slice(2), runs = +runsS;
const BOTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8')).bots;
const f = path.join(__dirname, 'mbot', `chains-${name.replace(/[^A-Za-z]/g, '')}.json`);
const C = JSON.parse(fs.readFileSync(f, 'utf8'));
const { triesOf } = require('./pdata.js');
const G = new Map(); for (const x of triesOf(name)) if (!G.has(x.lv)) G.set(x.lv, x.g);
const p = { ...Hard.P, ...BOTS[name].persona };
for (const l of C.levels) { const c = Hard.rateChain(G.get(l.lv), runs, 5, p, p.memory === undefined ? 1 : p.memory, 4); l.chains.dash = { cond: c.cond.map(v => v === null ? null : +v.toFixed(3)), within: c.within.map(v => +v.toFixed(3)) }; }
fs.writeFileSync(f, JSON.stringify(C));
console.log(name, 'done');
