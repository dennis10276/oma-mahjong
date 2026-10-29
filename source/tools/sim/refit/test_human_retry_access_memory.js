'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {createRetryAccessMemory}=require('./public_retry_access_memory.js'),{createFactoryController}=require('./human_factory_controller.js');
const release=require('./human_release.js'),{createSessionFactory}=require('./production_physical_session.js'),{observeBoard}=require('./human_board_visibility.js');
const {visibleRole,verifyAttempt}=require('./human_reference_campaign.js'),{encodeGame}=require('./personal_game_io.js');
function test(){
 const m=createRetryAccessMemory(3);m.observe({alive:[1,0,1],relieved:false,physicalTaps:1},{takeable:[true,null,false],down:[1,null,0]},1);
 assert(!m.canTake(0,m.removedMask([1,0,1]),false,1),'No future knowledge from the current attempt');assert(m.canTake(0,m.removedMask([1,0,0]),false,2));assert(!m.canTake(0,m.removedMask([1,1,0]),false,2),'A restored prerequisite invalidates transfer');assert(!m.canTake(0,m.removedMask([0,0,0]),false,2));assert.equal(m.downValue(0,2),1);
 const relief=createRetryAccessMemory(2);relief.observe({alive:[1,0],relieved:true,physicalTaps:1},{takeable:[true,null],down:[0,null]},1);assert(!relief.canTake(0,relief.removedMask([1,0]),false,2));assert(relief.canTake(0,relief.removedMask([1,0]),true,2));
 const tiles=[{x:0,y:0,z:0},{x:.28,y:.28/1.24,z:1},...Array.from({length:8},(_,i)=>({x:8+i*4,y:0,z:0}))];
 const game={tiles,nb:L.neighbors(tiles),faces:[1,5,2,3,4,5,2,3,4,1],down:tiles.map((_,i)=>+(i===0)),clock:null,rules:{ice:{0:1},iceNb:L.iceNeighbors(tiles),locks:new Set([5]),keys:[0,9]}};
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:64};function observe(c,s){const v=s.view(),legal=new Set(v.legalTiles),o=observeBoard(tiles,v.state,null,{picture:i=>game.faces[i],role:i=>visibleRole(game,v.state,i),takeable:i=>legal.has(i)});const copy=structuredClone(o);c.observe(v.state,o);assert.deepEqual(o,copy);return o;}
 const fresh=[],choices=[];
 for(const enabled of [0,1]){
  const p={...release.profiles.Dennis,retryKeyIdentityMemory:1,retryAccessMemory:enabled,retryRetention:1,memoryDecay:0,outWeight:0,lapse:0,temperature:.001};
  const first=factory(game,settings),a=createFactoryController(tiles,p,31);a.beginAttempt();observe(a,first);fresh.push(a.decide());
  const c=createFactoryController(tiles,p,31);c.beginAttempt();observe(c,first);const prefix=[1,0,2,3,4];for(const i of prefix){assert(first.view().legalTiles.includes(i));first.tap(i);observe(c,first);}assert.equal(first.view().why,'tray');assert.equal(verifyAttempt(encodeGame(game),prefix,settings,first.audit()),prefix.length);c.endAttempt('mid',first.view().state.tray);
  if(enabled){const f=c.retryAccessEvidence().find(f=>f.index===0);assert.equal(f.orientation.value,1);assert(f.witnesses.some(w=>w.removed.length===1&&w.removed[0]===1));assert(!Object.hasOwn(f,'initialRole'));}
  const retry=factory(game,settings);c.beginAttempt();const o=observe(c,retry);assert.equal(o.roles[0],null);assert.equal(o.down[0],null);assert.equal(o.pictures[0],null);assert.equal(c.remembered()[0],1);assert(!retry.view().legalTiles.includes(0));
  const next=c.decide().index;choices.push(next);assert(retry.view().legalTiles.includes(next));if(enabled){assert([1,9].includes(next),'Remembered orientation and access let bounded lookahead start a real key continuation');const actions=[next];retry.tap(next);observe(c,retry);while(retry.view().type!=='productionPhysicalEnd-v1'){assert(actions.length<64);const i=c.decide().index;assert(retry.view().legalTiles.includes(i));actions.push(i);retry.tap(i);observe(c,retry);}assert(retry.view().win);assert.equal(verifyAttempt(encodeGame(game),actions,settings,retry.audit()),actions.length);}
 }
 assert(![1,9].includes(choices[0]),'The control chooses an unrelated pair rather than planning through the hidden remembered key');assert.deepEqual(fresh[0],fresh[1]);
 console.log('PASS monotone actual-access witnesses, restored-prerequisite/relief guards, remembered live down orientation without invented initial roles, unchanged fresh choices and independently replayed key-access win');
}
if(require.main===module)test();module.exports=test;


