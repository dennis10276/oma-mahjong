'use strict';
const assert = require('assert/strict');
const { prefixOf, isNewInitial } = require('./personal_prefix_data.js');
const initial = { key: 'L91', partial: false, track: '', ez: 0, at: 7,
  tiles: Array.from({ length: 4 }, (_, index) => [index * 4, 0, 0]), gold: [0, 1],
  state: { a: [1, 1, 1, 1], d: [0, 0, 0, 0], f: [0, 0, 1, 1], tr: [], p: -1, m: 0, ob: null, ck: null } };
const removed = index => [[index * 10, 'tap', [index, 0, '']], [index * 10 + 1, 'state', { a: [[index, 0]], m: index + 1 }]];
const chunk = (seq, t, events, init) => ({ seq, t, data: JSON.stringify({ events, ...(init ? { init } : {}) }) });
const record = events => [chunk(0, 100, events, initial)];
const restart = prefixOf(record([...removed(0), ...removed(1), [21, 'end', { r: 'restart' }]]));
assert.deepEqual(restart.take, [0, 1]);
assert.equal(restart.ending, 'restart');
assert.equal(restart.complete, true);
assert.equal(restart.at, 7);
assert.deepEqual(restart.gold, [0, 1]);
const helped = prefixOf([chunk(0, 100, [...removed(0), [2, 'hint', [2, 3]], ...removed(2)], initial),
  chunk(1, 500, [...removed(3), [40, 'end', { r: 'win' }]])]);
assert.deepEqual(helped.take, [0]);
assert.equal(helped.availableAt, 500);
assert.equal(helped.ending, null);
assert.equal(helped.stopReason, 'hint');
for (const stop of ['auto', 'nudge', 'shuffle', 'rescue', 'truncated', 'help', 'clock-help']) {
  const stopped = prefixOf(record([...removed(0), [3, stop, null], ...removed(1)]));
  assert.deepEqual(stopped.take, [0]);
  assert.equal(stopped.stopReason, stop);
}
const unfinished = prefixOf(record(removed(0)));
assert.equal(unfinished.complete, false);
assert.equal(unfinished.stopReason, 'incomplete');
assert.equal(unfinished.ending, null);
const gap = prefixOf([chunk(0, 100, removed(0), initial), chunk(2, 200, removed(1))]);
assert.deepEqual(gap.take, [0]);
assert.equal(gap.stopReason, 'chunkGap');
assert.equal(gap.availableAt, 200);
assert.equal(prefixOf([chunk(1, 100, removed(0), initial)]), null);
assert.equal(prefixOf([chunk(-1, 100, removed(0), initial)]), null);
assert.equal(prefixOf([chunk(0, 100, removed(0), initial), chunk(0, 101, removed(1), initial)]), null);
assert.deepEqual(prefixOf([chunk(0, 100, removed(0), initial), chunk(0, 101, removed(0), initial)]).take, [0]);
for (const patch of [{ partial: true }, { track: 'other' }, { ez: 1 }, { key: 'D91' }]) {
  assert.equal(prefixOf([chunk(0, 100, removed(0), { ...initial, ...patch })]), null);
}
const unknownRemoval = prefixOf(record([...removed(0), [4, 'state', { a: [[2, 0]] }], ...removed(1)]));
assert.equal(unknownRemoval.stopReason, 'unattributedAction');
assert.deepEqual(unknownRemoval.take, [0]);
const flipped = prefixOf([chunk(0, 100, [[1, 'tap', [2, 0, '']], [2, 'state', { p: 2 }]],
  { ...initial, state: { ...initial.state, d: [0, 0, 1, 1] } })]);
assert.deepEqual(flipped.take, [-3]);
assert.equal(flipped.manualChoices, 1);
const progression = [{ k: 'end', lv: 105, r: 'win', t: 10 }, { k: 'end', lv: 200, r: 'win', m: 'd', t: 11 }];
assert.equal(isNewInitial(progression, { lv: 106, at: 1, t: 20 }), true);
assert.equal(isNewInitial(progression, { lv: 106, at: 2, t: 20 }), false);
assert.equal(isNewInitial(progression, { lv: 53, at: 1, t: 20 }), false);
assert.equal(isNewInitial([...progression, { k: 'end', lv: 106, r: 'win', t: 21 }], { lv: 106, at: 1, t: 20 }), true);
console.log('PASS natural prefixes: assistance boundaries, restarts, incomplete recordings, availability and chunk integrity');
