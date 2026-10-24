'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { informationPlayout } = require('./public_information_playout.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const settings = { seed: 1, tapMs: 1000, choiceLimit: 128 }, factory = createSessionFactory();
  const firstChoices = [];
  for (const hiddenPicture of [2, 5]) {
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, hiddenPicture, hiddenPicture, 3, 3, 4, 4],
      down: [0, 0, 1, 1, 0, 0, 0, 0], rules: null, clock: null };
    const memory = { pictures: [1, 1, null, null, 3, 3, 4, 4], down: game.down.slice(), initialRoles: tiles.map(() => 'none') };
    const before = JSON.stringify(memory), observations = [], choices = [];
    const session = factory(game, settings);
    const report = informationPlayout({ game, session, candidate: 0, memory, roleAt: visibleRole,
      deadline: Date.now() + 1000, createPolicy(deadline) {
        const policy = createHumanController(tiles, { exclusiveRoles: true, usePlacementContract: true,
          inspectBeforeCommit: 'recovery', inspectionTrayLimit: 1, knownPairMacros: true,
          nodes: 4, beam: 1, taps: 4, proofNodes: 2, decisionMs: undefined, deadline }, { boardMode: 'standard' });
        return { ...policy,
          observe(state, observation) {
            observations.push({ taps: state.physicalTaps, peek: state.openPeek, hidden: observation.pictures[2] });
            if (observation.pictures[2] !== null) assert(state.openPeek === 2 || !state.alive[2]);
            policy.observe(state, observation);
          },
          decide() { const selected = policy.decide(); choices.push(selected.plan.index); return selected; } };
      } });
    assert.equal(report.status, 'cleared'); assert(session.view().win);
    assert.equal(report.observedFact, false); assert.equal(JSON.stringify(memory), before);
    assert(observations.some(row => row.hidden === null)); assert(observations.some(row => row.hidden === hiddenPicture));
    assert.equal(verifyAttempt(encodeGame(game), report.path, settings, session.audit()), report.path.length);
    firstChoices.push(choices[0]);
    const expired = factory(game, settings);
    assert.equal(informationPlayout({ game, session: expired, candidate: 0, memory, roleAt: visibleRole,
      deadline: 0, createPolicy: () => { throw Error('Expired play-out created a policy'); } }).status, 'unresolved');
    assert.equal(expired.view().state.physicalTaps, 0);
  }
  assert.equal(firstChoices[0], firstChoices[1], 'A hidden replacement cannot affect decisions before it is seen');
  const policy = createHumanController(tiles);
  assert.throws(() => policy.rememberPublic({ pictures: [], down: [], initialRoles: [] }));
  assert.throws(() => policy.rememberPublic({ pictures: [], down: [], initialRoles: [], seed: 7 }));
  policy.beginAttempt();
  assert.throws(() => policy.rememberPublic({ pictures: [], down: [], initialRoles: [] }));
  factory.verifySource();
  console.log('PASS production-session play-outs use the fast primary policy, reveal closed pictures only after real taps, preserve actual memory and hidden-swap invariance, independently replay clears and retain expired work as unresolved');
}

if (require.main === module) test();
module.exports = test;
