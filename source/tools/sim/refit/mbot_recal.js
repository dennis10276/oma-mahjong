/* Rolling test: the move-based test player's chance for the board, corrected by how the person has
   been doing lately. Every level is predicted with only what came before it:
     logit P(win) = a + c*[retry] + b * logit(test player's chance for this try)
   a, b, c fitted on all earlier tries, recent tries weighted (half-life in tries), with a pull towards
   a = 0, b = 1, c = 0 (trust the test player when there is little data).
   Predictors compared (all corrected the same way, and the plain own-rate baseline):
     node mbot_recal.js [half-life tries=12] [pull=2] [warm-up levels=6] -> mbot/recal.json */
'use strict';
const path = require('path'), fs = require('fs');
const HALF = +(process.argv[2] || 12), PULL = +(process.argv[3] || 2), WARM = +(process.argv[4] || 6), B0 = +(process.argv[5] || 0.3), CAPQ = +(process.argv[6] || 0.05);
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'];
const clamp = (p, e = 0.02) => Math.min(1 - e, Math.max(e, p));
const logit = p => Math.log(clamp(p, CAPQ) / (1 - clamp(p, CAPQ))), sig = z => 1 / (1 + Math.exp(-z));
const chance = (ch, at) => { for (let t = Math.min(at, 4) - 1; t >= 0; t--) if (ch.cond[t] !== null) return ch.cond[t]; return ch.within[0]; };
// weighted logistic fit with a ridge pull to (a0, b0, c0), Newton steps
function fit(rows, prior) {
  let w = prior.slice();
  for (let it = 0; it < 30; it++) {
    const g = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const r of rows) { const x = [1, r.z, r.re], p = sig(x[0] * w[0] + x[1] * w[1] + x[2] * w[2]); for (let i = 0; i < 3; i++) { g[i] += r.w * (r.y - p) * x[i]; for (let j = 0; j < 3; j++) H[i][j] -= r.w * p * (1 - p) * x[i] * x[j]; } }
    for (let i = 0; i < 3; i++) { g[i] -= PULL * (w[i] - prior[i]); H[i][i] -= PULL; }
    // solve H d = g (3x3)
    const A = H.map((row, i) => [...row, g[i]]);
    for (let i = 0; i < 3; i++) { let m = i; for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k; [A[i], A[m]] = [A[m], A[i]]; for (let k = 0; k < 3; k++) if (k !== i) { const f = A[k][i] / A[i][i]; for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j]; } }
    const d = A.map((row, i) => row[3] / row[i]);
    w = w.map((v, i) => v - d[i]);
    if (Math.max(...d.map(Math.abs)) < 1e-6) break;
  }
  return w;
}
const report = {}, pool = {};
const PRED = (process.env.PRED || '2|high,3|half,dash').split(',');
for (const name of NAMES) {
  const f = path.join(__dirname, 'mbot', `chains-${name.replace(/[^A-Za-z]/g, '')}.json`);
  if (!fs.existsSync(f)) continue;
  const C = JSON.parse(fs.readFileSync(f, 'utf8')), L = C.levels;

  const res = { levels: L.length };
  for (const k of [...PRED, ...PRED.filter(q => !q.startsWith('auto:')).map(q => 'raw:' + q), 'own']) {
    let ll = 0, n = 0, ll1 = 0, n1 = 0, p1 = 0, w1 = 0; const cal = [];
    for (let i = WARM; i < L.length; i++) {
      const past = []; L.slice(0, i).forEach(l => l.tries.forEach(x => past.push({ x, l })));
      past.sort((u, v) => u.x.t - v.x.t);
      const N = past.length;
      let pred;
      if (k.startsWith('auto:')) {
        const care = k.slice(5); let best = null;
        for (const mk of ['none', 'low', 'half', 'high', 'full']) {
          const kk = care + '|' + mk;
          const rows = past.map((r, j) => ({ w: 0.5 ** ((N - 1 - j) / HALF), y: r.x.won ? 1 : 0, z: logit(chance(r.l.chains[kk], r.x.at)), re: r.x.at > 1 ? 1 : 0 }));
          const w = fit(rows, [0, B0, 0]);
          let v = 0; for (const r of rows) { const q = clamp(sig(w[0] + w[1] * r.z + w[2] * r.re), 0.03); v += r.w * Math.log(r.y ? q : 1 - q); }
          v -= 0.5 * PULL * ((w[0]) ** 2 + (w[1] - B0) ** 2 + w[2] ** 2);
          if (!best || v > best.v) best = { v, w, kk };
        }
        res.picked = res.picked || {}; res.picked[k] = best.kk;
        pred = x => sig(best.w[0] + best.w[1] * logit(chance(L[i].chains[best.kk], x.at)) + best.w[2] * (x.at > 1 ? 1 : 0));
      } else if (k.startsWith('raw:')) { const kk = k.slice(4); pred = x => chance(L[i].chains[kk], x.at); }
      else if (k === 'own') {
        const rw = j => 0.5 ** ((N - 1 - j) / HALF);
        const s1 = past.reduce((a, r, j) => a + (r.x.at === 1 ? rw(j) * r.x.won : 0), 0), n1_ = past.reduce((a, r, j) => a + (r.x.at === 1 ? rw(j) : 0), 0);
        const s2 = past.reduce((a, r, j) => a + (r.x.at > 1 ? rw(j) * r.x.won : 0), 0), n2_ = past.reduce((a, r, j) => a + (r.x.at > 1 ? rw(j) : 0), 0);
        pred = x => x.at === 1 ? (s1 + 1) / (n1_ + 2) : (s2 + 1) / (n2_ + 2);
      } else {
        const rows = past.map((r, j) => ({ w: 0.5 ** ((N - 1 - j) / HALF), y: r.x.won ? 1 : 0, z: logit(chance(r.l.chains[k], r.x.at)), re: r.x.at > 1 ? 1 : 0 }));
        const w = fit(rows, [0, B0, 0]);
        pred = x => sig(w[0] + w[1] * logit(chance(L[i].chains[k], x.at)) + w[2] * (x.at > 1 ? 1 : 0));
      }
      for (const x of L[i].tries) { const q = clamp(pred(x), 0.03); ll -= Math.log(x.won ? q : 1 - q); n++; (res.calAll = res.calAll || {})[k] = res.calAll[k] || []; res.calAll[k].push([q, x.won ? 1 : 0]); if (x.at === 1) { ll1 -= Math.log(x.won ? q : 1 - q); n1++; p1 += q; w1 += x.won; cal.push([q, x.won ? 1 : 0]); } }
    }
    res[k] = { tries: n, logLoss: +(ll / n).toFixed(3), firstTries: { n: n1, won: w1, predicted: +p1.toFixed(1), logLoss: +(ll1 / n1).toFixed(3) } };
    const P = pool[k] || (pool[k] = { ll: 0, n: 0, ll1: 0, n1: 0, cal: [] }); P.ll += ll; P.n += n; P.ll1 += ll1; P.n1 += n1; P.cal.push(...cal);
  }
  report[name] = res;
  console.log(`${name} (${L.length - WARM} levels predicted, ${res.own.tries} tries)`);
  if (res.picked) console.log('  memory now:', JSON.stringify(res.picked));
  for (const k of [...PRED, ...PRED.filter(q => !q.startsWith('auto:')).map(q => 'raw:' + q), 'own']) console.log(`  ${(k === 'own' ? 'own recent win share' : (k.startsWith('raw:') ? 'raw ' : 'corrected ') + k.replace('raw:', '').replace('dash', 'dashboard bot')).padEnd(26)} all tries ${res[k].logLoss} | first tries ${res[k].firstTries.won}/${res[k].firstTries.n}, predicted ${res[k].firstTries.predicted}, ${res[k].firstTries.logLoss}`);
}
console.log('pooled (all players)');
for (const k of PRED) {
  const cal = Object.values(report).flatMap(r => (r.calAll || {})[k] || []);
  const bands = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]].map(([a, b]) => { const s = cal.filter(([q]) => q >= a && q < b); return s.length ? `${a.toFixed(1)}-${Math.min(1, b).toFixed(1)}: ${s.length} tries, said ${(s.reduce((x, [q]) => x + q, 0) / s.length * 100).toFixed(0)}%, real ${(s.reduce((x, [, w]) => x + w, 0) / s.length * 100).toFixed(0)}%` : ''; }).filter(Boolean);
  console.log(`  calibration ${k}: ` + bands.join(' | '));
}
for (const [k, P] of Object.entries(pool)) {
  const auc = (() => { const Pp = P.cal.filter(c => c[1]), Nn = P.cal.filter(c => !c[1]); let s = 0; for (const a of Pp) for (const b of Nn) s += a[0] > b[0] ? 1 : a[0] === b[0] ? 0.5 : 0; return (s / Pp.length / Nn.length).toFixed(2); })();
  console.log(`  ${(k === 'own' ? 'own recent win share' : (k.startsWith('raw:') ? 'raw ' : 'corrected ') + k.replace('raw:', '').replace('dash', 'dashboard bot')).padEnd(26)} all tries ${(P.ll / P.n).toFixed(3)} (${P.n}) | first tries ${(P.ll1 / P.n1).toFixed(3)} (${P.n1}), AUC ${auc}`);
}
if (!process.env.QUIET) fs.writeFileSync(path.join(__dirname, 'mbot', 'recal.json'), JSON.stringify({ HALF, PULL, WARM, B0, CAPQ, report }, null, 1));
