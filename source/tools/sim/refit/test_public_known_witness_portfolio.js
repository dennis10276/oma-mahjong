'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createKnownWitnessPortfolio } = require('./public_known_witness_portfolio.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { verifyAttempt, createHumanController } = require('./human_reference_campaign.js');
const { createMeasurer } = require('./human_level_measure.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 4 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2], down: tiles.map(() => 0), rules: null, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
  const session = factory(actual, settings), frame = session.view();
  const seen = observeBoard(tiles, frame.state, null, { picture: index => actual.faces[index], role: () => 'none' });
  const state = { ...frame.state, pictures: seen.pictures, down: seen.down };
  const game = { tiles, nb: actual.nb, rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field,
    { get() { throw Error('Private known portfolio ' + field); } });
  const actions = frame.legalTiles.map(index => ({ index }));
  const primary = { index: 0, path: [0], nodes: 2, knownWin: false, safeClockExit: false,
    knownDead: false, information: false, boundary: true, knownProgress: 1, goal: 'boundedProgress' };
  const win = { ...primary, path: [0, 1, 2, 3], nodes: 3, knownWin: true, boundary: false, goal: 'win' };
  let secondaryCalls = 0;
  const portfolio = createKnownWitnessPortfolio((snapshot, position, roots, options) => {
    assert.equal(options.nodes, 16); assert.equal(options.decisionMs, 1500); return primary;
  }, { nodes: 8, choices: 32 }, (snapshot, position, roots, options) => {
    secondaryCalls++; assert.equal(options.nodes, 8); assert.equal(options.decisionMs, undefined);
    assert(options.diverseBeam && !options.diverseWitness); assert.equal(options.finishKnownMaxTaps, 32);
    assert(options.deadline > Date.now() && options.deadline <= Date.now() + 500); return win;
  });
  const selected = portfolio.search(game, state, actions, { nodes: 16, decisionMs: 1500 });
  assert(selected.knownWin && selected.knownWitnessPortfolio.selected); assert.equal(selected.nodes, 5);
  assert.equal(portfolio.stats().wins, 1); assert.equal(secondaryCalls, 1);
  for (const index of selected.path) session.tap(index);
  assert(session.view().win); let verified = verifyAttempt(encodeGame(actual), selected.path, settings, session.audit());
  for (const protectedReport of [win, { ...primary, safeClockExit: true }, { ...primary, knownDead: true }]) {
    assert.strictEqual(createKnownWitnessPortfolio(() => protectedReport, {}, () => { throw Error('Protected primary searched twice'); })
      .search(game, state, actions), protectedReport);
  }
  let calls = 0;
  const incomplete = createKnownWitnessPortfolio(() => primary, {}, () => { calls++; return win; });
  assert.strictEqual(incomplete.search(game, { ...state, pictures: [null, 1, 2, 2] }, actions), primary);
  assert.strictEqual(incomplete.search(game, { ...state, down: [null, 0, 0, 0] }, actions), primary);
  assert.equal(calls, 0);
  const invalid = createKnownWitnessPortfolio(() => primary, {}, () => ({ ...win, path: [0] }));
  const rejected = invalid.search(game, state, actions); assert(!rejected.knownWin && !rejected.knownWitnessPortfolio.selected);
  assert.equal(invalid.stats().rejectedWitnesses, 1);
  const uncertain = { ...game, publicFrontier: () => ({ free: [0, 1, 2, 3], uncertain: [2] }) };
  assert(!createKnownWitnessPortfolio(() => primary, {}, () => win).search(uncertain, state, actions).knownWitnessPortfolio.selected);
  const noTime = createKnownWitnessPortfolio(() => primary, {}, () => { throw Error('Expired extra budget'); });
  assert.strictEqual(noTime.search(game, state, actions, { deadline: Date.now() - 1 }), primary);
  assert.strictEqual(noTime.search(game, { ...state, physicalTaps: 512 }, actions), primary);
  const shortBudget = createKnownWitnessPortfolio(() => primary, { choices: 1 }, () => win);
  assert(!shortBudget.search(game, state, actions).knownWitnessPortfolio.selected);
  const clockActual = { ...actual, clock: { i: 2, n: 1 } }, clockGame = { ...game, clock: clockActual.clock };
  const exit = { ...primary, index: 2, path: [2], safeClockExit: true };
  const clockResult = createKnownWitnessPortfolio(() => primary, {}, () => exit).search(clockGame, state, actions);
  assert(clockResult.safeClockExit && clockResult.knownWitnessPortfolio.selected);
  const clockSession = factory(clockActual, settings), clockActions = [...clockResult.path, 3, 0, 1];
  for (const index of clockActions) clockSession.tap(index);
  assert(clockSession.view().win); verified += verifyAttempt(encodeGame(clockActual), clockActions, settings, clockSession.audit());
  assert(!createKnownWitnessPortfolio(() => primary, {}, () => ({ ...exit, index: 0, path: [0] }))
    .search(clockGame, state, actions).knownWitnessPortfolio.selected);
  assert(!createKnownWitnessPortfolio(() => primary, {}, () => ({ ...exit, path: [2, 99] }))
    .search({ ...clockGame, clock: { i: 3, n: 10 } }, state, actions).knownWitnessPortfolio.selected);
  assert.throws(() => createKnownWitnessPortfolio(() => primary, { milliseconds: 501 }));
  assert.throws(() => createKnownWitnessPortfolio(() => primary, { nodes: 1 }, () => win).search(game, state, actions));
  assert.throws(() => createHumanController(tiles, { knownWitnessMs: 250 }));
  assert.throws(() => search(game, state, actions, { ...REFERENCE_PARAMETERS, finishKnownMaxTaps: 0 }));
  assert.equal(search(game, state, actions, { ...REFERENCE_PARAMETERS, finishKnownMaxTaps: 4 }).tapLimit, 4);
  const measured = createMeasurer({ knownWitnessPortfolio: true })(actual, { salts: [1], maxTries: 1 });
  assert(measured.valid && measured.triesPerSalt[0] === 1 && measured.runs[0].knownWitnessPortfolio);
  const longTiles = Array.from({ length: 100 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const longActual = { tiles: longTiles, nb: Layouts.neighbors(longTiles),
    faces: longTiles.map((tile, index) => Math.floor(index / 2) % 36), down: longTiles.map(() => 0), rules: null, clock: null };
  const longSettings = { ...settings, choiceLimit: 256 }, longSession = factory(longActual, longSettings);
  const longFrame = longSession.view(), longSeen = observeBoard(longTiles, longFrame.state, null,
    { picture: index => longActual.faces[index], role: () => 'none' });
  const longState = { ...longFrame.state, pictures: longSeen.pictures, down: longSeen.down };
  const longPath = longTiles.map((tile, index) => index), longGame = { tiles: longTiles, nb: longActual.nb, rules: null, clock: null };
  const longResult = createKnownWitnessPortfolio(() => primary, {}, (snapshot, position, roots, options) => {
    assert.equal(options.finishKnownMaxTaps, 256); return { ...win, path: longPath };
  }).search(longGame, longState, longPath.map(index => ({ index })));
  assert(longResult.knownWin && longResult.path.length > 96);
  for (const index of longResult.path) longSession.tap(index);
  assert(longSession.view().win); verified += verifyAttempt(encodeGame(longActual), longPath, longSettings, longSession.audit());
  factory.verifySource();
  console.log('PASS a known-board secondary search keeps the primary budget, accepts only validated wins/clock exits, protects existing witnesses, rejects incomplete/unsafe/budget-limited reports, bounds extra search and supports the measured API; ' + verified + ' explicit production witness taps replay. Supplied reports isolate wrapper behavior, not a benchmark improvement.');
}

if (require.main === module) test();
module.exports = test;
