'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {openingPlanningController}=require('./public_opening_planning.js');
const {createHumanController,playHumanCampaign}=require('./human_reference_campaign.js');
const {openingConditionalPlanning,...baseline}=require('./human_level_measure_profile.json');
const light={...baseline,survivalBranches:true,survivalBacktracking:true,survivalEarlyForks:true,clockOrphanPreparation:true,clockRecoveryMinSlack:30};
function test(){
 const state={physicalTaps:0,moves:0,tray:[]};
 for(const [budget,locks,broad]of [[19,4,false],[20,4,true],[40,4,true],[41,4,false],[30,5,false],[21,1,true],[34,4,true],[37,6,false],[18,7,false],[44,3,false],[8,2,false],[null,1,false]]){
  const policy=openingPlanningController({...baseline,openingConditionalPlanning:true,openingBroadInformationPlanning:true},options=>({beginAttempt(){},observe(){},known(){return options;}}));
  policy.beginAttempt();const packet={clock:budget===null?null:{i:0,n:budget},roles:Array(locks).fill('lock')};
  Object.defineProperty(packet,'pictures',{get(){throw Error('Opening selection may not inspect pictures');}});
  policy.observe(state,packet);assert.equal(policy.openingSelectionStats().broadInformation,broad);
  const expected=budget!==null&&budget<=50&&locks<=3?light:baseline;
  assert.deepEqual(policy.known(),broad?{...expected,passiveInformation:'shortAll',rememberProvedContinuations:true}:expected);
  policy.observe({...state,moves:2,physicalTaps:2},{clock:null,roles:[]});policy.beginAttempt();policy.observe(state,{clock:null,roles:[]});
  assert.equal(policy.openingSelectionStats().broadInformation,broad);
 }
 const tiles=Array.from({length:12},(_,i)=>({x:i*8,y:0,z:0}));let taps=0;
 for(const [budget,locks]of [[19,4],[20,4],[40,4],[41,4],[20,2]]){
  const game={tiles,nb:Layouts.neighbors(tiles),faces:[100,100,1,1,2,2,3,3,4,4,5,5],down:tiles.map(()=>0),
   rules:{ice:{},iceNb:Layouts.iceNeighbors(tiles),keys:[0,1],locks:new Set(Array.from({length:locks},(_,i)=>i+2))},clock:{i:10,n:budget}};
  const broad=budget>=20&&budget<=40,base=locks<=3?light:baseline;
  const conditional=playHumanCampaign(game,{maximumAttempts:2,planning:{...baseline,openingConditionalPlanning:true,openingBroadInformationPlanning:true}});
  const direct=playHumanCampaign(game,{maximumAttempts:2,planning:broad?{...base,passiveInformation:'shortAll',rememberProvedContinuations:true}:base});
  assert.equal(conditional.wonOn,1);assert.equal(direct.wonOn,1);
  assert.deepEqual(conditional.attempts.map(a=>a.actions),direct.attempts.map(a=>a.actions));taps+=conditional.verifiedTaps+direct.verifiedTaps;
 }
 assert.throws(()=>createHumanController(tiles,{openingBroadInformationPlanning:true}));
 assert.throws(()=>createHumanController(tiles,{openingConditionalPlanning:true,openingBroadInformationPlanning:'yes'}));
 assert.throws(()=>createHumanController(tiles,{openingConditionalPlanning:true,openingBroadInformationPlanning:true,openingReusablePlanning:true}));
 console.log('PASS broad-information opening gate20–40/locks<=4 preserves other families,latched memory and private-picture boundary;'+taps+' independently replayed winning key/lock/clock taps');
}
if(require.main===module)test();module.exports=test;
