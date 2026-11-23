#!/usr/bin/env node
'use strict';
/* feel_hand.js: tune the finish. Hand boards default to a new idea (2 pressure parks), and live levels to an existing
   idea (3-5). Use --idea new|existing to set the context. A pressure park puts one tile in the tray with 1 or 2 already
   waiting. Only pictures of tiles taken after the clock move can change; every picture on the stored route to
   the clock is frozen. Every accepted board: the exact clock minimum unchanged (engine), the stored solution valid
   (Hard.validSolution), and the trap kept: along the route to the clock every move that lost before still loses (exact, budgeted).
     node source/tools/builder/bank/feel_hand.js <hand id> [--idea new|existing] [--max3 0.25] [--ms 120000] [--write]
     node source/tools/builder/bank/feel_hand.js --level <n> --out <dir> [--idea new|existing]   (a live level from main's levels-hard.js)
   --write (hand id) replaces the board's design; --level writes <out>/level-<n>.json { level, design, feel }. */
const fs = require('fs'), path = require('path'), vm = require('vm'), E = require('../engine.js'), D = require('../loop/detour.js');
global.Layouts = global.Layouts || require('../../../www/layouts.js');
const a = process.argv.slice(2), arg = (k, v) => { const i = a.indexOf('--' + k); return i < 0 ? v : a[i + 1]; };
const MAIN = path.resolve(__dirname, '../../../../../oma-mahjong-main/source/www/levels-hard.js');
let j = null, d, file = null, lv = arg('level', null);
if (lv) { global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(arg('table', MAIN), 'utf8') + ';HARD_LEVELS'); }
const H = require('../../../www/hard.js'), { tuneFeel } = require('./feel_retune.js');
if (lv) { const x = H.get(+lv); d = { tiles: x.tiles, faces: x.faces, down: x.down, gold: x.gold || [], obst: x.obst, clock: x.clock, solution: x.solution }; }
else { file = path.resolve(__dirname, '../../../analysis/builder/hand', a[0] + '.board.json'); j = JSON.parse(fs.readFileSync(file, 'utf8')); d = j.design; }
const ck = d.clock.i, route = d.solution.slice(0, d.solution.indexOf(ck) + 1);
const shortest = dd => { const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify({ ...dd, clock: { i: ck, n: 99 } }))), { nodes: 3e6, ms: 60000 }); return cs && !cs.unsure ? E.flatten(cs.path).indexOf(ck) + 1 : null; };
// the moves that lose at each step of the route to the clock (the trap); 'unknown' counts as not losing
const losing = dd => { const g = E.game(dd), w = D.work(4e6, 120000), out = []; let s = E.start(g);
  for (const t of route) { if (!s || s.clockTaken) break; out.push(w.classify(g, s, 30000).filter(c => c.result === 'lose').map(c => JSON.stringify(c.move)).sort().join(' ')); s = E.step(g, s, t); }
  return out; };
const k0 = shortest(d), lose0 = losing(d);
const validate = dd => { if (!H.validSolution(E.game(dd), dd.solution)) return { ok: false, why: 'solution' };
  const k = shortest(dd); if (k !== k0) return { ok: false, why: 'clock ' + k };
  const l = losing(dd); for (let i = 0; i < lose0.length; i++) for (const m of lose0[i].split(' ').filter(Boolean)) if (!l[i] || !l[i].split(' ').includes(m)) return { ok: false, why: 'trap' };
  return { ok: true }; };
const target = require('../chained_finish_profiles.js').tuningTarget(arg, lv ? 'existing' : 'new');
const res = tuneFeel(d, { target, tolerance: 0, ms: +arg('ms', 120000), seed: +arg('seed', 1), freeze: route, validate });
const pp = f => +(f.parkAt[1] + f.parkAt[2]).toFixed(1);
console.log(`${lv ? 'level ' + lv : a[0]}: clock ${k0} | pressure parks ${pp(res.before)} -> ${pp(res.after)} (target ${target.parks}${target.parksMax != null && target.parksMax !== target.parks ? '–' + target.parksMax : ''}), 3 waiting ${res.after.waiting[3]} | ${res.met ? 'MET' : res.ok ? 'best found' : 'nothing accepted'} | ${JSON.stringify(res.fails)}`);
const feel = { before: pp(res.before), after: pp(res.after), target: target.parks,
  ...(target.parksMax == null ? {} : { targetMax: target.parksMax }), met: res.met };
if (lv && res.ok) { const out = path.resolve(arg('out')); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `level-${lv}.json`), JSON.stringify({ level: +lv, design: res.design, feel })); }
if (!lv && a.includes('--write') && res.ok) { j.design = res.design; j.spec = { ...j.spec, feel }; fs.writeFileSync(file, JSON.stringify(j, null, 1)); console.log('written'); }
