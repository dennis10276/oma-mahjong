'use strict';
const assert = require('assert/strict');
const { captureOpening } = require('./public_observed_opening.js');
const { prototype } = require('./personal_pixel_opening_prototype.js');
const { capture } = require('./personal_pixel_partition_audit.js');
const { SYMBOLS } = require('./personal_public_picture_prior.js');
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 6, z: 0 }, { x: -1, y: 0, z: 1 },
  { x: 1, y: 0, z: 1 }, { x: -1, y: 6, z: 1 }, { x: 1, y: 6, z: 1 }];
const observation = pictures => ({ type: 'publicPixelPartition-v1', pictures, visiblePixels: 100,
  known: pictures.length === 1 ? pictures[0] : null, reason: pictures.length === 1 ? 'identified' : 'ambiguousPixels' });
const rows = [[2, 4], [2, 4], [3], [3], [4], [4]].map((pictures, index) => ({ index, alive: true, observation: observation(pictures) }));
const game = { tiles, down: Array(6).fill(0), rules: null, clock: null };
for (const field of ['faces', 'memory', 'nb']) Object.defineProperty(game, field, { get() { throw new Error('Private environment field ' + field); } });
for (const tile of tiles) Object.defineProperty(tile, 'face', { get() { throw new Error('Private tile face'); } });
const observed = captureOpening(game, rows);
assert.deepEqual(observed.snapshot.pictures, [null, null, 3, 3, 4, 4]);
assert.equal(observed.decision.observationVersion, 2);
assert.equal(observed.beliefs[0].weights[2], .5); assert.equal(observed.beliefs[0].weights[4], .5);
assert.equal(observed.beliefs[0].weights[3], 0);
const physicalFirst = { ...game, faces: [2, 2, 3, 3, 4, 4] }, physicalSecond = { ...game, faces: [9, 9, 7, 7, 6, 6] };
assert.deepEqual(captureOpening(physicalFirst, rows), captureOpening(physicalSecond, rows));
const wrongRecognition = rows.map(row => ({ ...row, observation: row.index === 2 ? observation([5]) : row.observation }));
assert.equal(captureOpening(physicalFirst, wrongRecognition).snapshot.pictures[2], 5);
assert.equal(physicalFirst.faces[2], 3);
assert.throws(() => captureOpening(game, [{ ...rows[0], alive: false }, ...rows.slice(1)]));
assert.throws(() => captureOpening(game, [{ ...rows[0], observation: { ...rows[0].observation, known: 2 } }, ...rows.slice(1)]));
const mask = [0, 0, 1, 1, 1, 1], engine = prototype().engine;
const controls = SYMBOLS.map(picture => capture(engine, tiles, picture, mask));
for (const control of controls) {
  assert.deepEqual(control.snapshot, observed.snapshot);
  const { observationVersion: priorVersion, ...before } = control.decision;
  const { observationVersion: currentVersion, ...after } = observed.decision;
  assert.deepEqual(before, after);
}
console.log('PASS observed-value opening capture never reads hidden faces, preserves recognized mistakes, retains ambiguous beliefs, marks a distinct observer version and passes37 filler controls');
