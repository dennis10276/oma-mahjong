'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {learnedEscapePlan}=require('./public_learned_escape.js'),{legal,advance}=require('./known_tray_plan.js');
function test(){
 const tiles=Array.from({length:8},(_,i)=>({x:i*8,y:0,z:0})),game={tiles,nb:L.neighbors(tiles),rules:null,clock:null};
 let state={alive:tiles.map(()=>1),pictures:[7,8,9,9,null,null,null,null],down:[1,1,0,0,1,1,1,1],
  tray:[1,2],moves:0,openPeek:-1,relieved:false,arriving:[]};
 const plan=learnedEscapePlan(game,state,legal(game,state).free.map(index=>({index})),{index:2,path:[2]}, {},{milliseconds:500,nodes:512});
 assert(plan);let removed=0,information=false;
 for(const index of plan.path){const moved=advance(game,state,index);assert(!moved.lost);
  if(moved.uncertain){information=true;break;}removed+=moved.removed;state=moved.state;}
 assert(information||removed>0&&state.tray.length<=2,'A ranked override must reach real information,relief or safe board progress;not a bare known peek');
 assert(plan.learnedEscape.constructiveProgress||plan.information);
 // With no known prefix to progress,leave the original search in charge.
 const single={...state,alive:[1,1,0,0,0,0,0,0],pictures:[7,8,null,null,null,null,null,null],openPeek:-1};
 assert.equal(learnedEscapePlan(game,single,[{index:0},{index:1}],{index:0,path:[0]}, {},{milliseconds:500}),null);
 const capped=learnedEscapePlan(game,single,[{index:0},{index:1}],{index:0,path:[0]}, {},{milliseconds:500,nodes:0});
 assert.equal(capped,null,'Capped lack of a constructive out falls back;it is not a death proof or permission to cycle');
 console.log('PASS learned escape known-singleton cycle regression:every override reaches new information,relief or safe board removal;otherwise retain the original planner without claiming death');
}
if(require.main===module)test();module.exports=test;
