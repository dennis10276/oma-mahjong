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
  assert(typeof r.humanTrayDistribution['0'] === 'number');
  assert(typeof r.humanTrayDistribution['1'] === 'number');
  assert(typeof r.humanTrayDistribution['2'] === 'number');
  assert(typeof r.humanTrayDistribution['3'] === 'number');
  assert(r.calibratedParameters.depth >= 8 && r.calibratedParameters.depth <= 20);
  assert([2, 3].includes(r.calibratedParameters.trayBuffer));
  assert(r.calibratedParameters.clockPatience >= 0 && r.calibratedParameters.clockPatience <= 1);
  assert(r.calibratedParameters.memoryDecay >= 0 && r.calibratedParameters.memoryDecay <= 1);
  assert(r.calibratedParameters.retryLearning >= 0 && r.calibratedParameters.retryLearning <= 1);
}

console.log('PASS personal action-policy fidelity: parameters calibrated, tray distributions measured, action rankings computed vs reference and random baseline');
