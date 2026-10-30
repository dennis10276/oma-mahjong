'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {createFactoryController}=require('./human_factory_controller.js'),release=require('./human_release.js');
const {createSessionFactory}=require('./production_physical_session.js'),{observeBoard}=require('./human_board_visibility.js');
const {visibleRole,verifyAttempt}=require('./human_reference_campaign.js'),{encodeGame}=require('./personal_game_io.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:.28,y:.28/1.24,z:1},...Array.from({length:8},(_,i)=>({x:8+i*4,y:0,z:0})),{x:36+.28,y:.28/1.24,z:1},{x:48,y:0,z:0}];
 const game={tiles,nb:L.neighbors(tiles),faces:[1,1,2,3,4,5,2,3,4,5,6,6],down:tiles.map(()=>0),clock:null,rules:{ice:{0:1},iceNb:L.iceNeighbors(tiles),locks:new Set([8,11]),keys:[0,9]}};
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:64};
 function observe(c,s){const v=s.view(),legal=new Set(v.legalTiles),o=observeBoard(tiles,v.state,null,{picture:i=>game.faces[i],role:i=>visibleRole(game,v.state,i),takeable:i=>legal.has(i)});c.observe(v.state,o);return o;}
 const choices=[],freshChoices=[];
 for(const enabled of [0,1]){
  // Disable the independent generic out bonus to isolate the learned preparation.
  const p={...release.profiles.Dennis,retryKeyIdentityMemory:1,retryLockedCarryKeys:1,retryPrepareKeyOuts:enabled,postClockKeyWeight:60,outWeight:0,retryKeyRouteValue:0,retryKeyPictureRelations:0,retryAccessMemory:0};
  const first=factory(game,settings),fresh=createFactoryController(tiles,p,31);fresh.beginAttempt();observe(fresh,first);freshChoices.push(fresh.decide());
  const c=createFactoryController(tiles,p,31);c.beginAttempt();observe(c,first);
  for(const i of [1,10,4,2]){assert(first.view().legalTiles.includes(i));first.tap(i);observe(c,first);}
  assert.equal(first.view().why,'tray');assert.equal(verifyAttempt(encodeGame(game),[1,10,4,2],settings,first.audit()),4);c.endAttempt('mid',first.view().state.tray);
  assert.deepEqual(c.lockedCarryEvidence().map(f=>f.face).sort((a,b)=>a-b),[4,6]);
  const retry=factory(game,settings);c.beginAttempt();const o=observe(c,retry);assert.deepEqual(retry.view().state.tray,[]);assert.equal(o.roles[0],null);assert.equal(o.roles[9],null);assert(!retry.view().legalTiles.includes(0)&&!retry.view().legalTiles.includes(9));
  const next=c.decide().index;choices.push(next);assert(retry.view().legalTiles.includes(next));
  if(enabled){assert.equal(next,10,'Prepare a remembered key cover while the tray is still empty');const actions=[next];retry.tap(next);observe(c,retry);while(retry.view().type!=='productionPhysicalEnd-v1'){assert(actions.length<64);const i=c.decide().index;assert(retry.view().legalTiles.includes(i));actions.push(i);retry.tap(i);observe(c,retry);}assert(retry.view().win);assert.equal(verifyAttempt(encodeGame(game),actions,settings,retry.audit()),actions.length);}
 }
 assert.equal(choices[0],2,'The control starts with an unrelated pair before acting on its prior trap');assert.deepEqual(freshChoices[0],freshChoices[1],'No prior loss means no change to the complete fresh choice');
 assert.throws(()=>createFactoryController(tiles,{...release.profiles.Dennis,retryLockedCarryKeys:0,retryPrepareKeyOuts:1},1));
 console.log('PASS actual-loss key preparation before carrying the learned trap face, fresh-choice parity, hidden-key/ice legality and independent production winning continuation');
}
if(require.main===module)test();module.exports=test;
