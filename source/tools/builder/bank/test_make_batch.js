'use strict';
/* Tests for the assignment rules of bank/make_batch.js, on a synthetic pool (no building, no engine).   node --test source/tools/builder/bank/test_make_batch.js */
const test = require('node:test'), assert = require('node:assert/strict');
const MB = require('./make_batch.js');
const rngOf = seed => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };

function pool(n, seed = 5) {
  const r = rngOf(seed), cands = [], BIGL = [13, 21, 27, 29, 47];
  for (let i = 0; i < n; i++) {
    const big = r() < 0.12, layout = big ? BIGL[Math.floor(r() * 5)] : Math.floor(r() * 48), shapeIndex = Math.floor(r() * 14), links = shapeIndex < 4 ? 2 : shapeIndex < 11 ? 3 : 4;
    const score = +(2.8 + r() * 5.4).toFixed(2), tail = +(0.06 + r() * 0.34).toFixed(2), tiles = big ? 96 : 72 + 4 * Math.floor(r() * 5);
    cands.push({ id: 'c' + i, shapeIndex, shape: 'shape' + shapeIndex, links, layout, seed: 1, tiles, score, needle: r() < 0.15, tail, spare: 1, down: 0.2, tier: 'std',
      sig: { layout, trap: 'shape' + shapeIndex, clock: Math.floor(r() * 9) + ',0,low', key: Math.floor(r() * 9) + ',1,low', ice: Math.floor(r() * 9) + ',2,low', cells: ['L' + layout + '-' + Math.floor(r() * 5)] },
      rec: { design: {}, card: { difficulty: { score, needle: false, parts: {}, facts: {} }, firstMoves: { winning: 3, legal: 9 }, pressure: {}, baits: [], faceDownShare: 0.2, see: 's', layoutName: 'x', tiles, spare: 1 } } });
  }
  return { cands, fails: {}, jobs: n };
}

test('assign: every hard rule holds on a synthetic pool and the score ramp rises without dips over 0.5', () => {
  const A = MB.assign({ pool: pool(900), dfsMs: 3000, saMs: 20000, rounds: 3 }), seq = A.seq, filled = seq.filter(Boolean);
  assert.equal(seq.length, 40); assert.ok(filled.length >= 30, 'filled ' + filled.length);
  seq.forEach((c, i) => {
    if (!c) return; const lv = 250 + i;
    assert.equal(c.tiles === 96, [250, 260, 270, 280].includes(lv), 'level ' + lv + ' tiles ' + c.tiles);
    if (!(c.tiles === 96)) assert.ok(c.tiles >= 72 && c.tiles <= 88);
    if (lv >= 256) assert.ok(c.links >= 3, 'links at ' + lv);
    if (lv < 276) assert.ok(!c.needle && c.tail >= 0.15, 'needle/low tail only in the hardest third: ' + lv);
    for (let j = Math.max(0, i - 12); j < i; j++) if (seq[j]) assert.notEqual(seq[j].layout, c.layout, `layout ${c.layout} twice within 12 (${250 + j} and ${lv})`);
    for (let j = Math.max(0, i - 2); j < i; j++) if (seq[j]) assert.notEqual(seq[j].shape, c.shape, `shape twice within 2 (${250 + j} and ${lv})`);
    if (i && seq[i - 1]) assert.ok(c.score >= seq[i - 1].score - 0.5, `dip at ${lv}: ${seq[i - 1].score} -> ${c.score}`);
  });
  const counts = {}; for (const c of filled) counts[c.shape] = (counts[c.shape] || 0) + 1; for (const v of Object.values(counts)) assert.ok(v <= 3, 'a shape at most 3 times');
  const pairs = new Set(); for (const c of filled) { const k = c.layout + '/' + c.shape; assert.ok(!pairs.has(k), 'layout+shape twice'); pairs.add(k); }
  assert.ok(filled[filled.length - 1].score > filled[0].score + 2.5, 'ramp rises: ' + filled[0].score + ' -> ' + filled[filled.length - 1].score);
  assert.ok(new Set(filled.map(c => c.id)).size === filled.length, 'a board is used once');
});
test('assign: a pool with only 2-link boards fills 250-255 and leaves the rest as holes (rule named, nothing relaxed)', () => {
  const p = pool(500, 9); for (const c of p.cands) { c.links = 2; c.needle = false; c.tail = 0.3; }
  const A = MB.assign({ pool: p, dfsMs: 1000, saMs: 6000, rounds: 2 });
  A.seq.forEach((c, i) => { if (250 + i >= 256) assert.equal(c, null, 'hole at ' + (250 + i)); });
  assert.ok(A.seq.slice(0, 6).filter(Boolean).length >= 3);
});
test('assign: a needle board is never placed before level 276', () => {
  const p = pool(500, 3); for (const c of p.cands) { c.needle = true; }
  const A = MB.assign({ pool: p, dfsMs: 1000, saMs: 6000, rounds: 2 }); A.seq.forEach((c, i) => { if (c) assert.ok(250 + i >= 276, 'needle at ' + (250 + i)); });
});
test('jobName is stable', () => { assert.equal(MB.jobName({ si: 12, layout: 41, seed: 2, dial: [5, 3] }), '12-41-2-d5_3.json'); });
