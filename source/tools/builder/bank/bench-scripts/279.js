// 279: band attempt (6 wide, mechanics pass) still has 9 rows; the top row holds only ordinary tiles 00, 01, 72, 68:
// move them to free brick spots below it (mirror pairs first, low first), then prove.
module.exports = (B, S) => {
  const D = require('../detower.js');
  S.fromBands(B);
  const lx = t => t[0] / 2 - t[2] * 0.14, ly = t => t[1] / 2 * 1.24 - t[2] * 0.14;
  for (const id of [0, 1, 72, 68]) {
    const cur = B.st.T.filter((t, i) => i !== id && t[1] > 0 && ![0, 1, 72, 68].includes(i) || (i !== id && [0, 1, 72, 68].includes(i) && B.st.T[i][1] > 0));
    const xs = cur.map(t => t[0]), X1 = Math.max(...xs) + 2, ys = cur.map(t => t[1]), Y1 = Math.max(...ys) + 2, m = Math.min(...xs) + Math.max(...xs);
    let best = null;
    for (let z = 0; z <= 2; z++) for (let y = 2; y + 2 <= Y1; y++) for (let x = Math.min(...xs); x + 2 <= X1; x++) {
      const p = [x, y, z]; if (!D.brickSpot(cur, p)) continue;
      const guard = B.st.T.map((t, i) => (B.role[i] !== '.' && ![0, 1, 72, 68].includes(i)) ? t : null).filter(Boolean);
      if (guard.some(q => (p[2] === q[2] + 1 && Math.abs(p[0] - q[0]) < 2 && Math.abs(p[1] - q[1]) < 2) || (p[2] === q[2] && Math.abs(p[1] - q[1]) < 2 && Math.abs(p[0] - q[0]) === 2))) continue;
      if (lx(p) < Math.min(...cur.map(lx)) - 1e-9 || ly(p) < Math.min(...cur.map(ly)) - 1e-9) continue;
      const mir = cur.some(q => q[0] === m - x && q[1] === y && q[2] === z);
      const sc = z * 10 - (mir ? 20 : 0) + Math.abs(x + 1 - (m + 2) / 2) * 0.5;
      if (!best || sc < best.sc) best = { p, sc };
    }
    if (!best) { console.log('no spot for', id); return; }
    B.st.T[id] = best.p;
  }
  console.log(S.problems(B)); B.centre(); B.show();
  const r = B.prove(); console.log(JSON.stringify(r).slice(0, 500));
  if (r.ok) console.log('saved', B.save('279: bands (6 wide), then the four ordinary tiles of the top row moved below it: 8 rows'));
};
