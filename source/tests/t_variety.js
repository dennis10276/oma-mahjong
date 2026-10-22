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
    const set = a => new Set(norm(a).map(p => p.join(','))), fset = a => new Set(norm(a).map(p => p[0] + ',' + p[1]));
    const ov = (A, B2) => { let c = 0; for (const k of A) if (B2.has(k)) c++; return c / Math.max(A.size, B2.size); };
    const alike = (ta, tb) => ({ pos: Math.max(ov(set(ta), set(tb)), ov(set(mir(ta)), set(tb))), foot: Math.max(ov(fset(ta), fset(tb)), ov(fset(mir(ta)), fset(tb))) });
    // same picture on the same spot / pairs on the same two spots (also mirrored)
    const pics = (A, B2) => { let w = { spot: 0, pair: 0 };
      for (const m of [false, true]) { const a = norm(m ? mir(A.tiles) : A.tiles), b = norm(B2.tiles), at = new Map(b.map((p, k) => [p.join(','), k])), map = a.map(p => at.get(p.join(',')));
        let spot = 0, pairs = 0, same = 0; const by = {};
        a.forEach((p, i) => { (by[A.faces[i]] = by[A.faces[i]] || []).push(i); if (map[i] !== undefined && A.faces[i] === B2.faces[map[i]]) spot++; });
        for (const g of Object.values(by)) for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) { pairs++; const p = map[g[x]], q = map[g[y]]; if (p !== undefined && q !== undefined && B2.faces[p] === B2.faces[q]) same++; }
        w = { spot: Math.max(w.spot, spot / Math.max(a.length, b.length)), pair: Math.max(w.pair, pairs ? same / pairs : 0) }; }
      return w; };
    const boards = {}; for (let lv = T.from; lv < T.from + T.levels.length; lv++) boards[lv] = Hard.get(lv);
    for (const r of R.levels) {
      const lv = r.lv, d = boards[lv];
      // unlike every level people could have played (before the remake; an old board kept further on,
      // where no new one fitted, is not compared)
      let worst = { pos: 0, foot: 0 }; for (const k in boards) if (+k < R.from) { const x = alike(d.tiles, boards[k].tiles); worst = { pos: Math.max(worst.pos, x.pos), foot: Math.max(worst.foot, x.foot) }; }
      t.ok(worst.pos <= R.novel.pos + 1e-9 && worst.foot <= R.novel.foot + 1e-9, `level ${lv}: a pile unlike every level before`, JSON.stringify(worst));
      // the other new boards: within R.nearLevels just as different; further apart a pile may look alike,
      // but then its pairs are in new spots (Dennis, 2026-10-22)
      for (const k of changed) if (k > lv) {
        const x = alike(d.tiles, boards[k].tiles), near = k - lv <= R.nearLevels;
        if (near && (x.pos > R.novel.pos || x.foot > R.novel.foot)) t.ok(false, `level ${lv}: unlike new level ${k}`, JSON.stringify(x));
        if (!near && x.pos > R.novel.pos) { const p = pics(d, boards[k]); if (p.spot > R.pics.spot || p.pair > R.pics.pair) t.ok(false, `level ${lv} and ${k}: pairs in new spots`, JSON.stringify(p)); }
      }
      const g = { tiles: d.tiles.map(([x, y, z]) => ({ x, y, z })), faces: d.faces, clock: d.clock };
      g.nb = L.neighbors(g.tiles);
      const o = d.obst; g.rules = o && (Object.keys(o.ice || {}).length || (o.keys || []).length) ? { iceNb: L.iceNeighbors(g.tiles), ice: o.ice || {}, locks: (o.keys || []).length ? new Set(o.locks) : null, keys: o.keys || [] } : null;
      t.ok(Hard.validSolution(g, d.solution), `level ${lv}: can be finished (stored way through, clock in time)`);
      for (const n of Object.keys(r.target)) for (const k of ['first', 'two', 'four']) {
        const d = r.final[n][k] - r.target[n][k];
        // Mrs. Doubtfire: first try at most R.mrs.harder harder and R.mrs.slots[0] easier
        const ok = n === 'Mrs. Doubtfire' && k === 'first' ? d <= R.mrs.slots[0] + 1e-9 && d >= -R.mrs.harder - 1e-9 : Math.abs(d) <= R.tol[k] + 1e-9;
        t.ok(ok, `level ${lv} ${n} ${k}: as hard as before`, [r.final[n][k], r.target[n][k]]);
      }
    }
    // the curve: per 10 levels the average first try and ease of each player as before
    const ease = m => 0.5 * m.first + 0.25 * m.two + 0.25 * m.four, bands = {};
    for (const r of R.levels) (bands[Math.floor(r.lv / 10)] = bands[Math.floor(r.lv / 10)] || []).push(r);
    for (const [b, rs] of Object.entries(bands)) for (const n of Object.keys(rs[0].target)) {
      const avg = f => rs.reduce((s, r) => s + f(r), 0) / rs.length;
      // not easier than before (only measurement noise), at most a little harder
      const d = [avg(r => r.final[n].first - r.target[n].first), avg(r => ease(r.final[n]) - ease(r.target[n]))];
      // (Dennisisdebeste may be harder: R.curve.harder[n] null)
      const hard = R.curve.harder[n];
      t.ok(d.every(x => x <= R.curve.easier + 1e-9 && (hard === null || x >= -hard - 1e-9)), `levels ${b}0-${b}9 ${n}: the curve as before, not easier`, d.map(x => x.toFixed(3)));
    }
    // Mrs. Doubtfire per 10 levels: one level up to 2 points easier, one up to 1, the rest the same or harder
    const easeOf = m => 0.5 * m.first + 0.25 * m.two + 0.25 * m.four;
    for (const [b, rs] of Object.entries(bands)) {
      const offs = rs.map(r => Math.max(r.final['Mrs. Doubtfire'].first - r.target['Mrs. Doubtfire'].first, easeOf(r.final['Mrs. Doubtfire']) - easeOf(r.target['Mrs. Doubtfire']))).sort((x, y) => y - x);
      t.ok(offs.every((o, k) => o <= (R.mrs.slots[k] ?? R.mrs.same) + 1e-9), `levels ${b}0-${b}9 Mrs. Doubtfire: the same or harder (one level 2 points, one 1 point easier at most)`, offs.map(x => x.toFixed(3)));
    }
    const first = Math.min(...changed);
    t.ok(Hard.designVersion(first) !== Hard.designVersion(first - 1) && Hard.designVersion(91) !== Hard.designVersion(92), 'saved games: only remade levels start fresh');
  },
}];
