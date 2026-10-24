'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createInformationPlayout, interleavePlayouts } = require('./public_interleaved_playouts.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  let time = 0;
  const order = [];
  const fake = (index, length, status) => {
    let steps = 0;
    return { next() { time++; order.push(index); steps++; return { done: steps >= length,
      value: { status: steps >= length ? status : 'unresolved' } }; }, snapshot: () => ({ status: 'unresolved' }) };
  };
  const balanced = interleavePlayouts([fake(0, 12, 'cleared'), fake(1, 1, 'lost'), fake(2, 1, 'lost')],
    { deadline: 16, now: () => time });
  assert.deepEqual(order.slice(0, 3), [0, 1, 2]);
  assert.deepEqual(balanced.reports.map(report => report.status), ['cleared', 'lost', 'lost']);
  assert.equal(time, 14); assert(balanced.allStarted);
  time = 0;
  const capped = interleavePlayouts([fake(0, 12, 'cleared'), fake(1, 1, 'lost'), fake(2, 1, 'lost')],
    { deadline: 6, now: () => time });
  assert.deepEqual(capped.reports.map(report => report.status), ['unresolved', 'lost', 'lost']);
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2, 3, 3, 4, 4],
    down: [0, 0, 1, 1, 0, 0, 0, 0], rules: null, clock: null };
  const memory = { pictures: [1, 1, null, null, 3, 3, 4, 4], down: game.down.slice(), initialRoles: tiles.map(() => 'none') };
  const before = JSON.stringify(memory), factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 128 };
  const sessions = [factory(game, settings), factory(game, settings)], deadline = Date.now() + 1000;
  const runners = [0, 2].map((candidate, index) => createInformationPlayout({ game, session: sessions[index], candidate,
    memory, roleAt: visibleRole, deadline, createPolicy: limit => createHumanController(tiles,
      { exclusiveRoles: true, usePlacementContract: true, knownPairMacros: true, nodes: 4, beam: 1, taps: 4,
        proofNodes: 2, decisionMs: undefined, deadline: limit }, { boardMode: 'standard' }) }));
  const played = interleavePlayouts(runners, { deadline });
  assert(played.allStarted);
  for (const [index, report] of played.reports.entries()) {
    assert.equal(report.status, 'cleared'); assert(sessions[index].view().win);
    assert.equal(verifyAttempt(encodeGame(game), report.path, settings, sessions[index].audit()), report.path.length);
  }
  assert.equal(JSON.stringify(memory), before); factory.verifySource();
  console.log('PASS interleaving preserves slow winning continuations while fast losses finish, starts each candidate fairly, retains unfinished games as unresolved and independently replays honest production clears without mutating actual memory');
}

if (require.main === module) test();
module.exports = test;
