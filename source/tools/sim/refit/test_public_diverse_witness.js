'use strict';
const assert = require('assert/strict');
const { diverseWitnessSearch } = require('./public_diverse_witness.js');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { legal, advance } = require('./known_tray_plan.js');

function test() {
  const game = {}, state = {}, actions = [{ index: 0 }, { index: 1 }], calls = [];
  let primary = { index: 0, path: [0], nodes: 4, knownWin: false, safeClockExit: false,
    knownDead: false, deadCertificate: null, boundary: true, prunedDeadSuccessors: 1 };
  let alternative = { index: 1, path: [1], nodes: 3, knownWin: false, safeClockExit: false,
    knownDead: false, deadCertificate: null, boundary: false, prunedDeadSuccessors: 2 };
  const guarded = diverseWitnessSearch((inputGame, inputState, inputActions, settings) => {
    assert.equal(inputGame, game); assert.equal(inputState, state); assert.equal(inputActions, actions);
    calls.push(settings); return settings.diverseBeam ? alternative : primary;
  });
  const deadline = Date.now() + 10000, settings = { diverseWitness: true, nodes: 10, deadline };
  const unresolved = guarded(game, state, actions, settings);
  assert.equal(unresolved.index, 0); assert.equal(unresolved.boundary, true); assert(!unresolved.knownDead);
  assert.equal(unresolved.nodes, 7); assert.equal(unresolved.prunedDeadSuccessors, 3);
  assert.deepEqual(calls[1], { diverseWitness: false, diverseBeam: true, nodes: 6, deadline });
  alternative = { ...alternative, knownDead: true, deadCertificate: { exhaustedKnownGraph: true } };
  const noFalseDeath = guarded(game, state, actions, settings);
  assert(!noFalseDeath.knownDead && noFalseDeath.deadCertificate === null);
  alternative = { ...alternative, knownDead: false, deadCertificate: null, knownWin: true };
  assert.equal(guarded(game, state, actions, settings).index, 1);
  alternative = { ...alternative, knownWin: false, safeClockExit: true };
  assert.equal(guarded(game, state, actions, settings).index, 1);
  for (const changes of [{ knownWin: true }, { safeClockExit: true }, { knownDead: true }, { nodes: 10 }]) {
    const saved = primary; primary = { ...saved, ...changes };
    const before = calls.length; assert.equal(guarded(game, state, actions, settings), primary);
    assert.equal(calls.length - before, 1); primary = saved;
  }
  const before = calls.length;
  assert.equal(guarded(game, state, actions, { ...settings, deadline: Date.now() - 1 }), primary);
  assert.equal(calls.length - before, 1);
  assert.equal(guarded(game, state, actions, { nodes: 10 }), primary);
  assert.throws(() => guarded(game, state, actions, { ...settings, diverseWitness: 'yes' }));
  assert.throws(() => guarded(game, state, actions, { ...settings, diverseBeam: true }));
  const tiles = Array.from({ length: 16 }, (value, index) => ({ x: Math.floor(index / 4) * 8, y: 0, z: index % 4 }));
  const observedGame = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(observedGame, field, { get() { throw Error('Private ' + field); } });
  const observed = { alive: tiles.map(() => 1), pictures: [7, 1, 0, 5, 0, 3, 5, 7, 4, 2, 3, 6, 1, 6, 2, 4],
    down: [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0], tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const observedActions = legal(observedGame, observed).free.map(index => ({ index }));
  const real = diverseWitnessSearch((inputGame, inputState, inputActions, configuration) =>
    search(inputGame, inputState, inputActions, { ...configuration, diverseWitness: false }));
  const configuration = { ...REFERENCE_PARAMETERS, nodes: 256, beam: 4, pruneDead: false, knownPairMacros: true, diverseWitness: true };
  const recovered = real(observedGame, observed, observedActions, configuration);
  assert(recovered.knownWin && recovered.diverseWitnessAudit.selected && recovered.nodes <= configuration.nodes);
  let position = observed;
  for (const index of recovered.path) {
    const moved = advance(observedGame, position, index); assert(!moved.uncertain && !moved.lost); position = moved.state;
  }
  assert(!position.alive.some(Boolean) && position.tray.length === 0);
  const capped = real(observedGame, observed, observedActions, { ...configuration, nodes: 35 });
  assert(!capped.knownWin && !capped.knownDead && capped.boundary && capped.nodes <= 35);
  assert.equal(capped.diverseWitnessAudit.selected, false);
  console.log('PASS diverse witness portfolios retain the original heuristic choice unless an alternative constructs a win or safe clock exit, share remaining nodes/deadline and never adopt an alternative failure as a death proof');
}

if (require.main === module) test();
module.exports = test;
