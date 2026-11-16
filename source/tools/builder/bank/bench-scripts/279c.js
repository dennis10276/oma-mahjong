// 279, understood: clock 8 under ice 61 (2 of 7,8,45,55,65) and locked by keys 54 (under ice 73: 2 of 48,54,67,70) and 42.
// Route 67,71,45,55,61,70,73,42,54,8; 55 (f30) pairs with 70 (f30). Bands make it 6 wide with no trap change; it is 9 rows.
// The top row holds only ordinary tiles: each goes to a spot that changes no trap dependency and keeps the route playing.
module.exports = (B, S) => {
  S.fromBands(B); console.log('after bands, changed deps:', S.diffDeps(B, { silent: true }).length);
  const top = B.ids(t => t[1] === Math.min(...B.st.T.map(q => q[1])));
  console.log('top row', top.join(','), top.map(i => B.role[i]).join(''));
  const y0 = Math.min(...B.st.T.map(q => q[1])) + 2;
  for (const id of top) { const p = S.safeSpot(B, id, { y0 }); console.log('tile', id, '->', JSON.stringify(p)); if (!p) return; }
  B.centre(); B.show(); S.explain(B, { depth: 2 });
  const r = B.prove(); console.log(JSON.stringify(r).slice(0, 400));
  if (r.ok) console.log('saved', B.save('279: rows slid to the middle (6 wide), top row moved into the pile without touching the trap (8 rows)'));
};
