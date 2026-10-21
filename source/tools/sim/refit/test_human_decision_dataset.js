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
  }

  // 5. Test chronological ordering
  for (let i = 1; i < result.decisions.length; i++) {
    assert(result.decisions[i].t >= result.decisions[i - 1].t, 'Decisions must be chronologically sorted');
  }
}

console.log('PASS human decision dataset: pre-action state integrity, action classification, campaign binding, and chronological ordering verified');
