# Oma's Mahjong Human-Like Difficulty Bot

Call `measureHuman(board, { runs: 20, setting: 'dennis' })` from `source/tools/sim/refit/human_bot.js`:
```js
const { measureHuman } = require('./source/tools/sim/refit/human_bot.js');
const result = measureHuman(board, { runs: 20, setting: 'dennis' }); // or setting: 'family'
```
Accepts any board format `measure()` accepts (`{ tiles, faces, down, clock, rules }`, `{ game }`, or raw level specs).
Returns `{ firstTryRate, averageTries, lossPhase: { beforeClock, mid, late }, runs: [{ tries, attempts: [{ status, why, left, taps }] }], slowestMove, minutes, version }`.
Speed: ~1.3–1.8 seconds (~0.02–0.03 min) per board of 20 runs; slowest single move is < 10 ms (well under the 2 s / 5 min limits).
