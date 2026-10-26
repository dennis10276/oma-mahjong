'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createKnownLossMemory } = require('./public_known_loss_memory.js');
const { legal, advance } = require('./known_tray_plan.js');
const { search, REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 },
    { x: 20, y: 0, z: 0 }, { x: 24, y: 0, z: 0 },
    { x: 20.28, y: 0.28 / 1.24, z: 1 }, { x: 24.28, y: 0.28 / 1.24, z: 1 }];
  const permutations = values => values.length ? values.flatMap((value, index) =>
    permutations(values.filter((unused, offset) => offset !== index)).map(tail => [value, ...tail])) : [[]];
  const worlds = permutations([1, 2, 3, 5, 6]);
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  let controls = 0, verifiedTaps = 0;
  for (const [ordinal, hidden] of worlds.entries()) for (const clocked of ordinal < 2 ? [false, true] : [false]) {
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 3, ...hidden, 5, 6],
      down: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1], rules: null, clock: clocked ? { i: 8, n: 20 } : null };
    const session = factory(actual, settings), actions = [], pictures = tiles.map(() => null), down = tiles.map(() => null);
    const observe = () => {
      const frame = session.view(), seen = observeBoard(tiles, frame.state, actual.clock,
        { picture: index => actual.faces[index], role: () => 'none' });
      seen.pictures.forEach((picture, index) => { if (picture !== null) pictures[index] = picture; });
      seen.down.forEach((orientation, index) => { if (orientation !== null) down[index] = orientation; });
      return { ...frame.state, pictures: pictures.map((picture, index) => frame.state.alive[index] ? picture : null),
        down: down.map((orientation, index) => frame.state.alive[index] ? orientation : 0) };
    };
    observe(); let beforeThirdCarry;
    for (const index of [8, 9, 0, 1, 2]) {
      if (index === 2) beforeThirdCarry = observe();
      session.tap(index); actions.push(index); observe();
    }
    const state = observe();
    assert.deepEqual(state.tray, [1, 2, 3]); assert.equal(state.openPeek, 9);
    for (const index of [3, 4, 5, 6, 7]) assert.equal(state.pictures[index], null);
    const game = { tiles, nb: actual.nb, rules: null, clock: actual.clock,
      publicFrontier: position => ({ free: tiles.flatMap((tile, index) => position.alive[index]
        && Layouts.isFree(index, position.alive, actual.nb) ? [index] : []), uncertain: [], relieved: !!position.relieved }) };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field,
      { get() { throw Error('Private inspection-loss proof ' + field); } });
    const roots = legal(game, state).free.map(index => ({ index }));
    const report = search(game, state, roots, { ...REFERENCE_PARAMETERS, nodes: 256, beam: 8 });
    assert(report.knownDead && !report.boundary);
    const successor = advance(game, state, 8); assert.equal(successor.removed, 0);
    const ordinary = createKnownLossMemory(game), derived = createKnownLossMemory(game, { inspectionSuccessors: true });
    ordinary.recordActual(state, report, roots); derived.recordActual(state, report, roots);
    assert(!ordinary.knowsLoss(successor.state)); assert(derived.knowsLoss(successor.state));
    assert(!derived.knowsLoss(beforeThirdCarry));
    assert(!derived.knowsLoss({ ...successor.state, relieved: true }));
    assert(!derived.knowsLoss({ ...successor.state, arriving: [101] }));
    if (clocked) assert(!derived.knowsLoss({ ...successor.state, moves: successor.state.moves + 1 }));
    const proof = derived.entries().find(entry => entry.proof)?.proof;
    assert.equal(proof.kind, 'knownInspectionSuccessorOfExhaustedLoss');
    assert.equal(proof.observedSuccessor, false); assert.equal(proof.actualParentPhysicalTaps, 5);
    const incomplete = createKnownLossMemory(game, { inspectionSuccessors: true });
    assert(!incomplete.recordActual(state, report, roots.slice(0, 1)));
    assert.deepEqual(incomplete.entries(), []);
    assert.throws(() => incomplete.recordActual(state, { ...report, boundary: true }, roots));
    assert.throws(() => incomplete.recordActual(state, { ...report, unknownTransitions: 1 }, roots));
    session.tap(8); actions.push(8);
    assert(derived.knowsLoss(observe()));
    verifiedTaps += verifyAttempt(encodeGame(actual), actions, settings, session.audit());
    const winner = factory(actual, settings), winning = [8, 8, 9, 9,
      3 + hidden.indexOf(5), 3 + hidden.indexOf(6),
      0, 3 + hidden.indexOf(1), 1, 3 + hidden.indexOf(2), 2, 3 + hidden.indexOf(3)];
    for (const index of winning) winner.tap(index);
    assert(winner.view().win);
    verifiedTaps += verifyAttempt(encodeGame(actual), winning, settings, winner.audit());
    controls++;
  }
  assert.throws(() => createKnownLossMemory({}, { inspectionSuccessors: 'yes' }));
  assert.throws(() => createHumanController(tiles, { rememberLossInspections: true }));
  factory.verifySource();
  console.log('PASS ' + controls + ' concealed paired worlds derive only known pure-inspection successors of an actual fully exhausted loss; preserve default, clock, arrival and relief distinctions; reject partial/bounded certificates; independently replay ' + verifiedTaps + ' taps. Separate full-information fixture witnesses establish opening-board winnability and are never passed to the memory or actor.');
}

if (require.main === module) test();
module.exports = test;
