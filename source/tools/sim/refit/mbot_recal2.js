/* Rolling test across the whole family: every level of every person is predicted with all tries
   (everyone's) made before it. logit P = a_person + c_person*[retry] + b * logit(test player's
   chance) [+ b2 * logit(second predictor)]; b shared by the family (more data), a and c per person,
   recent tries weighted per person (half-life), pulled towards a = 0, c = 0, b = B0.
     PRED='2|high' node mbot_recal2.js [half-life=12] [pull=1] [b0=0.3] [cap=0.05] [second predictor] */
'use strict';
const path = require('path'), fs = require('fs');
const HALF = +(process.argv[2] || 12), PULL = +(process.argv[3] || 1), B0 = +(process.argv[4] || 0.3), CAPQ = +(process.argv[5] || 0.05), SECOND = process.argv[6] || null;
const KEY = process.env.PRED || '2|high', WARM = 6;
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'];
const clamp = (p, e = 0.02) => Math.min(1 - e, Math.max(e, p));
const logit = p => Math.log(clamp(p, CAPQ) / (1 - clamp(p, CAPQ))), sig = z => 1 / (1 + Math.exp(-z));
const chance = (ch, at) => { for (let t = Math.min(at, 4) - 1; t >= 0; t--) if (ch.cond[t] !== null) return ch.cond[t]; return ch.within[0]; };
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let m = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[m][i])) m = k; [M[i], M[m]] = [M[m], M[i]]; for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; } } return M.map((r, i) => r[n] / r[i]); }
// rows: { x: design vector, y, w }; prior: means; pulls per parameter
function fit(rows, prior, pull) {
  let w = prior.slice(); const K = w.length;
  for (let it = 0; it < 40; it++) {
    const g = new Array(K).fill(0), H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const r of rows) { let z = 0; for (let i = 0; i < K; i++) z += r.x[i] * w[i]; const p = sig(z); for (let i = 0; i < K; i++) { if (!r.x[i]) continue; g[i] += r.w * (r.y - p) * r.x[i]; for (let j = 0; j < K; j++) if (r.x[j]) H[i][j] -= r.w * p * (1 - p) * r.x[i] * r.x[j]; } }
    for (let i = 0; i < K; i++) { g[i] -= pull[i] * (w[i] - prior[i]); H[i][i] -= pull[i]; }
    const d = solve(H, g); w = w.map((v, i) => v - d[i]);
    if (Math.max(...d.map(Math.abs)) < 1e-7) break;
  }
  return w;
}
const crypto = require('crypto'), { triesOf } = require('./pdata.js');
const sigOf = g => crypto.createHash('sha1').update(JSON.stringify([g.tiles.map(t => [t.x, t.y, t.z]), Array.from(g.faces), Array.from(g.down)])).digest('hex').slice(0, 16);
const TAU = +(process.env.TAU || 1);
const ALL = [];   // every try: person, level, try, time, won, chances
const LEV = {};
NAMES.forEach((name, pi) => {
  const C = JSON.parse(fs.readFileSync(path.join(__dirname, 'mbot', `chains-${name.replace(/[^A-Za-z]/g, '')}.json`), 'utf8'));
  LEV[name] = C.levels;
  const SG = new Map(); for (const x of triesOf(name)) if (!SG.has(x.lv)) SG.set(x.lv, sigOf(x.g));
  C.levels.forEach(l => { l.board = SG.get(l.lv); });
  C.levels.forEach((l, li) => l.tries.forEach(x => ALL.push({ name, pi, li, l, x })));
});
ALL.sort((a, b) => a.x.t - b.x.t);
const NP = NAMES.length, K = 2 * NP + 1 + (SECOND ? 1 : 0);
const design = r => { const v = new Array(K).fill(0); v[r.pi] = 1; if (r.x.at > 1) v[NP + r.pi] = 1; v[2 * NP] = logit(chance(r.l.chains[KEY], r.x.at)); if (SECOND) v[2 * NP + 1] = logit(chance(r.l.chains[SECOND], r.x.at)); return v; };
const prior = [...new Array(2 * NP).fill(0), B0, ...(SECOND ? [B0] : [])], pull = new Array(K).fill(PULL);
const res = {}, cal = [], BE = { n: 0, with: 0, without: 0 };
for (const name of NAMES) {
  const L = LEV[name], pi = NAMES.indexOf(name);
  let ll = 0, n = 0, ll1 = 0, n1 = 0, p1 = 0, w1 = 0;
  for (let i = WARM; i < L.length; i++) {
    const t0 = L[i].t, past = ALL.filter(r => r.x.t < t0);
    const cnt = {}; for (const r of past) cnt[r.name] = (cnt[r.name] || 0) + 1;
    const seen = {}; const rows = [];
    for (let j = past.length - 1; j >= 0; j--) { const r = past[j]; seen[r.name] = (seen[r.name] || 0) + 1; rows.push({ x: design(r), y: r.x.won ? 1 : 0, w: 0.5 ** ((seen[r.name] - 1) / HALF) }); }
    const w = fit(rows, prior, pull);
    // the board effect: others' earlier tries on this exact board, against their prediction
    let res_ = 0, info = 0, nb = 0;
    for (const r of past) if (r.name !== name && r.l.board === L[i].board) { const v = design(r); let z = 0; for (let k = 0; k < K; k++) z += v[k] * w[k]; const p = sig(z); res_ += (r.x.won ? 1 : 0) - p; info += p * (1 - p); nb++; }
    const e = nb ? res_ / (info + 1 / TAU ** 2) : 0;
    for (const x of L[i].tries) {
      const v = design({ pi, l: L[i], x }); let z = 0; for (let k = 0; k < K; k++) z += v[k] * w[k];
      if (nb) { const q0 = clamp(sig(z), 0.03), q1 = clamp(sig(z + e), 0.03); BE.n++; BE.without -= Math.log(x.won ? q0 : 1 - q0); BE.with -= Math.log(x.won ? q1 : 1 - q1); }
      if (process.env.BOARD) z += e;
      z *= +(process.env.SHRINK || 1);   // pull every chance towards 50% (overconfidence)
      const q = clamp(sig(z), 0.03);
      ll -= Math.log(x.won ? q : 1 - q); n++; cal.push([q, x.won ? 1 : 0, x.at === 1]);
      if (x.at === 1) { ll1 -= Math.log(x.won ? q : 1 - q); n1++; p1 += q; w1 += x.won; }
    }
    if (i === L.length - 1) res[name] = { slope: +w[2 * NP].toFixed(2) };
  }
  Object.assign(res[name], { tries: n, logLoss: +(ll / n).toFixed(3), first: { n: n1, won: w1, predicted: +p1.toFixed(1), logLoss: +(ll1 / n1).toFixed(3) } });
  console.log(`${name.padEnd(16)} all ${res[name].logLoss} | first ${w1}/${n1} predicted ${p1.toFixed(1)} ll ${res[name].first.logLoss} | family slope now ${res[name].slope}`);
}
const tot = Object.values(res).reduce((a, r) => [a[0] + r.logLoss * r.tries, a[1] + r.tries], [0, 0]);
const f1 = cal.filter(c => c[2]), Pp = f1.filter(c => c[1]), Nn = f1.filter(c => !c[1]); let s = 0; for (const a of Pp) for (const b of Nn) s += a[0] > b[0] ? 1 : a[0] === b[0] ? 0.5 : 0;
const bands = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]].map(([a, b]) => { const x = cal.filter(([q]) => q >= a && q < b); return x.length ? `${(a * 100).toFixed(0)}-${Math.min(100, b * 100).toFixed(0)}%: ${x.length}, said ${(x.reduce((u, [q]) => u + q, 0) / x.length * 100).toFixed(0)} real ${(x.reduce((u, [, y]) => u + y, 0) / x.length * 100).toFixed(0)}` : ''; }).filter(Boolean);
console.log(`pooled: log-loss ${(tot[0] / tot[1]).toFixed(3)} over ${tot[1]} tries | first tries AUC ${(s / Pp.length / Nn.length).toFixed(2)} | ${bands.join(' | ')}`);
console.log(`tries on a board others played before: ${BE.n}; log-loss without board effect ${(BE.without / Math.max(1, BE.n)).toFixed(3)}, with ${(BE.with / Math.max(1, BE.n)).toFixed(3)} (prior sd ${TAU})`);
if (process.env.SAVE) fs.writeFileSync(path.join(__dirname, 'mbot', 'recal2.json'), JSON.stringify({ HALF, PULL, B0, CAPQ, KEY, SECOND, res }, null, 1));
