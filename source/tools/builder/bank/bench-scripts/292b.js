// 292: Dennis's arrangement; ice 65 lost its cheap neighbour t60, so wrong move 74 became the cheap thaw. Put a finish tile
// back beside ice 65 (tower-free spot) and prove.
module.exports = (B, S) => {
  const fs = require('fs'), sv = JSON.parse(fs.readFileSync('../codex-tasks/results/narrow-251-299/placements-4/level-292.json'));
  sv.positions.forEach((p, i) => { if (p) B.st.T[i] = p.slice(); });
  const I = B.st.T[65], isNb = p => { const dx = Math.abs(p[0] - I[0]), dy = Math.abs(p[1] - I[1]), dz = Math.abs(p[2] - I[2]); return dz === 0 ? (dx <= 2 && dy <= 2 && (dx < 2 || dy < 2)) : (dz === 1 && dx < 2 && dy < 2); };
  const D = require('../../tools/builder/bank/detower.js');
  const movable = [60, 44, 17, 30, 59, 72, 68, 69, 67, 75, 54, 58, 50, 31, 32, 33, 34];
  for (const id of movable) {
    const home = B.st.T[id], cur = B.st.T.filter((t, i) => i !== id), spots = [];
    for (let z = 0; z <= 2; z++) for (let y = I[1] - 3; y <= I[1] + 3; y++) for (let x = I[0] - 3; x <= I[0] + 3; x++) { const p = [x, y, z]; if (isNb(p) && D.brickSpot(cur, p)) spots.push(p); }
    for (const p of spots) { B.st.T[id] = p; if (S.problems(B).length || B.quick().wide > 6.5) { B.st.T[id] = home; continue; } const r = B.prove(); console.log('tile', id, JSON.stringify(p), r.ok, (r.errors || [r.why]).join(',')); if (r.ok) { B.show(); console.log('saved', B.save("292: Dennis's editor arrangement + tile " + id + ' beside ice 65 again, so wrong move 74 costs as before')); return; } B.st.T[id] = home; }
  }
  console.log('no spot');
};
