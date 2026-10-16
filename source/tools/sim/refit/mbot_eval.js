/* The move-based test player per person, tested on the future.
   Habits (kind of move per situation) from their recordings before the cut, care level (temp) tuned on
   their first tries before the cut (recent ones weighted), then their first tries after the cut are
   predicted. Compared with: their own first-try win share before the cut, and the dashboard's current
   per-person test player (players/bots.json).
     node mbot_eval.js [runs=40] [half-life=20] [names] -> mbot/eval.json */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { triesOf } = require('./pdata.js');
const runs = +(process.argv[2] || 40), HALF = +(process.argv[3] || 20);
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', 'w-k20.json'), 'utf8'));
const BOTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8')).bots;
const names = process.argv[4] ? process.argv[4].split(',') : ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'];
const TEMPS = [0.75, 1, 1.5, 2, 3, 4, 6, 9];
const clamp = p => Math.min(0.97, Math.max(0.03, p));
const ewOf = temp => Array.from(Hard.weightsOf({ ...Hard.persona('strong'), temp }));
const mbot = (kinds, temp) => ({ ...Hard.P, w: ewOf(temp), allMoves: true, flips: true, kinds, peek: 0, end: 12, plan: 10 });
const memo = new Map();
const rateOf = (x, key, p) => { const k = key + '|' + x.t; if (!memo.has(k)) memo.set(k, Hard.rate(x.g, runs, 5, p).rate); return memo.get(k); };
fs.mkdirSync(path.join(__dirname, 'mbot'), { recursive: true });
const out = {};
for (const name of names) {
  const cut = W.test[name].cut_t, T = triesOf(name).filter(x => x.at === 1);
  const train = T.filter(x => x.t < cut), test = T.filter(x => x.t >= cut);
  const kinds = W.test[name].kinds;
  // care level: maximum likelihood of their first-try results before the cut, recent ones weighted
  const N = train.length; let best = null; const fits = [];
  for (const temp of TEMPS) {
    let ll = 0, wsum = 0, sim = 0;
    train.forEach((x, i) => { const rw = 0.5 ** ((N - 1 - i) / HALF), q = rateOf(x, 'm' + temp, mbot(kinds, temp)); sim += q; ll += rw * Math.log(x.won ? clamp(q) : 1 - clamp(q)); wsum += rw; });
    fits.push({ temp, ll: +(ll / wsum).toFixed(3), sim: +sim.toFixed(1) });
    if (!best || ll / wsum > best.ll) best = { temp, ll: ll / wsum };
  }
  const score = qs => { let ll = 0, br = 0, sum = 0; test.forEach((x, i) => { const q = qs[i]; sum += q; ll -= Math.log(x.won ? clamp(q) : 1 - clamp(q)); br += ((x.won ? 1 : 0) - q) ** 2; }); return { ll: +(ll / Math.max(1, test.length)).toFixed(3), brier: +(br / Math.max(1, test.length)).toFixed(3), predicted: +sum.toFixed(1) }; };
  const own = clamp((train.filter(x => x.won).length + 1) / (train.length + 2));
  const old = { ...Hard.P, ...BOTS[name].persona };
  const qM = test.map(x => rateOf(x, 'm' + best.temp, mbot(kinds, best.temp)));
  const qO = test.map(x => rateOf(x, 'old', old));
  const res = { train: train.length, trainWins: train.filter(x => x.won).length, temp: best.temp, fits, test: test.length, testWins: test.filter(x => x.won).length,
    moveBot: score(qM), dashboardBot: score(qO), ownRate: score(test.map(() => own)),
    levels: test.map((x, i) => ({ lv: x.lv, won: x.won, moveBot: +qM[i].toFixed(2), dashboardBot: +qO[i].toFixed(2) })) };
  out[name] = res;
  console.log(`${name}: care level ${best.temp} (from ${train.length} first tries, ${res.trainWins} won) | test ${test.length} first tries, ${res.testWins} won | predicted wins / log-loss: move bot ${res.moveBot.predicted} / ${res.moveBot.ll}, dashboard bot ${res.dashboardBot.predicted} / ${res.dashboardBot.ll}, own rate ${res.ownRate.predicted} / ${res.ownRate.ll}`);
}
fs.writeFileSync(path.join(__dirname, 'mbot', 'eval-' + names.map(n => n.replace(/[^A-Za-z]/g, '')).join('-') + '.json'), JSON.stringify(out, null, 1));
