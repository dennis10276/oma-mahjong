/* A person's care level, learned from their recorded moves: within the kind of move they chose (pair /
   single), how sharply do they prefer what the planning test player rates best? Maximum likelihood of
   their real choices for softmax(engine parts . weights / temp), recent games weighted (half-life).
     node mimic_temp.js [half-life=20] [weights file to write into]
   Writes players[name].temp (all games) and test[name].temp (games before the test cut). */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const HALF = +(process.argv[2] || 20), FILE = process.argv[3];
const NAMES = { Dennisisdebeste: 'Dennisisdebeste', 'Mrs. Doubtfire': 'Mrs_Doubtfire', PUK: 'PUK', Gerda: 'Gerda' };
const W = FILE ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
const TEMPS = [0.3, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 10, 13];
const CAP = 50, STUCK = [0, 3, 10, 20, 50, 1000];
const kindOf = (f, ix) => f[ix.flip] ? 'flip' : f[ix.overflow] ? 'fatal' : f[ix.isPair] ? 'pair' : 'single';
function sets(games, ix) {
  const N = games.length, out = [];
  games.forEach((g, gi) => {
    const rw = HALF ? 0.5 ** ((N - 1 - gi) / HALF) : 1;
    for (const dc of g.decisions) {
      if (dc.k < 0) continue; const kd = kindOf(dc.F[dc.k], ix); if (kd === 'flip' || kd === 'fatal') continue;
      const opt = dc.F.map((f, q) => [f, q]).filter(([f]) => kindOf(f, ix) === kd);
      if (opt.length < 2) continue;
      out.push({ rw, F: opt.map(([f]) => f.map(v => Math.max(-CAP, Math.min(CAP, v)))), k: opt.findIndex(([, q]) => q === dc.k) });
    }
  });
  return out;
}
function ll(S, w0, temp) {
  let s = 0, n = 0;
  for (const d of S) { const v = d.F.map(f => f.reduce((a, x, q) => a + x * w0[q], 0) / temp), m = Math.max(...v); const z = v.reduce((a, x) => a + Math.exp(x - m), 0); s += d.rw * (v[d.k] - m - Math.log(z)); n += d.rw; }
  return s / n;
}
const SHAPES = { strong: Hard.persona('strong'), sensible: Hard.persona('sensible') };
for (const [name, f] of Object.entries(NAMES)) {
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', f + '.json'), 'utf8')), ix = Object.fromEntries(D.feat.map((x, i) => [x, i]));
  const res = {};
  for (const part of ['all', 'train']) {
    const games = part === 'train' && W ? D.games.filter(g => g.t < W.test[name].cut_t) : D.games;
    const S = sets(games, ix); let best = null;
    // stuck: what being stuck for sure (and the clock ringing for sure) is worth to them, in the
    // engine's units (the engine itself: 1000, it never does it; people do, without seeing it coming)
    for (const [shape, pp] of Object.entries(SHAPES)) for (const stuck of STUCK) {
      const w0 = Array.from(Hard.weightsOf({ ...pp, temp: 1 }));
      w0[ix.stuckHard] = -stuck; w0[ix.clockDead] = -stuck; w0[ix.rang] = -stuck; w0[ix.stuckSoft] = Math.max(w0[ix.stuckSoft], -stuck);
      for (const t of TEMPS) { const v = ll(S, w0, t); if (!best || v > best.ll) best = { shape, stuck, temp: t, ll: v }; }
    }
    // chance level: equal odds among the options of the chosen kind
    const flat = S.reduce((a, d) => a - d.rw * Math.log(d.F.length), 0) / S.reduce((a, d) => a + d.rw, 0);
    res[part] = { ...best, ll: +best.ll.toFixed(3), flat: +flat.toFixed(3), decisions: S.length };
  }
  console.log(name, JSON.stringify(res));
  if (W) { W.players[name].engine = { shape: res.all.shape, temp: res.all.temp, stuck: res.all.stuck }; W.test[name].engine = { shape: res.train.shape, temp: res.train.temp, stuck: res.train.stuck }; }
}
if (W) fs.writeFileSync(FILE, JSON.stringify(W, null, 1));
