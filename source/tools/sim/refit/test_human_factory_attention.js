'use strict';
const assert=require('assert/strict'),{campaign}=require('./human_style_environment.js'),{normalizeBoard}=require('./public_board_input.js');
const {createFactoryController,PROFILES}=require('./human_factory_controller.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:2},{x:4,y:0,z:0},{x:8,y:0,z:0},{x:12,y:0,z:0}];
 const game=normalizeBoard({tiles,faces:[1,2,3,3,2,1],down:[0,0,0,0,0,0],clock:{i:0,n:4}});
 const science=r=>({wonOn:r.wonOn,attempts:r.attempts,verifiedTaps:r.verifiedTaps});
 for(const strict of [false,true])for(const seed of [1,31,85]){
  const base={...PROFILES.dennis,strictClockSlack:strict},fixed={...base,deadlineAttentionProbability:+strict,extraClockLookProbability:0};
  assert.deepEqual(science(campaign(game,base,seed,{maxAttempts:3,controllerFactory:createFactoryController})),science(campaign(game,fixed,seed,{maxAttempts:3,controllerFactory:createFactoryController})), 'Fixing attention to the existing policy must preserve every physical attempt and leave move-noise RNG unchanged');
 }
 const modes=new Set();for(let seed=1;seed<=40;seed++){const c=createFactoryController(tiles,{...PROFILES.family,extraClockLookProbability:.5,deadlineAttentionProbability:.5},seed);c.beginAttempt();const a=c.planningAttention();assert([2,3].includes(a.clockHorizon));modes.add(JSON.stringify(a));}
 const learner=createFactoryController(tiles,{...PROFILES.dennis,deadlineAttentionProbability:0,deadlineLearningRate:.5},31);learner.beginAttempt();assert.equal(learner.planningAttention().strictClockSlack,false);
 learner.endAttempt('mid',[]);learner.beginAttempt();assert.equal(learner.planningAttention().strictClockSlack,false,'A mid-game loss does not fabricate clock-learning evidence');
 learner.endAttempt('beforeClock',[]);learner.endAttempt('beforeClock',[]);learner.beginAttempt();assert.equal(learner.planningAttention().strictClockSlack,true,'Repeated actual clock losses raise deadline attention');
 assert.equal(modes.size,4,'Fixed personal attention variability must allow both limited horizons and deadline-attention states');
 assert.throws(()=>createFactoryController(tiles,{...PROFILES.dennis,extraClockLookProbability:1.01},1));
 assert.throws(()=>createFactoryController(tiles,{...PROFILES.dennis,deadlineAttentionProbability:-.01},1));
 assert.throws(()=>createFactoryController(tiles,{...PROFILES.dennis,trayDepth:5},1));
 assert.throws(()=>createFactoryController(tiles,{...PROFILES.dennis,levelRules:{132:'route'}},1));
 assert.throws(()=>createFactoryController(tiles,{...PROFILES.dennis,temperature:0},1));
 console.log('PASS bounded per-attempt attention variability, fixed-policy physical parity, independent move-noise stream and probability validation');
}
if(require.main===module)test();module.exports=test;
