'use strict';
/* Tests for bank/difficulty.js (bot-free difficulty score 1-10).   node --test source/tools/builder/bank/test_difficulty.js   (light: engine only) */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const Df = require('./difficulty.js');
const root = path.resolve(__dirname, '../../../build');
const key = JSON.parse(fs.readFileSync(path.join(root, 'bank/try-5-key.json'), 'utf8'));
const load = f => JSON.parse(fs.readFileSync(path.join(root, 'traps/examples2', f), 'utf8'));
const base = () => ({ links: 3, baits: 1, firstMoves: { winning: 6, legal: 12, share: 0.5 }, pressure: { share2plus: 0.7, run2: 6, at3: 3, k: 12 }, lateness: { share: 0.4 }, spare: 1, tailGreedyWin: 0.25, tiles: 76, faceDownShare: 0.2 });
const sc = f => { const p = Df.partsOf(f), t = Object.values(Df.WEIGHTS).reduce((a, b) => a + b, 0); return 1 + 9 * Object.keys(Df.WEIGHTS).reduce((s, k) => s + Df.WEIGHTS[k] * p[k], 0) / t; };

test('difficulty: the weights add up to 1 and every part lies in 0..1', () => {
  assert.ok(Math.abs(Object.values(Df.WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (const f of [base(), { ...base(), links: 2, tailGreedyWin: 1, tiles: 72, faceDownShare: 0, spare: 3 }, { ...base(), links: 6, tailGreedyWin: 0, tiles: 120, faceDownShare: 0.9, spare: 1 }]) {
    for (const v of Object.values(Df.partsOf(f))) assert.ok(v >= 0 && v <= 1, 'part ' + v);
    const s = sc(f); assert.ok(s >= 1 && s <= 10, 'score ' + s);
  }
});
test('difficulty: each lever moves the score the stated way', () => {
  const b = sc(base());
  assert.ok(sc({ ...base(), links: 2 }) < b && b < sc({ ...base(), links: 4 }), 'links');
  assert.ok(sc({ ...base(), tailGreedyWin: 0.5 }) < b && sc({ ...base(), tailGreedyWin: 0.10 }) > b, 'tail: lower is harder');
  assert.ok(sc({ ...base(), spare: 2 }) < b, 'spare 1 is harder than 2');
  assert.ok(sc({ ...base(), firstMoves: { winning: 3, legal: 12, share: 0.25 } }) > b, 'fewer winning first moves is harder');
  assert.ok(sc({ ...base(), baits: 2 }) > b, 'two proven baits');
  assert.ok(sc({ ...base(), pressure: { share2plus: 1, run2: 12, at3: 6, k: 12 } }) > b && sc({ ...base(), pressure: { share2plus: 0.2, run2: 1, at3: 0, k: 12 } }) < b, 'tray pressure');
  assert.ok(sc({ ...base(), lateness: { share: 0.8 } }) > b, 'a later loss is harder');
  assert.ok(sc({ ...base(), tiles: 96 }) > b, 'more tiles slightly harder');
});
test('difficulty: the face-down share counts only a little and is capped at 0.30', () => {
  const a = sc({ ...base(), faceDownShare: 0.30 }), c = sc({ ...base(), faceDownShare: 0.60 }), z = sc({ ...base(), faceDownShare: 0 });
  assert.equal(a, c); assert.ok(a > z && a - z < 0.5, 'small factor: ' + (a - z));
});
test('difficulty: the tail part is 0 at 0.40 and above, 0.75 at 0.15, 1 at 0.08 and below', () => {
  const t = w => Df.partsOf({ ...base(), tailGreedyWin: w }).tail;
  assert.equal(t(0.5), 0); assert.equal(t(0.40), 0); assert.ok(Math.abs(t(0.15) - 0.75) < 1e-9); assert.equal(t(0.08), 1); assert.equal(t(0.01), 1);
});
test('difficulty: a board with fewer than 3 winning first moves is marked needle', () => {
  const j = load('chain-3-8.json'), s = Df.score(j.design, j.card, { fresh: true });
  assert.equal(s.needle, s.facts.firstMoves.winning < 3); assert.equal(s.facts.firstMoves.winning, 2); assert.equal(s.needle, true);
  const j2 = load('chain-11-46.json'), s2 = Df.score(j2.design, j2.card, { fresh: true }); assert.equal(s2.needle, false);
});
test('difficulty: the lab-5 boards order 294, 295 < 296 < 293 < 292 < 291 (all five gaps positive)', () => {
  const S = {}; for (const e of key) { const j = load(e.file); S[e.level] = Df.score(j.design, j.card, { fresh: true }); }
  assert.ok(S[294].score < S[295].score && S[295].score < S[296].score && S[296].score < S[293].score && S[293].score < S[292].score, JSON.stringify(Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.score]))));
  assert.ok(S[292].score < S[291].score, '291 ' + S[291].score + ' 292 ' + S[292].score);
  for (const l of [294, 295, 296]) assert.ok(S[l].score < 4.5, 'two-link boards stay low');
  assert.equal(S[291].facts.links, 3); assert.equal(S[292].facts.links, 4);
});
test('difficulty: lateness follows the stored route after the wrong first move and is deterministic', () => {
  const j = load('chain-11-46.json'), b = j.card.baits[0], a = Df.lateness(j.design, j.card, b.tiles.slice(0, 1)), c = Df.lateness(j.design, j.card, b.tiles.slice(0, 1));
  assert.deepEqual(a, c); assert.ok(a.moves >= 1 && a.share > 0 && a.share <= 1, JSON.stringify(a));
});
