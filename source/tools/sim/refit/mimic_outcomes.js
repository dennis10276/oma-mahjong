/* Do the move-trained test players win as often as the real person, on the exact boards of the
   person's recorded games? Train = games before the person's cut (mimic fit), test = newest quarter.
   Sharpness multiplies the move weights (the fatal parts stay fixed).
     node mimic_outcomes.js <weights file> [runs=60] [sharpness list=1,1.5,2,3] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { PIDS, gamesOf } = require('./mimic_games.js');
const W = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const runs = +(process.argv[3] || 60), BETAS = (process.argv[4] || '1,1.5,2,3').split(',').map(Number);
const FIX = new Set(['stuckHard', 'clockDead', 'rang', 'overflow']);
const clamp = p => Math.min(0.97, Math.max(0.03, p));
const KINDS = process.env.KINDS === '1';   // the two-step player (kind of move per situation, then which)
const bot = (pl, w, beta, extra = {}) => ({ ...Hard.P, w: w.map((x, i) => FIX.has(W.feat[i]) ? x : x * beta), allMoves: true, flips: true, ...(KINDS ? { kinds: pl.kinds } : { flipRate: pl.flipRate, blunder3: pl.blunder3 }), peek: 0, end: 12, plan: 10, ...extra });
const out = {};
for (const name of Object.keys(PIDS)) {
  const cut = W.test[name].cut_t, G = gamesOf(name);
  const res = { games: G.length };
  for (const part of ['train', 'test']) {
    const S = G.filter(x => part === 'test' ? x.t >= cut : x.t < cut), w = part === 'test' ? W.test[name].train_w : W.players[name].w;
    // the test part is played by the test player made from the older games only (weights and habits)
    const pl = part === 'test' ? (KINDS ? W.test[name] : W.test[name].habits || W.players[name]) : W.players[name];
    const row = { n: S.length, real: S.filter(x => x.won).length };
    const base = clamp((G.filter(x => x.t < cut && x.won).length + 1) / (G.filter(x => x.t < cut).length + 2));
    row.baseLL = +(S.reduce((s, x) => s - Math.log(x.won ? base : 1 - base), 0) / Math.max(1, S.length)).toFixed(3);
    for (const b of BETAS) {
      let sum = 0, ll = 0, br = 0; const why = {};
      for (const x of S) { const q = Hard.rate(x.g, runs, 5, bot(pl, w, b)).rate; sum += q; ll -= Math.log(x.won ? clamp(q) : 1 - clamp(q)); br += ((x.won ? 1 : 0) - q) ** 2; }
      row['x' + b] = { sim: +sum.toFixed(1), ll: +(ll / Math.max(1, S.length)).toFixed(3), brier: +(br / Math.max(1, S.length)).toFixed(3) };
    }
    res[part] = row;
  }
  out[name] = res;
  console.log(name, JSON.stringify(res));
}
if (process.argv[5]) fs.writeFileSync(process.argv[5], JSON.stringify(out, null, 1));
