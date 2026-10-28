'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {pilePairRoutes}=require('./public_pile_pair_habit.js');
const {learnedEscapePlan}=require('./public_learned_escape.js');
const {createSessionFactory}=require('./production_physical_session.js');
const {verifyAttempt}=require('./human_reference_campaign.js'),{encodeGame}=require('./personal_game_io.js');
function test(){
 const tiles=Array.from({length:4},(_,i)=>({x:i*8,y:0,z:0})),game={tiles,nb:Layouts.neighbors(tiles),rules:null,clock:null};
 const factory=createSessionFactory(),settings={seed:1,tapMs:1000,choiceLimit:32};let taps=0;
 for(const down of [[1,0,0,0],[1,1,0,0]]){
  const actual={...game,faces:[1,1,2,2],down},session=factory(actual,settings);
  const state={...session.view().state,pictures:actual.faces.slice(),down:down.slice()};
  const pairs=pilePairRoutes(game,state,{deadline:Date.now()+500});assert(pairs.length);
  assert.deepEqual(pairs[0].path,[0,1],'Open the closed member first,then match its mate directly on pile');
  const plan=learnedEscapePlan(game,state,[0,1,2,3].map(index=>({index})),{index:1,path:[1]});
  assert(plan.pilePairHabit);assert.equal(plan.learnedEscape.probability,null,'No learned probability claim outside training domain');
  for(const index of plan.path){session.tap(index);assert.equal(session.view().state.tray.length,0);}
  for(const index of [2,3])session.tap(index);assert(session.view().win);
  taps+=verifyAttempt(encodeGame(actual),[...plan.path,2,3],settings,session.audit());
  assert.equal(pilePairRoutes(game,{...state,pictures:[null,1,2,2]},{deadline:Date.now()+500}).length,0,'Unknown hidden pictures cannot form a claimed pair');
  assert.equal(pilePairRoutes({...game,clock:{i:3,n:2}},state,{deadline:Date.now()+500}).length,0,'A pair that expires a live clock is forbidden');
  assert.equal(pilePairRoutes(game,state,{deadline:0}).length,0);
 }
 // Matching on the pile can itself be the known dead end: pressure stays3,
 // the remaining unmatched face-up tile would overflow. Do not prefer it.
 const dead={...game,tiles:tiles.slice(0,3),nb:Layouts.neighbors(tiles.slice(0,3))};
 const deadState={alive:[1,1,1],pictures:[1,1,2],down:[1,1,0],tray:[7,8,9],moves:0,openPeek:-1,relieved:false,arriving:[]};
 assert.equal(pilePairRoutes(dead,deadState,{deadline:Date.now()+500}).length,0,'Certified dead continuations override the pair habit');
 factory.verifySource();console.log('PASS pile-pair habit opens a closed member first with one/both down,uses zero tray slots,never invents hidden matches,rejects clock expiration/proved dead ends and independently replays '+taps+' winning taps');
}
if(require.main===module)test();module.exports=test;
