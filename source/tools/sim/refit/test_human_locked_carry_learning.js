'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {createFactoryController}=require('./human_factory_controller.js'),release=require('./human_release.js');
const {createSessionFactory}=require('./production_physical_session.js'),{observeBoard}=require('./human_board_visibility.js');
const {visibleRole,verifyAttempt}=require('./human_reference_campaign.js'),{encodeGame}=require('./personal_game_io.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:.28,y:.28/1.24,z:1},...Array.from({length:8},(_,i)=>({x:8+i*4,y:0,z:0}))];
 const game={tiles,nb:Layouts.neighbors(tiles),faces:[1,1,2,3,4,5,2,3,4,5],down:tiles.map(()=>0),clock:null,rules:{ice:{0:1},iceNb:Layouts.iceNeighbors(tiles),locks:new Set([5]),keys:[0,9]}};
 const settings={seed:1,tapMs:1000,choiceLimit:64},factory=createSessionFactory();
 function observe(c,session){const v=session.view(),legal=new Set(v.legalTiles),o=observeBoard(tiles,v.state,null,{picture:i=>game.faces[i],role:i=>visibleRole(game,v.state,i),takeable:i=>legal.has(i)});c.observe(v.state,o);return {v,o};}
 const choices=[],freshChoices=[];
 for(const enabled of [0,1]){
  const p={...release.profiles.Dennis,retryKeyIdentityMemory:1,retryLockedCarryKeys:enabled,postClockKeyWeight:60};
  const c=createFactoryController(tiles,p,31);c.beginAttempt();const first=factory(game,settings);observe(c,first);assert.deepEqual(c.lockedCarryEvidence(),[]);
  const fresh=createFactoryController(tiles,p,31);fresh.beginAttempt();observe(fresh,first);freshChoices.push(fresh.decide());
  for(const i of [1,9,2,3]){assert(first.view().legalTiles.includes(i));first.tap(i);observe(c,first);}
  assert.equal(first.view().why,'tray');assert.equal(verifyAttempt(encodeGame(game),[1,9,2,3],settings,first.audit()),4);assert.deepEqual(c.lockedCarryEvidence(),[],'Seeing a trapped tray alone cannot manufacture an earlier loss');
  c.endAttempt(null,first.view().state.tray);assert.deepEqual(c.lockedCarryEvidence(),[],'A null/winning outcome cannot teach a failed-carry dependency');
  c.endAttempt('mid',first.view().state.tray);
  const facts=c.lockedCarryEvidence();assert.deepEqual(facts.map(f=>[f.face,f.partner,f.attempt,f.physicalTaps]),enabled?[[5,5,1,4]]:[]);
  const retry=factory(game,settings);c.beginAttempt();const {o}=observe(c,retry);assert.equal(o.roles[0],null);assert(!retry.view().legalTiles.includes(0));retry.tap(9);observe(c,retry);const next=c.decide().index;choices.push(next);assert(retry.view().legalTiles.includes(next));
  if(enabled){assert.equal(next,1,'A previously failed carry now motivates uncovering its observed key route');const actions=[9,next];retry.tap(next);observe(c,retry);while(retry.view().type!=='productionPhysicalEnd-v1'){assert(actions.length<64);const i=c.decide().index;assert(retry.view().legalTiles.includes(i));actions.push(i);retry.tap(i);observe(c,retry);}assert(retry.view().win);assert.equal(verifyAttempt(encodeGame(game),actions,settings,retry.audit()),actions.length);}
 }
 assert.deepEqual(freshChoices[0],freshChoices[1],'A fresh attempt must retain its full choice/score without fabricated lessons');
 let cappedActor;const capped=require('./human_style_environment.js').campaign(encodeGame(game),{...release.profiles.Dennis,retryKeyIdentityMemory:1,retryLockedCarryKeys:1},31,{maxAttempts:3,choiceLimit:1,controllerFactory(t,p,seed){cappedActor=createFactoryController(t,p,seed);return cappedActor;}});assert(capped.attempts[0].censored&&capped.attempts.length===1);assert.deepEqual(cappedActor.lockedCarryEvidence(),[],'A computation cap cannot create a failed-carry lesson or a free retry');
 assert.notEqual(choices[0],1,'Without a failed-carry lesson the same key-memory policy prefers an unrelated pair');
 console.log('PASS actual-loss locked-partner provenance, no learning from null outcomes/observations alone, typed hidden-ice safety and independently replayed key-first retry continuation');
}
if(require.main===module)test();module.exports=test;
