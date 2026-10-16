/* Predictions for the levels ahead (version 1.55 boards) by each person's move-based test player:
   their habits now (kinds.js), care level 2, memory of lost tries 75/50/75%, then corrected by how
   they have been doing lately (the same correction as mbot_recal.js, fitted on all their tries with
   the chances in mbot/chains-<name>.json).
     node predict_mbot.js <name> <from level> [count=60] [runs=60] [aspect for classic levels]
   -> mbot/predict-<name>.json  { levels: { lv: [first, within 2, within 4] (%) }, fit } */
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const L = require(path.join(__dirname, '..', '..', '..', 'www', 'layouts.js'));
const { kindsAt, lastRecording } = require('./kinds.js');
const { classic } = require('./pdata.js');
const [name, fromS, countS = '60', runsS = '60', aspS] = process.argv.slice(2);
const from = +fromS, count = +countS, runs = +runsS;
const CARE = 2, MEM = [0.75, 0.5, 0.75], HALF = 12, PULL = 1, B0 = 0.3, CAPQ = 0.05, KEY = '2|high';
// the live boards: designed levels (70+), the ready-made 51 and 53-69, otherwise classic for their screen
const ctx = { console, Layouts: L }; vm.createContext(ctx);
for (const [f, v] of [['hard-1.55.js', 'Hard'], ['levels-1.55.js', 'HARD_LEVELS'], ['early-1.55.js', 'EARLY_LEVELS']]) vm.runInContext(fs.readFileSync(path.join(__dirname, 'tables', f), 'utf8').replace("typeof module !== 'undefined'", 'false') + `;this.${v} = ${v};`, ctx);
const rulesOf = (tiles, ob) => ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length) ? { iceNb: L.iceNeighbors(tiles), ice: { ...(ob.ice || {}) }, locks: (ob.keys || []).length ? new Set(ob.locks) : null, keys: ob.keys || [] } : null;
function board(lv, aspect = +aspS) {
  const H = ctx.Hard;
  const d = H.applies(lv, '') ? H.get(lv) : H.appliesEarly(lv, '') ? H.earlySpec(lv).made : null;
  if (!d) return { ...classic(lv, aspect), src: 'classic ' + aspect };
  const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), n = tiles.length, down = new Uint8Array(n); d.down.forEach(i => down[i] = 1);
  return { tiles, nb: L.neighbors(tiles), faces: d.faces.map(f => f === 63 ? 101 : f), down, rules: rulesOf(tiles, d.obst), clock: d.clock || null, src: lv >= 70 ? 'designed' : 'ready-made' };
}
// the correction: a, b, c on all their tries so far (recent weighted)
const clamp = (p, e = 0.02) => Math.min(1 - e, Math.max(e, p));
const logit = p => Math.log(clamp(p, CAPQ) / (1 - clamp(p, CAPQ))), sig = z => 1 / (1 + Math.exp(-z));
const chance = (ch, at) => { for (let t = Math.min(at, 4) - 1; t >= 0; t--) if (ch.cond[t] !== null) return ch.cond[t]; return ch.within[0]; };
function fit(rows, prior) {
  let w = prior.slice();
  for (let it = 0; it < 40; it++) {
    const g = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const r of rows) { const x = [1, r.z, r.re], p = sig(x[0] * w[0] + x[1] * w[1] + x[2] * w[2]); for (let i = 0; i < 3; i++) { g[i] += r.w * (r.y - p) * x[i]; for (let j = 0; j < 3; j++) H[i][j] -= r.w * p * (1 - p) * x[i] * x[j]; } }
    for (let i = 0; i < 3; i++) { g[i] -= PULL * (w[i] - prior[i]); H[i][i] -= PULL; }
    const A = H.map((row, i) => [...row, g[i]]);
    for (let i = 0; i < 3; i++) { let m = i; for (let k = i + 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k; [A[i], A[m]] = [A[m], A[i]]; for (let k = 0; k < 3; k++) if (k !== i) { const f = A[k][i] / A[i][i]; for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j]; } }
    const d = A.map((row, i) => row[3] / row[i]); w = w.map((v, i) => v - d[i]);
    if (Math.max(...d.map(Math.abs)) < 1e-7) break;
  }
  return w;
}
if (require.main !== module) { module.exports = { board }; return; }
const C = JSON.parse(fs.readFileSync(path.join(__dirname, 'mbot', `chains-${name.replace(/[^A-Za-z]/g, '')}.json`), 'utf8'));
const past = []; C.levels.forEach(l => l.tries.forEach(x => past.push({ x, l })));
past.sort((a, b) => a.x.t - b.x.t);
const N = past.length;
const rows = past.map((r, j) => ({ w: 0.5 ** ((N - 1 - j) / HALF), y: r.x.won ? 1 : 0, z: logit(chance(r.l.chains[KEY], r.x.at)), re: r.x.at > 1 ? 1 : 0 }));
const [a, b, c] = fit(rows, [0, B0, 0]);
// their test player now
const now = Date.now(), kinds = kindsAt(name, now);
const bot = { ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp: CARE })), allMoves: true, flips: true, kinds, peek: 0, end: 12, plan: 10, memory: MEM };
const out = { name, made: new Date().toISOString().slice(0, 10), from, model: { care: CARE, memory: MEM, correction: { a: +a.toFixed(3), b: +b.toFixed(3), retry: +c.toFixed(3), halfLifeTries: HALF }, habitsFrom: new Date(lastRecording(name)).toISOString(), runs }, fit: { tries: N, firstTries: past.filter(r => r.x.at === 1).length, retries: past.filter(r => r.x.at > 1).length, levels: [Math.min(...C.levels.map(l => l.lv)), Math.max(...C.levels.map(l => l.lv))] }, levels: {}, raw: {}, src: {} };
for (let lv = from; lv < from + count; lv++) {
  const g = board(lv), ch = Hard.rateChain(g, runs, 11, bot, MEM, 4);
  const p = [1, 2, 3, 4].map(t => sig(a + b * logit(chance(ch, t)) + c * (t > 1 ? 1 : 0)));
  let lose = 1; const within = p.map(q => { lose *= 1 - q; return 1 - lose; });
  out.levels[lv] = [Math.round(within[0] * 100), Math.round(within[1] * 100), Math.round(within[3] * 100)];
  out.raw[lv] = ch.within.map(v => +v.toFixed(2)); out.src[lv] = g.src;
  process.stderr.write(`${lv} `);
}
fs.writeFileSync(path.join(__dirname, 'mbot', `predict-${name.replace(/[^A-Za-z]/g, '')}.json`), JSON.stringify(out, null, 1));
console.log(`\n${name}: correction a ${a.toFixed(2)} b ${b.toFixed(2)} retry ${c.toFixed(2)}; next 10: ` + Object.entries(out.levels).slice(0, 10).map(([lv, v]) => `${lv}:${v.join('/')}`).join(' '));
