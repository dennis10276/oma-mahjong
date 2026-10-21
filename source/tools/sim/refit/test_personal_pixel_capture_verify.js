'use strict';
const assert = require('assert/strict');
const { supportOf } = require('./personal_pixel_capture_verify.js');
const { SYMBOLS } = require('./personal_public_picture_prior.js');
const bank = { rectangle: { left: 0, top: 0, width: 1, height: 1 }, mask: [1], tolerance: 1,
  templates: SYMBOLS.map(picture => ({ picture, pixels: [picture === 2 ? 10 : 20, 0, 0, 255] })) };
const image = { width: 1, height: 1, data: [10, 0, 0, 255] };
Object.defineProperty(bank, 'actualFace', { get() { throw Error('Private truth'); } });
assert.deepEqual(supportOf(bank, image), { pictures: [2], known: 2, visiblePixels: 1, reason: 'identified' });
assert.equal(supportOf(bank, { ...image, data: [11, 0, 0, 255] }).known, 2);
assert.equal(supportOf(bank, { ...image, data: [12, 0, 0, 255] }).reason, 'outsideDictionary');
assert.equal(supportOf({ ...bank, mask: [0] }, image).reason, 'noSafeVisiblePixels');
const ambiguous = { ...bank, templates: bank.templates.map(row => row.picture === 4 ? { ...row, pixels: [10, 0, 0, 255] } : row) };
assert.deepEqual(supportOf(ambiguous, image).pictures, [2, 4]);
assert.throws(() => supportOf({ ...bank, mask: [2] }, image));
assert.throws(() => supportOf({ ...bank, tolerance: 5 }, image));
assert.throws(() => supportOf({ ...bank, templates: bank.templates.slice(1) }, image));
console.log('PASS independent pixel replay checks every public candidate with direct arithmetic, preserves ambiguity and rejects changed alphabets, masks or noise bounds without private truth');
