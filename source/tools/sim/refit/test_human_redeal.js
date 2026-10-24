'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { targetTries, sunflowerTheme, openingObservation, makeRedeal, classifyLoss } = require('./human_redeal.js');
const seeds = require('./human_redeal_seeds.json');
const { playHumanCampaign } = require('./human_reference_campaign.js');

function test() {
  assert.equal(seeds.development.length, 10); assert.equal(seeds.luck.length, 50);
  assert.equal(new Set([...seeds.development, ...seeds.luck]).size, 60);
  assert.equal(sunflowerTheme().id, 'sunflower'); assert.equal(sunflowerTheme().identities[0], '🌻');
  assert.deepEqual([1, 2, 3, 7].map(targetTries), [1, 1, 2, 6]);
  assert.throws(() => targetTries(0));
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4],
    down: [0, 0, 1, 1, 1, 1, 1, 1], rules: null, clock: { i: 0, n: 5 } };
  const encoded = encodeGame(actual), original = JSON.stringify(encoded), boards = new Set();
  for (const seed of seeds.development) {
    const redeal = makeRedeal(encoded, seed);
    assert.deepEqual(redeal, makeRedeal(encoded, seed));
    assert.deepEqual(redeal.game.faces.slice(0, 2), [1, 1]); assert.equal(redeal.hiddenCount, 6);
    assert.deepEqual(openingObservation(decodeGame(redeal.game)), openingObservation(actual));
    assert.deepEqual(redeal.game.clock, encoded.clock); assert.deepEqual(redeal.game.rules, encoded.rules);
    assert.deepEqual(redeal.game.down, encoded.down); assert.deepEqual(redeal.game.tiles, encoded.tiles);
    assert.deepEqual(redeal.game.faces.slice().sort(), encoded.faces.slice().sort());
    assert(!Object.hasOwn(redeal.game, 'seed')); assert(!Object.hasOwn(redeal.game, 'redealSeed'));
    boards.add(JSON.stringify(redeal.game.faces));
  }
  assert(boards.size > 1); assert.equal(JSON.stringify(encoded), original);
  const faceUp = { ...encoded, down: encoded.down.map(() => 0) };
  assert.deepEqual(makeRedeal(faceUp, seeds.development[0]).game.faces, faceUp.faces);
  const hiddenGuard = { ...actual, faces: actual.faces.slice() };
  for (let index = 2; index < 8; index++) Object.defineProperty(hiddenGuard.faces, index,
    { get() { throw Error('Opening observation read a concealed picture'); } });
  assert.deepEqual(openingObservation(hiddenGuard).pictures, [1, 1, null, null, null, null, null, null]);
  const failed = playHumanCampaign({ ...actual, clock: null }, { choiceLimit: 1, captureDecisions: true });
  const geometry = { tiles, nb: actual.nb, clock: null };
  for (const field of ['faces', 'seed', 'deck', 'rules']) Object.defineProperty(geometry, field,
    { enumerable: true, get() { throw Error('Loss classifier read private ' + field); } });
  assert.equal(classifyLoss(failed, geometry).primary, 'decision_cap');
  const state = { alive: [0, 0, 0, 1, 1, 1, 1, 1], pictures: [null, null, null, 1, null, null, null, null],
    down: tiles.map(() => 0), tray: [1, 2, 3], moves: 3, openPeek: -1, relieved: false, arriving: [] };
  const terminal = { status: 'physicalLoss', wonOn: null, attempts: [{ attempt: 1, why: 'tray', status: 'physicalLoss',
    tray: [1, 2, 3, 4], last: { alive: state.alive, pictures: state.pictures },
    decisions: [{ index: 4, accepted: true, state,
      knowledgeSignature: JSON.stringify({ roles: tiles.map(() => 'none'), initialRoles: tiles.map(() => 'none') }) }] }] };
  assert.equal(classifyLoss(terminal, geometry).primary, 'missed_known_safe_match');
  terminal.attempts[0].decisions[0].knowledgeSignature = JSON.stringify({ roles: tiles.map(() => null) });
  assert.equal(classifyLoss(terminal, geometry).primary, 'tray_full_unseen_twins');
  terminal.attempts[0].why = 'clock'; assert.equal(classifyLoss(terminal, geometry).primary, 'clock_expired');
  console.log('PASS fixed disjoint re-deal seeds shuffle only concealed pictures, preserve opening facts/pairs/rules/clock/geometry, keep retry targets exact and classify losses without private-picture or seed access');
}

if (require.main === module) test();
module.exports = test;
