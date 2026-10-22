'use strict';
const assert = require('assert/strict');

function distribution(counts) {
  assert(counts && Object.keys(counts).length === 4, 'Need four raw tray bins');
  const values = Array.from({length: 4}, (_, k) => counts[k]);
  assert(values.every(n => Number.isSafeInteger(n) && n >= 0), 'Invalid raw counts');
  const n = values.reduce((a, b) => a + b, 0);
  assert(n > 0, 'Empty samples');
  return { p: values.map(v => v / n), n };
}

function compareTrayCounts(humanCounts, botCounts) {
  const h = distribution(humanCounts), b = distribution(botCounts);
  let tvd = 0, w1 = 0, c = 0;
  for (let k = 0; k < 4; k++) {
    const d = h.p[k] - b.p[k];
    tvd += Math.abs(d) / 2;
    c += d;
    if (k < 3) w1 += Math.abs(c);
  }
  return { totalVariationDistance: tvd, wassersteinDistance: w1, humanSamples: h.n, botSamples: b.n };
}

function auditTrayResult(row) {
  const m = compareTrayCounts(row.humanTrayCounts, row.botTrayCounts);
  for (const key of ['totalVariationDistance', 'wassersteinDistance']) {
    assert(Number.isFinite(row.trayComparison?.[key]) && Math.abs(row.trayComparison[key] - m[key]) <= 0.00011, key + ' does not reproduce from raw counts');
  }
  return { ...m, fidelityEstablished: false, status: 'NEEDS_REVIEWED_EQUIVALENCE_PROTOCOL_AND_INDEPENDENT_TEST_BLOCKS' };
}

/**
 * Nonparametric bootstrap upper confidence bound on TVD for equivalence testing (Wellek 2010).
 * H0: TVD(P_H, P_B) >= epsilon0 (non-equivalence)
 * H1: TVD(P_H, P_B) < epsilon0 (equivalence)
 * 
 * Rejects H0 at significance level alpha if and only if:
 * 1. Both human and bot sample counts satisfy minimum preregistered size (N_H >= 100, N_B >= 100)
 * 2. The (1 - alpha) bootstrap upper confidence limit of TVD is strictly less than epsilon0.
 */
function testTrayEquivalenceBootstrap(humanCounts, botCounts, options = {}) {
  const alpha = options.alpha ?? 0.05;
  const epsilon0 = options.epsilon0 ?? 0.20;
  const minSamples = options.minSamples ?? 100;
  const B = options.resamples ?? 2000;
  const seed = options.seed ?? 12345;

  const h = distribution(humanCounts);
  const b = distribution(botCounts);
  const observed = compareTrayCounts(humanCounts, botCounts);

  let state = seed >>> 0;
  const rng = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  function resampleCDF(probs, N) {
    const counts = [0, 0, 0, 0];
    const cdf = [probs[0], probs[0] + probs[1], probs[0] + probs[1] + probs[2], 1.0];
    for (let i = 0; i < N; i++) {
      const u = rng();
      let bin = 0;
      while (bin < 3 && u > cdf[bin]) bin++;
      counts[bin]++;
    }
    return counts.map(c => c / N);
  }

  const bootstrapTVDs = [];
  for (let iter = 0; iter < B; iter++) {
    const pH_star = resampleCDF(h.p, h.n);
    const pB_star = resampleCDF(b.p, b.n);
    let tvd_star = 0;
    for (let k = 0; k < 4; k++) tvd_star += Math.abs(pH_star[k] - pB_star[k]) / 2;
    bootstrapTVDs.push(tvd_star);
  }

  bootstrapTVDs.sort((x, y) => x - y);
  const uclIndex = Math.min(B - 1, Math.floor((1 - alpha) * B));
  const upperConfidenceLimit = bootstrapTVDs[uclIndex];
  const sufficientSamples = h.n >= minSamples && b.n >= minSamples;
  const equivalenceVerified = sufficientSamples && upperConfidenceLimit < epsilon0;

  let conclusion;
  if (!sufficientSamples) conclusion = 'UNVERIFIED_INSUFFICIENT_SAMPLES';
  else if (equivalenceVerified) conclusion = 'EQUIVALENCE_ESTABLISHED';
  else conclusion = 'UNVERIFIED';

  return {
    observedTVD: observed.totalVariationDistance,
    observedW1: observed.wassersteinDistance,
    upperConfidenceLimit: +(upperConfidenceLimit.toFixed(4)),
    epsilon0,
    alpha,
    humanSamples: h.n,
    botSamples: b.n,
    minSamplesRequired: minSamples,
    sufficientSamples,
    resamples: B,
    equivalenceVerified,
    conclusion
  };
}

module.exports = {
  distribution,
  compareTrayCounts,
  auditTrayResult,
  testTrayEquivalenceBootstrap
};
