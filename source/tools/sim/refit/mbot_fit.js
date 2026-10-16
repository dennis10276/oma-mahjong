/* The move-based test player per person, fitted and tested on the future, with retries.
   Each level is played with the person's habits at the time they first played it (kinds.js: only
   recordings before then), care level (temp: how well it picks the move within the kind) and memory
   of lost tries ([start, middle, end]) are fitted together on all their tries of the levels they
   started before the cut (recent levels weighted); the levels after the cut are predicted with the
   habits at the cut. Baselines: their own win shares before the cut (first tries, retries apart) and
   the dashboard's current per-person test player (players/bots.json).
     node mbot_fit.js <name> [runs=24] [half-life levels=20] [cut: test|<ISO time>] -> mbot/fit-<name>.json */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { triesOf } = require('./pdata.js');
const { kindsAt } = require('./kinds.js');
const [name, runsS = '24', halfS = '20', cutS = 'test'] = process.argv.slice(2);
const runs = +runsS, HALF = +halfS;
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', 'w-k20.json'), 'utf8'));
const BOTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8')).bots;
const cut = cutS === 'test' ? W.test[name].cut_t : cutS === 'none' ? Infinity : new Date(cutS).getTime();
const TEMPS = [1, 1.5, 2, 3, 4, 6, 9];
const MEMS = { none: [0, 0, 0], low: [0.3, 0.15, 0.3], half: [0.5, 0.3, 0.5], high: [0.75, 0.5, 0.75], full: [1, 1, 1] };
const clamp = p => Math.min(0.97, Math.max(0.03, p));
const mbot = (kinds, temp, mem) => ({ ...Hard.P, w: Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp })), allMoves: true, flips: true, kinds, peek: 0, end: 12, plan: 10, memory: mem });
// levels: all tries of a level together, in the order played
const byLv = new Map();
for (const x of triesOf(name)) { const k = x.lv; if (!byLv.has(k)) byLv.set(k, { lv: x.lv, t: x.t, g: x.g, tries: [] }); byLv.get(k).tries.push(x); }
const levels = [...byLv.values()].sort((a, b) => a.t - b.t);
const train = levels.filter(l => l.t < cut), test = levels.filter(l => l.t >= cut);
const chance = (ch, at) => { for (let t = Math.min(at, 4) - 1; t >= 0; t--) if (ch.cond[t] !== null) return ch.cond[t]; return ch.first; };
function ll(L, chains, weights) {
  let s = 0, ws = 0;
  L.forEach((l, i) => { const ch = chains[i], w = weights ? weights[i] : 1; for (const x of l.tries) { const q = clamp(chance(ch, x.at)); s += w * Math.log(x.won ? q : 1 - q); ws += w; } });
  return s / Math.max(1e-9, ws);
}
const N = train.length, wts = train.map((_, i) => 0.5 ** ((N - 1 - i) / HALF));
let best = null; const grid = [];
for (const temp of TEMPS) for (const [mk, mem] of Object.entries(MEMS)) {
  const chains = train.map(l => Hard.rateChain(l.g, runs, 5, mbot(kindsAt(name, l.t), temp, mem), mem, 4));
  const v = ll(train, chains, wts);
  grid.push({ temp, mem: mk, ll: +v.toFixed(4) });
  if (!best || v > best.ll) best = { temp, mem: mk, ll: v };
}
const res = { name, cut: isFinite(cut) ? new Date(cut).toISOString() : null, trainLevels: train.length, trainTries: train.reduce((a, l) => a + l.tries.length, 0), best, grid };
if (test.length) {
  const kNow = kindsAt(name, cut);
  const mChains = test.map(l => Hard.rateChain(l.g, runs * 2, 7, mbot(kNow, best.temp, MEMS[best.mem]), MEMS[best.mem], 4));
  const bp = { ...Hard.P, ...BOTS[name].persona };
  const bChains = test.map(l => Hard.rateChain(l.g, runs * 2, 7, bp, bp.memory === undefined ? 1 : bp.memory, 4));
  const tr = train.flatMap(l => l.tries), f1 = tr.filter(x => x.at === 1), f2 = tr.filter(x => x.at > 1);
  const own = { cond: [clamp((f1.filter(x => x.won).length + 1) / (f1.length + 2)), ...Array(3).fill(clamp((f2.filter(x => x.won).length + 1) / (f2.length + 2)))], first: null };
  const score = chains => {
    let lf = 0, nf = 0, lr = 0, nr = 0, pf = 0, pr = 0, wf = 0, wr = 0;
    test.forEach((l, i) => { for (const x of l.tries) { const q = clamp(chance(chains[i], x.at)), v = -Math.log(x.won ? q : 1 - q); if (x.at === 1) { lf += v; nf++; pf += q; wf += x.won; } else { lr += v; nr++; pr += q; wr += x.won; } } });
    return { first: { n: nf, won: wf, predicted: +pf.toFixed(1), ll: +(lf / Math.max(1, nf)).toFixed(3) }, retries: { n: nr, won: wr, predicted: +pr.toFixed(1), ll: +(lr / Math.max(1, nr)).toFixed(3) }, all: +((lf + lr) / Math.max(1, nf + nr)).toFixed(3) };
  };
  res.test = { levels: test.length, moveBot: score(mChains), dashboardBot: score(bChains), ownRate: score(test.map(() => own)),
    perLevel: test.map((l, i) => ({ lv: l.lv, tries: l.tries.map(x => x.won ? 'W' : 'L').join(''), moveBot: mChains[i].within.map(v => +v.toFixed(2)), dashboardBot: bChains[i].within.map(v => +v.toFixed(2)) })) };
}
fs.mkdirSync(path.join(__dirname, 'mbot'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'mbot', `fit-${name.replace(/[^A-Za-z]/g, '')}${cutS === 'test' ? '' : '-' + cutS.replace(/[^0-9A-Za-z]/g, '')}.json`), JSON.stringify(res, null, 1));
console.log(`${name}: care level ${best.temp}, memory ${best.mem} (from ${res.trainLevels} levels, ${res.trainTries} tries)`);
if (res.test) for (const k of ['moveBot', 'dashboardBot', 'ownRate']) { const s = res.test[k]; console.log(`  ${k.padEnd(13)} first tries ${s.first.won}/${s.first.n} predicted ${s.first.predicted} ll ${s.first.ll} | retries ${s.retries.won}/${s.retries.n} predicted ${s.retries.predicted} ll ${s.retries.ll} | all ll ${s.all}`); }
