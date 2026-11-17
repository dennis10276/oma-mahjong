#!/usr/bin/env node
'use strict';
/* tail_check.js: is a board lost AFTER the clock for every winning order over some tiles? ("Don't rush the clock", F6)
     node source/tools/builder/bank/tail_check.js <board.json> <tiles,comma> [limit]
   Every order (orders.js, the board's real pictures and specials) that takes the clock within the limit using only the listed tiles
   is played on the whole board, then a full-level search (every move, the game's rules) asks: can the level still be won?
   Prints each order's end tray and the verdict. */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), O = require('./orders.js');
const [file, list, lim] = process.argv.slice(2), j = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')), d = j.design, s = j.spec;
const tiles = list.split(',').map(Number), faces = {}; d.faces.forEach((f, i) => faces[i] = f);
const r = O.orders({ layout: s.layout, tiles, faces, clock: d.clock.i, limit: +(lim || d.clock.n), ice: s.ice, locks: s.locks, keys: s.keys, locks2: s.locks2, keys2: s.keys2, down: d.down, max: 2000, all: true });
const g = E.game(JSON.parse(JSON.stringify({ ...d, clock: { i: d.clock.i, n: 999 } })));
// the whole level after a state: depth-first with a memo on the alive set + tray pictures (the game's rules, peek pairs included)
function canWin(st, budget) {
  const memo = new Set(); let nodes = 0;
  const go = t => { if (E.won(g, t)) return true; if (++nodes > budget) throw Error('budget');
    const key = t.alive.join('') + '|' + t.tray.map(i => d.faces[i]).sort().join(','); if (memo.has(key)) return false; memo.add(key);
    for (const a of E.legal(g, t)) { let n2; try { n2 = E.step(g, t, a); } catch (e) { n2 = null; } if (n2 && go(n2)) return true; } return false; };
  return go(st);
}
let lost = 0, won = 0, unk = 0;
for (const w of r.wins) {
  let t = E.start(g); for (const x of w) { const a = typeof x === 'string' ? { pair: x.slice(1, -1).split('+').map(Number) } : x; t = E.step(g, t, a); if (!t) break; }
  if (!t) { console.log('order', w.join(' '), ': illegal on the board'); continue; }
  let v; try { v = canWin(t, 2e6) ? 'level still winnable' : 'LOST after the clock'; } catch (e) { v = 'unknown (budget)'; }
  if (v[0] === 'L') lost++; else if (v[0] === 'l') won++; else unk++;
  console.log(w.join(' '), '| tray', t.tray.map(i => i + ':' + d.faces[i]).join(' '), '|', v);
}
console.log(`orders ${r.wins.length}: lost after the clock ${lost}, still winnable ${won}, unknown ${unk}`);
