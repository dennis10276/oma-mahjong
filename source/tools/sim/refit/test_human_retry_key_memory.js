'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {createFactoryController}=require('./human_factory_controller.js'),release=require('./human_release.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {observeBoard}=require('./human_board_visibility.js');
const {visibleRole,verifyAttempt}=require('./human_reference_campaign.js');
const {encodeGame}=require('./personal_game_io.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:.28,y:.28/1.24,z:1},...Array.from({length:8},(_,i)=>({x:8+i*4,y:0,z:0}))];
 const game={tiles,nb:Layouts.neighbors(tiles),faces:[1,1,2,3,4,5,2,3,4,5],down:tiles.map(()=>0),clock:null,rules:{ice:{0:1},iceNb:Layouts.iceNeighbors(tiles),locks:new Set([5]),keys:[0,9]}};
 const settings={seed:1,tapMs:1000,choiceLimit:64},factory=createSessionFactory();
 function observed(session){const v=session.view(),legal=new Set(v.legalTiles);return {v,o:observeBoard(tiles,v.state,null,{picture:i=>game.faces[i],role:i=>visibleRole(game,v.state,i),takeable:i=>legal.has(i)})};}
 const outcomes=[];
 for(const enabled of [0,1]){
  const p={...release.profiles.Dennis,postClockKeyWeight:120,retryKeyIdentityMemory:enabled};
  const c=createFactoryController(tiles,p,31),first=factory(game,settings);c.beginAttempt();let {v,o}=observed(first);c.observe(v.state,o);
  assert.deepEqual(c.rememberedKeyTargets(),[],'A current-attempt observation cannot create a prior-attempt advantage');
  const firstChoice=c.decide();outcomes.push({firstChoice});
  // Feed a separately replayed actual prefix to a fresh learner, so policy proposals
  // never get credited as taps the player did not take.
  const learner=createFactoryController(tiles,p,31);learner.beginAttempt();learner.observe(v.state,o);
  for(const i of [1,2,3,4]){assert(first.view().legalTiles.includes(i));first.tap(i);({v,o}=observed(first));learner.observe(v.state,o);}
  assert.equal(v.why,'tray');assert.equal(verifyAttempt(encodeGame(game),[1,2,3,4],settings,first.audit()),4);learner.endAttempt('mid',v.state.tray);
  const facts=learner.keyIdentityEvidence();assert.deepEqual(facts.map(f=>f.index),enabled?[0,9]:[]);
  if(enabled){assert.equal(facts.find(f=>f.index===0).attempt,1);assert.equal(facts.find(f=>f.index===0).physicalTaps,1);}
  const retry=factory(game,settings);learner.beginAttempt();({v,o}=observed(retry));assert.equal(o.roles[0],null);assert(!v.legalTiles.includes(0));const copy=structuredClone(o);learner.observe(v.state,o);assert.deepEqual(o,copy,'Remembered membership must not overwrite the hidden current obstacle');
  assert.deepEqual(learner.rememberedKeyTargets(),enabled?[0,9]:[]);
  retry.tap(9);({v,o}=observed(retry));learner.observe(v.state,o);
  const choice=learner.decide();assert(v.legalTiles.includes(choice.index));assert.notEqual(choice.index,0,'Remembering a key never removes its covering ice or geometry');outcomes.at(-1).retryChoice=choice.index;
  if(enabled){assert.equal(choice.index,1,'A remembered hidden key makes its public cover an objective');const actions=[9,choice.index];retry.tap(choice.index);({v,o}=observed(retry));learner.observe(v.state,o);while(v.type!=='productionPhysicalEnd-v1'){assert(actions.length<64);const next=learner.decide().index;assert(v.legalTiles.includes(next));actions.push(next);retry.tap(next);({v,o}=observed(retry));learner.observe(v.state,o);}assert(v.win);assert.equal(verifyAttempt(encodeGame(game),actions,settings,retry.audit()),actions.length);}
 }
 assert.deepEqual(outcomes[0].firstChoice,outcomes[1].firstChoice,'Key history must preserve a fresh attempt including score/noise');assert.notEqual(outcomes[0].retryChoice,1,'The control has no prior key target behind that cover');
 console.log('PASS typed observed-key history changes a retry objective, preserves the complete fresh choice, never reveals initial ice/current role or hidden pictures, and physically replays the learned winning continuation');
}
if(require.main===module)test();module.exports=test;
