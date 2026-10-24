/* An honest play-out (Claude, prototype): in one filled-in world, play on with a simple policy that only uses
   what it would see in that world as tiles come free (it does not know where unseen pictures are).
   Returns 1 for a clear, otherwise the share of tiles it got off the board (times 0.9). */
'use strict';
const L = require('../../../www/layouts.js');
function makeRollout(game) {
  const n = game.tiles.length, nb = game.nb, clock = game.clock, init = new Uint8Array(n).fill(1);
  return function rollout(faces, down, rules, alive0, tray0, moves0, relieved0, known0) {
    const al = Uint8Array.from(alive0), known = Uint8Array.from(known0);
    let tr = tray0.slice(), mv = moves0, relieved = relieved0, left = 0;
    for (let i = 0; i < n; i++) left += al[i];
    const startLeft = left;
    const take = i => { al[i] = 0; left--; mv++; };
    for (let guard = 0; guard < 400; guard++) {
      if (!left) return tr.length ? 0.9 * (1 - left / startLeft) : 1;
      if (clock && al[clock.i] && mv >= clock.n) break;
      const can = i => al[i] && (rules && !relieved ? L.takeable(i, al, nb, rules, init) : L.isFree(i, al, nb));
      let c = []; for (let i = 0; i < n; i++) if (can(i)) c.push(i);
      if (!c.length && rules && !relieved) { relieved = true; for (let i = 0; i < n; i++) if (can(i)) c.push(i); }
      if (!c.length) break;
      for (const i of c) known[i] = 1;   // free tiles are seen (face-down ones turned over: looking is free)
      const clockOn = clock && al[clock.i];
      const cover = new Set();
      if (clockOn) { const st = [clock.i]; cover.add(clock.i); while (st.length) { const i = st.pop(); for (const j of nb.above[i]) if (al[j] && !cover.has(j)) { cover.add(j); st.push(j); } } }
      // 1. a tile that fits the tray
      const m = c.find(i => tr.includes(faces[i]));
      if (m !== undefined) { tr.splice(tr.indexOf(faces[m]), 1); take(m); continue; }
      // 2. two free tiles with the same picture (with a face-down one no slot is needed)
      let pair = null;
      for (let a = 0; a < c.length && !pair; a++) for (let b = a + 1; b < c.length; b++) if (faces[c[a]] === faces[c[b]] && (down[c[a]] || down[c[b]] || tr.length < 3)) { pair = [c[a], c[b]]; break; }
      if (pair && !(clockOn && !cover.has(pair[0]) && !cover.has(pair[1]) && mv + 2 + cover.size > clock.n)) { take(pair[0]); take(pair[1]); continue; }
      if (tr.length >= 3) break;
      // 3. one tile into the tray: on the way to the clock first; then one whose twin it has seen; then the one
      //    that frees the most tiles
      const twinSeen = i => { for (let j = 0; j < n; j++) if (j !== i && al[j] && known[j] && faces[j] === faces[i]) return true; return false; };
      const frees = i => { al[i] = 0; let k = 0; for (const j of c) void j; for (let j = 0; j < n; j++) if (al[j] && !known[j] && L.isFree(j, al, nb)) k++; al[i] = 1; return k; };
      let best = null, bs = -1e9;
      for (const i of c) {
        const s = (clockOn && cover.has(i) ? 100 : 0) + (twinSeen(i) ? 10 : 0) + frees(i) - (tr.length === 2 ? (twinSeen(i) ? 0 : 20) : 0);
        if (s > bs) { bs = s; best = i; }
      }
      tr.push(faces[best]); take(best);
    }
    return 0.9 * (1 - left / startLeft);
  };
}
module.exports = { makeRollout };
