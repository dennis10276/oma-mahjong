'use strict';
/**
 * t_m1_challenger_optimizer.js
 *
 * M1 Challenger 1 Adversarial Stress Test Suite for derivePointForecast and
 * Voorspeltest tolerance scoring.
 *
 * Covers:
 * 1. Independent Mathematical Oracle vs derivePointForecast across all implementations
 * 2. Severe Bimodal Distributions (50/50, 49/51, 51/49 across all pairs)
 * 3. Heavy Retry Tails (100% try8, 100% noClear, geometric, Pareto, endless loop)
 * 4. Boundary Transitions Across Tolerance Bands (3 vs 4, 5 vs 6, 7 vs 8, 7 vs noClear)
 * 5. Generative Dirichlet Monte Carlo Simplex (10,000 random distributions)
 * 6. Edge Cases & Numerical Safety (empty, zero, single, missing, extreme values)
 */

const assert = require('assert/strict');
const path = require('path');

// Target implementations to stress-test
const heldout = require('../tools/sim/refit/evaluate_heldout.js');
const v10 = require('../tools/sim/refit/generate_personal_witness_v10.js');
const v9 = require('../tools/sim/refit/generate_personal_witness_v9.js');
const v8 = require('../tools/sim/refit/generate_personal_witness_v8.js');
const ForecastScore = require('../tools/sim/refit/official_forecast_score.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function check(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
  } catch (err) {
    failedTests.push({ desc, error: err });
    console.error(`  FAIL: ${desc}`);
    console.error(`    ${err.message}`);
  }
}

/**
 * Independent Mathematical Oracle
 * Computes exact expected score under official Voorspeltest tolerance rules
 * and returns the optimal point forecast p in {1..8}.
 */
function independentOracle(dist) {
  // 1. Determine mode
  let mode = 1;
  let maxP = dist['try1'] || 0;
  for (let a = 2; a <= 8; a++) {
    const val = dist[`try${a}`] || 0;
    if (val > maxP) {
      maxP = val;
      mode = a;
    }
  }
  if ((dist.noClear || 0) > maxP) {
    mode = 8;
  }

  // 2. Compute expected score for each candidate p in 1..8
  const scores = {};
  let bestScore = -Infinity;
  for (let p = 1; p <= 8; p++) {
    let s = 0;
    for (let a = 1; a <= 8; a++) {
      s += (dist[`try${a}`] || 0) * (ForecastScore.correct(p, a) ? 1 : 0);
    }
    // Crucial rule: incomplete / >= 9 tries only scores if p >= 8
    s += (dist.noClear || 0) * (p >= 8 ? 1 : 0);
    scores[p] = s;
    if (s > bestScore) {
      bestScore = s;
    }
  }

  // 3. Find argmax with deterministic tie-breaking (closest to mode, then lower p)
  let bestP = 1;
  let bestDiff = Infinity;
  for (let p = 1; p <= 8; p++) {
    if (Math.abs(scores[p] - bestScore) < 1e-9) {
      const diff = Math.abs(p - mode);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestP = p;
      } else if (diff === bestDiff && p < bestP) {
        bestP = p;
      }
    }
  }

  return {
    bestP,
    bestScore,
    scores,
    mode
  };
}

console.log('======================================================================');
console.log('CHALLENGER 1: ADVERSARIAL STRESS TEST SUITE (derivePointForecast)');
console.log('======================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: Implementation Parity Across Active Tools
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: Parity Across evaluate_heldout, v10, v9, and v8 ---');

const sampleDistributions = [
  { desc: '100% try1', dist: { try1: 1.0 } },
  { desc: '100% try8', dist: { try8: 1.0 } },
  { desc: '100% noClear', dist: { noClear: 1.0 } },
  { desc: '50% try1, 50% noClear', dist: { try1: 0.5, noClear: 0.5 } },
  { desc: '50% try4, 50% try5', dist: { try4: 0.5, try5: 0.5 } },
  { desc: 'Dennis L158 (75% noClear)', dist: { noClear: 0.75, try5: 0.125, try7: 0.125 } },
  { desc: 'Gerda L116 (87.5% noClear)', dist: { noClear: 0.875, try1: 0.125 } },
  { desc: 'Mrs. Doubtfire L107 (try3 mode)', dist: { try2: 0.1667, try3: 0.5, try4: 0.3333 } },
  { desc: 'PUK L59 uniform 1..8', dist: { try1: 0.125, try2: 0.125, try3: 0.125, try4: 0.125, try5: 0.125, try6: 0.125, try7: 0.125, try8: 0.125 } }
];

for (const sd of sampleDistributions) {
  check(`Parity on ${sd.desc}`, () => {
    const rHeldout = heldout.derivePointForecast(sd.dist);
    const rV10 = v10.derivePointForecast(sd.dist);
    const rV9 = v9.derivePointForecast(sd.dist);
    const rV8 = v8.derivePointForecast(sd.dist);
    const oracle = independentOracle(sd.dist);

    assert.equal(rHeldout.predictedAttempt, oracle.bestP, 'heldout matches oracle predictedAttempt');
    assert.equal(rV10.predictedAttempt, oracle.bestP, 'v10 matches oracle predictedAttempt');
    assert.equal(rV9.predictedAttempt, oracle.bestP, 'v9 matches oracle predictedAttempt');
    assert.equal(rV8.predictedAttempt, oracle.bestP, 'v8 matches oracle predictedAttempt');

    assert.equal(rHeldout.expectedScore, +(oracle.bestScore.toFixed(4)), 'heldout matches oracle expectedScore');
    assert.equal(rV10.expectedScore, +(oracle.bestScore.toFixed(4)), 'v10 matches oracle expectedScore');
    assert.equal(rV9.expectedScore, +(oracle.bestScore.toFixed(4)), 'v9 matches oracle expectedScore');
    assert.equal(rV8.expectedScore, +(oracle.bestScore.toFixed(4)), 'v8 matches oracle expectedScore');
  });
}

// ----------------------------------------------------------------------------
// SUITE 2: Severe Bimodal Distributions
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Severe Bimodal Distributions ---');

const outcomes = ['try1', 'try2', 'try3', 'try4', 'try5', 'try6', 'try7', 'try8', 'noClear'];

// Test all 36 distinct pairs of outcomes with 50/50, 49/51, and 51/49 splits
for (let i = 0; i < outcomes.length; i++) {
  for (let j = i + 1; j < outcomes.length; j++) {
    const o1 = outcomes[i];
    const o2 = outcomes[j];

    const splits = [
      { w1: 0.50, w2: 0.50, tag: '50/50' },
      { w1: 0.51, w2: 0.49, tag: '51/49' },
      { w1: 0.49, w2: 0.51, tag: '49/51' }
    ];

    for (const split of splits) {
      check(`Bimodal ${o1} (${split.w1}) vs ${o2} (${split.w2}) [${split.tag}]`, () => {
        const dist = { [o1]: split.w1, [o2]: split.w2 };
        const res = heldout.derivePointForecast(dist);
        const oracle = independentOracle(dist);

        assert.equal(res.predictedAttempt, oracle.bestP, `Selected p=${res.predictedAttempt} must equal oracle p=${oracle.bestP}`);
        assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)), `Score must match oracle`);
        assert.ok(res.predictedAttempt >= 1 && res.predictedAttempt <= 8, `p must be within [1, 8]`);
        assert.ok(Number.isInteger(res.predictedAttempt), `p must be integer`);
        assert.ok(res.expectedScore >= 0 && res.expectedScore <= 1, `expectedScore must be within [0, 1]`);

        // Check that no other p achieves a strictly higher expected score
        for (let cand = 1; cand <= 8; cand++) {
          assert.ok(
            oracle.scores[res.predictedAttempt] >= oracle.scores[cand] - 1e-9,
            `Candidate p=${cand} score ${oracle.scores[cand]} exceeds selected p=${res.predictedAttempt} score ${oracle.scores[res.predictedAttempt]}`
          );
        }
      });
    }
  }
}

// ----------------------------------------------------------------------------
// SUITE 3: Heavy Retry Tails & Endless Loop Traps
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Heavy Retry Tails & Endless Loop Traps ---');

// 3.1: Dominant and pure retry tails
const tailDistributions = [
  { desc: '100% noClear', dist: { noClear: 1.0 }, expectP: 8 },
  { desc: '99.9% noClear, 0.1% try1', dist: { noClear: 0.999, try1: 0.001 }, expectP: 8 },
  { desc: '95% noClear, 5% try2', dist: { noClear: 0.95, try2: 0.05 }, expectP: 8 },
  { desc: '90% noClear, 10% try5', dist: { noClear: 0.90, try5: 0.10 }, expectP: 8 },
  { desc: '80% noClear, 20% try6', dist: { noClear: 0.80, try6: 0.20 }, expectP: 8 },
  { desc: '70% noClear, 30% try7', dist: { noClear: 0.70, try7: 0.30 }, expectP: 8 },
  { desc: '60% noClear, 40% try8', dist: { noClear: 0.60, try8: 0.40 }, expectP: 8 },
  { desc: '100% try8', dist: { try8: 1.0 }, expectP: 8 },
  { desc: 'Endless Loop: 0.01% tries 1..8, 99.92% noClear', dist: {
      try1: 0.0001, try2: 0.0001, try3: 0.0001, try4: 0.0001,
      try5: 0.0001, try6: 0.0001, try7: 0.0001, try8: 0.0001,
      noClear: 0.9992
    }, expectP: 8 }
];

for (const td of tailDistributions) {
  check(`Tail test: ${td.desc}`, () => {
    const res = heldout.derivePointForecast(td.dist);
    const oracle = independentOracle(td.dist);
    assert.equal(res.predictedAttempt, td.expectP, `Heavy tail must select p=${td.expectP}`);
    assert.equal(res.predictedAttempt, oracle.bestP, `Must match oracle`);
    assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)), `Score must match oracle`);
  });
}

// 3.2: Geometric Retry Decay Tails: P(k) = (1-r)*r^(k-1)
const decayRates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
for (const r of decayRates) {
  check(`Geometric decay tail with retention r=${r}`, () => {
    const dist = {};
    let sum = 0;
    for (let k = 1; k <= 8; k++) {
      const p = (1 - r) * Math.pow(r, k - 1);
      dist[`try${k}`] = p;
      sum += p;
    }
    dist.noClear = Math.max(0, 1.0 - sum);

    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);
    assert.equal(res.predictedAttempt, oracle.bestP);
    assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)));

    // Verify mathematical optimality
    for (let cand = 1; cand <= 8; cand++) {
      assert.ok(oracle.scores[res.predictedAttempt] >= oracle.scores[cand] - 1e-9);
    }
  });
}

// 3.3: Adversarial "Trap" tail: High mass on noClear + try5, check if p=6 is mistakenly chosen
// Bug regression check: earlier buggy code chose p=6 whenever noClear was large!
for (let noClearProb = 0.5; noClearProb <= 0.99; noClearProb += 0.05) {
  check(`No-clear trap test: noClear=${noClearProb.toFixed(2)}, remainder split across try1..try7`, () => {
    const remainder = 1.0 - noClearProb;
    const dist = { noClear: noClearProb };
    for (let a = 1; a <= 7; a++) {
      dist[`try${a}`] = remainder / 7;
    }
    const res = heldout.derivePointForecast(dist);
    // Under this setup, p=8 covers try6, try7, try8, and noClear!
    // Expected score of p=8: noClear + 2*(remainder/7).
    // Expected score of p=6: covers try5, try6, try7, try8 => 3*(remainder/7).
    // p=8 score is vastly higher than p=6 score!
    assert.equal(res.predictedAttempt, 8, `Trap test: Must NEVER select p=6 when noClear dominates!`);
    const oracle = independentOracle(dist);
    assert.equal(res.predictedAttempt, oracle.bestP);
  });
}

// ----------------------------------------------------------------------------
// SUITE 4: Boundary Transitions Across Tolerance Bands
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Boundary Transitions Across Tolerance Bands ---');

// 4.1: Transition between Try 3 (Band 1, exact) and Try 4 (Band 2, +-1)
// p=3 covers {3, 4} (score = 1.0 for all mixtures!)
// p=4 covers {4, 5, 6} (score = 1-w for try3 weight w)
// Therefore p=3 strictly dominates for all w > 0, and ties at w=0 (where mode 4 selects p=4).
for (let step = 0; step <= 100; step++) {
  const w = +(step / 100).toFixed(2); // weight of try3
  check(`Boundary 3 vs 4: try3=${w}, try4=${+(1-w).toFixed(2)}`, () => {
    const dist = { try3: w, try4: +(1 - w).toFixed(2) };
    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);

    assert.equal(res.predictedAttempt, oracle.bestP);
    assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)));

    if (w > 0.0001) {
      assert.equal(res.predictedAttempt, 3, `p=3 covers both 3 and 4, so it must win for any try3 > 0`);
      assert.equal(res.expectedScore, 1.0, `Score must be 1.0 because p=3 covers both {3, 4}`);
    } else {
      // Pure try4: mode is 4, p=4 is chosen by tie-breaking distance
      assert.equal(res.predictedAttempt, 4, `At 100% try4, mode tie-break selects p=4`);
      assert.equal(res.expectedScore, 1.0);
    }
  });
}

// 4.2: Transition between Try 5 (Band 2, +-1) and Try 6 (Band 3, +-2)
// p=5 covers {4, 5, 6, 7} (covers both 5 and 6)
// p=6 covers {5, 6, 7, 8} (covers both 5 and 6)
// Both score 1.0 for all mixtures! Mode decides tie-break.
for (let step = 0; step <= 100; step++) {
  const w = +(step / 100).toFixed(2); // weight of try5
  check(`Boundary 5 vs 6: try5=${w}, try6=${+(1-w).toFixed(2)}`, () => {
    const dist = { try5: w, try6: +(1 - w).toFixed(2) };
    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);

    assert.equal(res.predictedAttempt, oracle.bestP);
    assert.equal(res.expectedScore, 1.0, `Both p=5 and p=6 cover {5, 6}, so score is 1.0`);

    if (w >= 0.50) {
      assert.equal(res.predictedAttempt, 5, `try5 >= 0.5 selects p=5 by mode proximity`);
    } else {
      assert.equal(res.predictedAttempt, 6, `try5 < 0.5 selects p=6 by mode proximity`);
    }
  });
}

// 4.3: Transition between Try 7 (Band 3) and Try 8 (Band 4)
// Both score 1.0. Mode decides.
for (let step = 0; step <= 100; step++) {
  const w = +(step / 100).toFixed(2); // weight of try7
  check(`Boundary 7 vs 8: try7=${w}, try8=${+(1-w).toFixed(2)}`, () => {
    const dist = { try7: w, try8: +(1 - w).toFixed(2) };
    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);

    assert.equal(res.predictedAttempt, oracle.bestP);
    assert.equal(res.expectedScore, 1.0);

    if (w >= 0.50) {
      assert.equal(res.predictedAttempt, 7);
    } else {
      assert.equal(res.predictedAttempt, 8);
    }
  });
}

// 4.4: Transition between Try 7 and noClear
// p=7 covers 7 (score w). p=8 covers 7 AND noClear (score 1.0).
// p=8 strictly dominates for all w < 1.0!
for (let step = 0; step <= 100; step++) {
  const w = +(step / 100).toFixed(2); // weight of try7
  check(`Boundary 7 vs noClear: try7=${w}, noClear=${+(1-w).toFixed(2)}`, () => {
    const dist = { try7: w, noClear: +(1 - w).toFixed(2) };
    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);

    assert.equal(res.predictedAttempt, oracle.bestP);
    assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)));

    if (w < 1.0) {
      assert.equal(res.predictedAttempt, 8, `p=8 covers both 7 and noClear, so p=8 must win whenever noClear > 0`);
    } else {
      assert.equal(res.predictedAttempt, 7, `Pure try7 selects p=7`);
    }
  });
}

// ----------------------------------------------------------------------------
// SUITE 5: Generative Dirichlet Monte Carlo Simplex (10,000 Distributions)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Generative Dirichlet Monte Carlo Simplex (10,000 distributions) ---');

// Marsaglia polar method for Gamma / Dirichlet sampling
function sampleGamma(shape) {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let u = Math.random();
    let v;
    let x;
    do {
      x = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleDirichlet(alphas) {
  const gammas = alphas.map(a => sampleGamma(a));
  const sum = gammas.reduce((acc, g) => acc + g, 0);
  return gammas.map(g => g / sum);
}

// 4 distinct Dirichlet regimes:
const regimes = [
  { name: 'Flat Dirichlet (alpha=1.0)', count: 2500, alphas: Array(9).fill(1.0) },
  { name: 'Sparse Dirichlet (alpha=0.2)', count: 2500, alphas: Array(9).fill(0.2) },
  { name: 'Heavy-Tail Dirichlet', count: 2500, alphas: [0.5, 0.5, 0.5, 1.0, 1.0, 2.0, 3.0, 4.0, 5.0] },
  { name: 'Early-Clear Dirichlet', count: 2500, alphas: [5.0, 4.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.1] }
];

let totalDirichletSamples = 0;
let dirichletViolations = 0;

for (const regime of regimes) {
  const startTime = Date.now();
  let localViolations = 0;

  for (let s = 0; s < regime.count; s++) {
    const probs = sampleDirichlet(regime.alphas);
    const dist = {
      try1: probs[0],
      try2: probs[1],
      try3: probs[2],
      try4: probs[3],
      try5: probs[4],
      try6: probs[5],
      try7: probs[6],
      try8: probs[7],
      noClear: probs[8]
    };

    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);

    // Assertions
    if (res.predictedAttempt !== oracle.bestP) {
      localViolations++;
      console.error(`Dirichlet sub-optimality! Regime=${regime.name}, res=${res.predictedAttempt}, oracle=${oracle.bestP}`);
    }
    if (Math.abs(res.expectedScore - +(oracle.bestScore.toFixed(4))) > 1e-4) {
      localViolations++;
      console.error(`Dirichlet score mismatch! Regime=${regime.name}, res=${res.expectedScore}, oracle=${oracle.bestScore}`);
    }
    if (res.predictedAttempt < 1 || res.predictedAttempt > 8) {
      localViolations++;
      console.error(`Out of range p=${res.predictedAttempt}`);
    }
    if (!Number.isFinite(res.expectedScore) || res.expectedScore < 0 || res.expectedScore > 1.0001) {
      localViolations++;
      console.error(`Invalid expectedScore=${res.expectedScore}`);
    }

    totalDirichletSamples++;
  }

  const elapsed = Date.now() - startTime;
  check(`Regime: ${regime.name} (${regime.count} samples, ${elapsed}ms)`, () => {
    assert.equal(localViolations, 0, `Violations must be 0 in ${regime.name}`);
  });
  dirichletViolations += localViolations;
}

console.log(`  Total generative samples tested: ${totalDirichletSamples}`);
console.log(`  Total generative violations: ${dirichletViolations}`);

// ----------------------------------------------------------------------------
// SUITE 6: Edge Cases, Numerical Stability & Input Robustness
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Edge Cases, Numerical Stability & Input Robustness ---');

// 6.1: Empty object
check('Empty object input {}', () => {
  const res = heldout.derivePointForecast({});
  assert.equal(res.predictedAttempt, 1, 'Empty object defaults to p=1');
  assert.equal(res.expectedScore, 0.0, 'Empty object has expectedScore 0.0');
  assert.ok(res.predictedAttempt >= 1 && res.predictedAttempt <= 8);
  assert.ok(Number.isFinite(res.expectedScore));
});

// 6.2: All zeros
check('All zeros input { try1: 0, ... try8: 0, noClear: 0 }', () => {
  const dist = { noClear: 0 };
  for (let a = 1; a <= 8; a++) dist[`try${a}`] = 0;
  const res = heldout.derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 1, 'All-zero defaults to p=1');
  assert.equal(res.expectedScore, 0.0, 'All-zero has expectedScore 0.0');
  assert.ok(res.predictedAttempt >= 1 && res.predictedAttempt <= 8);
  assert.ok(Number.isFinite(res.expectedScore));
});

// 6.3: Single non-zero try for each a in 1..8 and noClear
for (let a = 1; a <= 8; a++) {
  check(`Single non-zero try: 100% try${a}`, () => {
    const dist = { [`try${a}`]: 1.0 };
    const res = heldout.derivePointForecast(dist);
    const oracle = independentOracle(dist);
    assert.equal(res.predictedAttempt, oracle.bestP);
    assert.equal(res.expectedScore, 1.0);
    assert.ok(res.predictedAttempt >= 1 && res.predictedAttempt <= 8);
  });
}

check('Single non-zero try: 100% noClear', () => {
  const dist = { noClear: 1.0 };
  const res = heldout.derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 8);
  assert.equal(res.expectedScore, 1.0);
});

// 6.4: Missing keys (sparse objects)
check('Missing keys: { try4: 0.5, try7: 0.5 }', () => {
  const dist = { try4: 0.5, try7: 0.5 };
  const res = heldout.derivePointForecast(dist);
  const oracle = independentOracle(dist);
  assert.equal(res.predictedAttempt, oracle.bestP);
  assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)));
  assert.ok(res.predictedAttempt >= 1 && res.predictedAttempt <= 8);
});

// 6.5: Extra unknown keys / prototype pollution resistance
check('Extra unknown keys ignored safely', () => {
  const dist = {
    try2: 1.0,
    try9: 0.5,
    try10: 0.5,
    extraData: 'junk',
    attempts: 99,
    nested: { foo: 'bar' }
  };
  const res = heldout.derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 2);
  assert.equal(res.expectedScore, 1.0);
});

// 6.6: Numerical extremes: tiny numbers and precision near machine epsilon
check('Tiny probability inputs (1e-15)', () => {
  const dist = { try1: 1e-15, try2: 2e-15 };
  const res = heldout.derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 2);
  assert.ok(res.predictedAttempt >= 1 && res.predictedAttempt <= 8);
  assert.ok(Number.isFinite(res.expectedScore));
});

// 6.7: Unnormalized counts (e.g. 5 wins on try1, 10 wins on try2)
check('Unnormalized integer counts: { try1: 5, try2: 10 }', () => {
  const dist = { try1: 5, try2: 10 };
  const res = heldout.derivePointForecast(dist);
  assert.equal(res.predictedAttempt, 2);
  assert.equal(res.expectedScore, 10.0);
});

// 6.8: Equal probability uniform distribution across all 9 outcomes
check('Uniform 1/9 on all 9 outcomes', () => {
  const dist = { noClear: 1 / 9 };
  for (let a = 1; a <= 8; a++) dist[`try${a}`] = 1 / 9;

  const res = heldout.derivePointForecast(dist);
  const oracle = independentOracle(dist);
  assert.equal(res.predictedAttempt, oracle.bestP);
  assert.equal(res.expectedScore, +(oracle.bestScore.toFixed(4)));
  // Let's inspect which p wins under uniform distribution:
  // p=1 covers 1 outcome (1/9)
  // p=2 covers 1 outcome (1/9)
  // p=3 covers 2 outcomes {3,4} (2/9)
  // p=4 covers 3 outcomes {4,5,6} (3/9)
  // p=5 covers 4 outcomes {4,5,6,7} (4/9)
  // p=6 covers 4 outcomes {5,6,7,8} (4/9)
  // p=7 covers 3 outcomes {6,7,8} (3/9)
  // p=8 covers 4 outcomes {6,7,8,noClear} (4/9)
  // Scores for p=5, 6, 8 all tie at 4/9 = 0.4444!
  // Mode is 1 (maxTryProb 1/9, no strictly greater probability).
  // Distance to mode 1:
  // p=5: |5 - 1| = 4
  // p=6: |6 - 1| = 5
  // p=8: |8 - 1| = 7
  // Therefore, p=5 has the minimum distance to mode 1!
  assert.equal(res.predictedAttempt, 5, 'p=5 is closest to mode 1 among the 4/9 tied winners');
  assert.equal(res.expectedScore, +(4 / 9).toFixed(4));
});

// ----------------------------------------------------------------------------
// SUMMARY & VERDICT
// ----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL TESTS RUN:    ${totalTests}`);
console.log(`PASSED:             ${passedTests}`);
console.log(`FAILED:             ${failedTests.length}`);
console.log('======================================================================\n');

if (failedTests.length > 0) {
  console.error(`VERDICT: FAILED (${failedTests.length} failures)`);
  process.exit(1);
} else {
  console.log('VERDICT: 100% PASSED — derivePointForecast IS MATHEMATICALLY OPTIMAL');
  process.exit(0);
}
