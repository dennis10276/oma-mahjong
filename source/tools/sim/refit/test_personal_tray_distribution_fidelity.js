'use strict';
const assert = require('assert/strict');
const { evaluateActionPolicyFidelity } = require('./personal_action_policy_evaluation.js');
const { NAMES } = require('./personal_model.js');

console.log('Testing independent bot-versus-human tray distribution fidelity across held-out chronological test games...');

const results = evaluateActionPolicyFidelity(30);

for (const name of NAMES) {
  const r = results[name];
  assert(r, `Results must exist for ${name}`);
  assert(r.trayComparison, `Tray comparison must exist for ${name}`);

  const tvd = r.trayComparison.totalVariationDistance;
  const w1 = r.trayComparison.wassersteinDistance;

  assert(typeof tvd === 'number' && Number.isFinite(tvd), `${name}: TVD must be a finite number`);
  assert(typeof w1 === 'number' && Number.isFinite(w1), `${name}: W1 must be a finite number`);

  console.log(`  ${name}: TVD = ${tvd.toFixed(4)} (threshold <= 0.50), W1 = ${w1.toFixed(4)} (threshold <= 1.25)`);

  assert(tvd <= 0.50, `${name}: bot-versus-human tray TVD exceeds tolerance (${tvd} > 0.50)`);
  assert(w1 <= 1.25, `${name}: bot-versus-human tray W1 exceeds tolerance (${w1} > 1.25)`);
  assert.equal(r.trayComparison.replicatesDistribution, true, `${name}: replicatesDistribution must be true`);
}

console.log('PASS independent bot-versus-human tray distribution fidelity verified: TVD <= 0.50 and W1 <= 1.25 across all 4 players');
