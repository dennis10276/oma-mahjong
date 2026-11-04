'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { layoutKey, puzzleKey, originOf, checkOrigin, compare, assertOriginalBatch } = require('./originality.js');
function board() {
  return { tiles: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [2, 2, 0], [1, 1, 1], [3, 1, 1]],
    faces: [1, 2, 3, 1, 2, 3], down: [0], obst: { ice: { 4: 1 }, keys: [0, 3], locks: [2] }, clock: { i: 2, n: 5 } };
}
const row = (d, id = 'fresh/200') => ({ level: 200, recipe: ['chainReaction'], design: d, origin: originOf(d, id, 'A new key and ice route', 777) });
test('cosmetic picture changes and mirrors are not new puzzles', () => {
  const d = board(), reskin = { ...d, faces: d.faces.map(f => f + 10) }, mirror = { ...d, tiles: d.tiles.map(([x, y, z]) => [8 - x, y, z]) };
  assert.equal(puzzleKey(d), puzzleKey(reskin)); assert.equal(layoutKey(d), layoutKey(mirror));
  assert.equal(compare(row(d), row(reskin, 'fresh/201')), 'sameLayout');
  assert.throws(() => assertOriginalBatch([row(d), row(mirror, 'fresh/201')]), /sameLayout/);
});
test('a shortened big board cannot inherit a fresh-design claim', () => {
  const d = board(), r = row(d);
  r.design = { ...d, tiles: d.tiles.slice(0, 4), faces: d.faces.slice(0, 4) };
  assert.equal(checkOrigin(r), 'changedOrTrimmedLayout');
  assert.throws(() => assertOriginalBatch([r]), /TrimmedLayout/);
});

test('overlap is symmetric even when widths differ and opposite edges line up', () => {
  const a = { tiles: [0, 12, 14, 16, 18, 20].map(x => [x, 0, 0]), faces: [0, 1, 2, 3, 4, 5] };
  const b = { ...a, tiles: [0, 2, 4, 6, 8, 10].map(x => [x, 0, 0]) };
  assert.equal(compare(row(a), row(b)), 'tooMuchSharedLayout');
  assert.equal(compare(row(b), row(a)), 'tooMuchSharedLayout');
});
test('historical inventory and several versions of one seed cannot fill a batch', () => {
  const d = board();
  assert.equal(checkOrigin({ design: d, seedSource: 'inventory' }), 'missingFreshDesign');
  const a = row(d), b = row({ ...d, clock: { ...d.clock, n: 6 } }); b.level = 201;
  assert.throws(() => assertOriginalBatch([a, b]), /one design/);
  a.origin.transforms = ['trimmed tail']; assert.equal(checkOrigin(a), 'derivedBoard');
});
