/* Do the move-trained test players win as often as the real person, on the exact boards of the
   person's recorded games? Each recorded game (no help used, played to the end) is played 100 times
   by the person's own test player (move weights from mimic/weights.json, turning-over habits per
   situation). The newest quarter of the games was not used for training (test); the rest was (train).
   Sharpness x1/x2/x3 multiplies the move weights (less or more decisive).
     node mimic_board_eval.js [runs=100] -> mimic/board-eval.json */
'use strict';
const fs = require('fs'), path = require('path');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const runs = +(process.argv[2] || 100);
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', 'weights.json'), 'utf8'));
const PIDS = { Dennisisdebeste: 'pmuy78xu6tsths9', 'Mrs. Doubtfire': 'pmv16kj3jr35750', PUK: 'pmv2gaa0g00eq3q', Gerda: 'pmv6yhzz3x9oxs8' };
const BETAS = [1, 2, 3];
const out = {};
for (const [name, pid] of Object.entries(PIDS)) {
  const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'replays', pid + '.json'), 'utf8'));
  const cut = W.test[name].cut_t, pl = W.players[name];
  const games = [];
  for (const ch of Object.values(R)) {
    const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
    let init = null; const ev = [];
    for (const r of rows) { const d = JSON.parse(r.data); if (d.init) init = d.init; ev.push(...d.events); }
    if (!init || init.partial || init.track || !init.state) continue;
    if (init.state.f.some(f => f >= 100 && f !== 101)) continue;
    if (ev.some(e => ['hint', 'shuffle', 'rescue', 'nudge'].includes(e[1]))) continue;
    const end = ev.find(e => e[1] === 'end'); if (!end || !end[2]) continue;
    const r = end[2].r; if (r === 'restart') continue;                  // given up: not a played-out try
    const st = init.state, tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), n = tiles.length;
    const down = new Uint8Array(n); st.d.forEach((v, i) => { if (v) down[i] = 1; });
    const ob = st.ob || {}, hasRules = Object.keys(ob.need || {}).length || (ob.keys || []).length;
    const rules = hasRules ? { iceNb: L.iceNeighbors(tiles), ice: { ...(ob.need || {}) }, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
    games.push({ key: init.key, at: init.at, t: rows[0].t, won: r === 'win', g: { tiles, nb: L.neighbors(tiles), faces: st.f.slice(), down, rules, clock: st.ck ? { i: st.ck.i, n: st.ck.n } : null } });
  }
  const res = { games: games.length, train: {}, test: {} };
  for (const part of ['train', 'test']) {
    const G = games.filter(x => part === 'test' ? x.t >= cut : x.t < cut);
    const w0 = part === 'test' ? W.test[name].train_w : pl.w;
    const realRate = G.filter(x => x.won).length / Math.max(1, G.length);
    const row = { n: G.length, realWins: G.filter(x => x.won).length };
    for (const beta of BETAS) {
      const p = { ...Hard.P, w: w0.map(x => x * beta), allMoves: true, flips: true, flipRate: pl.flipRate, peek: 0, end: 12, plan: 10 };
      let sum = 0, ll = 0, winP = [], lossP = [];
      for (const x of G) {
        const q = Hard.rate(x.g, runs, 5, p).rate; sum += q;
        const c = Math.min(0.99, Math.max(0.01, q)); ll -= Math.log(x.won ? c : 1 - c);
        (x.won ? winP : lossP).push(q);
      }
      const avg = v => v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : null;
      row['x' + beta] = { simWins: +sum.toFixed(1), logLoss: +(ll / Math.max(1, G.length)).toFixed(3), meanWhenWon: avg(winP), meanWhenLost: avg(lossP) };
    }
    const base = Math.min(0.99, Math.max(0.01, (games.filter(x => x.t < cut && x.won).length + 1) / (games.filter(x => x.t < cut).length + 2)));
    row.baselineLogLoss = +(G.reduce((s, x) => s - Math.log(x.won ? base : 1 - base), 0) / Math.max(1, G.length)).toFixed(3);
    res[part] = row;
  }
  out[name] = res;
  console.log(name, JSON.stringify(res));
}
fs.writeFileSync(path.join(__dirname, 'mimic', 'board-eval.json'), JSON.stringify(out, null, 1));
