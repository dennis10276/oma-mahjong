'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {createFactoryController}=require('./human_factory_controller.js'),release=require('./human_release.js');
const {createSessionFactory}=require('./production_physical_session.js'),{observeBoard}=require('./human_board_visibility.js');
const {visibleRole,verifyAttempt}=require('./human_reference_campaign.js'),{encodeGame}=require('./personal_game_io.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:.28,y:.28/1.24,z:1},...Array.from({length:8},(_,i)=>({x:8+i*4,y:0,z:0}))];
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:128};
 for(const scenario of ['same-zero','both-forgotten','different']){
  const same=scenario!=='different',faces=same?[0,5,2,3,4,5,2,3,4,0]:[1,1,2,3,4,5,2,3,4,5],down=tiles.map(()=>0);if(scenario==='both-forgotten')down[9]=1;
  const game={tiles,nb:L.neighbors(tiles),faces,down,clock:null,rules:{ice:{0:1},iceNb:L.iceNeighbors(tiles),locks:new Set([5]),keys:[0,9]}};
  function observe(c,s){const v=s.view(),legal=new Set(v.legalTiles),o=observeBoard(tiles,v.state,null,{picture:i=>{assert.notEqual(i,0,'Covered picture cannot be read on retry');return faces[i];},role:i=>visibleRole(game,v.state,i),takeable:i=>legal.has(i)});c.observe(v.state,o);return o;}
  // The strict reader above is only for the covered retry opening. Actual training
  // and play use the same visibility gate with a normal trusted renderer reader.
  function normal(c,s){const v=s.view(),legal=new Set(v.legalTiles),o=observeBoard(tiles,v.state,null,{picture:i=>faces[i],role:i=>visibleRole(game,v.state,i),takeable:i=>legal.has(i)});c.observe(v.state,o);return o;}
  const firstChoices=[];
  for(const enabled of [0,1]){
   const p={...release.profiles.Dennis,retryKeyIdentityMemory:1,retryKeyPictureRelations:enabled,retryRetention:0,memoryDecay:0,lapse:0,temperature:.001};
   const first=factory(game,settings),fresh=createFactoryController(tiles,p,31);fresh.beginAttempt();normal(fresh,first);firstChoices.push(fresh.decide());
   const c=createFactoryController(tiles,p,31);c.beginAttempt();normal(c,first);const prefix=scenario==='both-forgotten'?[9,1,2,3,4]:[1,2,3,4];
   for(const i of prefix){assert(first.view().legalTiles.includes(i));first.tap(i);normal(c,first);}assert.equal(first.view().why,'tray');assert.equal(verifyAttempt(encodeGame(game),prefix,settings,first.audit()),prefix.length);c.endAttempt('mid',first.view().state.tray);
   const facts=c.keyPictureRelationEvidence();assert.deepEqual(facts.map(f=>[f.a,f.b,f.attempt]),enabled&&same?[[0,9,1]]:[]);assert(facts.every(f=>!Object.hasOwn(f,'picture')),'A relation stores equality, not an unforgotten hidden picture value');
   const retry=factory(game,settings);c.beginAttempt();const o=observe(c,retry);assert.equal(o.pictures[0],null);assert.equal(o.roles[0],null);assert(!retry.view().legalTiles.includes(0));
   const expected=enabled&&scenario==='same-zero'?0:null;assert.equal(c.remembered()[0],expected,'Only a known source picture plus an earlier actual equality can recover the covered picture');const actions=[];
   if(scenario==='both-forgotten'){assert.equal(c.remembered()[9],null);retry.tap(9);actions.push(9);normal(c,retry);assert.equal(c.remembered()[0],enabled?0:null,'An actual fresh peek supplies the missing zero-valued source');}
   while(retry.view().type!=='productionPhysicalEnd-v1'){assert(actions.length<128);const i=c.decide().index;assert(retry.view().legalTiles.includes(i));actions.push(i);retry.tap(i);normal(c,retry);}assert(retry.view().win);assert.equal(verifyAttempt(encodeGame(game),actions,settings,retry.audit()),actions.length);
  }
  assert.deepEqual(firstChoices[0],firstChoices[1],'A current-attempt observation cannot activate a prior-attempt relation');
 }
 assert.throws(()=>createFactoryController(tiles,{...release.profiles.Dennis,retryKeyPictureRelations:1},1));
 console.log('PASS observed-history key-picture equality, zero-valued inference, both-forgotten/different-picture negatives, hidden-ice visibility, fresh-choice parity and independently replayed physical wins');
}
if(require.main===module)test();module.exports=test;
