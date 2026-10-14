/* Step 1 of the re-fit: the honest test player's win chance on every board real players got,
   for a grid of player settings. Results go to rates/<part>.json (resumable).
     node fit.js [part=0] [parts=1] [runs=100]
   temp: noise in its choices; end: plans the last n tiles exactly; clockFocus: digs for the
   alarm clock (only matters on boards with a clock, so the other boards skip that axis). */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const part = +(process.argv[2] || 0), parts = +(process.argv[3] || 1), runs = +(process.argv[4] || 100);
// GRID=1: temp x end x clockFocus. GRID=2 and 3 (3: after the face-down pair rule in hard.js):
// the fear of an unknown twin (unknown) as an extra axis, end fixed at 12
const GRID = +(process.env.GRID || 1);
const G1 = GRID === 1;
const TEMPS = G1 ? [0.3, 0.5, 0.7, 1, 1.5, 2, 3, 4.5, 6, 9] : GRID === 2 ? [0.3, 0.7, 1.5, 3, 6] : [0.3, 0.7, 1, 1.5, 2, 3, 4.5, 6];
const ENDS = G1 ? [0, 12, 20] : [12], FOCUS = G1 ? [0, 1, 4] : [1, 4], UNK = G1 ? [7] : [0, 2, 7];
const A = require('./attempts.json');
const keys = [...new Set(A.map(a => a.key))].sort().filter((k, i) => i % parts === part);
const OUT = path.join(__dirname, G1 ? 'rates' : 'rates' + GRID); fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `part${part}.json`);
const res = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const build = k => { const a = A.find(x => x.key === k); return a.board.kind === 'classic' ? B.classic(a.board.lv, a.board.aspect) : B.designed(a.board.v, a.board.lv); };
const t0 = Date.now();
keys.forEach((k, n) => {
  if (res[k]) return;
  const g = build(k), out = {};
  for (const temp of TEMPS) for (const end of ENDS) for (const cf of (g.clock ? FOCUS : [0])) for (const unknown of UNK) {
    const r = Hard.rate(g, runs, 1, { ...Hard.P, temp, end, clockFocus: cf, unknown });
    out[`${temp}|${end}|${cf}` + (G1 ? '' : `|${unknown}`)] = r.rate;
  }
  res[k] = { tiles: g.tiles.length, clock: !!g.clock, runs, r: out };
  fs.writeFileSync(file, JSON.stringify(res));
  console.error(`${n + 1}/${keys.length} ${k} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
});
