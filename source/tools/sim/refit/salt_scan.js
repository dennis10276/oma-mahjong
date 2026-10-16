/* One deal per level 1-69 for everyone (made for screen shape 1.6): for each level, the usual
   difficulty is the median over the screen shapes phones have (average test player, the game's own
   level code incl. gold, jokers, ice and locks). Deal 0 (the one 1.6 phones got so far) is kept when
   it is within 8 points of that; otherwise the closest of the other deals (salt 1-15).
     node salt_scan.js [from=1] [to=69] [part=0] [parts=1] -> salts-<part>.json */
'use strict';
const fs = require('fs'), path = require('path');
const { gameBoard } = require('./gameboard.js');
const Hard = require(path.join(__dirname, '..', '..', '..', 'www', 'hard.js'));
const from = +(process.argv[2] || 1), to = +(process.argv[3] || 69), part = +(process.argv[4] || 0), parts = +(process.argv[5] || 1);
const SHAPES = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2], ASPECT = 1.6;
const file = path.join(__dirname, `salts-${part}.json`);
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const avg = Hard.persona('average');
for (let lv = from; lv <= to; lv++) {
  if ((lv - from) % parts !== part || out[lv]) continue;
  const byShape = SHAPES.map(a => Hard.rate(gameBoard(lv, a), 80, 9, avg).rate);
  const usual = byShape.slice().sort((a, b) => a - b)[SHAPES.length >> 1];
  const cand = [];
  for (let salt = 0; salt < 16; salt++) {
    const q = Hard.rate(gameBoard(lv, ASPECT, salt), 120, 13, avg).rate;
    cand.push({ salt, q });
    if (salt === 0 && Math.abs(q - usual) <= 0.08) break;
    if (salt > 0 && Math.abs(q - usual) <= 0.04) break;
  }
  const pick = Math.abs(cand[0].q - usual) <= 0.08 ? cand[0] : cand.slice().sort((a, b) => Math.abs(a.q - usual) - Math.abs(b.q - usual))[0];
  const g = gameBoard(lv, ASPECT, pick.salt);
  const rates = Object.fromEntries(['strong', 'sensible', 'average'].map(k => [k, +Hard.rate(g, 200, 21, Hard.persona(k)).rate.toFixed(3)]));
  out[lv] = { usual: +usual.toFixed(3), byShape: Object.fromEntries(SHAPES.map((a, i) => [a, byShape[i]])), salt: pick.salt, tried: cand.length, deal0: +cand[0].q.toFixed(3), rates };
  fs.writeFileSync(file, JSON.stringify(out));
  console.error(lv, 'usual', usual.toFixed(2), 'deal0 at 1.6', cand[0].q.toFixed(2), '-> salt', pick.salt, JSON.stringify(rates));
}
