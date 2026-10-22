'use strict';
const assert=require('assert/strict');
const {auditTrayResult,compareTrayCounts}=require('./independent_tray_metrics.js');
const {evaluateActionPolicyFidelity}=require('./personal_action_policy_evaluation.js');
const {NAMES}=require('./personal_model.js');
const h={0:20,1:0,2:0,3:0}, b={0:0,1:0,2:0,3:20};
assert.throws(()=>auditTrayResult({humanTrayCounts:h,botTrayCounts:b,trayComparison:{totalVariationDistance:0,wassersteinDistance:0,replicatesDistribution:true}}),/does not reproduce/);
assert.deepEqual(compareTrayCounts(h,b),{totalVariationDistance:1,wassersteinDistance:3,humanSamples:20,botSamples:20});
assert.throws(()=>compareTrayCounts({0:0,1:0,2:0,3:0},b),/Empty/);
assert.throws(()=>compareTrayCounts({0:NaN,1:0,2:0,3:0},b),/Invalid/);
const results=evaluateActionPolicyFidelity(30);
for(const n of NAMES){const m=auditTrayResult(results[n]);assert.equal(m.fidelityEstablished,false);console.log(n,JSON.stringify(m));}
console.log('PASS metric integrity and forged-distance rejection. Personal tray fidelity remains UNVERIFIED.');
