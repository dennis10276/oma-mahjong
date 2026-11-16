// 293, understood: clock 45 under ice 71, locked by keys 4 (under ice 63) and 0; ice 63 thaws by 52+53, ice 71 by 72+75.
// Wrong move 73 (lonely neighbour of ice 71): twin 36 deep under 62/64. Bands: 6 wide x 8 rows, no trap dependency changed,
// route plays; but the two keys (same picture) end up diagonal neighbours. Slide row 0 (key 0's row) so they are apart again.
module.exports = (B, S) => {
  const D = require('../detower.js'), SEP = require(D.CF + 'separate');
  S.fromBands(B);
  const row0 = B.ids(t => t[1] === Math.min(...B.st.T.map(q => q[1])));
  console.log('row 0', row0.join(','), 'key 0 at', JSON.stringify(B.st.T[0]), 'key 4 at', JSON.stringify(B.st.T[4]));
  const pre = B.a.solution.slice(0, B.a.solution.indexOf(B.a.clock.i) + 1);
  for (const dx of [-2, 2, -1, 1, -3, 3, -4, 4]) {
    B.move(row0, dx, 0, 0);
    const ok = !S.problems(B).length && B.quick({ cheap: true }).wide <= 6.5 && !S.diffDeps(B, { silent: true }).length;
    const { d, keep } = B.design(), tw = SEP.closeTwins(d).visible, idn = new Map(keep.map((x, k) => [x, k]));
    const plays = ok && !S.explainRoute(d, pre.map(i => idn.get(i))).lines.some(l => /NOT TAKEABLE|LOSES/.test(l));
    console.log('row 0 by', dx, 'valid/deps', ok, 'twins', tw, 'route plays', plays);
    if (ok && plays && tw <= B.base.twins) break;
    B.move(row0, -dx, 0, 0);
  }
  B.centre(); B.show(); const r = B.prove(); console.log(JSON.stringify(r).slice(0, 400));
  if (r.ok) console.log('saved', B.save('293: rows slid to the middle and gaps closed (6 wide), row 0 slid so the two keys stay apart'));
};
