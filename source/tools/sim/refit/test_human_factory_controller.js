'use strict';
const assert=require('assert/strict'),{createFactoryController,PROFILES}=require('./human_factory_controller.js');
const {measureHuman}=require('./human_bot.js'),{campaign}=require('./human_style_environment.js');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:4,y:0,z:0}];
 const p={...PROFILES.dennis,clockWeight:0,postClockKeyWeight:0,trayCost:0,pairReward:0,exploration:0,zWeight:0,
  freePeekBonus:0,outWeight:0,futureWeight:1,trayDepth:1,memoryDecay:0,lapse:0,temperature:.001};
 const c=createFactoryController(tiles,p,31);c.beginAttempt();
 const state={alive:[1,1],tray:[],moves:0,physicalTaps:0,openPeek:-1};Object.defineProperty(state,'faces',{get(){throw Error('private picture access');}});
 c.observe(state,{pictures:[7,9],roles:['none','lock'],down:[1,0],takeable:[true,false],clock:null});
 assert.equal(c.decide().score,-.5,'A known closed tile is a peek, not a one-tap removal, even without a currently free twin');
 const board={tiles:[[0,0,0],[4,0,0],[8,0,0],[12,0,0]],faces:[1,1,2,2],down:[]};
 const capped=measureHuman(board,{runs:2,seed:1,choiceLimit:1,maxAttempts:12});
 assert.equal(capped.firstTryRate,null);assert.equal(capped.averageTries,null);assert(!capped.valid);
 assert.equal(capped.lossCounts.clock+capped.lossCounts.mid+capped.lossCounts.late,0,'Computation limits cannot become losses or free retries');
 assert(capped.results.every(r=>r.attempts.length===1&&r.attempts[0].censored));assert.equal(capped.runs,2);
 let finishes=0;const game=require('./public_board_input.js').normalizeBoard(board);
 campaign(game,PROFILES.dennis,1,{choiceLimit:1,maxAttempts:12,controllerFactory(t,p,s){const actor=createFactoryController(t,p,s);return {...actor,endAttempt(){finishes++;}};}});
 assert.equal(finishes,0,'Retry strategy learning needs an actual completed attempt');
 const valid=measureHuman(board,{runs:2,seed:1});assert.equal(valid.version,'human-v0');assert(valid.valid&&valid.verifiedTaps>0&&valid.firstTryRate===1);
 console.log('PASS audited factory API, physical closed-tile tap count, capped null means, no fabricated losses/retries, terminal learning and independent replay');
}
if(require.main===module)test();module.exports=test;
