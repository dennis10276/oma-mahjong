'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { reference } = require('./public_witness_reference.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 };
  const cases = [
    { name: 'unrelated penalty retains prefix', penalized: 7, expected: 4 },
    { name: 'next-root penalty replans', penalized: 4, expected: 5 },
    { name: 'default reference unchanged', penalized: 4, enabled: false, expected: 4 },
    { name: 'known win protected', penalized: 4, knownWin: true, expected: 4 },
    { name: 'known clock exit protected', penalized: 4, clocked: true, safeClockExit: true, expected: 4 },
    { name: 'active clock protected', penalized: 4, clocked: true, expected: 4 },
    { name: 'explicit clock retry can replan', penalized: 4, clocked: true, clockRetryLearning: true, expected: 5 },
    { name: 'missing retry cost retains prefix', penalized: 4, missingCost: true, expected: 4 },
  ];
  let verifiedTaps = 0;
  for (const fixture of cases) {
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 3, 4, 1, 2, 3, 4],
      down: [0, 0, 0, 0, 0, 0, 1, 1], rules: null, clock: fixture.clocked ? { i: 5, n: 20 } : null };
    const session = factory(actual, settings), pictures = tiles.map(() => null), actions = [];
    const observe = () => {
      const frame = session.view(), allowed = new Set(frame.legalTiles ?? []);
      const seen = observeBoard(tiles, frame.state, actual.clock, { picture: index => actual.faces[index],
        role: () => 'none', takeable: index => allowed.has(index) });
      seen.pictures.forEach((picture, index) => { if (picture !== null) pictures[index] = picture; });
      return { ...frame.state, pictures: pictures.slice(), down: seen.down };
    };
    observe();
    for (const index of [6, 7, 0, 1]) { session.tap(index); actions.push(index); observe(); }
    assert(pictures.every(picture => picture !== null), 'Both closed identities were actually inspected');
    const game = { tiles, nb: actual.nb, rules: null, clock: actual.clock,
      ...(!fixture.missingCost ? { publicRetryCost: index => +(index === fixture.penalized) } : {}) };
    for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field,
      { get() { throw Error('Private prefix retention ' + field); } });
    let calls = 0;
    const planner = reference({ replanOnInformation: true, replanOnRetryCost: fixture.enabled ?? true,
      clockRetryLearning: fixture.clockRetryLearning }, () => {
      calls++;
      const knownWin = !!fixture.knownWin, safeClockExit = !!fixture.safeClockExit;
      return { index: calls === 1 ? 6 : 5,
        path: calls === 1 ? knownWin ? [6, 4, 5, 2, 3, 7] : [6, 4, 5] : [5, 4],
        knownWin, safeClockExit, knownDead: false, goal: knownWin ? 'win' : 'boundedProgress',
        information: false, knownProgress: 2, boundary: !knownWin, clockRoom: 0, nodes: 2,
        prunedDeadSuccessors: 0 };
    });
    const plan = () => {
      planner.physicalTrayPlanning(game, observe(), session.view().legalTiles.map(index => ({ index })));
      return planner.report();
    };
    assert.equal(plan().index, 6); planner.acknowledgeTile(6); session.tap(6); actions.push(6);
    const second = plan(); assert.equal(second.index, fixture.expected, fixture.name);
    assert.equal(calls, fixture.expected === 5 ? 2 : 1, fixture.name);
    if (fixture.enabled !== false) assert.equal(planner.stats().retryReplans, fixture.expected === 5 ? 1 : 0);
    planner.acknowledgeTile(second.index); session.tap(second.index); actions.push(second.index);
    for (const index of [second.index === 4 ? 5 : 4, 2, 3, 7]) { session.tap(index); actions.push(index); observe(); }
    assert(session.view().win, fixture.name);
    verifiedTaps += verifyAttempt(encodeGame(actual), actions, settings, session.audit());
  }
  assert.throws(() => reference({ replanOnRetryCost: 'yes' }));
  factory.verifySource();
  console.log('PASS ' + cases.length + ' retry-prefix cases retain valid unpenalized continuations, replan a penalized next root, preserve wins and clock guards, keep default behavior and independently replay ' + verifiedTaps + ' production taps with actually inspected closed identities. Search reports are unit fixtures, not campaign gains.');
}

if (require.main === module) test();
module.exports = test;
