'use strict';
// Normal-player ledger and difficulty curve N(level) (Gerda, Mrs. Doubtfire, D4V3, Loulou), compared with the bot ruler D.
// Reads GET-only pulls in source/build/real-v2/v3/<pid>.json (see normal_pull.js) and ratings; writes
// source/analysis/builder/process-v2/normal-players.json. Light CPU. node normal_players.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const B = path.join(ROOT, 'source/build/real-v2');
const RL = require('../real_ledger.js');
const NORMAL = ['Gerda', 'MrsD', 'D4V3', 'Loulou'];
const NAMEMAP = { 'Gerda': 'Gerda', 'Mrs. Doubtfire': 'MrsD', 'D4V3': 'D4V3', 'Loulou': 'Loulou', 'Dennisisdebeste': 'Dennis' };
const CAP = 20, FROM = 70, TO = 269;

// ---- export + player table (names compared case-insensitively)
const NM = Object.fromEntries(Object.entries(NAMEMAP).map(([k, v]) => [k.toLowerCase(), v]));
const exp = {}, players = {}, PL = {};
for (const f of fs.readdirSync(path.join(B, 'v3'))) {
  const pid = f.replace('.json', ''), node = JSON.parse(fs.readFileSync(path.join(B, 'v3', f), 'utf8')) || {};
  const ev = Object.values(node); const nm = (ev.find(e => e.name) || {}).name || '?';
  const who = NM[nm.toLowerCase()] || nm;
  if (nm === 'DennisTEST' || nm === 'Dennis' || nm === 'OmaHanny') { players[pid] = { name: nm, who, skipped: nm === 'OmaHanny' ? 'own care track' : 'test account' }; continue; }
  const pl = ev.filter(e => (e.k === 'start' || e.k === 'end') && e.m !== 'd' && Number.isInteger(e.lv));
  const lvs = new Set(pl.map(e => e.lv));
  const wins = pl.filter(e => e.k === 'end' && e.r === 'win');
  players[pid] = { name: nm, who, furthestStarted: Math.max(0, ...lvs), furthestWon: Math.max(0, ...wins.map(e => e.lv)), levelsPlayed: lvs.size, levelsWon: new Set(wins.map(e => e.lv)).size,
    first: new Date(Math.min(...ev.map(e => e.t))).toISOString().slice(0, 10), last: new Date(Math.max(...ev.map(e => e.t))).toISOString().slice(0, 10), records: ev.length };
  // boards 75-105 are the 1.52 boards: below 85 count only app >= 1.52 (above 85 as in real_ledger.js)
  for (const e of pl) if (e.lv < 85 && RL.verNum(e.v) < RL.verNum('1.52')) e.v = '1.0';
  exp[pid] = node; PL[pid] = { who, weight: 1, family: true };
}
const L = RL.ledger(exp, { from: FROM, to: TO, players: PL });
const seq = L.sequences;
const val = s => Math.min(CAP, s.won ? s.tries : s.tries + 1);   // censored: lower bound = tries so far + 1

const byLv = {};
for (const s of seq) if (NORMAL.includes(s.who)) (byLv[s.lv] = byLv[s.lv] || {})[s.who] = s;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

// ---- multiplicative player effect: log v = a_level + b_player, levels with >=2 players, alternating LS
const lv2 = Object.keys(byLv).map(Number).filter(l => Object.keys(byLv[l]).length >= 2);
function fitEffects(levels) {
  const a = {}, b = Object.fromEntries(NORMAL.map(p => [p, 0]));
  const present = NORMAL.filter(p => levels.some(l => byLv[l][p]));
  for (let it = 0; it < 200; it++) {
    for (const l of levels) { const ps = Object.keys(byLv[l]); a[l] = mean(ps.map(p => Math.log(val(byLv[l][p])) - b[p])); }
    for (const p of present) { const ls = levels.filter(l => byLv[l][p]); b[p] = mean(ls.map(l => Math.log(val(byLv[l][p])) - a[l])); }
    const m = mean(present.map(p => b[p]));
    for (const p of present) b[p] -= m;
  }
  return { a, b };
}
let seed = 5; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const fit = fitEffects(lv2);
const boot = NORMAL.map(() => []);
for (let i = 0; i < 300; i++) { const lv = [...new Set(lv2.map(() => lv2[Math.floor(rnd() * lv2.length)]))];
  const f = fitEffects(lv); NORMAL.forEach((p, k) => { if (lv.some(l => byLv[l][p])) boot[k].push(Math.exp(f.b[p])); }); }
const effects = {};
NORMAL.forEach((p, k) => { const n = lv2.filter(l => byLv[l][p]).length; const s = boot[k].sort((x, y) => x - y);
  effects[p] = n ? { levelsInFit: n, factor: +Math.exp(fit.b[p]).toFixed(2), lo90: +s[Math.floor(.05 * s.length)].toFixed(2), hi90: +s[Math.floor(.95 * s.length)].toFixed(2) } : { levelsInFit: 0 }; });
const pairwise = [];
for (let i = 0; i < NORMAL.length; i++) for (let j = i + 1; j < NORMAL.length; j++) {
  const ls = Object.keys(byLv).map(Number).filter(l => byLv[l][NORMAL[i]] && byLv[l][NORMAL[j]]);
  if (ls.length) pairwise.push({ a: NORMAL[i], b: NORMAL[j], shared: ls.length, meanA: +mean(ls.map(l => val(byLv[l][NORMAL[i]]))).toFixed(2), meanB: +mean(ls.map(l => val(byLv[l][NORMAL[j]]))).toFixed(2), geoRatioAoverB: +Math.exp(mean(ls.map(l => Math.log(val(byLv[l][NORMAL[i]]) / val(byLv[l][NORMAL[j]]))))).toFixed(2) });
}
const presentP = NORMAL.filter(p => lv2.some(l => byLv[l][p]));
const avgFac = mean(presentP.map(p => Math.exp(fit.b[p])));
const rows = [];
for (let lv = FROM; lv <= TO; lv++) {
  const ps = byLv[lv]; if (!ps) continue;
  const who = Object.keys(ps), v = who.map(p => val(ps[p]));
  const per = Object.fromEntries(who.map(p => [p, ps[p].won ? ps[p].tries : '>=' + (ps[p].tries + 1)]));
  // player-adjusted: geometric mean of tries / player factor, scaled back by the mean factor (players without a fitted effect count as 1)
  const Nadj = Math.exp(mean(who.map((p, i) => Math.log(v[i]) - (fit.b[p] || 0)))) * avgFac;
  rows.push({ lv, nPlayers: who.length, N: +mean(v).toFixed(2), Nuncapped: +mean(who.map(p => ps[p].won ? ps[p].tries : ps[p].tries + 1)).toFixed(2), Nmedian: med(v), Nadj: +Nadj.toFixed(2), anyCensored: who.some(p => !ps[p].won), perPlayer: per });
}
const nCount = { 1: 0, 2: 0, 3: 0, 4: 0 }; rows.forEach(r => nCount[r.nPlayers]++);

// ---- bot D (cap 40): 70-169 ratings40.jsonl, 170-239 ratings.jsonl D40
const D = {}, D20 = {};
for (const l of fs.readFileSync(path.join(B, 'ratings40.jsonl'), 'utf8').trim().split('\n')) { const r = JSON.parse(l); D[r.lv] = r; }
for (const l of fs.readFileSync(path.join(B, 'ratings.jsonl'), 'utf8').trim().split('\n')) { const r = JSON.parse(l); if (r.what === 'D40') D[r.lv] = { lv: r.lv, D40: r.D, perCampaign: r.perCampaign, pHat: r.pHat }; if (r.what === 'D20') D20[r.lv] = r.D; }
for (const r of rows) r.D40 = D[r.lv] ? +D[r.lv].D40.toFixed(2) : null;

// ---- stats helpers
const rank = a => { const idx = a.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
const pear = (a, b) => { const n = a.length, ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
const spear = (a, b) => pear(rank(a), rank(b));
function spB(rs, x, y) { const f = rs.filter(r => r[x] != null && r[y] != null); if (f.length < 5) return { n: f.length }; const rho = spear(f.map(r => r[x]), f.map(r => r[y])); const bs = [];
  for (let i = 0; i < 1000; i++) { const s = f.map(() => f[Math.floor(rnd() * f.length)]); const c = spear(s.map(r => r[x]), s.map(r => r[y])); if (!isNaN(c)) bs.push(c); } bs.sort((p, q) => p - q);
  return { n: f.length, rho: +rho.toFixed(2), lo90: +bs[Math.floor(.05 * bs.length)].toFixed(2), hi90: +bs[Math.floor(.95 * bs.length)].toFixed(2) }; }
function pav(pts) { const s = [...pts].sort((a, b) => a[0] - b[0]); const out = []; for (const p of s) { out.push({ x0: p[0], w: 1, m: p[1] }); while (out.length > 1 && out[out.length - 2].m > out[out.length - 1].m) { const q = out.pop(), o = out.pop(); out.push({ x0: o.x0, w: o.w + q.w, m: (o.m * o.w + q.m * q.w) / (o.w + q.w) }); } } return x => { let r = out[0].m; for (const b of out) if (x >= b.x0) r = b.m; return r; }; }
const lsq = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } const b = sxy / sxx; return { a: my - b * mx, b }; };

const both = rows.filter(r => r.D40 != null);
const two = both.filter(r => r.nPlayers >= 2), D85 = both.filter(r => r.lv >= 85);
const corr = { N_all: spB(both, 'D40', 'N'), Nadj_all: spB(both, 'D40', 'Nadj'), N_2plus: spB(two, 'D40', 'N'), N_lv85plus: spB(D85, 'D40', 'N'), N_lv70_84: spB(both.filter(r => r.lv < 85), 'D40', 'N'), N_lv85_149: spB(both.filter(r => r.lv >= 85 && r.lv < 150), 'D40', 'N'), N_lv150plus: spB(both.filter(r => r.lv >= 150), 'D40', 'N'), N_median: spB(both, 'D40', 'Nmedian') };
const edges = [0, 1.5, 2, 3, 4, 5, 7, 10, 100], bins = [];
for (let i = 0; i + 1 < edges.length; i++) { const rs = both.filter(r => r.D40 >= edges[i] && r.D40 < edges[i + 1]); if (rs.length) bins.push({ D: `${edges[i]}-${edges[i + 1]}`, n: rs.length, meanD: +mean(rs.map(r => r.D40)).toFixed(2), N_mean: +mean(rs.map(r => r.N)).toFixed(2), N_median: +med(rs.map(r => r.N)).toFixed(2), N_p25: pct(rs.map(r => r.N), .25), N_p75: pct(rs.map(r => r.N), .75), Nadj_mean: +mean(rs.map(r => r.Nadj)).toFixed(2), ratioNoverD: +(mean(rs.map(r => r.N)) / mean(rs.map(r => r.D40))).toFixed(2) }); }
const iso = pav(both.map(r => [r.D40, r.N])), isoAdj = pav(both.map(r => [r.D40, r.Nadj]));
const grid = [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
const isoMap = grid.map(g => ({ D: g, N: +iso(g).toFixed(2), Nadj: +isoAdj(g).toFixed(2) }));
const lf = lsq(both.map(r => Math.log(r.D40)), both.map(r => Math.log(r.N))), lfa = lsq(both.map(r => Math.log(r.D40)), both.map(r => Math.log(r.Nadj)));
const resid = both.map(r => Math.log(r.N) - (lf.a + lf.b * Math.log(r.D40)));
const rev = {};
const ratios = both.map(r => r.N / r.D40);
const c_geo = Math.exp(mean(ratios.map(Math.log))), c_ratioOfMeans = mean(both.map(r => r.N)) / mean(both.map(r => r.D40)), c_median = med(ratios);
for (const t of [10, 11, 12, 13]) { let d = null; for (let x = 1; x <= 40; x += .05) if (iso(x) >= t) { d = +x.toFixed(2); break; }
  rev[t] = { isotonic_D_reaches: d, powerlaw_D: +Math.exp((Math.log(t) - lf.a) / lf.b).toFixed(2), linearFactor_D: +(t / c_geo).toFixed(2) }; }
const factor = { c_ratioOfMeans: +c_ratioOfMeans.toFixed(2), c_median: +c_median.toFixed(2), c_geo: +c_geo.toFixed(2), ratioP10: +pct(ratios, .1).toFixed(2), ratioP90: +pct(ratios, .9).toFixed(2), loglogSlope: +lf.b.toFixed(2), loglogIntercept: +lf.a.toFixed(2), loglogSlopeAdj: +lfa.b.toFixed(2), residSD_log: +Math.sqrt(mean(resid.map(x => x * x))).toFixed(2), slopeBoot90: null };
{ const bs = []; for (let i = 0; i < 500; i++) { const s = both.map(() => both[Math.floor(rnd() * both.length)]); bs.push(lsq(s.map(r => Math.log(r.D40)), s.map(r => Math.log(r.N))).b); } bs.sort((a, b) => a - b); factor.slopeBoot90 = [+bs[25].toFixed(2), +bs[475].toFixed(2)]; }
factor.byRange = [[70, 99], [100, 139], [140, 179], [180, 219]].map(([a, b]) => { const rs = both.filter(r => r.lv >= a && r.lv <= b); return rs.length ? { range: `${a}-${b}`, n: rs.length, meanN: +mean(rs.map(r => r.N)).toFixed(2), meanD: +mean(rs.map(r => r.D40)).toFixed(2), ratio: +(mean(rs.map(r => r.N)) / mean(rs.map(r => r.D40))).toFixed(2) } : null; }).filter(Boolean);
// hazard by try index: real (normal players pooled, levels with D) vs bot perCampaign (same levels); tries capped at 12
const haz = (seqs, K) => { const out = []; for (let k = 1; k <= K; k++) { const atRisk = seqs.filter(s => s.length >= k), wins = atRisk.filter(s => s.won && s.length === k).length; out.push({ k, atRisk: atRisk.length, h: atRisk.length ? +(wins / atRisk.length).toFixed(3) : null }); } return out; };
const realS = [], botS = [];
for (const r of both) { for (const p of Object.keys(byLv[r.lv])) { const s = byLv[r.lv][p]; realS.push({ length: Math.min(s.tries, 12), won: s.won && s.tries <= 12 }); } for (const c of D[r.lv].perCampaign) botS.push({ length: Math.min(c, 12), won: c <= 12 }); }
const hazard = { real: haz(realS, 8), bot: haz(botS, 8) };
const ft = both.map(r => ({ lv: r.lv, real: mean(Object.values(byLv[r.lv]).map(s => s.res[0])), bot: D[r.lv].perCampaign.filter(c => c === 1).length / D[r.lv].perCampaign.length }));
hazard.firstTryReal = +mean(ft.map(x => x.real)).toFixed(3); hazard.firstTryBot = +mean(ft.map(x => x.bot)).toFixed(3);
hazard.firstTrySpearman = +spear(ft.map(x => x.real), ft.map(x => x.bot)).toFixed(2);

// ---- hardest and bands
const top15 = [...rows].sort((a, b) => b.N - a.N).slice(0, 15), top15two = [...rows].filter(r => r.nPlayers >= 2).sort((a, b) => b.N - a.N).slice(0, 15);
const topStats = {}; for (const [k, arr] of [['2plus', rows.filter(r => r.nPlayers >= 2)], ['all', rows]]) for (const m of ['N', 'Nadj', 'Nuncapped']) for (const q of [5, 10, 15]) { const t = [...arr].sort((a, b) => b[m] - a[m]).slice(0, q); topStats[`${k}.${m}.top${q}.mean`] = +mean(t.map(r => r[m])).toFixed(2); }
const quant = {}; for (const m of ['N', 'Nadj']) { const a = rows.filter(r => r.nPlayers >= 2).map(r => r[m]); quant[m] = { p50: +pct(a, .5).toFixed(2), p75: +pct(a, .75).toFixed(2), p90: +pct(a, .9).toFixed(2), p95: +pct(a, .95).toFixed(2), max: +Math.max(...a).toFixed(2), n: a.length }; }
const bands = [];
for (let a = 70; a < 270; a += 10) { const rs = rows.filter(r => r.lv >= a && r.lv < a + 10); if (!rs.length) continue; const n2 = rs.filter(r => r.nPlayers >= 2);
  bands.push({ band: `${a}-${a + 9}`, levels: rs.length, N_mean: +mean(rs.map(r => r.N)).toFixed(2), N_median: +med(rs.map(r => r.N)).toFixed(2), N_max: Math.max(...rs.map(r => r.N)), Nadj_mean: +mean(rs.map(r => r.Nadj)).toFixed(2), n2plus: n2.length, D40_mean: (() => { const d = rs.filter(r => r.D40 != null); return d.length ? +mean(d.map(r => r.D40)).toFixed(2) : null; })() }); }
const bandsBot = [];
for (let a = 70; a < 240; a += 10) { const ds = []; for (let l = a; l < a + 10; l++) if (D[l]) ds.push(D[l].D40); if (ds.length) bandsBot.push({ band: `${a}-${a + 9}`, D40_mean: +mean(ds).toFixed(2), D40_max: +Math.max(...ds).toFixed(2), n: ds.length }); }
const topBot = Object.values(D).sort((a, b) => b.D40 - a.D40).slice(0, 10).map(r => ({ lv: r.lv, D40: +r.D40.toFixed(2) }));
const NS = seq.filter(s => NORMAL.includes(s.who));
const censTotals = { sequences: NS.length, censored: NS.filter(s => !s.won).length, open: NS.filter(s => s.open).length, capHit: NS.filter(s => val(s) >= CAP).length };
const sensN = []; for (const lv of Object.keys(byLv)) { const ps = Object.values(byLv[lv]).filter(s => s.won); if (ps.length) sensN.push({ lv: +lv, N: mean(ps.map(val)) }); }
const perPlayer = {}; for (const p of NORMAL) { const ss = seq.filter(s => s.who === p); if (!ss.length) continue; perPlayer[p] = { levels: ss.length, minLv: Math.min(...ss.map(s => s.lv)), maxLv: Math.max(...ss.map(s => s.lv)), meanTries: +mean(ss.map(val)).toFixed(2), medianTries: med(ss.map(val)), censored: ss.filter(s => !s.won).length, firstTryWin: +(ss.filter(s => s.won && s.tries === 1).length / ss.length).toFixed(2) }; }
const otherSum = {}; for (const s of seq.filter(s => !NORMAL.includes(s.who))) { const o = otherSum[s.who] = otherSum[s.who] || { levels: 0, maxLv: 0 }; o.levels++; o.maxLv = Math.max(o.maxLv, s.lv); }
const out = { generated: new Date().toISOString(), params: { normal: NORMAL, tryCap: CAP, censoredRule: 'value = tries so far + 1 (lower bound of tries to first win); cap 20', levelsRange: [FROM, TO], boardRule: 'real_ledger.js (app version >= release of present board, tile count and clock moves match); levels 70-84 additionally need app >= 1.52 (75-105 are 1.52 boards); levels < 70 not in the hard table and not read; a player who won on an older board is dropped from that level' },
  players: Object.entries(players).map(([pid, p]) => ({ pid, ...p })), perPlayer, otherPlayersInLedger: otherSum, ledgerSkipped: L.skipped, levelsWithPlayers: rows.length, playersPerLevel: nCount, censTotals,
  playerEffect: { model: 'log(tries) = level + player on levels with >=2 normal players; factors relative, geometric mean 1', levelsInFit: lv2.length, effects, pairwise },
  topStats, quant, correlation: corr, binsByD: bins, isotonicDtoN: isoMap, reverse: rev, factor, hazard, bands, bandsBot, top15, top15two, topBot,
  sensitivityWonOnly: { levels: sensN.length, meanN: +mean(sensN.map(x => x.N)).toFixed(2) }, rows };
fs.mkdirSync(path.join(ROOT, 'source/analysis/builder/process-v2'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'source/analysis/builder/process-v2/normal-players.json'), JSON.stringify(out, null, 1) + '\n');
const o2 = { ...out }; delete o2.rows; delete o2.generated; console.log(JSON.stringify(o2));
