'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { advance } = require('./known_tray_plan.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 1 },
    { x: 9, y: -1, z: 0 }, { x: 10, y: 0, z: 1 }, { x: 9, y: 1, z: 0 },
    { x: 14, y: 0, z: 1 }, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 }];
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null,
    publicFrontier(position) {
      return { free: position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, this.nb) ? [index] : []),
        uncertain: position.alive[1] ? [1] : [] };
    } };
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: [1, 1, 1, 1, 1, 1, 1, 0, 0], pictures: [7, null, 8, null, 11, null, 11, null, null],
    down: [0, 1, 0, 1, 0, 1, 0, 0, 0], tray: [9, 35], moves: 2, openPeek: -1, relieved: false, arriving: [] };
  const roots = game.publicFrontier(state).free.map(index => ({ index }));
  const options = { ...REFERENCE_PARAMETERS, taps: 8, nodes: 256, beam: 32, pruneDead: false,
    finishKnown: false, shortInformation: true, goalRecovery: true, riskFirstRecovery: true,
    goalRecoveryMin: 1, alternativeRecoveryRoutes: true, knownPairMacros: true };
  const short = search(game, state, roots, options);
  assert.equal(short.index, 0);
  assert(short.information && short.path.length === 2);
  const wider = search(game, state, roots, { ...options, informationWidth: 2 });
  assert(wider.information && wider.path.length > short.path.length);
  assert(!wider.knownWin && !wider.knownDead);
  let position = state;
  const prefix = [];
  for (const index of wider.path) {
    const moved = advance(game, position, index);
    if (moved.uncertain) break;
    assert(!moved.lost); position = moved.state; prefix.push(index);
  }
  const allowed = game.publicFrontier(position);
  const alternatives = allowed.free.filter(index => !allowed.uncertain.includes(index) && position.pictures[index] === null);
  assert(alternatives.length >= 2);
  const actual = { tiles, nb: game.nb, rules: null, clock: null, faces: [7, 7, 8, 8, 11, 12, 11, 9, 35], down: state.down };
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 32 }, session = createSessionFactory()(actual, settings);
  for (const index of [7, 8, ...prefix]) session.tap(index);
  for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(session.view().state[field], position[field]);
  assert.equal(verifyAttempt(encodeGame(actual), [7, 8, ...prefix], settings, session.audit()), prefix.length + 2);
  const sparse = { ...state, pictures: [null, null, 8, null, 11, null, 11, null, null],
    down: [1, 1, 0, 1, 0, 1, 0, 0, 0], tray: [], moves: 0 };
  const uncertainRoot = { ...game, publicFrontier(position) {
    const available = game.publicFrontier(position);
    return { ...available, uncertain: [0, 1].filter(index => position.alive[index]) };
  } };
  const informative = search(uncertainRoot, sparse, roots, { ...options, informationWidth: 2, informationDominance: true });
  assert(!informative.dominanceStop, 'The old one-tap rank bound does not apply to a width-sensitive objective');
  assert(informative.information && informative.path.length > 1);
  const clocked = { ...game, clock: { i: 0, n: 4 } };
  const fields = ['index', 'path', 'goal', 'knownWin', 'knownDead', 'safeClockExit'];
  const before = search(clocked, state, roots, options), after = search(clocked, state, roots, { ...options, informationWidth: 2 });
  for (const field of fields) assert.deepEqual(after[field], before[field]);
  assert.throws(() => search(game, state, roots, { ...options, informationWidth: -1 }));
  assert.throws(() => search(game, state, roots, { ...options, informationWidth: 5 }));
  console.log('PASS public information-width ordering prefers multiple mechanically guaranteed unknown-picture candidates over a narrow uncertain probe, replays the known prefix in production, preserves clocks and disables inapplicable dominance shortcuts');
}

if (require.main === module) test();
module.exports = test;
