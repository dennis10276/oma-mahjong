'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {simplifyKnownPrefix}=require('./public_reusable_exploration.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {encodeGame}=require('./personal_game_io.js');
const {verifyAttempt,createHumanController}=require('./human_reference_campaign.js');
function test(){
 const tiles=Array.from({length:6},(_,i)=>({x:i*8,y:0,z:0}));
 const actual={tiles,nb:Layouts.neighbors(tiles),faces:[5,6,5,6,7,7],down:[1,1,0,0,0,0],rules:null,clock:{i:4,n:5}};
 const model={tiles,nb:actual.nb,rules:null,clock:actual.clock};
 for(const field of ['faces','seed','deck'])Object.defineProperty(model,field,{get(){throw Error('Private '+field);}});
 const state={alive:tiles.map(()=>1),pictures:actual.faces.slice(),down:actual.down.slice(),tray:[],moves:0,openPeek:-1,relieved:false,arriving:[]};
 const roots=new Set([0,1,2,3,4,5]),path=[0,1,0,1,3,0,2,4,5];
 const result=simplifyKnownPrefix(model,state,path,path.length,roots,Date.now()+100);
 assert.deepEqual(result.path,[1,3,0,2,4,5]);assert.equal(result.removedKnownPeeks,3);
 assert.deepEqual(path,[0,1,0,1,3,0,2,4,5],'Do not mutate cached witness');
 const factory=createSessionFactory(),settings={seed:1,choiceLimit:64,tapMs:1000};
 const sessions=[factory(actual,settings),factory(actual,settings)];let replayed=0;
 for(const [i,route]of [path,result.path].entries()){
  for(const index of route){assert(sessions[i].view().legalTiles.includes(index));sessions[i].tap(index);}
  assert(sessions[i].view().win);replayed+=verifyAttempt(encodeGame(actual),route,settings,sessions[i].audit());
 }
 for(const field of ['alive','tray','moves','openPeek','relieved','arriving'])assert.deepEqual(sessions[0].view().state[field],sessions[1].view().state[field]);
 const necessary=[0,2,1,3,4,5];
 assert.deepEqual(simplifyKnownPrefix(model,state,necessary,necessary.length,roots,Date.now()+100).path,necessary,'Preserve twin peek needed to clear a pair');
 const restricted=simplifyKnownPrefix(model,state,[0,1,3,0,2,4,5],7,new Set([0]),Date.now()+100);
 assert.equal(restricted.path[0],0,'Never introduce an excluded search root');
 const unknown={...state,pictures:[5,null,5,6,7,7]};
 assert.deepEqual(simplifyKnownPrefix(model,unknown,[0,1],1,roots,Date.now()+100).path,[0,1],'Never inspect or reason through a future unknown peek');
 assert.deepEqual(simplifyKnownPrefix(model,state,path,path.length,roots,Date.now()-1).path,path,'Anytime deadline preserves original witness');
 assert.throws(()=>createHumanController(tiles,{reusableSimplifyPrefixes:true}));
 factory.verifySource();console.log('PASS known-prefix simplification removes only state-equivalent abandoned peeks, preserves twin pairs/root restrictions/unknown boundaries/deadlines and independently replays '+replayed+' winning production taps');
}
if(require.main===module)test();module.exports=test;
