'use strict';
const assert = require('assert/strict');
const { firstDivergence } = require('./personal_handoff_first.js');
const { checkFirst } = require('./personal_handoff_count_data.js');
const frames = [
  { index: 0, kind: 'flip', moves: 0, alive: [1, 1], tray: [], openPeek: 0 },
  { index: 1, kind: 'take', moves: 1, alive: [1, 0], tray: [3], openPeek: 0 },
];
assert.equal(firstDivergence(frames, structuredClone(frames), [null, null]), null);
const changed = [frames[0], { ...frames[1], index: 0 }], cue = { type: 'newTrayMate', clock: false, recipients: [2] };
assert.deepEqual(firstDivergence(frames, changed, [null, cue]), { index: 1, cue, before: 1, after: 0 });
assert.throws(() => firstDivergence(frames, changed, [null, null]), /eligible public handoff cue/);
assert.throws(() => firstDivergence(frames, frames.slice(0, 1), [null]), /without an earlier changed physical tap/);
assert.throws(() => firstDivergence(frames, frames, [null]), /correspond exactly/);
assert.throws(() => firstDivergence(frames, [frames[0], { ...frames[1], tray: [7] }], [null, null]), /eligible public handoff cue/);
checkFirst({ first: 0.5 }, [{ win: true }, { win: false }], 2);
assert.throws(() => checkFirst({ first: 1 }, [{ win: true }, { win: false }], 2), /first-attempt survival/);
assert.throws(() => checkFirst({ first: 1 }, [{ win: true }], 2));
console.log('PASS first physical handoff divergence requires an actual public cue; unrelated path or length changes fail');
