'use strict';
const assert = require('assert/strict');
const L = require('../../../www/layouts.js');
const { visibleKnowledge, exitsOf, auditTrace, summarize } = require('./physical_tray_audit.js');
const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
const game = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 0, 1, 2, 3, 3], down: Array(8).fill(0) };
const state = { alive: [0, 0, 0, 1, 1, 1, 1, 1], tray: [0, 1, 2], openPeek: -1, moves: 3 };
assert.equal(exitsOf(game, state, Array(8).fill(1)).kind, 'knownSafeExit');
const hidden = { ...game, down: [0, 0, 0, 1, 1, 1, 0, 0] }, known = Array(8).fill(0);
visibleKnowledge(hidden, state, known);
assert.equal(exitsOf(hidden, state, known).matches.length, 0);
assert.equal(exitsOf(hidden, state, known).kind, 'novelInspection');
const changed = { ...hidden, faces: [0, 1, 2, 2, 0, 1, 3, 3] };
assert.deepEqual(exitsOf(changed, state, known), exitsOf(hidden, state, known));
const frames = [
  { alive: [0, 1, 1, 1, 1, 1, 1, 1], tray: [0], openPeek: -1, moves: 1, index: 0, kind: 'take' },
  { alive: [0, 0, 1, 1, 1, 1, 1, 1], tray: [0, 1], openPeek: -1, moves: 2, index: 1, kind: 'take' },
  { ...state, index: 2, kind: 'take' },
  { alive: [0, 0, 0, 1, 1, 1, 0, 1], tray: [0, 1, 2, 3], openPeek: -1, moves: 4, index: 6, kind: 'take' },
];
const result = auditTrace(game, frames, { why: 'tray', left: 4 });
assert.equal(result.fatal.exitClass, 'knownSafeExit');
assert.equal(result.fatal.knownMatches, 3);
assert.equal(summarize([result]).fatalExits.knownSafeExit, 1);
assert.equal(summarize([result]).trayLossNearEnd12, 1);
assert.equal(summarize([]).eligible, 0);
assert.equal(auditTrace({ ...game, faces: [101, ...game.faces.slice(1)] }, [], {}).excluded, 'wildcardPhysics');
console.log('PASS physical tray audit: pre-action knowledge, hidden-picture invariance, known exits and explicit wildcard exclusions');
