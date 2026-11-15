// 278: top band (rows 0-8) = two side columns around a hollow; bottom block (rows 10-14) = pyramid, lock/ice trap on its right.
// The bottom block's left staircase (22 base, 49, 67, route tile 76 on top) comes off: the block is then 6.5 wide.
// The left column slides half a tile right (no new neighbours). Route tile 76 goes right beside the clock (Dennis's editor
// arrangement does the same); the three ordinary tiles go into the hollow.
module.exports = (B, S) => {
  const top = B.ids(t => t[1] <= 8), leftCol = top.filter(i => B.st.T[i][0] <= 4);
  B.move(leftCol, 1, 0, 0);
  for (const [i, p] of [[76, [4, 6, 0]], [22, [7, 2, 0]], [67, [7, 4, 0]], [49, [7, 6, 0]]]) B.at(i, p);
  console.log(S.problems(B));
  B.centre(); B.show();
  console.log(JSON.stringify(B.quick()));
  const r = B.prove(); console.log(JSON.stringify(r));
  if (r.ok) console.log('saved', B.save('278: left staircase of the bottom block off, left column half a tile in, route tile beside the clock, three tiles into the hollow (Dennis 2026-11-16)'));
};
