'use strict';
const assert = require('assert/strict');
const L = require('../../../www/layouts.js');
const { exits, auditFailure } = require('./failure_audit.js');
const tiles = Array.from({ length: 7 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
const state = { a: [0, 0, 0, 1, 1, 1, 1], d: [0, 0, 0, 0, 1, 1, 0], f: [0, 1, 2, 3, 0, 3, 0],
  tr: [0, 1, 2], p: -1, m: 3, ob: null, ck: null };
const before = exits(tiles, L.neighbors(tiles), state, [0, 0, 0, 0, 0, 1, 0]);
assert.deepEqual(before.visibleMatches, [6]);
assert.deepEqual(before.rememberedPairs, [[3, 5]]);
assert.deepEqual(before.novelFlips, [4]);
const swapped = { ...state, f: [0, 1, 2, 3, 2, 3, 0] };
assert.deepEqual(exits(tiles, L.neighbors(tiles), swapped, [0, 0, 0, 0, 0, 1, 0]), before);
const record = (initial, events) => [{ seq: 0, t: 10, data: JSON.stringify({ init: { key: 'L91', at: 2,
  state: initial, tiles: tiles.map(tile => [tile.x, tile.y, tile.z]) }, events }) }];
const events = [[0, 'tap', [3, 0, '']], [1, 'state', { a: [[3, 0]], tr: [0, 1, 2, 3], m: 4 }], [2, 'end', { r: 'stuck' }]];
const failed = auditFailure(record(state, events));
assert.equal(failed.mechanism, 'tray');
assert.equal(failed.exitClass, 'visibleSafeExit');
assert.equal(failed.lastTake.tray, 3);
assert.equal(failed.lastTake.clicked, 3);
assert.equal(auditFailure(record({ ...state, ck: { i: 6, n: 4 } }, [...events.slice(0, 2), [2, 'end', { r: 'stuck', ck: 1 }]])).mechanism, 'clock');
assert.equal(auditFailure(record(state, [...events.slice(0, 1), [0, 'hint', {}], ...events.slice(1)])), null);
const locked = exits(tiles, L.neighbors(tiles), { ...state, ob: { locks: [6], keys: [], unlocked: false, left: { 4: 1 } } }, []);
assert.deepEqual(locked.visibleMatches, []);
assert.deepEqual(locked.novelFlips, [5]);
console.log('PASS failed-tap diagnostic: pre-action exits, clock mechanism, hidden pictures and assistance');
