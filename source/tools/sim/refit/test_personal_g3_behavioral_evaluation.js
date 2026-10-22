'use strict';
const assert = require('assert/strict');
const {
  detectChangePoint,
  computeActionProbabilities,
  computeCalibrationMetrics,
  evaluatePlayerCompleteGames,
  evaluateAllPlayersG3
} = require('./personal_g3_behavioral_evaluation.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing personal G3 behavioral evaluation across complete chronological games...');

// 1. Test computeActionProbabilities unit behavior
const dummyGeom = {
  tiles: [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }],
  nb: { above: [[], []], left: [[], []], right: [[], []] },
  rules: null, clock: null
};
const dummyState = {
  pictures: [1, 2],
  down: [0, 0],
  alive: [1, 1],
  tray: [1],
  moves: 0,
  openPeek: -1,
  relieved: false,
  arriving: []
};
const legalMoves = [{ index: 0, inspect: false }, { index: 1, inspect: false }];
const probs = computeActionProbabilities(dummyGeom, dummyState, legalMoves, { trayBuffer: 2, clockPatience: 0.5 });
assert.equal(probs.length, 2);
assert(probs[0].probability > probs[1].probability, 'Matching tray tile 0 must have higher probability than single 1');
const sumProb = probs.reduce((s, p) => s + p.probability, 0);
assert(Math.abs(sumProb - 1.0) < 1e-6, 'Probabilities must sum to 1.0');

// 2. Test detectChangePoint unit behavior on synthetic shifted series
const syntheticGames = [
  ...Array.from({ length: 10 }, (_, i) => ({ t: 1000 + i * 10, take: [0, 1, 2] })), // small games
  ...Array.from({ length: 10 }, (_, i) => ({ t: 2000 + i * 10, take: [0, 1, 2, 3, 4, 5, 6, 7] })) // large games
];
const detectedCP = detectChangePoint(syntheticGames);
assert(detectedCP.changePointIndex >= 8 && detectedCP.changePointIndex <= 12, 'Must detect split near boundary of shift');
assert(detectedCP.changePointTime >= 1000);
assert(detectedCP.regimeSize >= 8);

// 3. Test computeCalibrationMetrics with synthetic predictions
const synthPreds = [
  { actionProbabilities: [{ index: 0, probability: 0.8 }, { index: 1, probability: 0.2 }], targetIndex: 0 },
  { actionProbabilities: [{ index: 0, probability: 0.7 }, { index: 1, probability: 0.3 }], targetIndex: 0 },
  { actionProbabilities: [{ index: 0, probability: 0.4 }, { index: 1, probability: 0.6 }], targetIndex: 1 }
];
const calibResult = computeCalibrationMetrics(synthPreds);
assert(Number.isFinite(calibResult.brierScore) && calibResult.brierScore >= 0);
assert(Number.isFinite(calibResult.logLoss) && calibResult.logLoss >= 0);
assert(Number.isFinite(calibResult.ece) && calibResult.ece >= 0);
assert.equal(calibResult.bins.length, 5);

// 4. Test evaluatePlayerCompleteGames across real player chronological blocks
for (const name of NAMES) {
  const playerResult = evaluatePlayerCompleteGames(name, { maxGames: 2 });
  assert.equal(playerResult.playerName, name);
  assert(playerResult.evaluatedCompleteGames > 0, `${name}: must evaluate at least 1 complete game`);
  assert(playerResult.evaluatedDecisions >= 10, `${name}: must evaluate at least 10 decisions across complete games`);

  // Verify provenance fields
  assert(Number.isFinite(playerResult.provenance.trainCutoff));
  assert(Array.isArray(playerResult.provenance.games) && playerResult.provenance.games.length > 0);
  for (const g of playerResult.provenance.games) {
    assert(typeof g.aid === 'string');
    assert(typeof g.boardId === 'string' && g.boardId.length === 64);
    assert(typeof g.publicBoardId === 'string' && g.publicBoardId.length === 64);
    assert(Number.isInteger(g.openedAt) && Number.isInteger(g.availableAt));
    assert(g.availableAt >= g.openedAt);
  }

  // Verify model comparisons (including generic reference and alternative personal model)
  const mc = playerResult.modelComparisons;
  assert(mc.personalBot && typeof mc.personalBot.top1Accuracy === 'number');
  assert(mc.genericReferenceBot && typeof mc.genericReferenceBot.top1Accuracy === 'number');
  assert(mc.simpleGreedyBaseline && typeof mc.simpleGreedyBaseline.top1Accuracy === 'number');
  assert(mc.randomBaseline && typeof mc.randomBaseline.expectedTop1Accuracy === 'number');
  assert(mc.alternativePersonalModel && typeof mc.alternativePersonalModel.top1Accuracy === 'number');
  assert.equal(mc.alternativePersonalModel.name, 'defensivePersonalVariant');

  // Verify adaptation comparison: recency-weighted vs rolling-window vs change-point vs static
  const ac = playerResult.adaptationComparison;
  assert(ac.recencyWeighted && ac.recencyWeighted.parameters);
  assert(ac.rollingWindow && ac.rollingWindow.parameters && Number.isFinite(ac.rollingWindow.windowStartTime));
  assert(ac.changePoint && ac.changePoint.parameters && Number.isFinite(ac.changePoint.changePointTime));
  assert(ac.staticHistorical && ac.staticHistorical.parameters);

  // Verify calibration metrics
  const apc = playerResult.actionProbabilityCalibration;
  assert(Number.isFinite(apc.brierScore));
  assert(Number.isFinite(apc.logLoss));
  assert(Number.isFinite(apc.ece));

  // Verify inspection metrics
  const ib = playerResult.inspectionBehavior;
  assert(Number.isFinite(ib.humanInspectionRate) && ib.humanInspectionRate >= 0 && ib.humanInspectionRate <= 1);
  assert(Number.isFinite(ib.botInspectionRate) && ib.botInspectionRate >= 0 && ib.botInspectionRate <= 1);

  // Verify clock behavior
  const cb = playerResult.clockBehavior;
  assert(Number.isInteger(cb.totalClockMoves));

  // Verify key behavior
  const kb = playerResult.keyBehavior;
  assert(Number.isInteger(kb.totalKeyMoves));

  // Verify route / retry behavior
  const rrb = playerResult.routeRetryBehavior;
  assert(Number.isInteger(rrb.totalRetriesObserved));
  assert(Number.isFinite(rrb.humanRouteDivergenceRate));
  assert(Number.isFinite(rrb.botRouteDivergenceRate));

  // Verify timing behavior
  const tb = playerResult.timingBehavior;
  assert(Number.isInteger(tb.totalRecordedTapIntervals));
  assert(Number.isFinite(tb.meanDecisionLatencyMs));

  // Verify risk behavior
  const rb = playerResult.riskBehavior;
  assert(Number.isFinite(rb.humanRiskySingleAdditionRate));
  assert(Number.isFinite(rb.botRiskySingleAdditionRate));

  // Verify tray metrics
  const tm = playerResult.trayMetrics;
  assert(Number.isFinite(tm.totalVariationDistance));
  assert(Number.isFinite(tm.wassersteinDistance));
  assert.equal(tm.status, 'ARITHMETIC_VERIFIED_EQUIVALENCE_UNVERIFIED');

  console.log(`  ${name}: evaluated ${playerResult.evaluatedCompleteGames} complete games, ${playerResult.evaluatedDecisions} decisions. Top-1: personal=${mc.personalBot.top1Accuracy}, altPersonal=${mc.alternativePersonalModel.top1Accuracy}, ref=${mc.genericReferenceBot.top1Accuracy}, rand=${mc.randomBaseline.expectedTop1Accuracy}. Brier=${apc.brierScore}, ECE=${apc.ece}, changePointTime=${ac.changePoint.changePointTime}`);
}

console.log('PASS G3 behavioral evaluation: action probabilities, Brier calibration, inspection/reinspection, clock/key preparation, route changes, timing, model comparisons, and chronological adaptation (recency, rolling, change-point, static)');
