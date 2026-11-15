// 292 from Dennis's editor arrangement (outer base tiles of rows 4/8 off, t60/.44/.17/.30 elsewhere, key 53 <-> 57):
// only wrong move 74 lost its cost. Search spots for the moved tiles until the trap proves.
module.exports = (B, S) => {
  const sv = JSON.parse(require('fs').readFileSync('../codex-tasks/results/narrow-251-299/placements-4/level-292.json'));
  sv.positions.forEach((p, i) => { if (p) B.st.T[i] = p.slice(); });
  for (const id of [60, 44, 17, 30]) {
    const r = S.spots(B, id, { max: 60 });
    console.log('tile', id, 'good', JSON.stringify(r.good), 'tried', r.tried, r.good ? '' : JSON.stringify([...new Set(r.out.map(o => o.errors.join(',')))]).slice(0, 300));
    if (r.good) break;
  }
  B.show();
  const r = B.prove(); console.log(JSON.stringify(r).slice(0, 500));
  if (r.ok) console.log('saved', B.save("292: Dennis's editor arrangement; spots searched for the moved tiles until every wrong move costs as before"));
};
