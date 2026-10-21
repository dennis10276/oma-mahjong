'use strict';
const assert = require('assert/strict');
const { reconstructHumanDecisions } = require('./human_decision_dataset.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing human decision dataset reconstruction...');

for (const name of NAMES) {
  const result = reconstructHumanDecisions(name);
  assert(result.gamesProcessed > 0, `Expected games for ${name}`);
  assert(result.decisionCount > 100, `Expected >100 decisions for ${name}, got ${result.decisionCount}`);

  for (const d of result.decisions) {
    // 1. Strict pre-action boundary: legalTiles must contain targetIndex
    assert(Array.isArray(d.legalTiles) && d.legalTiles.includes(d.targetIndex),
      'Target index must be a legal action in the pre-action state');

    // 2. Action classification validity
    assert(['inspection', 'trayMatch', 'boardMatch', 'singleTrayAdd'].includes(d.actionKind),
      `Invalid action kind: ${d.actionKind}`);

    // 3. Inspection outcome separation
    if (d.actionKind === 'inspection') {
      assert(d.revealedFace !== null, 'Inspection must have a revealed face outcome');
    } else {
      assert(d.revealedFace === null, 'Non-inspection must not leak revealed face');
    }

    // 4. Exact board and campaign identity binding
    assert(typeof d.boardId === 'string' && d.boardId.length === 64, 'Must have valid SHA256 boardId');
    assert(typeof d.publicBoardId === 'string' && d.publicBoardId.length === 64, 'Must have valid SHA256 publicBoardId');
    assert(typeof d.campaignId === 'string' && d.campaignId.length > 0, 'Must have valid campaignId');
    assert(Number.isInteger(d.attempt) && d.attempt >= 1, 'Attempt number must be >= 1');

    // 5. Actual opening, completion and data-availability timestamps
    assert(Number.isInteger(d.openedAt) && Number.isInteger(d.availableAt), 'Must have integer timestamps');
    assert(d.availableAt >= d.openedAt, 'Data availability/completion must be >= opening timestamp');
    assert.equal(d.t, d.openedAt, 't must equal openedAt');
  }

  // 6. Test chronological ordering
  for (let i = 1; i < result.decisions.length; i++) {
    assert(result.decisions[i].t >= result.decisions[i - 1].t, 'Decisions must be chronologically sorted');
  }

  // 7. Test chronological cutoff: training may use only earlier available information
  const midCutoff = 1792000000000;
  const causalResult = reconstructHumanDecisions(name, midCutoff);
  assert(causalResult.decisions.length <= result.decisions.length);
  assert(causalResult.decisions.every(d => d.availableAt < midCutoff && d.openedAt < midCutoff),
    'Training for a target must use only earlier available information');
}

console.log('PASS human decision dataset: pre-action state integrity, action classification, campaign binding, and chronological ordering verified');

// A replay followed by a retry must never rejoin the earlier campaign.
// Fixtures are injected only in this test process; they are not human evidence.
const mimicFile = require.resolve('./mimic_games.js');
const datasetFile = require.resolve('./human_decision_dataset.js');
const actualGamesOf = require.cache[mimicFile].exports.gamesOf;
const fixture = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }],
  nb: { above: [[], []], left: [[], []], right: [[], []] },
  faces: [1, 1], down: [0, 0], rules: null, clock: null
};
try {
  require.cache[mimicFile].exports.gamesOf = () => [
    { key: 'synthetic', aid: 'old', at: 1, t: 1, availableAt: 1, won: true, take: [0], g: fixture },
    { key: 'synthetic', aid: 'replay', at: 1, t: 2, availableAt: 2, won: false, take: [0], g: fixture },
    { key: 'synthetic', aid: 'retry', at: 2, t: 3, availableAt: 3, won: false, take: [0, 99], g: fixture }
  ];
  delete require.cache[datasetFile];
  const result = require(datasetFile).reconstructHumanDecisions('Gerda');
  const [old, replay, retry] = result.decisions;
  assert.notEqual(old.campaignId, replay.campaignId);
  assert.equal(retry.campaignId, replay.campaignId);
  assert.equal(retry.attempt, 2);
  assert.equal(result.unresolvedEvents.length, 1);
  assert.equal(result.unresolvedEvents[0].status, 'unresolved');
  assert.equal(result.unresolvedEvents[0].actionIndex, 99);
  console.log('PASS: replay campaign reset, local retry numbering, unresolved event retention');
} finally {
  require.cache[mimicFile].exports.gamesOf = actualGamesOf;
  delete require.cache[datasetFile];
}
