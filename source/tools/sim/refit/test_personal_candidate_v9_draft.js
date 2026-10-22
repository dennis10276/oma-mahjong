'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { generateTargets, computeSourceClosureHashes, generateCandidateDraft, V9_FRONTIERS } = require('./generate_personal_witness_v9.js');
const { prepareRegistration } = require('./register_personal_candidate.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing candidate v9 draft generation, targets, and registration guard integration...');

async function main() {
  // 1. Verify target generation
  const targets = generateTargets();
  assert.equal(targets.length, 80, 'Expected exactly 80 targets (20 per player)');

  const playerCounts = Object.fromEntries(NAMES.map(n => [n, 0]));
  for (const t of targets) {
    assert(NAMES.includes(t.name), `Unknown player ${t.name}`);
    assert(Number.isInteger(t.lv), 'Level must be integer');
    assert(t.lv >= V9_FRONTIERS[t.name], `Level ${t.lv} must be >= frontier ${V9_FRONTIERS[t.name]}`);
    assert(typeof t.board === 'string' && /^[0-9a-f]{64}$/.test(t.board), 'Board ID must be 64-char hex SHA256');
    playerCounts[t.name]++;
  }
  for (const name of NAMES) {
    assert.equal(playerCounts[name], 20, `${name} must have 20 targets`);
  }

  // 2. Verify targets are strictly unopened in the existing live outcomes archive
  const liveOutcomesPath = path.resolve(__dirname, '../../../analysis/archive/personal-bots/live-openings-2026-10-20T15-29-12-622Z/personal-outcomes.json');
  const liveOutcomes = JSON.parse(fs.readFileSync(liveOutcomesPath, 'utf8'));
  for (const t of targets) {
    const wasOpened = liveOutcomes.episodes.some(e => e.name === t.name && e.lv === t.lv);
    assert(!wasOpened, `Target ${t.name} L${t.lv} was already opened in historical live archive!`);
  }

  // 3. Verify source closure hashing
  const hashes = computeSourceClosureHashes();
  assert(typeof hashes === 'object' && Object.keys(hashes).length >= 25, 'Source closure must cover >= 25 files');
  assert(hashes['source/tools/sim/refit/generate_personal_witness_v9.js']);
  assert(hashes['source/tools/sim/refit/register_personal_candidate.js']);

  // 4. Verify candidate draft format satisfies prepareRegistration constraints
  const now = Date.now();
  const draft = {
    model: 'source-bound-personal-witness-v9',
    generatedAt: now - 5000,
    progressionStartLevels: { ...V9_FRONTIERS },
    forecasts: targets.map(t => ({
      name: t.name,
      lv: t.lv,
      board: t.board,
      predictedAttempt: 1
    })),
    quantitativeSourceHashes: hashes
  };

  // Must NOT contain frozenAt or cohortStartsAfter
  assert(!Object.hasOwn(draft, 'frozenAt'), 'Draft must not have frozenAt');
  assert(!Object.hasOwn(draft, 'cohortStartsAfter'), 'Draft must not have cohortStartsAfter');

  // Test prepareRegistration with a simulated fresh live check
  const freshLive = {
    evidence: 'separate-live-completed-and-pending-outcomes',
    observedAt: new Date(now - 1000).toISOString(),
    episodes: liveOutcomes.episodes,
    unresolvedBoards: 0
  };

  const anchor = prepareRegistration(draft, freshLive, now);
  assert.equal(anchor.model, 'source-bound-personal-witness-v9');
  assert.equal(anchor.frozenAt, now);
  assert.equal(anchor.cohortStartsAfter, now);
  assert.equal(anchor.targetMet, false);
  assert.equal(anchor.forecasts.length, 80);

  // Stale live snapshot (>300s or before generation) must be rejected
  assert.throws(() => {
    prepareRegistration(draft, { ...freshLive, observedAt: new Date(now - 400000).toISOString() }, now);
  }, /fresh opening check/);

  // Targets already opened must be rejected
  assert.throws(() => {
    const badDraft = {
      ...draft,
      forecasts: [...draft.forecasts, { name: 'Mrs. Doubtfire', lv: 107, board: 'a'.repeat(64), predictedAttempt: 1 }]
    };
    prepareRegistration(badDraft, freshLive, now);
  }, /already opened/);

  // 5. Test real end-to-end draft generation with worker threads on a test subset
  const testDraftPath = path.join(__dirname, 'test_draft_v9_out.json');
  try {
    const generated = await generateCandidateDraft(testDraftPath, {
      maxTargetsPerPlayer: 1,
      campaignsPerTarget: 2,
      skipCalibration: true
    });
    assert(fs.existsSync(testDraftPath), 'Draft file must be created on disk');
    assert.equal(generated.forecasts.length, 4, 'Must generate 1 target per player = 4 forecasts');
    assert.equal(generated.model, 'source-bound-personal-witness-v9');
    for (const fc of generated.forecasts) {
      assert(Number.isInteger(fc.predictedAttempt) && fc.predictedAttempt >= 1 && fc.predictedAttempt <= 8);
      assert.equal(fc.campaignCount, 2);
      assert(Array.isArray(fc.campaignResults) && fc.campaignResults.length === 2);
    }
  } finally {
    if (fs.existsSync(testDraftPath)) fs.unlinkSync(testDraftPath);
  }

  console.log('PASS candidate v9 draft: explicit new frontiers, unopened targets, source closure, end-to-end simulation, and registration guard verification verified');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
