'use strict';
const assert=require('assert/strict'),L=require('../../../www/layouts.js');
const {createCleanupIntention}=require('./public_cleanup_intention.js');
const {advance}=require('./known_tray_plan.js');
function test(){
 const tiles=[{x:0,y:0,z:1},{x:0,y:0,z:0},{x:8,y:0,z:0},{x:16,y:0,z:0}],game={tiles,nb:L.neighbors(tiles),rules:null,clock:null};
 for(const f of ['faces','deck','seed'])Object.defineProperty(game,f,{get(){throw Error('Private '+f);}});
 let state={alive:[1,1,1,1],pictures:[7,null,9,9],down:[0,1,1,1],tray:[1,2],moves:0,openPeek:-1,relieved:false,arriving:[]};
 const memory=createCleanupIntention(),original={index:0,path:[0,1],information:true};memory.remember(original,'seen-v1');
 for(const i of [2,3]){memory.acknowledge(i,true);state=advance(game,state,i).state;}
 const plan=memory.propose(game,state,{index:0,path:[0]},'seen-v1');assert.deepEqual(plan.path,[0,1]);assert(plan.information&&!plan.knownWin);
 memory.acknowledge(0,true);state=advance(game,state,0).state;
 assert.deepEqual(memory.propose(game,state,{index:1,path:[1]},'seen-v1').path,[1]);
 assert.equal(memory.propose(game,state,{index:1,path:[1]},'new-picture'),null,'New public knowledge discards stale intention');
 memory.remember(original,'x');memory.acknowledge(2,false);assert.equal(memory.propose(game,state,{index:1},'x'),null);
 memory.remember(original,'x');assert.equal(memory.propose(game,state,{index:1,knownWin:true},'x'),null,'Never displace a new proved win');
 memory.remember(original,'x');assert.equal(memory.propose(game,state,{index:1,provedDeadRoots:[1]},'x'),null,'Current proof exclusions take precedence');
 memory.remember(original,'x');memory.clear();assert.equal(memory.propose(game,state,{index:1},'x'),null);
 console.log('PASS cleanup retains and consumes a public information intention,fully revalidates known prefixes,stops at unknown pictures,and invalidates new knowledge,rejected taps,proof conflicts and retry reset');
}
if(require.main===module)test();module.exports=test;
