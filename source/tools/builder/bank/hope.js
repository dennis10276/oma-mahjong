#!/usr/bin/env node
'use strict';
/* hope.js: how long wrong paths look good on a board (Dennis 2026-11-17: "good levels are levels where many different wrong paths
   looks good for a long time. Then to realize AHA i missed this detail several times before getting it").
     node source/tools/builder/bank/hope.js <board.json> [--tiles 1,2,3] [--goal clock|level]
   Plays every order over the tiles that matter (default: the spec's route + block + pairs that are free early, the game's rules
   incl. face-down pairs and the clock). A move from a position that can still win into one that cannot is a point of no return;
   its false hope is the longest run of legal moves after it before the player is stuck (4th tile / nothing free) or the clock is
   out. Reported: the wrong first moves and how long they last, every point of no return with a false hope of 5+ moves (grouped
   by the move that made it), and the longest false hope. A good board: many different points of no return, each lasting long. */
const fs = require('fs'), path = require('path'), E = require('../engine.js');
function hope(board, o = {}) {
  const d = JSON.parse(JSON.stringify(board.design)), n = d.tiles.length, ck = d.clock.i, N = d.clock.n;
  const g = E.game(d), region = new Set(o.tiles || [...Array(n).keys()]);
  const acts = s => E.legal(g, s).filter(a => typeof a === 'number' ? region.has(a) : region.has(a.pair[0]) && region.has(a.pair[1]));
  const key = s => { let k = ''; for (const i of region) k += s.alive[i] ? '1' : '0'; return k + '|' + s.tray.map(t => d.faces[t]).sort((a, b) => a - b).join(','); };
  const step = (s, a) => { try { return E.step(g, s, a); } catch (e) { return null; } };
  const winMemo = new Map(), hopeMemo = new Map(); let nodes = 0;
  const canWin = s => {   // the clock taken in time (the engine stops a game whose clock ran out: step returns null)
    if (!s.alive[ck]) return true;
    const k = key(s); if (winMemo.has(k)) return winMemo.get(k); if (++nodes > (o.nodes || 3e6)) throw Error('budget');
    let w = false; for (const a of acts(s)) { const t = step(s, a); if (t && canWin(t)) { w = true; break; } }
    winMemo.set(k, w); return w;
  };
  const longest = s => {   // legal moves still possible from a lost position (it looks alive while moves go through)
    const k = key(s); if (hopeMemo.has(k)) return hopeMemo.get(k); if (++nodes > (o.nodes || 3e6)) throw Error('budget');
    let best = 0; for (const a of acts(s)) { const t = step(s, a); if (t) best = Math.max(best, 1 + (t.alive[ck] ? longest(t) : 0)); }
    hopeMemo.set(k, best); return best;
  };
  const name = a => typeof a === 'number' ? String(a) : '[' + a.pair.join('+') + ']';
  const s0 = E.start(g), firsts = [], points = new Map(), seen = new Set();
  // the first moves: which lose at once, and how long they last
  for (const a of acts(s0)) { const t = step(s0, a); if (!t) continue; const w = canWin(t); firsts.push({ move: name(a), wins: w, hope: w ? null : longest(t) }); }
  // every point of no return reachable along winnable play (breadth first over winnable positions)
  let front = [s0]; seen.add(key(s0));
  for (let depth = 0; front.length && depth < N; depth++) {
    const next = [];
    for (const s of front) for (const a of acts(s)) {
      const t = step(s, a); if (!t || !t.alive[ck]) continue;
      if (canWin(t)) { const k = key(t); if (!seen.has(k)) { seen.add(k); next.push(t); } continue; }
      const h = longest(t), m = name(a), p = points.get(m) || { move: m, at: [], hope: 0, count: 0 };
      p.count++; p.hope = Math.max(p.hope, h); if (!p.at.includes(depth + 1)) p.at.push(depth + 1); points.set(m, p);
    }
    front = next;
  }
  const all = [...points.values()].sort((a, b) => b.hope - a.hope), long = all.filter(p => p.hope >= (o.long || 5));
  return { clock: N, firsts, points: all, long: long.length, maxHope: all.length ? all[0].hope : 0, nodes,
    score: long.reduce((m, p) => m + Math.min(p.hope, 12), 0) };
}
module.exports = { hope };
if (require.main === module) {
  const a = process.argv.slice(2), arg = (k, v) => { const i = a.indexOf('--' + k); return i < 0 ? v : a[i + 1]; };
  const b = JSON.parse(fs.readFileSync(path.resolve(a[0]), 'utf8')), s = b.spec || {};
  const dflt = [...new Set([...(s.route || []).flat(), ...Object.values(s.pairs || {}).flat()])];
  const tiles = arg('tiles') ? arg('tiles').split(',').map(Number) : dflt;
  const r = hope(b, { tiles });
  console.log(`clock ${r.clock}, ${tiles.length} tiles | wrong points of no return: ${r.points.length}, lasting 5+ moves: ${r.long}, longest false hope ${r.maxHope} | score ${r.score}`);
  console.log('first moves: ' + r.firsts.map(f => f.move + (f.wins ? ' ok' : ' LOST(' + f.hope + ')')).join('  '));
  console.log('points of no return (move: hope, at moves):');
  for (const p of r.points.slice(0, 15)) console.log(`  ${p.move}: ${p.hope} (at ${p.at.slice(0, 6).join(',')}${p.at.length > 6 ? '...' : ''}; ${p.count}x)`);
}
