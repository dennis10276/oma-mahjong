'use strict';
const assert=require('assert/strict'),{openingPlanningController}=require('./public_opening_planning.js');
function test(){
 for(const budget of [null,19,20,21,34,40,41,61])for(const locks of [0,3,4,5,7]){
  const factory=settings=>({beginAttempt(){},observe(){},decide(){return settings;}});
  const api=openingPlanningController({openingConditionalPlanning:true,openingTrayGuardPlanning:true},factory);
  api.beginAttempt();api.observe({physicalTaps:0,moves:0,tray:[]},{clock:budget===null?null:{i:0,n:budget},roles:Array(locks).fill('lock')});
  const enabled=budget!==null&&budget>=20&&budget<=40&&locks<=4,chosen=api.decide();
  assert.equal(!!chosen.avoidThirdTrayInformation,enabled);assert.equal(api.openingSelectionStats().trayGuard,enabled);
  assert.equal(chosen.learnedEscapePlanning,undefined);assert.equal(chosen.retainCleanupIntention,undefined);
  assert.equal(!!chosen.survivalBranches,budget!==null&&budget<=50&&locks<=3);
  api.beginAttempt();api.observe({physicalTaps:0,moves:0,tray:[]},{clock:{i:0,n:99},roles:Array(9).fill('lock')});
  assert.equal(!!api.decide().avoidThirdTrayInformation,enabled,'Keep the opening selection latched across retries');
 }
 assert.throws(()=>openingPlanningController({openingConditionalPlanning:true,openingTrayGuardPlanning:true,avoidThirdTrayInformation:true},()=>({})));
 console.log('PASS conditional tray guard uses public clock20-40/locks<=4,retains baseline40 families,latches retries and leaves learned/intention policies inactive');
}
if(require.main===module)test();module.exports=test;
