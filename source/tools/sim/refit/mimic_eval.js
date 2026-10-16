/* Behaviour cloning, step 3: do the move-trained test players predict wins and losses?
   For each player: their tries after the moment their test games start (mimic/weights.json cut_t),
   predicted with weights learned only from their older recorded games, and compared with
   - their own win share before that moment (first tries and retries apart), and
   - the results-fitted test player from before (players/bots.json).
     node mimic_eval.js [runs=150] -> mimic/eval.json */
'use strict';
const fs = require('fs'), path = require('path');
const B = require('./boards.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const runs = +(process.argv[2] || 150);
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'mimic', 'weights.json'), 'utf8'));
const { bots } = JSON.parse(fs.readFileSync(path.join(__dirname, 'players', 'bots.json'), 'utf8'));
const A = require('./attempts.json');
const build = a => a.board.kind === 'classic' ? B.classic(a.board.lv, a.board.aspect) : B.designed(a.board.v, a.board.lv);
const clamp = p => Math.min(0.99, Math.max(0.01, p));
const ll = (p, won) => -Math.log(won ? clamp(p) : 1 - clamp(p));
const out = {};
for (const name of Object.keys(W.test)) {
  const cut = W.test[name].cut_t, bot = bots[name];
  const mine = A.filter(a => a.name === name), before = mine.filter(a => a.t < cut), test = mine.filter(a => a.t >= cut);
  const rate1 = (before.filter(a => a.at === 1 && a.r === 'win').length + 1) / (before.filter(a => a.at === 1).length + 2);
  const rateR = (before.filter(a => a.at > 1 && a.r === 'win').length + 1) / (before.filter(a => a.at > 1).length + 2);
  const variants = {
    mimic: { ...Hard.P, w: W.test[name].train_w, allMoves: true, end: 12, plan: 0, peek: W.players[name].peek, memory: bot.persona.memory },
    mimicPlan: { ...Hard.P, w: W.test[name].train_w, allMoves: true, end: 12, plan: 10, peek: W.players[name].peek, memory: bot.persona.memory },
    oldBot: { ...Hard.P, ...bot.persona },
  };
  const cache = {};
  const chance = (v, a) => {
    const k = v + '|' + a.key;
    if (!cache[k]) cache[k] = Hard.rateChain(build(a), runs, 23, variants[v], variants[v].memory, 8);
    const c = cache[k], t = Math.min(a.at, 8) - 1;
    let q = c.cond[t]; for (let u = t; q === null && u > 0; u--) q = c.cond[u - 1];
    return q === null ? c.first : q;
  };
  const sc = { rate: [], mimic: [], mimicPlan: [], oldBot: [] }, rows = [];
  for (const a of test) {
    const won = a.r === 'win', row = { lv: a.lv, at: a.at, r: a.r };
    sc.rate.push(ll(a.at === 1 ? rate1 : rateR, won));
    for (const v of Object.keys(variants)) { const q = chance(v, a); row[v] = +q.toFixed(2); sc[v].push(ll(q, won)); }
    rows.push(row);
  }
  const m = v => v.length ? +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(3) : null;
  out[name] = { tests: test.length, firstTries: test.filter(a => a.at === 1).length, logLoss: Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, m(v)])), rows };
  console.log(name.padEnd(16), 'test tries', test.length, JSON.stringify(out[name].logLoss));
}
fs.writeFileSync(path.join(__dirname, 'mimic', 'eval.json'), JSON.stringify(out, null, 1));
