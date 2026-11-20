#!/usr/bin/env node
'use strict';
/* feel_hand.js: give a hand board (analysis/builder/hand/<id>.board.json) the tray pressure of levels 100-249 after its trap.
   Dennis 2026-11-20: "combine tray pressure that were in levels 100-250 with the new traps and chains in new trap chains".
   Measured with feel.js expert (pressure parks = parks with 1 or 2 already waiting, per game): live 100-249 sampled every 7th level
   7-16, median ~11; the round-5 boards had 0-1.4. Only pictures of tiles taken after the clock move (feel_retune.tuneFeel); every
   picture on the route to the clock is frozen, so the trap is untouched. Every accepted board: the exact clock minimum unchanged
   (engine) and the stored solution valid (Hard.validSolution).
     node source/tools/builder/bank/feel_hand.js <id> [--parks 8] [--max3 0.25] [--ms 120000] [--write]
   --write replaces the board's design and records spec.feel { before, after, target }. */
const fs = require('fs'), path = require('path'), E = require('../engine.js');
global.Layouts = global.Layouts || require('../../../www/layouts.js');
const H = require('../../../www/hard.js'), { tuneFeel } = require('./feel_retune.js');
const a = process.argv.slice(2), arg = (k, v) => { const i = a.indexOf('--' + k); return i < 0 ? v : a[i + 1]; };
const file = path.resolve(__dirname, '../../../analysis/builder/hand', a[0] + '.board.json'), j = JSON.parse(fs.readFileSync(file, 'utf8')), d = j.design;
const ck = d.clock.i, route = d.solution.slice(0, d.solution.indexOf(ck) + 1);
const shortest = dd => { const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify({ ...dd, clock: { i: ck, n: 99 } }))), { nodes: 3e6, ms: 60000 }); return cs && !cs.unsure ? E.flatten(cs.path).indexOf(ck) + 1 : null; };
const k0 = shortest(d);
const validate = dd => { if (!H.validSolution(E.game(dd), dd.solution)) return { ok: false, why: 'solution' }; const k = shortest(dd); return k === k0 ? { ok: true } : { ok: false, why: 'clock ' + k }; };
const target = { parks: +arg('parks', 8), max3: +arg('max3', 0.25) };
const res = tuneFeel(d, { target, ms: +arg('ms', 120000), seed: +arg('seed', 1), freeze: route, validate });
const pp = f => +(f.parkAt[1] + f.parkAt[2]).toFixed(1);
console.log(`${a[0]}: clock ${k0} | pressure parks ${pp(res.before)} -> ${pp(res.after)} (target ${target.parks}), mean waiting ${res.before.mean} -> ${res.after.mean}, 3 waiting ${res.after.waiting[3]} | ${res.met ? 'MET' : res.ok ? 'best found' : 'nothing accepted'} | ${JSON.stringify(res.fails)}`);
if (a.includes('--write') && res.ok) { j.design = res.design; j.spec = { ...j.spec, feel: { before: pp(res.before), after: pp(res.after), target: target.parks } }; fs.writeFileSync(file, JSON.stringify(j, null, 1)); console.log('written'); }
