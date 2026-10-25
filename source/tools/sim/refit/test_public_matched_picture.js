'use strict';
const assert = require('assert/strict');
const layouts = require('../../../www/layouts.js');
const { inferMatchedPicture } = require('./public_matched_picture.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createHumanController, verifyAttempt } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

const outcome = state => ({ alive: state.alive, tray: state.tray, moves: state.moves,
  openPeek: state.openPeek, physicalTaps: state.physicalTaps });

function test() {
  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 32, tapMs: 1000 };
  const tiles = Array.from({ length: 8 }, (value, index) => ({ x: index * 4, y: 0, z: 0 }));
  let controls = 0;
  for (const kind of ['tray', 'twin', 'terminal']) for (const known of [1, 101]) for (const hidden of [...Array(36).keys(), 101]) {
    const actual = { tiles, nb: layouts.neighbors(tiles), faces: [known, hidden, 7, 7, 8, 8, known, hidden],
      down: [kind === 'twin' ? 1 : 0, 1, 0, 0, 0, 0, 1, 1], rules: null,
      clock: kind === 'terminal' ? { i: 4, n: 2 } : null };
    const session = factory(actual, settings); session.tap(0);
    const raw = session.view().state;
    const board = observeBoard(tiles, raw, actual.clock, { picture: index => actual.faces[index], role: index => index === 1 ? null : 'none' });
    const before = { ...outcome(raw), down: board.down, pictures: board.pictures };
    assert.equal(before.pictures[1], null); assert.equal(before.down[1], 1);
    const after = session.tap(1), publicResult = outcome(after.state);
    for (const field of ['faces', 'pictures', 'down', 'deck', 'seed']) Object.defineProperty(publicResult, field, { get() { throw Error('Private result ' + field); } });
    const snapshot = JSON.stringify([before, publicResult]), inferred = inferMatchedPicture(before, 1, publicResult);
    if (hidden === known) {
      assert.deepEqual(inferred, { index: 1, picture: known, source: kind === 'twin' ? 'observedOpenTwinMatch' : 'observedTrayMatch' });
      if (kind === 'terminal') assert.equal(after.why, 'clock');
    } else assert.equal(inferred, null);
    assert.equal(JSON.stringify([before, publicResult]), snapshot);
    assert.equal(inferMatchedPicture({ ...before, down: before.down.map((down, index) => index === 1 ? null : down) }, 1, publicResult), null);
    assert.equal(inferMatchedPicture(before, 1, { ...outcome(after.state), physicalTaps: before.physicalTaps }), null);
    assert.equal(verifyAttempt(encodeGame(actual), [0, 1], settings, session.audit()), 2);
    controls++;
  }
  const actual = { tiles, nb: layouts.neighbors(tiles), faces: [1, 1, 7, 7, 8, 8, 1, 1],
    down: [0, 1, 0, 0, 0, 0, 1, 1], rules: null, clock: { i: 4, n: 2 } };
  const session = factory(actual, settings), controller = createHumanController(tiles, { exclusiveRoles: true });
  const observe = frame => controller.observe({ ...outcome(frame.state), relieved: frame.state.relieved, arriving: frame.state.arriving },
    observeBoard(tiles, frame.state, actual.clock, { picture: index => actual.faces[index], role: index => index === 1 ? null : 'none' }));
  controller.beginAttempt(); observe(session.view());
  for (const index of [0, 1]) { controller.decide(); controller.acknowledge(index, true); observe(session.tap(index)); }
  assert.equal(session.view().why, 'clock');
  assert.equal(controller.known().pictures[1], 1, 'A closed tile matched immediately before losing must remain remembered');
  assert.equal(controller.known().initialRoles[1], null, 'Matching does not disclose the hidden key/ice/lock role');
  controller.beginAttempt(); const restarted = factory(actual, settings);
  const hiddenBoard = observeBoard(tiles, restarted.view().state, actual.clock, { picture: index => actual.faces[index], role: index => index === 1 ? null : 'none' });
  assert.equal(hiddenBoard.pictures[1], null); observe(restarted.view());
  assert.equal(controller.known().pictures[1], 1); assert.equal(controller.known().initialRoles[1], null);
  factory.verifySource();
  console.log('PASS ' + controls + ' actual tray/twin/terminal match controls infer only identities already visible in prior tray/open tiles, never read removed pictures, independently replay in production, and retain no invented starting role across retries');
}

if (require.main === module) test();
module.exports = test;
