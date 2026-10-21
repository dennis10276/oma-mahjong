/* Level variety (analysis/variety-plan.md): the remade levels have a pile unlike every other designed
   level, can be finished, have the difficulty of the board they replaced (measured offline, the
   report), and only they start a saved half-played game fresh. */
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
module.exports = [{
  name: 'variety: new pile per remade level, same difficulty as before, other levels unchanged',
  cpu: true,
  async run(t) {
    const root = path.join(__dirname, '..');
    const T = vm.runInNewContext(fs.readFileSync(path.join(root, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
    if (!T.designVersions) { t.ok(true, 'variety not applied to the table yet'); return; }
    const B = vm.runInNewContext(fs.readFileSync(path.join(root, 'analysis', 'levels-before-variety.js'), 'utf8') + ';HARD_LEVELS');
    const R = JSON.parse(fs.readFileSync(path.join(root, 'analysis', 'variety.json'), 'utf8'));
    const L = require(path.join(root, 'www', 'layouts.js'));
    global.Layouts = L; global.HARD_LEVELS = T;
    delete require.cache[require.resolve(path.join(root, 'www', 'hard.js'))];
    const Hard = require(path.join(root, 'www', 'hard.js'));
    const changed = new Set(R.levels.map(l => l.lv));
    // unchanged levels are exactly the old rows
    for (let lv = T.from; lv < T.from + T.levels.length; lv++) if (!changed.has(lv)) t.eq(T.levels[lv - T.from], B.levels[lv - B.from], `level ${lv} unchanged`);
    // alike: share of the same tile spots (shifted, also mirrored) with any other designed level
    const norm = a => { const mx = Math.min(...a.map(p => p[0])), my = Math.min(...a.map(p => p[1])); return a.map(([x, y, z]) => [x - mx, y - my, z]); };
    const mir = a => { const w = Math.max(...a.map(p => p[0])); return a.map(([x, y, z]) => [w - x, y, z]); };
    const set = a => new Set(norm(a).map(p => p.join(',')));
    const ov = (A, B2) => { let c = 0; for (const k of A) if (B2.has(k)) c++; return c / Math.max(A.size, B2.size); };
    const tiles = {}; for (let lv = T.from; lv < T.from + T.levels.length; lv++) tiles[lv] = Hard.get(lv).tiles;
    for (const r of R.levels) {
      const lv = r.lv, d = Hard.get(lv), a = set(d.tiles), am = set(mir(d.tiles));
      // against the levels that stay before the remake and the other new boards (an old board kept
      // further on, where no new one fitted, is not compared)
      let worst = 0; for (const k in tiles) if (+k !== lv && (+k < R.from || changed.has(+k))) { const b = set(tiles[k]); worst = Math.max(worst, ov(a, b), ov(am, b)); }
      t.ok(worst <= R.novel.pos + 1e-9, `level ${lv}: a pile unlike every other level`, worst.toFixed(2));
      const g = { tiles: d.tiles.map(([x, y, z]) => ({ x, y, z })), faces: d.faces, clock: d.clock };
      g.nb = L.neighbors(g.tiles);
      const o = d.obst; g.rules = o && (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: L.iceNeighbors(g.tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null;
      t.ok(Hard.validSolution(g, d.solution), `level ${lv}: can be finished (stored way through, clock in time)`);
      for (const n of Object.keys(r.target)) for (const k of ['first', 'two', 'four'])
        t.ok(Math.abs(r.final[n][k] - r.target[n][k]) <= R.tol[k] + 1e-9, `level ${lv} ${n} ${k}: as hard as before`, [r.final[n][k], r.target[n][k]]);
    }
    const first = Math.min(...changed);
    t.ok(Hard.designVersion(first) !== Hard.designVersion(first - 1) && Hard.designVersion(91) !== Hard.designVersion(92), 'saved games: only remade levels start fresh');
  },
}];
