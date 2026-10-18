'use strict';
const assert = require('assert/strict');
const { targetsFor } = require('./count_profile_prospective.js');
const events = [{ k: 'end', lv: 51, r: 'win', at: 1, t: 0, v: '1.53' }, { k: 'end', lv: 97, r: 'win', at: 4, t: 1, v: '1.55' },
  { k: 'start', lv: 54, at: 3, t: 2, v: '1.55' }, { k: 'end', lv: 200, m: 'd', t: 3, v: '1.55', r: 'win' }];
const targets = targetsFor(events, 24);
assert.equal(targets.first, 55);
assert(targets.levels.includes(55));
assert(targets.levels.includes(78));
assert(targets.levels.includes(97));
assert(targets.levels.includes(51));
assert(targets.levels.includes(54));
assert(!targets.levels.includes(200));
assert.equal(new Set(targets.levels).size, targets.levels.length);
assert.throws(() => targetsFor([{ k: 'start', lv: 54, at: 1, t: 4, v: 'unknown' }], 24));
assert.equal(targetsFor([{ k: 'end', lv: 53, at: 10, r: 'win', t: 4, v: '1.55' }], 24).first, 54);
console.log('PASS profile forecast coverage: actual current target, fixed replay boards and daily exclusion');
