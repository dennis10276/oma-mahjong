'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { inferPairedPicture } = require('./public_paired_picture.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const { encodeGame } = require('./personal_game_io.js');
const { advance } = require('./known_tray_plan.js');

function test() {
  const contract = { pairedInitialPictures: true }, alphabet = [0, 1, 35, 101];
  let worlds = 0, controls = 0, deductions = 0;
  for (const size of [2, 4, 6]) for (let code = 0; code < alphabet.length ** size; code++) {
    const actualPictures = Array.from({ length: size }, (unused, index) => alphabet[Math.floor(code / alphabet.length ** index) % alphabet.length]);
    if (alphabet.some(picture => actualPictures.filter(value => value === picture).length % 2)) continue;
    worlds++;
    for (let mask = 0; mask < 2 ** size; mask++) {
      const memory = actualPictures.map((picture, index) => mask & 2 ** index ? picture : null);
      for (const field of ['faces', 'deck', 'seed', 'alive', 'tray']) Object.defineProperty(memory, field,
        { get() { throw Error('Inference read unavailable ' + field); } });
      const snapshot = memory.slice(), proof = inferPairedPicture(memory, contract);
      assert.deepEqual(memory.slice(), snapshot);
      if (proof) {
        assert.equal(proof.picture, actualPictures[proof.index]);
        assert.equal(memory[proof.index], null);
        assert.equal(memory.filter(picture => picture === null).length, 1);
        deductions++;
      } else assert.notEqual(memory.filter(picture => picture === null).length, 1);
      controls++;
    }
  }
  assert(deductions > 0 && worlds > 0);
  assert.throws(() => inferPairedPicture([0, null]), /explicit paired opening/);
  assert.throws(() => inferPairedPicture([0, null], { pairedInitialPictures: false }));
  assert.throws(() => inferPairedPicture([0, null], { ...contract, seed: 1 }));
  assert.throws(() => inferPairedPicture([0, 1], contract), /contradict/);
  assert.throws(() => inferPairedPicture([0, 1, 2, null], contract), /contradict/);
  assert.throws(() => inferPairedPicture([0, null, null], contract));
  assert.throws(() => inferPairedPicture([36, null], contract));
  const sparse = [0, null]; sparse.length = 4;
  assert.throws(() => inferPairedPicture(sparse, contract), 'Absent array entries cannot masquerade as remembered pictures');
  assert.equal(inferPairedPicture([null, null], contract), null, 'An unknown pair has no identifiable picture');
  assert.equal(inferPairedPicture([0, null, 1, null], contract), null, 'A known multiset does not assign pictures to positions');
  assert.deepEqual(inferPairedPicture([...Array(69).fill(35), null], contract),
    { index: 69, picture: 35, source: 'pairedOpeningParity' });

  const factory = createSessionFactory(), settings = { seed: 1, choiceLimit: 32, tapMs: 1000 };
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  for (const picture of alphabet) {
    const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [picture, picture, 2, 2, 3, 3, 4, 4],
      down: [0, 1, 0, 0, 0, 0, 0, 0], rules: null, clock: null };
    const session = factory(actual, settings), opening = session.view().state;
    const board = observeBoard(tiles, opening, null, { picture: index => {
      assert.notEqual(index, 1, 'The original closed picture must not be read'); return actual.faces[index];
    }, role: () => 'none' });
    assert.equal(board.pictures[1], null);
    const proof = inferPairedPicture(board.pictures, contract);
    assert.deepEqual(proof, { index: 1, picture, source: 'pairedOpeningParity' });
    const first = session.tap(0), before = { ...first.state, down: board.down,
      pictures: board.pictures.map((known, index) => index === proof.index ? proof.picture : known) };
    const predicted = advance({ tiles, nb: actual.nb }, before, 1), observed = session.tap(1);
    assert.equal(predicted.uncertain, undefined);
    for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(predicted.state[field], observed.state[field]);
    assert.equal(observed.state.alive[1], 0);
    for (const index of [2, 3, 4, 5, 6, 7]) session.tap(index);
    assert.equal(session.view().win, true);
    assert.equal(verifyAttempt(encodeGame(actual), [0, 1, 2, 3, 4, 5, 6, 7], settings, session.audit()), 8);
  }
  factory.verifySource();
  console.log('PASS ' + controls + ' public-memory masks across ' + worlds + ' paired worlds, ' + deductions
    + ' sound deductions including Jokers, and four independently replayed production clears; no initial inventory or hypothetical reveals read');
}

if (require.main === module) test();
module.exports = test;
