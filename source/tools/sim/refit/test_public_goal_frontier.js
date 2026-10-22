'use strict';
const assert = require('assert/strict'), Layouts = require('../../../www/layouts.js');
const { frontierFor, recoveryDepth } = require('./public_goal_frontier.js');
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 8, y: 0, z: 1 },
  { x: 24, y: 0, z: 0 }, { x: 32, y: 0, z: 0 }];
const game = { tiles, nb: Layouts.neighbors(tiles), clock: { i: 0, n: 6 },
  rules: { locks: new Set([0]), keys: [1, 3], ice: { 3: 1 }, iceNb: [[], [], [], [4], []] } };
Object.defineProperty(game, 'faces', { get() { throw Error('Read private pictures'); } });
const state = { alive: [1, 1, 1, 1, 1], relieved: false, tray: [9, 8], pictures: [9, null, null, null, null] };
assert.deepEqual([...frontierFor(game, state, 0)].sort(), [0, 1, 2, 3, 4]);
assert.equal(recoveryDepth(game, state).knownCost, 4);
assert.equal(recoveryDepth(game, state).unknownWaiting, 1);
const thawed = { ...state, alive: [1, 1, 1, 1, 0] };
assert.deepEqual([...frontierFor(game, thawed, 0)].sort(), [0, 1, 2, 3]);
const relieved = { ...state, relieved: true };
assert.deepEqual([...frontierFor(game, relieved, 0)], [0]);
assert.equal(recoveryDepth(game, relieved).knownCost, 0);
const removed = { ...state, alive: [0, 1, 1, 1, 1] };
assert.equal(frontierFor(game, removed, 0).size, 0);
const circular = { ...game, rules: { ...game.rules, locks: new Set([0, 1]), keys: [0, 1] } };
assert(frontierFor(circular, state, 0).size <= tiles.length);
assert.throws(() => frontierFor(game, state, -1));
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const flatTiles = [0, 8, 16, 24].map(horizontal => ({ x: horizontal, y: 0, z: 0 }));
const flat = { tiles: flatTiles, nb: Layouts.neighbors(flatTiles), rules: null, clock: null };
Object.defineProperty(flat, 'faces', { get() { throw Error('Read actual deck'); } });
const flatState = { alive: [1, 1, 1, 1], down: [0, 0, 0, 0], pictures: [1, 1, 2, 3],
  tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
const rankControl = search(flat, flatState, [0, 1, 2, 3].map(index => ({ index })),
  { ...REFERENCE_PARAMETERS, taps: 2, nodes: 32, beam: 16, finishKnown: false, pruneDead: false, goalRecovery: true });
assert.deepEqual(rankControl.goalAudit.recoveryRankWidths, [10], 'Empty and occupied trays must use identical ranking axes');
const prospective = search(flat, flatState, [0, 1, 2, 3].map(index => ({ index })),
  { ...REFERENCE_PARAMETERS, taps: 2, nodes: 32, beam: 16, finishKnown: false, pruneDead: false, goalRecovery: true, goalRecoveryMin: 2 });
assert.equal(prospective.goalAudit.goalRecoveryActive, true, 'An empty root tray must not disable safety for occupied hypothetical trays');
assert.deepEqual(prospective.goalAudit.recoveryRankWidths, [10], 'Below-threshold candidates retain neutral values on the same ranking axes');
assert.throws(() => search(flat, flatState, [{ index: 0 }], { ...REFERENCE_PARAMETERS, goalRecoveryMin: 4 }));
assert.throws(() => search(flat, flatState, [{ index: 0 }], { ...REFERENCE_PARAMETERS, goalRecovery: 'yes' }));
console.log('PASS public goal frontiers include buried key and thaw dependencies, update after removals/relief, terminate on cycles and never inspect concealed identities');
