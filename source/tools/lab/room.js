/* "Room for error" of a board, for comparing with how many tries Dennis needs in the lab (the test
   players misjudge these boards both ways). Along the stored way through, at every step: how many tiles
   could be taken, and after how many of them the level can still be won (an exact search: tray, ice,
   locks, the clock). traps = sum over the steps of log2(takeable / still winnable): the bits a player has
   to find out; narrow = the steps with at most one good move out of three or more.
     node source/tools/lab/room.js <idea id> ...                                                    */
'use strict';
const path = require('path');
const L = require(path.join(__dirname, '..', '..', 'www', 'layouts.js'));
function analyse(b, limit = +(process.env.LIMIT || 200000)) {
  const tiles = b.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), n = tiles.length;
  const rules = { iceNb: L.iceNeighbors(tiles), ice: (b.obst && b.obst.ice) || {}, locks: (b.obst && (b.obst.keys || []).length) ? new Set(b.obst.locks) : null, keys: (b.obst && b.obst.keys) || [] };
  const al0 = new Uint8Array(n).fill(1), F = b.faces, clock = b.clock;
  const can = (i, alive) => alive[i] && L.takeable(i, alive, nb, rules, al0);
  const step = (alive, tray, i) => { const a = alive.slice(); a[i] = 0; const q = tray.findIndex(t => F[t] === F[i]); const t2 = q >= 0 ? tray.filter((_, k) => k !== q) : tray.concat(i); return [a, t2]; };
  // can the level still be won from here? (null: the search gave up)
  function winnable(alive, tray, moves) {
    const seen = new Set(); let nodes = 0;
    const go = (alive, tray, moves) => {
      if (++nodes > limit) throw 0;
      if (clock && alive[clock.i] && moves >= clock.n) return false;
      if (tray.length >= 4) return false;
      let left = 0; for (let i = 0; i < n; i++) left += alive[i];
      if (!left) return !tray.length;
      const key = alive.join('') + '|' + tray.map(t => F[t]).sort((a, c) => a - c).join(',');
      if (seen.has(key)) return false; seen.add(key);
      const c = []; for (let i = 0; i < n; i++) if (can(i, alive)) c.push(i);
      // pairs first, then the clock tile, then tiles whose twin can also be taken
      const score = i => (tray.some(t => F[t] === F[i]) ? 0 : clock && i === clock.i ? 1 : c.some(j => j !== i && F[j] === F[i]) ? 2 : 3);
      c.sort((p, q) => score(p) - score(q));
      for (const i of c) { const [a, t2] = step(alive, tray, i); if (go(a, t2, moves + 1)) return true; }
      return false;
    };
    try { return go(alive, tray, moves); } catch (e) { return null; }
  }
  let alive = al0.slice(), tray = [], traps = 0, narrow = 0, unknown = 0, steps = [];
  b.solution.forEach((s, k) => {
    const c = []; for (let i = 0; i < n; i++) if (can(i, alive)) c.push(i);
    let good = 0;
    for (const i of c) { if (i === s) { good++; continue; } const [a, t2] = step(alive, tray, i); const w = winnable(a, t2, k + 1); if (w === null) { unknown++; good++; } else if (w) good++; }
    traps += Math.log2(c.length / Math.max(1, good));
    if (c.length >= 3 && good <= 1) narrow++;
    steps.push([c.length, good]);
    [alive, tray] = step(alive, tray, s);
  });
  return { traps: +traps.toFixed(1), narrow, unknown, steps };
}
module.exports = { analyse };
if (require.main === module) {
  for (const id of process.argv.slice(2)) {
    const x = require(path.join(__dirname, 'ideas-out', id + '.json'));
    const t0 = Date.now(), r = analyse(x.board);
    console.log(`idea ${id} ${x.kind} ${x.level}: traps ${r.traps} bits, narrow steps ${r.narrow}, unknown ${r.unknown} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
