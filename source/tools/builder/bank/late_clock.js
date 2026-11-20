#!/usr/bin/env node
'use strict';
/* late_clock.js: set a face-down-clock board's number so that the ONLY way in time is the clock as half of a face-down pair started
   with one move left (Dennis 2026-11-20 "Allow it as a trick": the game checks the clock after the whole pair, MECHANICS.md 6).
     node source/tools/builder/bank/late_clock.js <board.json> [--write]
   Checks: (1) the game's rules (engine, clock after the action) win with number k = the shortest; (2) the stored solution passes
   Hard.validSolution (new rule) and fails the old rule (a pair had to end by the number); (3) without face-down pairs there is no
   way within k; (4) at the pair the tray is full and the badge shows 1 move left. --write stores the number in the board. */
const fs = require('fs'), path = require('path'), E = require('../engine.js');
global.Layouts = global.Layouts || require('../../../www/layouts.js');
const L = global.Layouts, H = require('../../../www/hard.js');
const a = process.argv.slice(2), file = path.resolve(a[0]), j = JSON.parse(fs.readFileSync(file, 'utf8')), d = j.design, ck = d.clock.i;
const shortest = (dd, o) => { const cs = E.clockShortest(E.game(JSON.parse(JSON.stringify(dd)), o), { nodes: 3e6, ms: 60000 }); return cs && !cs.unsure ? E.flatten(cs.path).indexOf(ck) + 1 : null; };
const k = shortest({ ...d, clock: { i: ck, n: 99 } });
const kStrict = shortest({ ...d, clock: { i: ck, n: 99 } }, { strict: true });
// the old rule: like validSolution, but a face-down pair at a full tray had to end before the number (move + 1 < n)
function oldValid(dd, sol) {
  const tiles = dd.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), g = E.game(dd), n = sol.length;
  const init = new Uint8Array(n).fill(1), alive = init.slice(), tray = [], can = i => alive[i] && (g.rules ? L.takeable(i, alive, nb, g.rules, init) : L.isFree(i, alive, nb));
  let taken = false;
  for (let m = 0; m < n; m++) {
    const i = sol[m]; if (!can(i)) return false; if (!taken && m >= dd.clock.n) return false;
    const q = tray.indexOf(dd.faces[i]);
    if (q < 0 && tray.length >= 3) { const jj = sol[m + 1]; if (!(jj !== i && can(jj) && dd.faces[jj] === dd.faces[i] && (g.down[i] || g.down[jj]))) return false;
      if (!taken && m + 1 >= dd.clock.n) return false; alive[i] = alive[jj] = 0; if (i === ck || jj === ck) taken = true; m++; continue; }
    alive[i] = 0; if (i === ck) taken = true; if (q >= 0) tray.splice(q, 1); else tray.push(dd.faces[i]);
  }
  return taken && !tray.length;
}
const dk = { ...d, clock: { i: ck, n: k } }, gk = E.game(dk);
const newOk = H.validSolution(gk, d.solution), oldOk = oldValid(dk, d.solution);
// the moment of the pair in the stored solution: moves before it and the tray then
const at = d.solution.indexOf(ck), pairStart = d.solution[at - 1] !== undefined && d.faces[d.solution[at - 1]] === d.faces[ck] && at > 0 && d.down.includes(d.solution[at - 1]) ? at - 1 : at;
let s = E.start(gk); const flat = d.solution.slice(0, pairStart); for (const x of flat) s = E.step(gk, s, x);
console.log(`shortest (clock after the action): ${k}; without face-down pairs: ${kStrict == null ? 'no way' : kStrict}`);
console.log(`at the pair: ${pairStart} moves made, badge shows ${k - pairStart} left, tray ${s ? s.tray.length : '?'} waiting`);
console.log(`stored solution with number ${k}: new rule ${newOk ? 'in time' : 'FAILS'}, old rule ${oldOk ? 'in time (no trick needed)' : 'too late (the trick is needed)'}`);
const ok = k != null && newOk && !oldOk && (kStrict == null || kStrict > k) && s && s.tray.length >= 3 && k - pairStart === 1;
console.log(ok ? 'OK: only the clock pair one move late is in time' : 'NOT a one-move-late board');
if (ok && a.includes('--write')) { d.clock.n = k; j.spec.clockN = k; j.spec.lateClock = true; fs.writeFileSync(file, JSON.stringify(j, null, 1)); console.log('written: clock', k); }
