'use strict';
const assert = require('assert/strict');
const { knownMask } = require('./public_pixel_capture.js');
const observation = (pictures, reason = 'ambiguousPixels') => ({ type: 'publicPixelPartition-v1', pictures,
  known: reason === 'identified' ? pictures[0] : null, visiblePixels: reason === 'noSafeVisiblePixels' ? 0 : 40, reason });
const rows = [{ index: 0, alive: true, observation: observation([2], 'identified') },
  { index: 1, alive: true, observation: observation([2, 4]) }, { index: 2, alive: false, observation: null }];
for (const row of rows) Object.defineProperty(row, 'actualFace', { get() { throw new Error('Private picture metadata'); } });
assert.deepEqual(knownMask(rows), [1, 0, 0]);
assert.deepEqual(knownMask([{ index: 0, alive: true, observation: observation([2, 4], 'outsideDictionary') }]), [0]);
assert.deepEqual(knownMask([{ index: 0, alive: true, observation: observation([2, 4], 'noSafeVisiblePixels') }]), [0]);
assert.throws(() => knownMask([{ ...rows[0], index: 1 }]));
assert.throws(() => knownMask([{ ...rows[1], observation: { ...rows[1].observation, known: 2 } }]));
assert.throws(() => knownMask([{ ...rows[0], observation: observation([2, 4], 'identified') }]));
assert.throws(() => knownMask([{ ...rows[0], observation: observation([999], 'identified') }]));
assert.throws(() => knownMask([{ index: 0, alive: false, observation: rows[0].observation }]));
console.log('PASS screenshot-observation bridge derives knowledge only from validated singleton public pixel classes and preserves unknown/dead tiles without private metadata');
