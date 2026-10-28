'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {learnedEscapePlan}=require('./public_learned_escape.js'),{advance}=require('./known_tray_plan.js');
function test(){
 const tiles=[{x:0,y:0,z:1},{x:0,y:0,z:0}],game={tiles,nb:L.neighbors(tiles),rules:null,clock:{i:1,n:20}};
 for(const field of ['faces','deck','seed'])Object.defineProperty(game,field,{get(){throw Error('Private '+field);}});
 const state={alive:[1,1],pictures:[7,null],down:[0,1],tray:[1],moves:0,openPeek:-1,relieved:false,arriving:[]};
 const actions=[{index:0}],primary={index:0,path:[0]},before=JSON.stringify(state);
 assert.equal(learnedEscapePlan(game,state,actions,primary,{}, {milliseconds:500}),null,'Earlier mode cannot compare this known-prefix information route');
 const plan=learnedEscapePlan(game,state,actions,primary,{}, {milliseconds:500,continuationRanking:true});
 assert(plan);assert.deepEqual(plan.path,[0,1]);assert(plan.information&&!plan.knownWin&&!plan.knownDead);
 assert(plan.learnedEscape.continuationRanking&&plan.learnedEscape.probability<=plan.learnedEscape.rootProbability);
 const moved=advance(game,state,0);assert(!moved.uncertain&&!moved.lost);assert(advance(game,moved.state,1).uncertain);
 assert.equal(JSON.stringify(state),before);assert.equal(moved.state.pictures[1],null,'Projected information scoring never supplies the hidden picture');
 assert.equal(learnedEscapePlan(game,state,actions,{...primary,safeClockExit:true},{},{continuationRanking:true}),null);
 console.log('PASS continuation ranking constructs a known-prefix route to actual unknown inspection,scores only public state,keeps correlated Q estimates heuristic,preserves proofs and never invents pictures');
}
if(require.main===module)test();module.exports=test;
