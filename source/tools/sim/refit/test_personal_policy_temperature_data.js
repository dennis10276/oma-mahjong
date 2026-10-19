'use strict';
const assert = require('assert/strict');
const { eligibleRows, restoreBoard } = require('./personal_policy_temperature_data.js');
const { boardId } = require('./personal_model.js');
const { boardOf } = require('./mimic_games.js');
const rows = Array.from({ length: 22 }, (unused, index) => ({ name: 'Dennis', lv: index + 1, start: index * 2,
  end: index * 2 + 1, wonOn: 1, firstAttempt: 1, firstClear: true, boardChangedWithinCampaign: false,
  openingRecorded: index > 5 }));
const expected = eligibleRows(rows, 'Dennis', 100);
assert.deepEqual(expected.map(row => row.lv), rows.slice(-20).map(row => row.lv));
assert.equal(expected[0].openingRecorded, false);
assert.deepEqual(eligibleRows([...rows, { ...rows.at(-1), lv: 99, end: 100 }], 'Dennis', 100), expected);
assert.deepEqual(eligibleRows([...rows, ...rows.map(row => ({ ...row, name: 'Other' }))], 'Dennis', 100), expected);
for (const invalid of [
  rows.map(row => ({ ...row, firstClear: false })), rows.map(row => ({ ...row, boardChangedWithinCampaign: undefined })),
  rows.map(row => ({ ...row, assisted: true })), rows.map(row => ({ ...row, lv: 1 })), rows.slice(0, 19),
]) assert.throws(() => eligibleRows(invalid, 'Dennis', 100));
const initial = { tiles: [[0, 0, 0], [2, 0, 0]], state: { f: [1, 1], d: [0, 0], ob: {} } };
const row = { name: 'Dennis', lv: 1, source: 'recorded', board: boardId(boardOf(initial)), campaignAids: ['first'] };
const replays = { first: { zero: { data: JSON.stringify({ init: initial }) } } };
assert.deepEqual(restoreBoard(row, replays), boardOf(initial));
assert.throws(() => restoreBoard({ ...row, board: 'wrong' }, replays));
assert.throws(() => restoreBoard(row, { first: { zero: { data: JSON.stringify({ init: { ...initial, partial: true } }) } } }));
assert.throws(() => restoreBoard(row, {}));
console.log('PASS own policy-count training restores exact prior boards, keeps older fixed-table counts training-only and excludes replays/assistance/future data');
