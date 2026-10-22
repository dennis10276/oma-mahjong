'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { compareTrayCounts, auditTrayResult, testTrayEquivalenceBootstrap } = require('./independent_tray_metrics.js');
const { evaluatePlayerCompleteGames } = require('./personal_g3_behavioral_evaluation.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing tray metric integrity and preregistered equivalence protocol across held-out blocks...');

// 1. Synthetic integrity tests: forged distance rejection and mathematical properties
const perfectMatch = compareTrayCounts({ 0: 50, 1: 50, 2: 0, 3: 0 }, { 0: 50, 1: 50, 2: 0, 3: 0 });
assert.equal(perfectMatch.totalVariationDistance, 0);
assert.equal(perfectMatch.wassersteinDistance, 0);
assert.equal(perfectMatch.humanSamples, 100);
assert.equal(perfectMatch.botSamples, 100);

const totalDivergence = compareTrayCounts({ 0: 100, 1: 0, 2: 0, 3: 0 }, { 0: 0, 1: 0, 2: 0, 3: 100 });
assert.equal(totalDivergence.totalVariationDistance, 1.0);
assert.equal(totalDivergence.wassersteinDistance, 3.0);

// Forged distances must fail closed
assert.throws(() => auditTrayResult({
  humanTrayCounts: { 0: 50, 1: 50, 2: 0, 3: 0 },
  botTrayCounts: { 0: 0, 1: 50, 2: 50, 3: 0 },
  trayComparison: { totalVariationDistance: 0.1, wassersteinDistance: 0.1 }
}), /does not reproduce/);

// 2. Statistical equivalence bootstrap tests
// 2a. Small sample size blindness protection: 5 identical samples has observed TVD=0 but insufficient sample size
const smallIdentical = testTrayEquivalenceBootstrap({ 0: 5, 1: 0, 2: 0, 3: 0 }, { 0: 5, 1: 0, 2: 0, 3: 0 }, { resamples: 500 });
assert.equal(smallIdentical.observedTVD, 0);
assert.equal(smallIdentical.equivalenceVerified, false, 'Small sample (N=5) must NOT establish equivalence despite TVD=0');
assert.equal(smallIdentical.conclusion, 'UNVERIFIED_INSUFFICIENT_SAMPLES');

// 2b. High divergence: TVD=1.0 must never establish equivalence
const divergentEquiv = testTrayEquivalenceBootstrap({ 0: 100, 1: 0, 2: 0, 3: 0 }, { 0: 0, 1: 0, 2: 0, 3: 100 }, { resamples: 500 });
assert.equal(divergentEquiv.observedTVD, 1.0);
assert.equal(divergentEquiv.equivalenceVerified, false);

// 2c. Large identical samples (N=1000) with true TVD=0 will establish equivalence
const largeIdentical = testTrayEquivalenceBootstrap({ 0: 500, 1: 500, 2: 0, 3: 0 }, { 0: 500, 1: 500, 2: 0, 3: 0 }, { resamples: 500 });
assert.equal(largeIdentical.observedTVD, 0);
assert.equal(largeIdentical.equivalenceVerified, true, 'Large sample (N=1000) with identical distribution must satisfy equivalence');

// 3. Recompute distances from raw counts across independently held-out multi-game blocks
const results = {};
for (const name of NAMES) {
  const evalResult = evaluatePlayerCompleteGames(name, { maxGames: 3 });
  const rawHuman = evalResult.trayMetrics.humanTrayCounts;
  const rawBot = evalResult.trayMetrics.botTrayCounts;

  // Recompute with independent_tray_metrics
  const computed = compareTrayCounts(rawHuman, rawBot);
  assert(Number.isFinite(computed.totalVariationDistance));
  assert(Number.isFinite(computed.wassersteinDistance));
  assert.equal(computed.humanSamples, Object.values(rawHuman).reduce((a, b) => a + b, 0));
  assert.equal(computed.botSamples, Object.values(rawBot).reduce((a, b) => a + b, 0));

  // Audit function must confirm integrity but report fidelity unestablished
  const audit = auditTrayResult({
    humanTrayCounts: rawHuman,
    botTrayCounts: rawBot,
    trayComparison: {
      totalVariationDistance: computed.totalVariationDistance,
      wassersteinDistance: computed.wassersteinDistance
    }
  });
  assert.equal(audit.fidelityEstablished, false);
  assert.equal(audit.status, 'NEEDS_REVIEWED_EQUIVALENCE_PROTOCOL_AND_INDEPENDENT_TEST_BLOCKS');

  // Run bootstrap equivalence test on real data
  const equiv = testTrayEquivalenceBootstrap(rawHuman, rawBot, { resamples: 500 });
  assert.equal(equiv.equivalenceVerified, false, `${name}: current held-out data must honestly report equivalence UNVERIFIED`);
  assert(equiv.conclusion.startsWith('UNVERIFIED'), `${name}: conclusion must start with UNVERIFIED`);

  results[name] = {
    sampleCounts: { human: computed.humanSamples, bot: computed.botSamples },
    perGameCount: evalResult.provenance.games.length,
    rawHuman,
    rawBot,
    totalVariationDistance: +(computed.totalVariationDistance.toFixed(4)),
    wassersteinDistance: +(computed.wassersteinDistance.toFixed(4)),
    upperConfidenceLimit: equiv.upperConfidenceLimit,
    equivalenceStatus: 'UNVERIFIED'
  };

  console.log(`  ${name}: ${evalResult.provenance.games.length} test games, humanSamples=${computed.humanSamples}, botSamples=${computed.botSamples}, TVD=${results[name].totalVariationDistance}, UCL=${equiv.upperConfidenceLimit} (Equivalence: UNVERIFIED)`);
}

// 4. Confirm that protocol document exists and defines the preregistered hypotheses
const protocolDoc = path.join(__dirname, 'TRAY_EQUIVALENCE_PROTOCOL.md');
assert(fs.existsSync(protocolDoc), 'TRAY_EQUIVALENCE_PROTOCOL.md must exist');
const docText = fs.readFileSync(protocolDoc, 'utf8');
assert(docText.includes('Bootstrap Equivalence Protocol'), 'Must define bootstrap protocol');
assert(docText.includes('Holm-Bonferroni'), 'Must include family-wise error rate control');

console.log('PASS tray metric integrity verified across complete chronological games. Tray equivalence correctly reported as UNVERIFIED.');
