#!/usr/bin/env node
'use strict';
/* tail_check.js: is a board lost AFTER the clock for every winning order over some tiles? ("Don't rush the clock", F6)
     node source/tools/builder/bank/tail_check.js <board.json> <tiles,comma> [limit]
     const { check } = require('./tail_check.js'); check({ spec, design }, tiles, limit, { stopAtWinnable }) -> { lost, won, unk, orders }
   Every order (orders.js, the board's real pictures and specials) that takes the clock within the limit using only the listed tiles
   is played on the whole board, then a full-level search (every move, the game's rules) asks: can the level still be won? */
const fs = require('fs'), path = require('path'), E = require('../engine.js'), O = require('./orders.js');
function check(board, tiles, lim, o = {}) {
  const d = board.design, s = board.spec, faces = {}; d.faces.forEach((f, i) => faces[i] = f);
  const r = O.orders({ layout: s.layout, tiles, faces, clock: d.clock.i, limit: +(lim || d.clock.n), ice: s.ice, locks: s.locks, keys: s.keys, locks2: s.locks2, keys2: s.keys2, down: d.down, max: o.max || 2000, all: true });
  const g = E.game(JSON.parse(JSON.stringify({ ...d, clock: { i: d.clock.i, n: 999 } })));
  // the whole level after a state: depth-first with a memo on the alive set + tray pictures (the game's rules, peek pairs included)
  const canWin = (st, budget) => {
    const memo = new Set(); let nodes = 0;
    const go = t => { if (E.won(g, t)) return true; if (++nodes > budget) throw Error('budget');
      const key = t.alive.join('') + '|' + t.tray.map(i => d.faces[i]).sort().join(','); if (memo.has(key)) return false; memo.add(key);
      for (const a of E.legal(g, t)) { let n2; try { n2 = E.step(g, t, a); } catch (e) { n2 = null; } if (n2 && go(n2)) return true; } return false; };
    return go(st);
  };
  const out = { lost: 0, won: 0, unk: 0, orders: [] };
  for (const w of r.wins) {
    let t = E.start(g); for (const x of w) { const a = typeof x === 'string' ? { pair: x.slice(1, -1).split('+').map(Number) } : x; try { t = E.step(g, t, a); } catch (e) { t = null; } if (!t) break; }
    if (!t) { out.orders.push({ order: w, verdict: 'illegal' }); continue; }
    let v; try { v = canWin(t, o.budget || 2e6) ? 'level still winnable' : 'LOST after the clock'; } catch (e) { v = 'unknown (budget)'; }
    if (v[0] === 'L') out.lost++; else if (v[0] === 'l') out.won++; else out.unk++;
    out.orders.push({ order: w, tray: t.tray.map(i => i + ':' + d.faces[i]), verdict: v });
    if (o.stopAtWinnable && (out.won || out.unk)) break;
  }
  return out;
}
module.exports = { check };
if (require.main === module) {
  const [file, list, lim] = process.argv.slice(2), j = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const r = check(j, list.split(',').map(Number), lim);
  for (const x of r.orders) console.log(x.order.join(' '), x.tray ? '| tray ' + x.tray.join(' ') : '', '|', x.verdict);
  console.log(`orders ${r.orders.length}: lost after the clock ${r.lost}, still winnable ${r.won}, unknown ${r.unk}`);
}
