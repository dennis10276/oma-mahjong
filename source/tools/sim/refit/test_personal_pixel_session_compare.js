'use strict';
const assert = require('assert/strict');
const { physicalControlOf } = require('./personal_pixel_session_compare.js');
const fixture = { name: 'control', frames: [{ position: 0, frame: { tray: [], moves: 3 }, memory: [2, null],
  plan: { index: 0, path: [0, 1], nodes: 8, note: 'old diagnostic' } }],
  final: { win: true }, stopped: null, audit: { physicalLog: [{ index: 0 }] } };
const diagnostic = structuredClone(fixture); diagnostic.frames[0].plan.note = 'new diagnostic'; diagnostic.frames[0].plan.nodes = 12;
assert.deepEqual(physicalControlOf(diagnostic), physicalControlOf(fixture));
for (const change of [value => { value.frames[0].plan.index = 1; }, value => { value.frames[0].plan.path = [0, 2]; },
  value => { value.frames[0].memory[0] = 4; }, value => { value.frames[0].frame.moves = 2; },
  value => { value.audit.physicalLog[0].index = 1; }, value => { value.final.win = false; }]) {
  const different = structuredClone(fixture); change(different);
  assert.notDeepEqual(physicalControlOf(different), physicalControlOf(fixture));
}
console.log('PASS physical control comparison preserves every tap, witness path, memory state, physical frame, raw audit and terminal outcome without claiming plan-report or pixel equality');
