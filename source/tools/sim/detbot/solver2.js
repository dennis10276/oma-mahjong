/* Fast exact solver for a fully known Oma's Mahjong position (Claude, prototype). Same rules as hard.js:
   tray of 3 singles (a 4th ends it), a tile fitting the tray is taken with it, a free face-down tile and
   a free tile of the same picture go together without a slot, the clock tile before clock.n moves,
   ice/locks with relief. A dead-position table can be kept across calls (same world, same decision). */
'use strict';
const L = require('../../../www/layouts.js');
function makeSolver2(game) {
  const n = game.tiles.length, nb = game.nb, clock = game.clock;
  const above = nb.above.map(a => Int32Array.from(a)), left = nb.left.map(a => Int32Array.from(a)), right = nb.right.map(a => Int32Array.from(a));
  const iceNb = L.iceNeighbors(game.tiles).map(a => Int32Array.from(a));
  let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
  const z1 = Uint32Array.from({ length: n }, rnd), z2 = Uint32Array.from({ length: n }, rnd);
  function world(faces, down, rules, slots = 3) {
    const dead = new Set();
    const ice = rules && rules.ice ? Int32Array.from({ length: n }, (_, i) => rules.ice[i] || 0) : null;
    const lockSet = rules && rules.locks ? new Uint8Array(n) : null;
    if (lockSet) for (const i of rules.locks) lockSet[i] = 1;
    const keys = rules && rules.keys ? rules.keys : [];
    return function winnable(alive0, tray0, moves0, relieved0, limit) {
      const al = Uint8Array.from(alive0);
      let h1 = 0, h2 = 0, leftN = 0;
      for (let i = 0; i < n; i++) if (al[i]) { h1 ^= z1[i]; h2 ^= z2[i]; leftN++; }
      let nodes = 0, gaveUp = false, deepest = 0;
      const free = i => { if (!al[i]) return false; const a = above[i]; for (let k = 0; k < a.length; k++) if (al[a[k]]) return false;
        const l = left[i]; let ok = true; for (let k = 0; k < l.length; k++) if (al[l[k]]) { ok = false; break; } if (ok) return true;
        const r = right[i]; for (let k = 0; k < r.length; k++) if (al[r[k]]) return false; return true; };
      const takeableNow = (i, relieved) => {
        if (!free(i)) return false; if (relieved) return true;
        if (ice && ice[i]) { let g = 0; const q = iceNb[i]; for (let k = 0; k < q.length; k++) if (!al[q[k]]) g++; if (g < ice[i]) return false; }
        if (lockSet && lockSet[i] && keys.some(k => al[k])) return false;
        return true; };
      const hasRules = !!(ice || lockSet);
      const cover = () => { const s = [clock.i], seen = new Set(s); for (let p = 0; p < s.length; p++) { const a = above[s[p]]; for (let k = 0; k < a.length; k++) { const j = a[k]; if (al[j] && !seen.has(j)) { seen.add(j); s.push(j); } } } return seen; };
      const rm = i => { al[i] = 0; h1 ^= z1[i]; h2 ^= z2[i]; leftN--; };
      const put = i => { al[i] = 1; h1 ^= z1[i]; h2 ^= z2[i]; leftN++; };
      const go = (tr, mv, relieved) => {
        if (++nodes > limit) { gaveUp = true; return false; }
        if (n - leftN > deepest) deepest = n - leftN;
        if (!leftN) return tr.length === 0;
        const clockOn = clock && al[clock.i];
        let cs = null;
        if (clockOn) {
          if (mv >= clock.n) return false;
          cs = cover(); let need = cs.size;
          let lb = false, rb = false; for (const j of left[clock.i]) if (al[j]) lb = true; for (const j of right[clock.i]) if (al[j]) rb = true;
          if (lb && rb) need++;
          if (mv + need > clock.n) return false;
        }
        const key = h1 + ':' + h2 + ':' + (tr.length ? tr.slice().sort((a, b) => a - b).join(',') : '') + (relieved ? 'r' : '');
        if (dead.has(key)) return false;
        const c = []; for (let i = 0; i < n; i++) if (takeableNow(i, relieved)) c.push(i);
        if (!c.length) {
          if (hasRules && !relieved) { for (let i = 0; i < n; i++) if (free(i)) { const r = go(tr, mv, true); if (!r && !gaveUp) dead.add(key); return r; } }
          dead.add(key); return false;
        }
        const inTray = f => tr.indexOf(f);
        const acts = [];
        let forced = null;
        // matches, slot-free pairs, open pairs
        const byF = new Map();
        for (const i of c) { const f = faces[i]; if (inTray(f) >= 0) { acts.push([[i], 'm']); continue; } let l = byF.get(f); if (!l) byF.set(f, l = []); l.push(i); }
        const pairs = [];
        for (const [, l] of byF) if (l.length >= 2) for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) pairs.push([l[a], l[b]]);
        if (!clockOn) {
          if (acts.length) forced = acts[0];
          else { const p = pairs.find(p => down[p[0]] || down[p[1]]) || (tr.length < slots ? pairs[0] : null); if (p) forced = [p, 'p']; }
        }
        let list;
        if (forced) list = [forced];
        else {
          list = acts;
          const onC = i => cs && cs.has(i) ? 1 : 0;
          const ps = pairs.filter(p => down[p[0]] || down[p[1]] || tr.length < slots).sort((x, y) => (onC(y[0]) + onC(y[1])) - (onC(x[0]) + onC(x[1])));
          for (const p of ps) list.push([p, 'p']);
          if (tr.length < slots) {
            const singles = c.filter(i => inTray(faces[i]) < 0);
            const sc = i => (onC(i) ? 0 : 2) + ((byF.get(faces[i]) || []).length >= 2 ? 0 : 1);
            singles.sort((a, b) => sc(a) - sc(b));
            for (const i of singles) list.push([[i], 's']);
          }
        }
        for (const [ts, kind] of list) {
          let t2;
          if (kind === 'm') { const q = inTray(faces[ts[0]]); t2 = tr.filter((_, k) => k !== q); }
          else if (kind === 'p') t2 = tr;
          else t2 = tr.concat(faces[ts[0]]);
          // the clock must not run out in the middle of a pair either (the game checks before each take)
          if (clockOn && kind === 'p' && mv + 1 >= clock.n && !ts.includes(clock.i)) continue;
          for (const i of ts) rm(i);
          const ok = go(t2, mv + ts.length, relieved);
          for (const i of ts) put(i);
          if (ok) return true;
          if (gaveUp) return false;
        }
        dead.add(key); return false;
      };
      const r = go(tray0.slice(), moves0, relieved0);
      winnable.nodes = nodes; winnable.deepest = deepest;
      return gaveUp ? null : r;
    };
  }
  return world;
}
module.exports = { makeSolver2 };
