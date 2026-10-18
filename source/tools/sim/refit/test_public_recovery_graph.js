'use strict';
const assert = require('assert/strict'), L = require('../../../www/layouts.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const { advance } = require('./known_tray_plan.js');
const pictures = [0, 3, 4, 1, 1], tiles = pictures.map((value, index) => ({ x: index * 4, y: 0, z: 0 }));
const game = { tiles, nb: L.neighbors(tiles) };
const state = { pictures, alive: pictures.map(() => 1), down: pictures.map(() => 0),
  tray: [0, 3, 4], moves: 0, openPeek: -1, relieved: false, arriving: [] };
const report = analyzeRecovery(game, state);
assert(report.complete && report.knownWinningRoute);
assert.deepEqual(report.productiveWinningFirstActions, [0, 1, 2]);
assert(report.firstActions.filter(action => !action.knownWinningRoute).every(action => action.lost));
for (const action of report.firstActions.filter(action => action.knownWinningRoute)) {
  let position = state;
  for (const index of action.witness) {
    const moved = advance(game, position, index);
    assert(!moved.uncertain && !moved.lost); position = moved.state;
  }
  assert(!position.alive.some(Boolean) && position.tray.length === 0);
}
const unknown = analyzeRecovery(game, { ...state, pictures: [null, ...pictures.slice(1)] });
assert(!unknown.complete && unknown.uncertainTransitions > 0);
assert.equal(unknown.firstActions[0].uncertain, 'unseenPicture');
const bounded = analyzeRecovery(game, state, { nodes: 1 });
assert(!bounded.complete && bounded.boundary && !bounded.knownWinningRoute);
const inspected = analyzeRecovery(game, { ...state, down: [0, 0, 0, 1, 1] });
assert(inspected.complete && inspected.knownWinningRoute);
assert(inspected.firstActions.find(action => action.index === 3).knownWinningRoute);
assert.equal(inspected.firstActions.find(action => action.index === 3).removed, 0);
assert.throws(() => analyzeRecovery(game, state, { nodes: 0 }));
console.log('PASS public recovery graph retains inspection detours, verifies witnesses and refuses unknown/bounded uniqueness claims');
