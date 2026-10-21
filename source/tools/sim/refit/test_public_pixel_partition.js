'use strict';
const assert = require('assert/strict');
const { compile } = require('./public_pixel_partition.js');
const alphabet = [1, 2, 3], mask = [1, 0];
const templates = [{ picture: 1, pixels: [10, 20, 30, 255, 1, 2, 3, 255] },
  { picture: 2, pixels: [10, 20, 30, 255, 4, 5, 6, 255] },
  { picture: 3, pixels: [30, 20, 10, 255, 7, 8, 9, 255] }];
const reader = compile(templates, mask, alphabet);
assert.deepEqual(reader(templates[0].pixels).pictures, [1, 2]); assert.equal(reader(templates[0].pixels).known, null);
assert.deepEqual(reader(templates[0].pixels), reader(templates[1].pixels));
assert.equal(reader(templates[2].pixels).known, 3);
const extraHidden = templates.map(template => ({ ...template, pixels: template.pixels.slice(0, 4).concat([90, 91, 92, 255]) }));
assert.equal(compile(extraHidden, mask, alphabet).dictionaryId, reader.dictionaryId);
assert.deepEqual(compile(extraHidden, mask, alphabet)(templates[0].pixels), reader(templates[0].pixels));
const hidden = compile(templates, [0, 0], alphabet);
assert.equal(hidden(templates[0].pixels).reason, 'noSafeVisiblePixels');
assert.deepEqual(hidden(templates[0].pixels).pictures, alphabet);
assert.equal(compile(templates, [1, 1], alphabet)(templates[1].pixels).known, 2);
const mismatch = reader([99, 99, 99, 255, 0, 0, 0, 255]);
assert.equal(mismatch.reason, 'outsideDictionary'); assert.equal(mismatch.known, null); assert.deepEqual(mismatch.pictures, alphabet);
const mutated = reader(templates[0].pixels); mutated.pictures.push(101);
assert.deepEqual(reader(templates[0].pixels).pictures, [1, 2]);
assert.throws(() => compile(templates.slice(0, 2), mask, alphabet));
assert.throws(() => compile(templates, [1, 2], alphabet));
assert.throws(() => reader([NaN, 0, 0, 255, 0, 0, 0, 255]));
console.log('PASS pixel recognition keeps indistinguishable symbols ambiguous, retains useful partial information and never hashes hidden pixels into dictionary identity');
