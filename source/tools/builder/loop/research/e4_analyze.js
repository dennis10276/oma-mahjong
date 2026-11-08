'use strict';
// E4 step 2: ruler validity vs real Y. Reads e4-live-ratings.jsonl + e2-real-data.json; writes e4-anchor-validity.json and
// library/calibration.json. No bot runs. Deterministic (seeded bootstrap).
const fs = require('fs'), path = require('path');
const A = path.resolve(__dirname, '../../../../analysis/builder');
const P = path.join(A, 'process-v1');
const rows = fs.readFileSync(path.join(P, 'e4-live-ratings.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const e2 = JSON.parse(fs.readFileSync(path.join(P, 'e2-real-data.json'), 'utf8'));
const get = w => Object.fromEntries(rows.filter(r => r.what === w).map(r => [r.lv, r]));
const F = get('family'), R = get('reference'), PL = get('planner');
const Y = Object.fromEntries(Object.entries(e2.yardstick).map(([k, v]) => [+k, v]));
let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, i = Math.floor(p); return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); };
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); x += (a[i] - ma) ** 2; y += (b[i] - mb) ** 2; } return x && y ? s / Math.sqrt(x * y) : null; };
const spearman = (a, b) => a.length < 3 ? null : pearson(rank(a), rank(b));
const auc = (score, label) => { let w = 0, n = 0; for (let i = 0; i < score.length; i++) for (let j = 0; j < score.length; j++) if (label[i] && !label[j]) { n++; w += score[i] > score[j] ? 1 : score[i] === score[j] ? 0.5 : 0; } return n ? w / n : null; };
// isotonic regression (pool adjacent violators); predict(x) interpolates between block centres
function isotonic(xs, ys) {
  const o = xs.map((x, i) => [x, ys[i]]).sort((a, b) => a[0] - b[0]);
  const bl = [];
  for (const [x, y] of o) {
    bl.push({ s: y, n: 1, x0: x, x1: x });
    while (bl.length > 1 && bl.at(-2).s / bl.at(-2).n >= bl.at(-1).s / bl.at(-1).n) { const b = bl.pop(), a = bl.pop(); bl.push({ s: a.s + b.s, n: a.n + b.n, x0: a.x0, x1: b.x1 }); }
  }
  const pts = bl.map(b => ({ x: (b.x0 + b.x1) / 2, y: b.s / b.n }));
  return x => {
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts.at(-1).x) return pts.at(-1).y;
    let i = 0; while (pts[i + 1].x < x) i++;
    const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x || 1);
    return pts[i].y + t * (pts[i + 1].y - pts[i].y);
  };
}
const levelsY = Object.keys(Y).map(Number).filter(l => F[l] && R[l]).sort((a, b) => a - b);
const lab = l => Y[l].Y >= 6;
const out = { about: 'E4: anchor and ruler validity (loop/research/e4_analyze.js)', made: new Date().toISOString(),
  inputs: { ratings: 'e4-live-ratings.jsonl', realY: 'e2-real-data.json (yardstick)', ruler: Object.values(F)[0]?.fp, reference: Object.values(R)[0]?.fp },
  nLevelsY: levelsY.length, nCensoredY: levelsY.filter(l => Y[l].censored).length, nSpike: levelsY.filter(lab).length };
const bots = { ruler: l => F[l].D, reference: l => R[l].D };
out.spikeAUC = {};
for (const [name, f] of Object.entries(bots)) {
  const sc = levelsY.map(f), lb = levelsY.map(lab), a = auc(sc, lb), bs = [];
  for (let b = 0; b < 2000; b++) { const ix = levelsY.map(() => Math.floor(rnd() * levelsY.length)); const v = auc(ix.map(i => sc[i]), ix.map(i => lb[i])); if (v != null) bs.push(v); }
  out.spikeAUC[name] = { auc: a, ci90: [quantile(bs, .05), quantile(bs, .95)], n: levelsY.length, spikes: lb.filter(Boolean).length };
}
{ const lv = levelsY.filter(l => PL[l]?.S != null); if (lv.length > 3) out.spikeAUC.plannerOnYlevels = { n: lv.length, note: 'planner rated only on 175-199 + 91/132/150', auc: auc(lv.map(l => PL[l].S), lv.map(lab)) }; }
out.levelSpearman = Object.fromEntries(Object.entries(bots).map(([k, f]) => [k, spearman(levelsY.map(f), levelsY.map(l => Y[l].Y))]));
function windows(size) {
  const w = {}; for (const l of levelsY) { const k = Math.floor((l - 85) / size); (w[k] ||= []).push(l); }
  return Object.values(w).filter(a => a.length >= 3);
}
out.windows = {};
for (const size of [5, 10]) {
  const W = windows(size), yw = W.map(a => mean(a.map(l => Y[l].Y)));
  const res = { n: W.length };
  for (const [name, f] of Object.entries(bots)) {
    const dw = W.map(a => mean(a.map(f)));
    const errM = [], errC = [];
    W.forEach((a, i) => {
      const train = W.filter((_, j) => j !== i).flat(), M = isotonic(train.map(f), train.map(l => Y[l].Y));
      errM.push(Math.abs(mean(a.map(l => M(f(l)))) - yw[i]));
      errC.push(Math.abs(median(train.map(l => Y[l].Y)) - yw[i]));
    });
    const bs = []; for (let b = 0; b < 2000; b++) { const ix = W.map(() => Math.floor(rnd() * W.length)); bs.push(mean(ix.map(i => errC[i] - errM[i]))); }
    res[name] = { spearman: spearman(dw, yw), maeModel: mean(errM), maeMedianBaseline: mean(errC), gain: mean(errC) - mean(errM), gainCi90: [quantile(bs, .05), quantile(bs, .95)], modelBeatsBaseline: mean(errM) < mean(errC) };
  }
  out.windows[size] = res;
}
out.M = {};
const grid = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14];
for (const [name, f] of Object.entries(bots)) {
  const xs = levelsY.map(f), ys = levelsY.map(l => Y[l].Y), M = isotonic(xs, ys), band = grid.map(() => []);
  for (let b = 0; b < 1000; b++) { const ix = levelsY.map(() => Math.floor(rnd() * levelsY.length)), Mb = isotonic(ix.map(i => xs[i]), ix.map(i => ys[i])); grid.forEach((g, k) => band[k].push(Mb(g))); }
  const q10 = quantile(xs, .1), q90 = quantile(xs, .9);
  out.M[name] = { fitRange: [Math.min(...xs), Math.max(...xs)], quantilesOfD: [q10, quantile(xs, .5), q90],
    points: grid.map((g, k) => ({ D: g, Y: M(g), lo5: quantile(band[k], .05), hi95: quantile(band[k], .95), extrapolated: g > q90 || g < q10 })),
    note: 'Y capped at 20; censored levels count at their lower bound. Points flagged extrapolated lie outside the 10-90% range of live D; the map is flat beyond the largest fitted D.' };
}
const rng = (a, b) => Object.keys(F).map(Number).filter(l => l >= a && l <= b);
const d19 = rng(190, 199).map(l => F[l].D), uq = quantile(d19, .75);
const rd = l => F[l]?.D;
out.anchor = { D190_199: rng(190, 199).map(l => [l, +F[l].D.toFixed(2)]), upperQuartile: uq, median: median(d19),
  ruler132: rd(132), ruler150: rd(150), ruler91: rd(91), proposalUncapped: 1.15 * uq, cap: Math.min(rd(132) ?? Infinity, rd(150) ?? Infinity) };
out.anchor.T200 = Math.min(out.anchor.proposalUncapped, out.anchor.cap);
out.anchor.capBinds = out.anchor.proposalUncapped > out.anchor.cap;
const win = (a, b, f) => { const l = rng(a, b); return l.length ? { n: l.length, mean: mean(l.map(f)), median: median(l.map(f)) } : null; };
out.liveWindows = ['85-94', '95-104', '105-114', '115-124', '125-134', '135-144', '145-154', '155-164', '165-174', '175-184', '185-194', '195-199'].map(s => { const [a, b] = s.split('-').map(Number); return { window: s, ruler: win(a, b, l => F[l].D), reference: win(a, b, l => R[l].D) }; });
out.ratioToReference = { medianRulerOverRef: median(rng(85, 199).filter(l => R[l]).map(l => F[l].D / R[l].D)) };
if (Object.keys(PL).length) out.planner = { n: Object.keys(PL).length, levels: Object.values(PL).map(p => [p.lv, p.S, p.valid]), medianS190_199: median(rng(190, 199).filter(l => PL[l]?.S != null).map(l => PL[l].S)) };
const k = out.spikeAUC.ruler.auc, w5 = out.windows[5].ruler, w10 = out.windows[10].ruler;
out.kill = { rule: 'spike AUC < 0.65 AND window error no better than the constant baseline -> ruler cannot anchor a curve', rulerAuc: k, aucBelow065: k < 0.65, window5BeatsConstant: w5.modelBeatsBaseline, window10BeatsConstant: w10.modelBeatsBaseline };
out.kill.killed = out.kill.aucBelow065 && !w5.modelBeatsBaseline && !w10.modelBeatsBaseline;
fs.writeFileSync(path.join(P, 'e4-anchor-validity.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(A, 'library/calibration.json'), JSON.stringify({ schema: 'calibration-v1', made: out.made, source: 'process-v1/e4-anchor-validity.json (E4)', ruler: out.inputs.ruler, anchor: out.anchor, M: out.M, spikeAUC: out.spikeAUC, windows: out.windows, kill: out.kill, status: 'proposal for Dennis; M refitted after every played window' }, null, 1));
console.log(JSON.stringify({ n: out.nLevelsY, spikes: out.nSpike, auc: out.spikeAUC, spear: out.levelSpearman, w5: out.windows[5], w10: out.windows[10], anchor: out.anchor, kill: out.kill }, null, 1));
