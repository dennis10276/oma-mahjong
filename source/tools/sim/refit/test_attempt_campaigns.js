'use strict';
const assert = require('assert/strict');
const { campaignsOf } = require('./attempt_campaigns.js');
const { normalizeAttempts } = require('./attempt_count_labels.js');
const { includePendingOpenings } = require('./prospective_openings.js');
const event = (k, t, at, aid, extra = {}) => ({ k, t, at, aid, lv: 91, v: '1.55', ...extra });
const missing = [event('start', 10, 1, 'initial'), event('start', 100, 2, 'second'),
  event('end', 120, 2, 'second', { r: 'stuck' }), event('end', 200, 21, 'won', { r: 'win' })];
const first = campaignsOf(missing)[0];
assert.equal(first.start, 10);
assert.equal(first.firstCounter, 1);
assert.equal(normalizeAttempts(first.firstCounter, 21, first.confirmedOpening).wonOn, 21);
assert(first.campaignAids.includes('initial'));
assert.equal(includePendingOpenings('person', [first], missing).length, 1);
const resumed = campaignsOf([event('start', 10, 1, 'original'), event('end', 20, 1, 'original', { r: 'stuck' }),
  event('start', 100, 1, 'resumed', { res: true }), event('end', 101, 1, 'resumed', { r: 'stuck' }),
  event('start', 102, 2, 'second'), event('end', 120, 2, 'second', { r: 'win' })]);
assert.equal(resumed.length, 1);
assert.equal(resumed[0].events.length, 2);
assert.equal(resumed[0].start, 10);
assert.deepEqual(resumed[0].campaignAids, ['original', 'resumed', 'second']);
const replay = campaignsOf([...missing, event('start', 300, 22, 'replay'),
  event('end', 350, 24, 'replay-win', { r: 'win' })]);
assert.equal(replay.length, 2);
assert.equal(normalizeAttempts(replay[1].firstCounter, 24, replay[1].confirmedOpening).wonOn, 3);
const interleaved = campaignsOf([event('start', 1, 1, 'new'), event('end', 2, 1, 'new', { r: 'stuck' }),
  event('end', 3, 10, 'old', { lv: 53, r: 'win' }), event('end', 4, 2, 'new2', { r: 'win' })]);
assert.equal(interleaved.filter(row => row.lv === 91).length, 1);
assert.equal(campaignsOf([event('start', 10, 1, 'pending')])[0].events.length, 0);
const reset = campaignsOf([event('start', 1, 12, 'older'), event('start', 10, 1, 'reset'),
  event('end', 20, 1, 'reset', { r: 'win' })]);
assert.equal(reset.length, 2);
assert.equal(reset[1].firstCounter, 1);
const missingOpening = campaignsOf([event('end', 100, 1, 'first', { r: 'stuck', dur: 0.05 }),
  event('start', 110, 2, 'second'), event('end', 120, 2, 'second', { r: 'win' })])[0];
assert.equal(missingOpening.opening, undefined);
assert.equal(missingOpening.start, 50);
assert.equal(missingOpening.firstCounter, 1);
console.log('PASS campaign opening, missing ends, resumed duplicates, replay counters and interleaving');
