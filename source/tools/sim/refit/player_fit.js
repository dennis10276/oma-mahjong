/* A test player per family member, fitted to their own tries.
     node player_fit.js <name> <base persona> <temps comma> [runs=100]   -> players/<name>.json
   Stage 1, first tries: how carefully they play (temp: noise in choices) and how often they play
   on with 3 tiles waiting as if the tray had room (blunder).
   Stage 2, retries: how much of a lost try they remember on the next one, by part of the lost try
   (start / middle / end), for tries 2-4 on the same board (Hard.rateChain).
   The fit is the likelihood of their real wins and losses; per level band the real and predicted
   win shares are kept as a check. */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const [name, base, tempsArg] = process.argv.slice(2, 5);
const runs = +(process.argv[5] || 100);
// RECENT=n: only their n most recent levels (players improve; for predicting what comes next the
// recent play counts). Levels go up over time, so recent = the highest levels they played.
let A = require('./attempts.json').filter(a => a.name === name);
const RECENT = +(process.env.RECENT || 0);
if (RECENT) { const lvs = [...new Set(A.map(a => a.lv))].sort((x, y) => y - x).slice(0, RECENT); A = A.filter(a => lvs.includes(a.lv)); }
const build = a => a.board.kind === 'classic' ? B.classic(a.board.lv, a.board.aspect) : B.designed(a.board.v, a.board.lv);
const games = {}; const game = a => games[a.key] || (games[a.key] = build(a));
const clamp = p => Math.min(0.99, Math.max(0.01, p));
const log = (...x) => console.error(name, ...x);

// stage 1: first tries
const first = A.filter(a => a.at === 1);
const BL = [0, 0.15, 0.3];
const s1 = [];
for (const temp of tempsArg.split(',').map(Number)) for (const blunder of BL) {
  const p = { ...Hard.persona(base), temp, blunder };
  let ll = 0, pred = 0;
  for (const a of first) { const q = clamp(Hard.rate(game(a), runs, 3, p).rate); pred += q; ll += Math.log(a.r === 'win' ? q : 1 - q); }
  s1.push({ temp, blunder, ll: +ll.toFixed(2), pred: +(pred / first.length).toFixed(3) });
  log('stage 1', JSON.stringify(s1[s1.length - 1]));
}
s1.sort((x, y) => y.ll - x.ll);
const best1 = s1[0], play = { ...Hard.persona(base), temp: best1.temp, blunder: best1.blunder };

// stage 2: retries (a try right after a lost one on the same board)
const byKey = {}; for (const a of A) (byKey[a.key] = byKey[a.key] || []).push(a);
const retries = [];
for (const list of Object.values(byKey)) { list.sort((x, y) => x.at - y.at); for (let k = 1; k < list.length; k++) if (list[k - 1].r !== 'win' && list[k].at === list[k - 1].at + 1) retries.push(list[k]); }
const chainCache = {};
function memFit(mem) {
  let ll = 0, pred = 0;
  for (const a of retries) {
    const key = a.key + '|' + JSON.stringify(mem);
    const c = chainCache[key] || (chainCache[key] = Hard.rateChain(game(a), +(process.env.CHAIN_RUNS || Math.max(40, runs * 0.6 | 0)), 5, play, mem, 4));
    const t = Math.min(a.at, 4) - 1; let q = c.cond[t]; for (let u = t; q === null && u > 0; u--) q = c.cond[u - 1];
    q = clamp(q === null ? c.first : q); pred += q; ll += Math.log(a.r === 'win' ? q : 1 - q);
  }
  return { mem, ll: +ll.toFixed(2), predWins: +pred.toFixed(1) };
}
const s2 = [];
if (retries.length) {
  const grid = [];
  for (const se of [0, 0.25, 0.5, 0.75, 1]) for (const m of [0, 0.15, 0.3, 0.5, 0.75]) if (m <= se) grid.push([se, m, se]);
  for (const mem of grid) { s2.push(memFit(mem)); log('stage 2', JSON.stringify(s2[s2.length - 1])); }
  s2.sort((x, y) => y.ll - x.ll);
  // then start and end apart (a person may remember the start better than the end, or the other way)
  const [se, m] = s2[0].mem;
  for (const d of [-0.25, 0.25]) for (const mem of [[se + d, m, se], [se, m, se + d]]) if (mem.every(x => x >= 0 && x <= 1) && mem[1] <= Math.max(mem[0], mem[2])) { s2.push(memFit(mem)); log('stage 2b', JSON.stringify(s2[s2.length - 1])); }
  s2.sort((x, y) => y.ll - x.ll);
}
const memory = s2.length ? s2[0].mem : 0;

// check per level band: first tries real vs predicted
const bands = {};
for (const a of first) { const b = a.lv < 75 ? Math.floor(a.lv / 10) * 10 : a.lv < 80 ? 75 : Math.floor(a.lv / 10) * 10; const o = bands[b] || (bands[b] = { n: 0, real: 0, pred: 0 }); o.n++; o.real += a.r === 'win'; o.pred += Hard.rate(game(a), runs, 3, play).rate; }
for (const o of Object.values(bands)) { o.real = +(o.real / o.n).toFixed(2); o.pred = +(o.pred / o.n).toFixed(2); }
const out = {
  name, made: new Date().toISOString().slice(0, 10), base,
  persona: { ...Hard.REF[base], temp: best1.temp, blunder: best1.blunder, memory },
  data: { firstTries: first.length, firstWins: first.filter(a => a.r === 'win').length, retries: retries.length, retryWins: retries.filter(a => a.r === 'win').length, levels: [Math.min(...A.map(a => a.lv)), Math.max(...A.map(a => a.lv))] },
  firstTryFit: s1.slice(0, 5), memoryFit: s2.slice(0, 5), bands,
};
fs.mkdirSync(path.join(__dirname, 'players'), { recursive: true });
out.recent = RECENT || null;
fs.writeFileSync(path.join(__dirname, 'players', name.replace(/[^\w]+/g, '_') + (RECENT ? '-recent' : '') + '.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
