'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createKnownLossMemory } = require('./public_known_loss_memory.js');
const { legal, advance } = require('./known_tray_plan.js');
const { analyzeContinuation } = require('./public_dead_end.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 1, 2, 3, 4, 3, 4],
    down: tiles.map(() => 0), rules: { keys: [4, 5], locks: new Set([2, 3, 6, 7]),
      ice: {}, iceNb: Layouts.iceNeighbors(tiles) }, clock: null };
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const session = factory(actual, settings); session.tap(0);
  const frame = session.view(), seen = observeBoard(tiles, frame.state, null,
    { picture: index => actual.faces[index], role: index => visibleRole(actual, frame.state, index) });
  const origin = { ...frame.state, pictures: seen.pictures,
    down: seen.down.map((orientation, index) => frame.state.alive[index] ? orientation : 0) };
  const game = { tiles, nb: actual.nb, rules: { keys: seen.roles.flatMap((role, index) => role === 'key' ? [index] : []),
    locks: new Set(seen.roles.flatMap((role, index) => role === 'lock' ? [index] : [])),
    ice: {}, iceNb: Layouts.iceNeighbors(tiles) }, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field,
    { get() { throw Error('Private retained continuation ' + field); } });
  const target = advance(game, origin, 1).state, roots = legal(game, target).free.map(index => ({ index }));
  const proof = analyzeContinuation(game, target, roots, 256);
  assert(proof.knownDead && proof.certificate.includesSafeRemovalsAndInspections);
  const ordinary = createKnownLossMemory(game), retained = createKnownLossMemory(game, { provedContinuations: true });
  assert.equal(ordinary.recordContinuation(origin, [1], target, proof), false);
  assert(retained.recordContinuation(origin, [1], target, proof));
  assert(retained.knowsLoss(target)); assert(!retained.knowsLoss(origin));
  assert.equal(retained.recordContinuation(origin, [1], target, proof), false);
  const entry = retained.entries()[0];
  assert.equal(entry.proof.kind, 'exhaustedKnownContinuationFromActualRoot');
  assert.equal(entry.proof.actualParentPhysicalTaps, 1); assert.equal(entry.proof.observedSuccessor, false);
  entry.proof.path.push(7); entry.proof.certificate.reachableUnknown = true;
  assert.deepEqual(retained.entries()[0].proof.path, [1]);
  assert.equal(retained.entries()[0].proof.certificate.reachableUnknown, false);
  const fresh = () => createKnownLossMemory(game, { provedContinuations: true });
  assert(!fresh().recordContinuation(origin, [1], target, analyzeContinuation(game, target, roots, 1)));
  assert.throws(() => fresh().recordContinuation(origin, [1], target,
    { ...proof, certificate: { ...proof.certificate, budgetBoundary: true } }));
  assert(!fresh().recordContinuation(origin, [1], target,
    { ...proof, certificate: { ...proof.certificate, allRequestedRoots: roots.slice(0, 1).map(root => root.index) } }));
  assert(!fresh().recordContinuation(origin, [1, 4, 5], target, proof));
  assert(!fresh().recordContinuation({ ...origin, pictures: origin.pictures.map((picture, index) => index === 1 ? null : picture) }, [1], target, proof));
  assert.throws(() => fresh().recordContinuation(origin, [1],
    { ...target, pictures: target.pictures.map((picture, index) => index === 4 ? 101 : picture) }, proof));
  const searchMemory = fresh(); let publicExposureChecks = 0;
  const integrated = { ...game, publicKnownLoss: state => searchMemory.knowsLoss(state),
    publicInformationExposure: () => { publicExposureChecks++; return []; },
    publicRetainKnownLoss: (parent, path, state, report) => searchMemory.recordContinuation(parent, path, state, report) };
  const options = { ...REFERENCE_PARAMETERS, continuationPruning: true, continuationTrayMin: 2, nodes: 256 };
  const first = search(integrated, origin, [{ index: 1 }], options);
  assert(first.retainedContinuationLosses > 0 && publicExposureChecks > 0);
  assert(searchMemory.knowsLoss(target)); assert(!searchMemory.knowsLoss(origin));
  const second = search(integrated, origin, [{ index: 1 }], options);
  assert(second.rememberedLossPrunes > 0);
  const broaderMemory = fresh();
  search({ ...integrated, publicKnownLoss: state => broaderMemory.knowsLoss(state), publicInformationExposure: () => [4],
    publicRetainKnownLoss: (parent, path, state, report) => broaderMemory.recordContinuation(parent, path, state, report) },
  origin, [{ index: 1 }], options);
  assert.deepEqual(broaderMemory.entries(), [], 'A reachable broader public frontier blocks persistent loss certification');
  session.tap(1); session.tap(4); session.tap(5); assert.equal(session.view().why, 'tray');
  let verified = verifyAttempt(encodeGame(actual), [0, 1, 4, 5], settings, session.audit());
  const winner = factory(actual, settings), winning = [0, 4, 5, 6, 7, 2, 3, 1];
  for (const index of winning) winner.tap(index);
  assert(winner.view().win); verified += verifyAttempt(encodeGame(actual), winning, settings, winner.audit());
  assert(!retained.knowsLoss(origin), 'A losing continuation must never condemn its winning actual parent');
  const controller = createHumanController(tiles, { rememberKnownLosses: true, rememberProvedContinuations: true,
    deadEndInformation: true, retryInformationWitness: true, obstacleFrontier: true, continuationTrayMin: 2 });
  const observedSession = factory(actual, settings); controller.beginAttempt();
  const observeController = () => {
    const current = observedSession.view(), allowed = new Set(current.legalTiles ?? []);
    const observed = observeBoard(tiles, current.state, null, { picture: index => actual.faces[index],
      role: index => visibleRole(actual, current.state, index), takeable: index => allowed.has(index) });
    controller.observe(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
      .map(field => [field, current.state[field]])), observed);
  };
  observeController(); controller.decide(); controller.acknowledge(0, true); observedSession.tap(0); observeController();
  controller.decide();
  assert(controller.knownLossEvidence().some(item => item.proof?.kind === 'exhaustedKnownContinuationFromActualRoot'));
  verified += verifyAttempt(encodeGame(actual), [0], settings, observedSession.audit());
  assert.throws(() => createHumanController(tiles, { rememberProvedContinuations: true }));
  assert.throws(() => createHumanController(tiles, { rememberKnownLosses: true, rememberProvedContinuations: true }));
  factory.verifySource();
  console.log('PASS persistent continuation losses require an actual-root known path and an exhaustive full public child proof; preserve the winning parent, reject bounds/unknowns/changed picture facts, include the broader information frontier, reuse only certified losses, deep-copy provenance and replay ' + verified + ' production witness taps.');
}

if (require.main === module) test();
module.exports = test;
