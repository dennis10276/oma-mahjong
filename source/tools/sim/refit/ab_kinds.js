/* Variants of a person's test player on their newest games (not level 51 for Gerda: 17 tries of one
   board). node ab_kinds.js <name> [runs=30] */
'use strict';
const path = require('path'), fs = require('fs');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const { gamesOf } = require('./mimic_games.js');
const [name, runsS = '30'] = process.argv.slice(2), runs = +runsS;
const W = JSON.parse(fs.readFileSync('mimic/w-k20.json', 'utf8')), pl = W.players[name];
const all = gamesOf(name), G = all.slice(-Math.ceil(all.length / 4)).filter(x => !(name === 'Gerda' && x.lv === 51));
const eng = k => Array.from(Hard.weightsOf(Hard.persona(k)));
const V = {
  'kinds + own move weights': { w: pl.w, kinds: pl.kinds },
  'kinds + strong engine': { w: eng('strong'), kinds: pl.kinds },
  'kinds + average engine': { w: eng('average'), kinds: pl.kinds },
  'strong engine, own flips': { ...Hard.persona('strong'), flipRate: pl.flipRate || W.players[name].flipRate, blunder3: 0 },
  'strong engine (sees all)': { ...Hard.persona('strong') },
};
console.log(`${name}: ${G.length} newest games, real wins ${G.filter(x => x.won).length}`);
for (const [k, v] of Object.entries(V)) {
  const p = { ...Hard.P, allMoves: !!v.kinds, flips: true, peek: v.w || v.flipRate ? 0 : 1, end: 12, plan: 10, ...v };
  let w = 0; for (const x of G) for (let r = 0; r < runs; r++) w += Hard.play(x.g, p, 5 + r * 7919).win / runs;
  console.log(`  ${k.padEnd(28)} ${w.toFixed(1)}`);
}
