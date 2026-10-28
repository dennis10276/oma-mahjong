'use strict';
const assert=require('assert/strict'),{openingPlanningController}=require('./public_opening_planning.js');
function test(){
 for(const clock of [null,19,20,21,34,40,41,61])for(const locks of [0,3,4,5,7]){
  let configured;
  const factory=settings=>({beginAttempt(){},observe(){},decide(){return settings;}});
  const policy=openingPlanningController({openingConditionalPlanning:true,openingLearnedEscapePlanning:true},factory);
  policy.beginAttempt();policy.observe({physicalTaps:0,moves:0,tray:[]},{clock:clock===null?null:{i:0,n:clock},roles:Array(locks).fill('lock')});
  configured=policy.decide();const applies=clock!==null&&clock>=20&&clock<=40&&locks<=4;
  assert.equal(!!configured.learnedEscapePlanning,applies);assert.equal(policy.openingSelectionStats().learnedEscape,applies);
  assert.equal(!!configured.survivalBranches,clock!==null&&clock<=50&&locks<=3);
  policy.beginAttempt();policy.observe({physicalTaps:0,moves:0,tray:[]},{clock:{i:0,n:99},roles:Array(9).fill('lock')});
  assert.equal(!!policy.decide().learnedEscapePlanning,applies,'Opening condition remains latched across retries');
 }
 assert.throws(()=>openingPlanningController({openingConditionalPlanning:true,openingLearnedEscapePlanning:true,learnedEscapePlanning:true},()=>({}))); 
 console.log('PASS conditional escape planning uses only opening clock20-40/visible locks<=4,preserves retained40 families and latches across retries;global/conditional modes are explicit');
}
if(require.main===module)test();module.exports=test;
