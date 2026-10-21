'use strict';
const assert = require('assert/strict'), Layouts = require('../../../www/layouts.js');
const { analyze } = require('./public_dead_end.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const { legal } = require('./known_tray_plan.js');
const tiles = [{ x: 0, y: 0, z: 3 }, { x: 8, y: 0, z: 2 }, { x: 0, y: 0, z: 2 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }];
const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
Object.defineProperty(game, 'faces', { get() { throw new Error('Private board read'); } });
const state = { alive: tiles.map(() => 1), pictures: [1, 2, 1, 4, 5, 2, 6], down: [1, 1, 0, 0, 0, 0, 0],
  tray: [4, 5, 6], moves: 3, openPeek: -1, relieved: false, arriving: [] };
const actionsOf = position => legal(game, position).free.map(index => ({ index, inspect: true }));
const proof = analyze(game, state, actionsOf(state)); assert(proof.knownDead); assert(proof.lossPath.length >= 2);
assert.equal(analyze(game, state, actionsOf(state), 1).reason, 'bounded');
const unknown = { ...state, pictures: [null, ...state.pictures.slice(1)] };
assert.equal(analyze(game, unknown, actionsOf(unknown)).reason, 'reachableInformation');
const recoverable = { ...state, pictures: [1, 1, 2, 4, 5, 2, 6] };
assert.equal(analyze(game, recoverable, actionsOf(recoverable)).reason, 'safeRemoval');
for (let shift = 0; shift < 36; shift++) {
  const picture = value => (value * 5 + shift) % 36;
  const full = { ...state, pictures: state.pictures.map(picture), tray: state.tray.map(picture) };
  const observed = { ...full, pictures: full.pictures.map((value, index) => index < 2 ? value : null) };
  const certified = analyze(game, observed, actionsOf(observed)); assert(certified.knownDead);
  const independent = analyzeRecovery(game, full, { nodes: 1000 });
  assert(independent.complete && !independent.knownWinningRoute);
}
assert.throws(() => analyze(game, state, actionsOf(state), 0));
console.log('PASS public dead-end proofs exhaust known inspection graphs, reject unknown/bounded/recoverable states and agree with independent full-information recovery graphs');
