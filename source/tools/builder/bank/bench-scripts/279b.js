// 279: as 279.js, but every candidate spot is checked for the clock route length (must stay as released) before it is taken.
module.exports = (B, S) => {
  const D = require('../../tools/builder/bank/detower.js'), P = require(D.CF + 'narrow_proof');
  S.fromBands(B);
  const kOf = () => P.kOf(B.design().d), k0 = B.base.k, top = [0, 1, 72, 68];
  console.log('k after bands', kOf(), 'released', k0);
  const lx = t => t[0] / 2 - t[2] * 0.14, ly = t => t[1] / 2 * 1.24 - t[2] * 0.14;
  // park the top row out of the way first, then bring each back to the best spot that keeps k
  for (const id of top) {
    const others = () => B.st.T.filter((t, i) => i !== id && !(top.includes(i) && B.st.T[i][1] === 0 && top.indexOf(i) > top.indexOf(id)));
    const cur = others(), xs = cur.map(t => t[0]), m = Math.min(...xs) + Math.max(...xs), cands = [];
    for (let z = 0; z <= 2; z++) for (let y = 2; y <= 16; y++) for (let x = Math.min(...xs); x + 2 <= Math.max(...xs) + 2; x++) {
      const p = [x, y, z]; if (!D.brickSpot(cur, p) || lx(p) < Math.min(...cur.map(lx)) - 1e-9 || ly(p) < Math.min(...cur.map(ly)) - 1e-9) continue;
      const mir = cur.some(q => q[0] === m - x && q[1] === y && q[2] === z);
      cands.push({ p, sc: z * 10 - (mir ? 20 : 0) + Math.abs(x + 1 - (m + 2) / 2) * 0.5 });
    }
    cands.sort((p, q) => p.sc - q.sc);
    const home = B.st.T[id]; let done = false;
    for (const c of cands) { B.st.T[id] = c.p; if (S.problems(B).length) continue; if (kOf() === k0) { done = true; console.log('tile', id, '->', JSON.stringify(c.p)); break; } }
    if (!done) { B.st.T[id] = home; console.log('no k-keeping spot for', id); }
  }
  B.centre(); B.show();
  const r = B.prove(); console.log(JSON.stringify(r).slice(0, 500));
  if (r.ok) console.log('saved', B.save('279: bands (6 wide), then the four ordinary tiles of the top row moved below it (spots keeping the clock route): 8 rows'));
};
