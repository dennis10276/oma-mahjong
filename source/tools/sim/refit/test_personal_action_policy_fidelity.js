'use strict';
const assert = require('assert/strict');
const { evaluateActionPolicyFidelity } = require('./personal_action_policy_evaluation.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing personal action policy fidelity (Gate G3)...');

const results = evaluateActionPolicyFidelity(20);

for (const name of NAMES) {
  const r = results[name];
  assert(r, `Results must exist for ${name}`);
  assert.equal(r.evaluatedDecisions, 20, `Must evaluate 20 decisions for ${name}`);
  assert(r.top1Accuracy.personalBot >= 0.0 && r.top1Accuracy.personalBot <= 1.0);
  assert(r.top1Accuracy.randomBaseline > 0.0 && r.top1Accuracy.randomBaseline <= 1.0);
  assert(r.personalFidelityVerified === true && r.top1Accuracy.personalBot > r.top1Accuracy.randomBaseline,
    `${name}: personal fidelity failed (${r.top1Accuracy.personalBot} vs random ${r.top1Accuracy.randomBaseline}). Keep G3 incomplete; do not replace this acceptance condition with parameter bounds.`);
  assert(typeof r.humanTrayDistribution['0'] === 'number');
  assert(typeof r.humanTrayDistribution['1'] === 'number');
  assert(typeof r.humanTrayDistribution['2'] === 'number');
  assert(typeof r.humanTrayDistribution['3'] === 'number');
  assert(typeof r.botTrayDistribution['0'] === 'number');
  assert(typeof r.botTrayDistribution['1'] === 'number');
  assert(typeof r.botTrayDistribution['2'] === 'number');
  assert(typeof r.botTrayDistribution['3'] === 'number');
  assert(r.trayComparison && typeof r.trayComparison.totalVariationDistance === 'number');
  assert(r.trayComparison.totalVariationDistance <= 0.50,
    `${name}: bot tray TVD exceeds tolerance (${r.trayComparison.totalVariationDistance})`);
  assert(r.trayComparison.replicatesDistribution === true,
    `${name}: tray distribution not replicated`);
  assert(r.calibratedParameters.depth >= 8 && r.calibratedParameters.depth <= 20);
  assert([1, 2, 3].includes(r.calibratedParameters.trayBuffer));
  assert(r.calibratedParameters.clockPatience >= 0 && r.calibratedParameters.clockPatience <= 1);
  assert(r.calibratedParameters.memoryDecay >= 0 && r.calibratedParameters.memoryDecay <= 1);
  assert(r.calibratedParameters.retryLearning >= 0 && r.calibratedParameters.retryLearning <= 1);
}

console.log('PASS personal action-policy fidelity: parameters calibrated, tray distributions measured, action rankings computed vs reference and random baseline');
