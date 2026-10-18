'use strict';
const assert = require('assert/strict');
const { tableVersion, fixedEarlyLevel } = require('./board_versions.js');
const { designed } = require('./boards.js');
const { boardId } = require('./personal_model.js');
const { progressionTargets } = require('./progression_targets.js');
for (const version of ['1.55', '1.56', '1.57', '1.58']) {
  assert.equal(tableVersion(version), '1.55');
  for (const level of [51, 53, 69, 70, 80, 106, 128, 269]) assert.equal(boardId(designed(version, level)), boardId(designed('1.55', level)));
  assert.equal(progressionTargets([{ k: 'start', lv: 128, at: 1, v: version, t: 1 }], { level: 128 }).version, '1.55');
}
assert.equal(tableVersion('1.59'), '1.59');
assert.equal(designed('1.59', 128), null);
assert.throws(() => progressionTargets([{ k: 'start', lv: 128, v: '1.59', t: 1 }], { level: 128 }));
assert.equal(fixedEarlyLevel('1.57', 51), true);
assert.equal(fixedEarlyLevel('1.57', 53), true);
assert.equal(fixedEarlyLevel('1.57', 52), false);
assert.equal(fixedEarlyLevel('1.54', 53), false);
assert.equal(fixedEarlyLevel('1.58', 53), true);
console.log('PASS fixed-board versions: verified aliases, early tables and refusal to assume future compatibility');
