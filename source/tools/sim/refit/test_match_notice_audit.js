'use strict';
const assert = require('assert/strict');
const { auditRecording, visibleMatches } = require('./match_notice_audit.js');
const L = require('../../../www/layouts.js');
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
const initial = { a: [1, 1, 1], d: [0, 0, 0], f: [0, 0, 1], tr: [], p: -1, m: 0, ob: null, ck: null };
const events = [[0, 'tap', [0, 0, '']], [1, 'state', { a: [[0, 0]], tr: [0], m: 1 }],
  [2, 'tap', [2, 0, '']], [3, 'state', { a: [[2, 0]], tr: [0, 2], m: 2 }], [4, 'tap', [1, 0, '']]];
const record = { seq: 0, t: 100, data: JSON.stringify({ init: { key: 'L10', at: 1, state: initial, tiles: tiles.map(tile => [tile.x, tile.y, tile.z]) }, events }) };
const audit = auditRecording([record]);
assert.equal(audit.counts.noClock.opportunities, 2);
assert.equal(audit.counts.noClock.otherTaps, 1);
assert.equal(audit.counts.noClock.matchTaps, 1);
const hidden = { ...initial, a: [0, 1, 1], d: [0, 1, 0], tr: [0] };
assert.deepEqual(visibleMatches(tiles, L.neighbors(tiles), hidden), []);
assert.deepEqual(visibleMatches(tiles, L.neighbors(tiles), { ...hidden, p: 1 }), [1]);
assert.deepEqual(visibleMatches(tiles, L.neighbors(tiles), { ...hidden, p: 1, ob: { left: { 1: 1 }, locks: [] } }), []);
const moreTiles = [...tiles, { x: 12, y: 0, z: 0 }];
const novelEvents = [[0, 'tap', [0, 0, '']], [1, 'state', { a: [[0, 0]], tr: [0], m: 1 }],
  [2, 'tap', [2, 0, '']], [3, 'state', { p: 2 }], [4, 'tap', [3, 0, '']], [5, 'state', { p: 3 }], [6, 'tap', [2, 0, '']]];
const novelRecord = { seq: 0, t: 100, data: JSON.stringify({ init: { key: 'L10', at: 1,
  state: { ...initial, a: [1, 1, 1, 1], d: [0, 0, 1, 1], f: [0, 0, 1, 1] },
  tiles: moreTiles.map(tile => [tile.x, tile.y, tile.z]) }, events: novelEvents }) };
const novelty = auditRecording([novelRecord]).counts.noClock;
assert.equal(novelty.novelFlipTaps, 2);
assert.equal(novelty.reopenFlipsInstead, 1);
assert.equal(novelty.novelOpportunities, 2);
console.log('PASS visible-match diagnostic: pre-action state, hidden pictures and ice constraints');
