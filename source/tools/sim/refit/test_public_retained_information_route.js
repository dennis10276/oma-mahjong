'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {retryInformationSearch,createRetainedInformationRoute}=require('./public_retry_information.js');
const {advance}=require('./known_tray_plan.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {observeBoard}=require('./human_board_visibility.js');
const {encodeGame}=require('./personal_game_io.js');
const {verifyAttempt,createHumanController}=require('./human_reference_campaign.js');
function test(){
 const tiles=Array.from({length:6},(_,i)=>({x:i*8,y:0,z:0}));
 const actual={tiles,nb:Layouts.neighbors(tiles),faces:[5,6,7,7,5,6],down:[0,0,1,1,0,0],rules:null,clock:null};
 const model={tiles,nb:actual.nb,rules:null,clock:null};
 for(const field of ['faces','deck','seed'])Object.defineProperty(model,field,{get(){throw Error('Private '+field);}});
 const factory=createSessionFactory(),settings={seed:1,choiceLimit:64,tapMs:1000};
 const session=factory(actual,settings);session.tap(4);session.tap(5);
 const pictures=[5,6,null,null,5,6],down=actual.down.slice(),initialRoles=tiles.map(()=>'none');
 const memory={pictures,down,initialRoles};
 const position=()=>({...session.view().state,pictures:pictures.map((p,i)=>session.view().state.alive[i]?p:null),down});
 const actions=()=>session.view().legalTiles.map(index=>({index}));
 const primary={index:1,path:[1],nodes:0,knownWin:false,knownDead:false,safeClockExit:false};
 let report=primary;
 const policy=retryInformationSearch(()=>report,{reusablePlanning:true,contextVersion:()=>JSON.stringify(memory),
  continueAfterInformation:true,prepareCrowded:true,retainRoute:true,nodes:10000,milliseconds:100,choices:64});
 policy.beginAttempt(memory);
 const state=position(),first=policy.search(model,state,actions());
 assert.deepEqual(first.path,[0,2]);assert.equal(first.retryInformationWitness.knownPrefixTaps,1);
 const original=JSON.stringify(memory);session.tap(first.index);policy.observe(memory);
 const second=policy.search(model,position(),actions());
 assert.equal(second.index,2);assert(second.retryInformationWitness.retainedRoute);
 assert.equal(second.retryInformationWitness.knownPrefixTaps,0);
 assert.equal(policy.stats().retainedRouteTaps,1);assert.equal(JSON.stringify(memory),original);
 assert.equal(pictures[2],null,'The planned peek never becomes a remembered picture');
 session.tap(second.index);
 const observed=observeBoard(tiles,session.view().state,null,{picture:i=>actual.faces[i],role:()=> 'none'});
 observed.pictures.forEach((p,i)=>{if(p!==null)pictures[i]=p;});policy.observe(memory);
 assert.equal(pictures[2],7,'Only the actual production reveal supplies the picture');
 const replayed=verifyAttempt(encodeGame(actual),[4,5,0,2],settings,session.audit());
 policy.finish('unresolved',memory);
 const route={path:[0,2],knownPrefixTaps:1,kind:'actualPeekRequired',knownWin:false};
 const expected={...advance(model,state,0).state,physicalTaps:state.physicalTaps+1};
 const cache=createRetainedInformationRoute();
 cache.remember(model,state,route);assert.equal(cache.take(model,{...expected,moves:expected.moves+1},actions(),Date.now()+100,1),null,'Different actual histories invalidate continuation');
 cache.remember(model,state,route);assert.equal(cache.take(model,{...expected,physicalTaps:expected.physicalTaps+1},actions(),Date.now()+100,1),null,'An extra peek cannot masquerade as the expected next tap');
 cache.remember(model,state,route);assert.equal(cache.take(model,expected,[{index:1}],Date.now()+100,1),null,'Unavailable first continuation invalidates');
 cache.remember(model,state,route);assert.equal(cache.take({...model,clock:{i:2,n:expected.moves+2}},expected,actions(),Date.now()+100,1),null,'Urgent clock invalidates unknown peek');
 cache.remember(model,state,route);assert.equal(cache.take(model,expected,actions(),Date.now()-1,1),null,'Deadline invalidates');
 cache.remember(model,state,route);cache.clear();assert.equal(cache.take(model,expected,actions(),Date.now()+100,1),null);
 // Fresh information and higher-priority constructive witnesses must stop retention.
 for(const protection of ['knownWin','safeClockExit','newKnowledge','newAttempt']){
  const fresh=retryInformationSearch(()=>report,{reusablePlanning:true,contextVersion:()=> 'known',continueAfterInformation:true,
   prepareCrowded:true,retainRoute:true,nodes:10000,milliseconds:100,choices:64});
  report=primary;const initialMemory={pictures:[5,6,null,null,5,6],down,initialRoles};fresh.beginAttempt(initialMemory);
  assert.deepEqual(fresh.search(model,state,[0,1,2,3].map(index=>({index}))).path,[0,2]);
  if(protection==='newKnowledge')fresh.observe({...initialMemory,pictures:[5,6,7,null,5,6]});
  else if(protection==='newAttempt'){fresh.finish('unresolved',initialMemory);fresh.beginAttempt(initialMemory);}
  else report={...primary,[protection]:true};
  const next=fresh.search(model,expected,[0,1,2,3].map(index=>({index})));
  assert(!next.retryInformationWitness?.retainedRoute);assert.equal(fresh.stats().retainedRouteTaps,0);
 }
 assert.throws(()=>retryInformationSearch(()=>primary,{retainRoute:true}));
 assert.throws(()=>createHumanController(tiles,{reusableRetainRoute:true}));
 factory.verifySource();console.log('PASS retained public information prefixes follow verified production taps, stop on discoveries/history/clock/legality/deadline changes and protect constructive wins; '+replayed+' independently replayed taps');
}
if(require.main===module)test();module.exports=test;
