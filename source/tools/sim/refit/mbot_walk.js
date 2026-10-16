/* Rolling test of the move-based test player (mbot/chains-<name>.json from mbot_chains.js): every
   level is predicted with only what came before its first try: habits from earlier recordings (in the
   chains), care level and memory fitted on the earlier levels' tries (recent levels weighted,
   half-life in levels). Compared with: their own win shares so far (first tries and retries apart).
     node mbot_walk.js [half-lives=8,20,1000] [warm-up levels=8] -> mbot/walk.json */
'use strict';
const path = require('path'), fs = require('fs');
const HALVES = (process.argv[2] || '8,20,1000').split(',').map(Number), WARM = +(process.argv[3] || 8);
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'];
const clamp = p => Math.min(0.97, Math.max(0.03, p));
const chance = (ch, at) => { for (let t = Math.min(at, 4) - 1; t >= 0; t--) if (ch.cond[t] !== null) return ch.cond[t]; return ch.within[0]; };
const out = {}, pooled = {};
for (const name of NAMES) {
  const f = path.join(__dirname, 'mbot', `chains-${name.replace(/[^A-Za-z]/g, '')}.json`);
  if (!fs.existsSync(f)) continue;
  const C = JSON.parse(fs.readFileSync(f, 'utf8')), L = C.levels, keys = Object.keys(L[0].chains);
  const res = { levels: L.length, tested: 0 };
  for (const half of HALVES) {
    let llM = 0, llO = 0, n = 0, n1 = 0, llM1 = 0, llO1 = 0, pM1 = 0, w1 = 0, pM = 0, wAll = 0; const picks = [], cal = [];
    for (let i = WARM; i < L.length; i++) {
      const past = L.slice(0, i), N = past.length;
      let best = null;
      for (const k of keys) {
        let s = 0, ws = 0;
        past.forEach((l, j) => { const w = 0.5 ** ((N - 1 - j) / half); for (const x of l.tries) { const q = clamp(chance(l.chains[k], x.at)); s += w * Math.log(x.won ? q : 1 - q); ws += w; } });
        if (!best || s / ws > best.v) best = { k, v: s / ws };
      }
      picks.push(best.k);
      const tr = past.flatMap(l => l.tries), f1 = tr.filter(x => x.at === 1), f2 = tr.filter(x => x.at > 1);
      const o1 = clamp((f1.filter(x => x.won).length + 1) / (f1.length + 2)), o2 = clamp((f2.filter(x => x.won).length + 1) / (f2.length + 2));
      for (const x of L[i].tries) {
        const q = clamp(chance(L[i].chains[best.k], x.at)), o = x.at === 1 ? o1 : o2;
        llM -= Math.log(x.won ? q : 1 - q); llO -= Math.log(x.won ? o : 1 - o); n++; pM += q; wAll += x.won;
        if (x.at === 1) { n1++; llM1 -= Math.log(x.won ? q : 1 - q); llO1 -= Math.log(x.won ? o : 1 - o); pM1 += q; w1 += x.won; cal.push([q, x.won ? 1 : 0]); }
      }
    }
    res.tested = L.length - WARM;
    res['h' + half] = { tries: n, logLoss: { moveBot: +(llM / n).toFixed(3), ownRate: +(llO / n).toFixed(3) }, firstTries: { n: n1, won: w1, predicted: +pM1.toFixed(1), moveBot: +(llM1 / n1).toFixed(3), ownRate: +(llO1 / n1).toFixed(3) }, allTries: { won: wAll, predicted: +pM.toFixed(1) }, lastPick: picks[picks.length - 1], cal };
    const P = pooled['h' + half] || (pooled['h' + half] = { n: 0, m: 0, o: 0, cal: [] }); P.n += n; P.m += llM; P.o += llO; P.cal.push(...cal);
  }
  out[name] = res;
  console.log(name, `(${res.tested} levels predicted)`);
  for (const half of HALVES) { const r = res['h' + half]; console.log(`  half-life ${String(half).padEnd(5)} all tries ${r.tries}: log-loss move bot ${r.logLoss.moveBot} vs own rate ${r.logLoss.ownRate} | first tries ${r.firstTries.won}/${r.firstTries.n} won, predicted ${r.firstTries.predicted}: ${r.firstTries.moveBot} vs ${r.firstTries.ownRate} | all tries won ${r.allTries.won}, predicted ${r.allTries.predicted} | now: ${r.lastPick}`); }
}
console.log('pooled');
for (const [h, P] of Object.entries(pooled)) {
  // calibration of first tries: predicted vs real in three bands
  const bands = [[0, 0.35], [0.35, 0.65], [0.65, 1.01]].map(([a, b]) => { const s = P.cal.filter(([q]) => q >= a && q < b); return `${a}-${b}: ${s.length} tries, predicted ${(s.reduce((x, [q]) => x + q, 0) / Math.max(1, s.length)).toFixed(2)}, real ${(s.reduce((x, [, w]) => x + w, 0) / Math.max(1, s.length)).toFixed(2)}`; });
  console.log(`  ${h}: log-loss move bot ${(P.m / P.n).toFixed(3)} vs own rate ${(P.o / P.n).toFixed(3)} over ${P.n} tries | first tries by predicted chance: ${bands.join(' | ')}`);
}
fs.writeFileSync(path.join(__dirname, 'mbot', 'walk.json'), JSON.stringify(out, null, 1));
