'use strict';
const assert = require('assert/strict');
const fixture = require('./fixtures/tray-intent-bee150.json');
const { masksOf } = require('./personal_tray_intents_choice.js');
const { componentsOf } = require('./personal_clock_intents_choice.js');
const { clockPrefix } = require('./personal_joint_intents_first.js');
const masks = masksOf(fixture.decision), selected = fixture.decision.k;
assert.equal(masks[1][selected], false);
assert.equal(masks[2][selected], false);
assert(componentsOf(fixture.decision.F.map(() => 1 / fixture.decision.F.length), masks)[0][selected] > 0);
const frames = [
  { index: 0, kind: 'flip', moves: 0, alive: [1, 1, 1], tray: [], openPeek: 0 },
  { index: 1, kind: 'take', moves: 1, alive: [1, 0, 1], tray: [3], openPeek: 0 },
  { index: 2, kind: 'take', moves: 2, alive: [1, 0, 0], tray: [], openPeek: 0 },
];
const clock = { i: 1, n: 4 }, expected = clockPrefix(frames, clock);
assert.equal(expected.frames, 2);
assert.deepEqual(clockPrefix([...frames.slice(0, 2), { ...frames[2], index: 99 }], clock), expected);
assert.notEqual(clockPrefix([{ ...frames[0], index: 2 }, ...frames.slice(1)], clock).hash, expected.hash);
assert.equal(clockPrefix(frames, { i: 0, n: 4 }).frames, 3);
assert.deepEqual(clockPrefix(frames, null), { hash: null, frames: 0 });
console.log('PASS confirmed bee remains ordinary optional behavior; clock-prefix hashes include actual taps only through clock removal/failure');
