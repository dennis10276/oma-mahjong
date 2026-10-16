/* Final predictions for the dashboard from the move-based test players' chances (mbot/predict-<name>.json,
   raw) and everyone's tries so far (mbot/chains-<name>.json):
     logit P = a_person + c_person*[retry] + b * logit(test player's chance) + e_board
   a, c per person (recent tries weighted, half-life HALF), b shared by the family (mbot_recal2.js),
   e_board: how the family did on that exact board so far against their own prediction (boards are the
   same for everyone from version 1.55), strongly pulled towards 0 (prior sd TAU in log-odds).
     node finalize_predict.js -> mbot/final-<name>.json */
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { triesOf } = require('./pdata.js');
const HALF = 20, PULL = 1, B0 = 0.5, CAPQ = 0.05, KEY = '2|high', TAU = 1;
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'], NP = NAMES.length, K = 2 * NP + 1;
const file = (n, p) => path.join(__dirname, 'mbot', `${p}-${n.replace(/[^A-Za-z]/g, '')}.json`);
const clamp = (p, e = 0.02) => Math.min(1 - e, Math.max(e, p));
const logit = p => Math.log(clamp(p, CAPQ) / (1 - clamp(p, CAPQ))), sig = z => 1 / (1 + Math.exp(-z));
const chance = (ch, at) => { for (let t = Math.min(at, 4) - 1; t >= 0; t--) if (ch.cond[t] !== null) return ch.cond[t]; return ch.within[0]; };
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let m = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[m][i])) m = k; [M[i], M[m]] = [M[m], M[i]]; for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; } } return M.map((r, i) => r[n] / r[i]); }
function fit(rows, prior, pull) {
  let w = prior.slice();
  for (let it = 0; it < 50; it++) {
    const g = new Array(K).fill(0), H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const r of rows) { let z = 0; for (let i = 0; i < K; i++) z += r.x[i] * w[i]; const p = sig(z); for (let i = 0; i < K; i++) { if (!r.x[i]) continue; g[i] += r.w * (r.y - p) * r.x[i]; for (let j = 0; j < K; j++) if (r.x[j]) H[i][j] -= r.w * p * (1 - p) * r.x[i] * r.x[j]; } }
    for (let i = 0; i < K; i++) { g[i] -= pull[i] * (w[i] - prior[i]); H[i][i] -= pull[i]; }
    const d = solve(H, g); w = w.map((v, i) => v - d[i]); if (Math.max(...d.map(Math.abs)) < 1e-8) break;
  }
  return w;
}
const sigOf = g => crypto.createHash('sha1').update(JSON.stringify([g.tiles.map(t => [t.x, t.y, t.z]), Array.from(g.faces), Array.from(g.down)])).digest('hex').slice(0, 16);
// everyone's tries, with the board each was played on
const ALL = [];
NAMES.forEach((name, pi) => {
  const C = JSON.parse(fs.readFileSync(file(name, 'chains'), 'utf8')), G = new Map(); for (const x of triesOf(name)) if (!G.has(x.lv)) G.set(x.lv, sigOf(x.g));
  C.levels.forEach(l => l.tries.forEach(x => ALL.push({ name, pi, l, x, board: G.get(l.lv) })));
});
const design = (pi, at, q) => { const v = new Array(K).fill(0); v[pi] = 1; if (at > 1) v[NP + pi] = 1; v[2 * NP] = logit(q); return v; };
// recent tries weighted per person
const cnt = {}; const rows = [];
for (const r of [...ALL].sort((a, b) => b.x.t - a.x.t)) { cnt[r.name] = (cnt[r.name] || 0) + 1; rows.push({ x: design(r.pi, r.x.at, chance(r.l.chains[KEY], r.x.at)), y: r.x.won ? 1 : 0, w: 0.5 ** ((cnt[r.name] - 1) / HALF) }); }
const w = fit(rows, [...new Array(2 * NP).fill(0), B0], new Array(K).fill(PULL));
console.log('family slope b', w[2 * NP].toFixed(2), '| a', NAMES.map((n, i) => n.slice(0, 5) + ' ' + w[i].toFixed(2)).join(', '), '| retry c', NAMES.map((n, i) => n.slice(0, 5) + ' ' + w[NP + i].toFixed(2)).join(', '));
// board effects from everyone's tries on that exact board (against their own prediction)
const eff = {};
for (const r of ALL) { if (!r.board) continue; const p = sig(design(r.pi, r.x.at, chance(r.l.chains[KEY], r.x.at)).reduce((s, v, i) => s + v * w[i], 0)); const e = eff[r.board] || (eff[r.board] = { res: 0, info: 0, n: 0, who: {} }); e.res += (r.x.won ? 1 : 0) - p; e.info += p * (1 - p); e.n++; e.who[r.name] = (e.who[r.name] || 0) + 1; }
const effOf = b => { const e = eff[b]; return e ? { e: e.res / (e.info + 1 / TAU ** 2), n: e.n, who: e.who } : null; };
const { board } = require('./predict_mbot.js');
const ASPECT = { PUK: 1.1 };
for (const name of NAMES) {
  const P = JSON.parse(fs.readFileSync(file(name, 'predict'), 'utf8')), pi = NAMES.indexOf(name), out = { ...P, levels: {}, boardEffects: {} };
  for (const [lv, within] of Object.entries(P.raw)) {
    const g = board(+lv, ASPECT[name] || 1.6), be = effOf(sigOf(g)), mine = be && be.who[name];
    const e = be && !mine ? be.e : 0;            // (their own earlier tries on it are in their own a and c already)
    if (be && !mine) out.boardEffects[lv] = { e: +e.toFixed(2), tries: be.n, by: Object.keys(be.who) };
    const cond = [within[0], ...[1, 2, 3].map(t => within[t - 1] < 1 ? (within[t] - within[t - 1]) / (1 - within[t - 1]) : within[t])];
    const p = [1, 2, 3, 4].map(t => sig(w[pi] + (t > 1 ? w[NP + pi] : 0) + w[2 * NP] * logit(cond[t - 1]) + e));
    let lose = 1; const wt = p.map(q => { lose *= 1 - q; return 1 - lose; });
    out.levels[lv] = [Math.round(wt[0] * 100), Math.round(wt[1] * 100), Math.round(wt[3] * 100)];
  }
  out.model.correction = { a: +w[pi].toFixed(3), retry: +w[NP + pi].toFixed(3), familySlope: +w[2 * NP].toFixed(3), halfLifeTries: HALF, boardPriorSd: TAU };
  fs.writeFileSync(file(name, 'final'), JSON.stringify(out, null, 1));
  console.log(`${name}: ` + Object.entries(out.levels).slice(0, 12).map(([lv, v]) => `${lv}:${v.join('/')}`).join(' ') + (Object.keys(out.boardEffects).length ? ` | board effects ${JSON.stringify(out.boardEffects)}` : ''));
}
