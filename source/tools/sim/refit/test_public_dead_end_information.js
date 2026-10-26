'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { retryInformationSearch } = require('./public_retry_information.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { verifyAttempt, createHumanController } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0.28, y: 0.28 / 1.24, z: 1 },
    ...Array.from({ length: 6 }, (unused, index) => ({ x: 8 + index * 4, y: 0, z: 0 }))];
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 32 };
  let verifiedTaps = 0, referenceObservation = null, referenceDecision = null;
  for (const hidden of [4, 101]) for (const hiddenDown of [0, 1]) {
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [hidden, 1, 1, 2, 3, 4, 2, 3],
      down: [hiddenDown, 0, 0, 0, 0, 0, 0, 0], rules: null, clock: null };
    const session = factory(actual, settings), prefix = [2, 3, 4];
    for (const index of prefix) session.tap(index);
    const frame = session.view(), free = new Set(frame.legalTiles);
    const observed = observeBoard(tiles, frame.state, null, { picture: index => actual.faces[index],
      role: () => 'none', takeable: index => free.has(index) });
    assert.equal(observed.down[0], null); assert.equal(observed.pictures[0], null);
    if (referenceObservation) assert.deepEqual(observed, referenceObservation); else referenceObservation = observed;
    const state = { ...frame.state, pictures: observed.pictures, down: observed.down };
    const memory = { pictures: observed.pictures.slice(), down: observed.down.slice(), initialRoles: observed.roles.slice() };
    const game = { tiles, nb: actual.nb, clock: null, rules: null,
      publicInformationExposure: createExposureFrontier(tiles, { ...state, roles: observed.roles }, 'all', true) };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field,
      { get() { throw Error('Private dead-end recovery ' + field); } });
    const primary = { index: 5, path: [5], nodes: 7, knownDead: true, knownWin: false,
      safeClockExit: false, deadCertificate: { exhaustedKnownGraph: true, reachableUnknown: false },
      provedDeadRoots: [1, 5, 6, 7], exclusionProof: { knownDead: true }, goal: 'syntheticConditionalDeadReport' };
    const roots = frame.legalTiles.map(index => ({ index }));
    const legacy = retryInformationSearch(() => primary, { nodes: 100, milliseconds: 100 });
    legacy.beginAttempt(memory); assert.strictEqual(legacy.search(game, state, roots), primary);
    const policy = retryInformationSearch(() => primary, { deadEndInformation: true, nodes: 100, milliseconds: 100 });
    policy.beginAttempt(memory);
    const before = JSON.stringify([state, memory, primary]), recovered = policy.search(game, state, roots);
    assert.equal(JSON.stringify([state, memory, primary]), before);
    assert.deepEqual(recovered.path, [1]); assert.equal(recovered.knownDead, false);
    assert.equal(recovered.deadCertificate, undefined); assert.equal(recovered.provedDeadRoots, undefined);
    assert.equal(recovered.exclusionProof, undefined);
    assert.deepEqual(recovered.retryInformationWitness.newlyExposed, [0]);
    assert.equal(recovered.retryInformationWitness.imaginedPicturesAdded, 0);
    assert.equal(policy.stats().deadEndConsidered, 1); assert.equal(policy.stats().firstAttemptDeadEndConsidered, 1);
    assert.equal(policy.stats().deadEndRoutes, 1);
    if (referenceDecision) assert.deepEqual(recovered.path, referenceDecision); else referenceDecision = recovered.path;
    session.tap(1);
    const after = observeBoard(tiles, session.view().state, null,
      { picture: index => actual.faces[index], role: () => 'none' });
    assert.equal(after.down[0], hiddenDown);
    assert.equal(state.down[0], null); assert.equal(memory.pictures[0], null);
    const actions = [...prefix, 1, 6, 7, 5, 0];
    for (const index of [6, 7, 5, 0]) session.tap(index);
    if (session.view().state.alive[0]) { actions.push(0); session.tap(0); }
    assert(session.view().win);
    verifiedTaps += verifyAttempt(encodeGame(actual), actions, settings, session.audit());
    const expired = retryInformationSearch(() => primary, { deadEndInformation: true, nodes: 100 });
    expired.beginAttempt(memory);
    const unresolved = expired.search(game, state, roots, { deadline: Date.now() - 1 });
    assert(!unresolved.knownDead && unresolved.boundary);
    assert.equal(unresolved.deadCertificate, undefined); assert.equal(unresolved.provedDeadRoots, undefined);
    assert.equal(unresolved.deadEndInformation.reason, 'deadline');
    const bounded = retryInformationSearch(() => primary, { deadEndInformation: true, nodes: 1 });
    bounded.beginAttempt(memory);
    const capped = bounded.search(game, state, roots);
    assert(!capped.knownDead && capped.boundary); assert.equal(capped.deadEndInformation.reason, 'node_limit');
    const protectedReports = [{ ...primary, knownWin: true }, { ...primary, safeClockExit: true }, { ...primary, knownDead: false }];
    for (const protectedReport of protectedReports) {
      const protectedPolicy = retryInformationSearch(() => protectedReport, { deadEndInformation: true });
      protectedPolicy.beginAttempt(memory);
      assert.strictEqual(protectedPolicy.search(game, state, roots), protectedReport);
      assert.equal(protectedPolicy.stats().considered, 0);
    }
    const urgent = retryInformationSearch(() => primary, { deadEndInformation: true, nodes: 100 });
    urgent.beginAttempt(memory);
    const tooLate = urgent.search({ ...game, clock: { i: 5, n: 4 } }, state, roots);
    assert(tooLate.knownDead); assert.equal(tooLate.index, primary.index);
    assert.equal(tooLate.deadEndInformation.broaderInformationCertificateEstablished, true);
    assert.equal(urgent.stats().routes, 0); assert.equal(urgent.stats().confirmedDeadEndReports, 1);
    const exhaustedChoices = retryInformationSearch(() => primary, { deadEndInformation: true, choices: 3 });
    exhaustedChoices.beginAttempt(memory);
    assert.equal(exhaustedChoices.search(game, state, roots).deadEndInformation.reason, 'choice_budget');
  }
  assert.equal(verifiedTaps, 33);
  assert.throws(() => retryInformationSearch(() => ({}), { deadEndInformation: 'yes' }));
  assert.throws(() => createHumanController(tiles, { deadEndInformation: true }));
  assert.throws(() => createHumanController(tiles, { deadEndInformation: 'yes', retryInformationWitness: true }));
  factory.verifySource();
  console.log('PASS first-attempt public-information recovery preserves four indistinguishable hidden worlds, learns only after observation, protects wins/clock exits/non-dead choices, clears incomplete death claims, respects budgets and independently replays33 winning physical taps');
}
if (require.main === module) test();
module.exports = test;
