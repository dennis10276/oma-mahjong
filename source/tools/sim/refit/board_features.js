/* Difficulty features of every board real players got: the first-try win chance of the standard
   test players (strong, sensible, average) and of a weak one (temp 6). These are the inputs of the
   per-player prediction model (predict_model.py).
     node board_features.js [runs=200] [part=0] [parts=1] -> features-<part>.json */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const runs = +(process.argv[2] || 200), part = +(process.argv[3] || 0), parts = +(process.argv[4] || 1);
const A = require('./attempts.json');
const extra = process.env.EXTRA ? JSON.parse(fs.readFileSync(process.env.EXTRA, 'utf8')) : [];   // more boards: [{key, board}]
const boards = new Map(); for (const a of [...A, ...extra]) if (!boards.has(a.key)) boards.set(a.key, a.board);
const keys = [...boards.keys()].sort().filter((k, i) => i % parts === part);
const file = path.join(__dirname, `features-${part}.json`);
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const P = { strong: Hard.persona('strong'), sensible: Hard.persona('sensible'), average: Hard.persona('average'), weak: { ...Hard.persona('average'), temp: 6 } };
for (const k of keys) {
  if (out[k]) continue;
  const b = boards.get(k), g = b.kind === 'classic' ? B.classic(b.lv, b.aspect) : B.designed(b.v, b.lv);
  const f = { tiles: g.tiles.length, down: g.down.reduce((x, y) => x + y, 0), clock: g.clock ? g.clock.n : 0 };
  for (const [n, p] of Object.entries(P)) f[n] = Hard.rate(g, runs, 17, p).rate;
  out[k] = f; fs.writeFileSync(file, JSON.stringify(out));
  console.error(k, JSON.stringify(f));
}
