'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {learnedEscapePlan}=require('./public_learned_escape.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {verifyAttempt,createHumanController}=require('./human_reference_campaign.js');
const {observeBoard}=require('./human_board_visibility.js');
const {encodeGame}=require('./personal_game_io.js');
const {NAMES}=require('./public_escape_critic.js');
function test(){
 const tiles=Array.from({length:10},(_,i)=>({x:i*8,y:0,z:0}));
 const actual={tiles,nb:Layouts.neighbors(tiles),faces:[1,2,3,100,100,1,2,3,4,4],down:[0,0,0,1,1,0,0,0,0,0],
  rules:{ice:{},iceNb:Layouts.iceNeighbors(tiles),keys:[3,4],locks:new Set([5,6,7])},clock:null};
 const game={tiles,nb:actual.nb,rules:actual.rules,clock:null};
 for(const field of ['faces','deck','seed','level','target'])Object.defineProperty(game,field,{get(){throw Error('Private '+field);}});
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:64},session=factory(actual,settings),route=[0,1,2];
 route.forEach(i=>session.tap(i));
 const state={...session.view().state,pictures:actual.faces.slice(),down:actual.down.slice()};
 const context={roles:tiles.map((_,i)=>[3,4].includes(i)?'key':[5,6,7].includes(i)?'lock':'none'),knownKeys:[3,4]};
 const actions=session.view().legalTiles.map(index=>({index})),primary={index:8,path:[8],knownWin:false,nodes:0};
 const original=JSON.stringify(state),plan=learnedEscapePlan(game,state,actions,primary,context,{milliseconds:500});
 assert(plan&&[3,4].includes(plan.index));assert(plan.path.length>=3);
 assert(plan.learnedEscape.knownRelief);assert(plan.learnedEscape.estimatedNotProved);assert(!plan.knownDead);
 assert(plan.learnedEscape.probability>0&&plan.learnedEscape.probability<1);assert.equal(JSON.stringify(state),original);
 for(const i of plan.path){assert(session.view().legalTiles.includes(i));session.tap(i);route.push(i);}
 assert(session.view().state.tray.length<3,'Known on-pile key chain reaches a locked waiting tray partner');
 for(const i of [5,6,7,8,9])if(session.view().state.alive[i]){session.tap(i);route.push(i);}
 assert(session.view().win);assert.equal(verifyAttempt(encodeGame(actual),route,settings,session.audit()),route.length);
 for(const protectedPlan of [{knownWin:true},{safeClockExit:true},{survivalBranches:{necessaryIfSolvable:true}},
  {deadCertificate:{exhaustedKnownGraph:true}}])assert.equal(learnedEscapePlan(game,state,actions,{...primary,...protectedPlan},context),null);
 assert.equal(learnedEscapePlan(game,state,actions,primary,context,{deadline:0}),null);
 const capped=learnedEscapePlan(game,state,actions,primary,context,{nodes:0,milliseconds:500});
 assert(capped&&!capped.knownDead&&capped.learnedEscape.capped,'A bounded miss cannot reject the remaining branch');
 // Changing only learned weights changes root preference; this is actual
 // learned ranking, rather than an ignored score or hand-coded key preference.
 const weights=Array(NAMES.length+1).fill(0);weights[1+NAMES.indexOf('rootKey')]=-10;
 const adversarial={kind:'public-escape-logistic-v1',features:[...NAMES],weights};
 const spare={...state,tray:[1,2],alive:state.alive.slice()};spare.alive[2]=1;
 const choice=learnedEscapePlan(game,spare,[{index:3},{index:2}],{index:3,path:[3]},context,{model:adversarial,milliseconds:500});
 assert.equal(choice.index,2,'Shared learned Q,not hard-coded key identity,orders eligible alternatives');
 // The completed physical fixture above supplies same-board retry memory.
 // Feed actual production observations through the controller integration.
 const controller=createHumanController(tiles,{learnedEscapePlanning:true,nodes:1,proofNodes:1,taps:1,finishKnown:false,decisionMs:10});
 controller.rememberPublic({pictures:actual.faces.slice(),down:actual.down.slice(),initialRoles:context.roles.slice()});
 const replay=factory(actual,settings),taken=[];controller.beginAttempt();let learned=0;
 const feed=()=>{const frame=replay.view(),allowed=new Set(frame.legalTiles);
  controller.observe(Object.fromEntries(['alive','tray','moves','openPeek','relieved','arriving','physicalTaps'].map(f=>[f,frame.state[f]])),
   observeBoard(tiles,frame.state,null,{picture:i=>actual.faces[i],role:i=>context.roles[i],takeable:i=>allowed.has(i)}));};
 const tap=i=>{controller.acknowledge(i,true);replay.tap(i);taken.push(i);feed();};feed();
 for(const i of [0,1,2]){controller.decide();tap(i);}
 for(let n=0;n<30&&!replay.view().win&&!replay.view().lost;n++){
  const selected=controller.decide();assert(selected);learned+=+!!selected.plan.learnedEscape;
  assert(replay.view().legalTiles.includes(selected.plan.index));tap(selected.plan.index);
 }
 assert(learned>0,'Enabled controller really uses the learned route planner');assert(replay.view().win);
 controller.completeAttempt('cleared');verifyAttempt(encodeGame(actual),taken,settings,replay.audit());
 factory.verifySource();console.log('PASS learned escape planner ranks with frozen experience weights,preserves proofs,avoids known immediate losses,plans tray3 on-pile key escape and replays the clear;caps remain unknown');
}
if(require.main===module)test();module.exports=test;
