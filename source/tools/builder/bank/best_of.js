#!/usr/bin/env node
'use strict';
/* best_of.js: the same idea searched with several seeds; keep the proven board whose wrong paths look good longest (hope.js).
   Dennis 2026-11-17: "good levels are levels where many different wrong paths looks good for a long time".
     node source/tools/builder/bank/best_of.js <idea.js> [--seeds 6] [--tries 2000]
   Ranks by the number of points of no return with a false hope of 5+ moves, then the hope score. Writes <id>.board.json (the best)
   and prints one line per seed. */
const fs = require('fs'), path = require('path'), I = require('./idea_search.js'), Hp = require('./hope.js');
const a = process.argv.slice(2), arg = (k, v) => { const i = a.indexOf('--' + k); return i < 0 ? v : a[i + 1]; };
const idea = require(path.resolve(a[0])), DIR = path.resolve(__dirname, '../../../analysis/builder/hand');
let best = null;
for (let seed = 1; seed <= +arg('seeds', 6); seed++) {
  const r = I.search(idea, { tries: +arg('tries', 2000), seed });
  if (!r.ok) { console.log(`seed ${seed}: not found ${JSON.stringify(r.why)}`); continue; }
  const board = { spec: r.spec, design: r.design, offers: r.offers };
  let h; try { h = Hp.hope(board, { tiles: [...new Set([...r.spec.route.flat(), ...Object.values(r.spec.pairs || {}).flat()])] }); } catch (e) { h = { long: 0, score: 0, points: [], maxHope: 0 }; }
  const clock = r.report.split('\n').find(l => /^clock \d+ in/.test(l)) || '';
  console.log(`seed ${seed}: ${clock} | wrong points ${h.points.length}, lasting 5+: ${h.long}, longest ${h.maxHope}, score ${h.score} | biting ${r.offers ? r.offers.biting + '/' + r.offers.tempting : '?'}`);
  if (!best || h.long > best.h.long || (h.long === best.h.long && h.score > best.h.score)) best = { board, h, seed };
}
if (best) { fs.writeFileSync(path.join(DIR, idea.id + '.board.json'), JSON.stringify(best.board, null, 1)); console.log(`BEST seed ${best.seed}: lasting 5+ ${best.h.long}, score ${best.h.score} -> ${idea.id}.board.json`); }
else console.log('NONE');
