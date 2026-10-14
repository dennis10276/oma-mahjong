/* Step 2 of the re-fit: which settings of the honest test player play most like each real player.
   Likelihood of every real attempt (win or not) under the test player's win chance on that exact
   board. Later tries on the same board get easier for a person (they saw it before): a learning
   term b per extra try, on the log-odds scale, is fitted along.
     node analyze.js > fit-report.json */
'use strict';
const fs = require('fs'), path = require('path');
const A = require('./attempts.json');
const DIR = path.join(__dirname, process.env.RATES || 'rates');
const R = {}; for (const f of fs.readdirSync(DIR)) Object.assign(R, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
// MINLV / MAXLV: fit on part of the levels only (to see whether a player changes over the levels)
const att = A.filter(a => R[a.key] && a.lv >= +(process.env.MINLV || 0) && a.lv <= +(process.env.MAXLV || 999));
// the settings measured on boards with a clock (those have every clockFocus)
const cfgs = Object.keys(Object.values(R).find(x => x.clock).r);
// cfg: temp|end|clockFocus[|unknown]; on a board without a clock clockFocus is stored as 0
const rateOf = (k, c) => { const x = R[k]; let v = x.r[c]; if (v === undefined) { const q = c.split('|'); q[2] = '0'; v = x.r[q.join('|')]; } return (v * x.runs + 0.5) / (x.runs + 1); };
const logit = p => Math.log(p / (1 - p)), sig = z => 1 / (1 + Math.exp(-z));
const B = [0, 0.25, 0.5, 0.75, 1, 1.5, 2];
function ll(list, c, b) {
  let s = 0;
  for (const a of list) { const p = sig(logit(rateOf(a.key, c)) + b * (Math.min(a.at, 4) - 1)); s += Math.log(a.r === 'win' ? p : 1 - p); }
  return s;
}
const players = [...new Set(att.map(a => a.name))];
const report = { boards: Object.keys(R).length, attempts: att.length, players: {} };
for (const name of players) {
  const list = att.filter(a => a.name === name), first = list.filter(a => a.at === 1);
  const rows = [];
  for (const c of cfgs) for (const b of B) rows.push({ c, b, ll: ll(list, c, b), ll1: ll(first, c, 0) });
  rows.sort((x, y) => y.ll - x.ll);
  const best = rows[0];
  const firstBest = rows.slice().sort((x, y) => y.ll1 - x.ll1)[0];
  // how well it tells hard boards from easy ones: first tries, predicted vs real, by level band
  const bands = {};
  for (const a of first) { const k = Math.floor(a.lv / 10) * 10; const o = bands[k] || (bands[k] = { n: 0, real: 0, pred: 0 }); o.n++; o.real += a.r === 'win'; o.pred += rateOf(a.key, best.c); }
  for (const o of Object.values(bands)) { o.real = +(o.real / o.n).toFixed(2); o.pred = +(o.pred / o.n).toFixed(2); }
  // tries needed per level: real vs expected
  const lv = {}; for (const a of list) { const o = lv[a.key] || (lv[a.key] = { lv: a.lv, tries: 0, won: 0 }); o.tries++; if (a.r === 'win') o.won = 1; }
  const top = rows.filter((r, i, all) => all.findIndex(q => q.c === r.c) === i).slice(0, 5).map(r => ({ cfg: r.c, b: r.b, ll: +r.ll.toFixed(1) }));
  report.players[name] = {
    attempts: list.length, wins: list.filter(a => a.r === 'win').length, firstTries: first.length, firstWins: first.filter(a => a.r === 'win').length,
    levels: [Math.min(...list.map(a => a.lv)), Math.max(...list.map(a => a.lv))],
    best: { cfg: best.c, b: best.b, ll: +best.ll.toFixed(1), perTry: +Math.exp(best.ll / list.length).toFixed(3) },
    bestFirstOnly: { cfg: firstBest.c, ll: +firstBest.ll1.toFixed(1) },
    top, bands,
  };
}
// the same settings for everyone, as a check that the players really differ
const all = cfgs.map(c => ({ c, ll: B.reduce((m, b) => Math.max(m, ll(att, c, b)), -1e9) })).sort((x, y) => y.ll - x.ll)[0];
report.shared = { cfg: all.c, ll: +all.ll.toFixed(1), sumOfOwn: +Object.values(report.players).reduce((s, p) => s + p.best.ll, 0).toFixed(1) };
console.log(JSON.stringify(report, null, 1));
