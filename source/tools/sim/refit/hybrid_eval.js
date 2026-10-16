/* Per-person test player, hybrid: the planning test player (engine) with the person's own habits
   from their recordings: turning tiles over per situation (they see a face-down tile only after
   turning it over), the fatal 4th tile with 3 waiting (blunder3). Only the engine's care level
   (temp) is fitted, on the person's older recorded games (exact boards, real results); the newest
   quarter is the test.
     node hybrid_eval.js [runs=100] -> mimic/hybrid-eval.json */
'use strict';
const fs = require('fs'), path = require('path');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const runs = +(process.argv[2] || 100);
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', 'weights.json'), 'utf8'));
const PIDS = { Dennisisdebeste: ['pmuy78xu6tsths9', 'strong'], 'Mrs. Doubtfire': ['pmv16kj3jr35750', 'average'], PUK: ['pmv2gaa0g00eq3q', 'average'], Gerda: ['pmv6yhzz3x9oxs8', 'average'] };
const TEMPS = [1, 1.5, 2, 3, 4.5, 6, 9];
function recorded(pid) {
  const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'analysis', 'archive', 'replays', pid + '.json'), 'utf8'));
  const games = [];
  for (const ch of Object.values(R)) {
    const rows = Object.values(ch).filter(r => r && r.data).sort((a, b) => a.seq - b.seq);
    let init = null; const ev = [];
    for (const r of rows) { const d = JSON.parse(r.data); if (d.init) init = d.init; ev.push(...d.events); }
    if (!init || init.partial || init.track || !init.state) continue;
    if (init.state.f.some(f => f >= 100 && f !== 101)) continue;
    if (ev.some(e => ['hint', 'shuffle', 'rescue', 'nudge'].includes(e[1]))) continue;
    const end = ev.find(e => e[1] === 'end'); if (!end || !end[2] || end[2].r === 'restart') continue;
    const st = init.state, tiles = init.tiles.map(([x, y, z]) => ({ x, y, z })), n = tiles.length;
    const down = new Uint8Array(n); st.d.forEach((v, i) => { if (v) down[i] = 1; });
    const ob = st.ob || {}, hasRules = Object.keys(ob.need || {}).length || (ob.keys || []).length;
    const rules = hasRules ? { iceNb: L.iceNeighbors(tiles), ice: { ...(ob.need || {}) }, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
    games.push({ key: init.key, at: init.at, t: rows[0].t, won: end[2].r === 'win', g: { tiles, nb: L.neighbors(tiles), faces: st.f.slice(), down, rules, clock: st.ck ? { i: st.ck.i, n: st.ck.n } : null } });
  }
  return games;
}
const clamp = q => Math.min(0.99, Math.max(0.01, q));
const out = {};
for (const [name, [pid, engine]] of Object.entries(PIDS)) {
  const pl = W.players[name], cut = W.test[name].cut_t, games = recorded(pid);
  const train = games.filter(x => x.t < cut), test = games.filter(x => x.t >= cut);
  const bot = temp => ({ ...Hard.persona(engine), temp, flips: true, flipRate: pl.flipRate, peek: 0, blunder3: pl.blunder3 });
  const cache = new Map();
  const q = (x, temp) => { const k = x.key + x.t + '|' + temp; if (!cache.has(k)) cache.set(k, Hard.rate(x.g, runs, 5, bot(temp)).rate); return cache.get(k); };
  const score = (G, temp) => { let ll = 0, sum = 0; for (const x of G) { const p = q(x, temp); sum += p; ll -= Math.log(x.won ? clamp(p) : 1 - clamp(p)); } return { ll: +(ll / Math.max(1, G.length)).toFixed(3), sim: +sum.toFixed(1) }; };
  const fits = TEMPS.map(t => ({ temp: t, ...score(train, t) }));
  const best = fits.slice().sort((a, b) => a.ll - b.ll)[0];
  const base = clamp((train.filter(x => x.won).length + 1) / (train.length + 2));
  const baseLL = G => +(G.reduce((s, x) => s - Math.log(x.won ? base : 1 - base), 0) / Math.max(1, G.length)).toFixed(3);
  const t = score(test, best.temp);
  out[name] = { engine, temp: best.temp, train: { n: train.length, realWins: train.filter(x => x.won).length, simWins: best.sim, logLoss: best.ll, baseline: baseLL(train) }, test: { n: test.length, realWins: test.filter(x => x.won).length, simWins: t.sim, logLoss: t.ll, baseline: baseLL(test) }, fits };
  console.log(name, JSON.stringify({ temp: best.temp, train: out[name].train, test: out[name].test }));
}
fs.writeFileSync(path.join(__dirname, 'mimic', 'hybrid-eval.json'), JSON.stringify(out, null, 1));
