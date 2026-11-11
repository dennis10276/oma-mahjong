'use strict';
const assert = require('assert/strict');
const P = require('./planner.js');
const V = require('./evaluator.js');
const { createBuilder } = require('./builder_next.js');
const { createYardstick } = require('./yardstick.js');

async function main() {
  const request = { target: 10, skilledBand: [2.5,6], tol: 1 };
  const good = { staticPass:true, S:3, S_valid:true, D:10, D_valid:true, tracePass:true };
  assert.deepEqual(V.diagnose(good,request),[]);
  assert(V.diagnose({...good,tracePass:false,pass:true},request).includes('TRACE_FAILURE'));
  assert(V.diagnose({...good,S:NaN},request).includes('SKILLED_UNRESOLVED'));
  assert(V.diagnose({...good,D_valid:false},request).includes('FAMILY_UNRESOLVED'));
  assert(V.diagnose({...good,D:13,maxTarget:10},{...request,target:13}).includes('REPEAT_INFLATED_TARGET'));
  const pool = P.proposals(22);
  assert.equal(new Set(pool.map(P.recipeKey)).size,pool.length);
  assert.notEqual(P.recipeKey(P.rankProposals(pool,[],request)[0].recipe),
    P.recipeKey(P.rankProposals(pool,[],{...request,target:13})[0].recipe));
  assert(pool.every(r => Number.isFinite(r.expectedS) && r.expectedS >= 2.0));
  const ys = createYardstick({cacheDir:false});
  assert.equal(ys.pins.family.fingerprint,require('../builder/loop/yardstick.js').loadPins().family.fingerprint);
  assert.notEqual(ys.pins.planner.fingerprint,require('../builder/loop/yardstick.js').loadPins().planner.fingerprint);
  const design = require('../../analysis/skilled-bot-b1/evidence/g9-board.json');
  let evaluations = 0;
  const builder = createBuilder({ys,knowledgeFile:false,sourceIdentity:'focused-regression',
    buildBase:()=>({design}), compose:(base,recipe)=>{ const b = base?.design || base || design; return {ok:true,design:{...b,clock:{...b.clock,n:16+recipe.spare}},recipe}; },
    evaluate:()=>{evaluations++;return {...good,pass:true,tracePass:false};} });
  const out = await builder.build(request,{maxCandidates:4});
  assert.equal(out.success,false,'A failed trace must never qualify a numerical target hit');
  assert.equal(out.attempts.length,4);
  assert.equal(evaluations,new Set(out.attempts.map(a=>a.boardKey)).size);
  assert.equal(new Set(out.attempts.map(a=>P.recipeKey(a.recipe))).size,4);
  assert(out.attempts.filter(a=>a.evaluation).every(a=>a.issues.includes('TRACE_FAILURE')));
  console.log('Planning checks pass: complete qualification, distinct requests, no repair cycles, B3 isolation.');
}
if (require.main === module) main().catch(e=>{console.error(e);process.exitCode=1;});
