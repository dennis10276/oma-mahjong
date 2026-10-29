'use strict';
const assert=require('assert/strict'),{measureHuman}=require('./human_style_measure.js');
const {createLimitedReference,limitedOptions}=require('./human_limited_reference.js');
function test(){
 const p=limitedOptions(1);assert(p.taps<=4&&p.nodes<=96&&p.beam<=6);
 for(const key of ['openingConditionalPlanning','retryInformationWitness','finishKnown','clockRecovery','continuationPruning'])assert.equal(p[key],false);
 const board={tiles:[[0,0,0],[4,0,0],[8,0,0],[12,0,0]],faces:[1,1,2,2],down:[]};
 const r=measureHuman(board,{setting:'dennis',runs:4,seed:1,maxAttempts:1});
 assert.equal(r.runs,4);assert.equal(r.firstTryRate,1);assert.equal(r.averageTries,1);assert(r.valid&&r.verifiedTaps>0);assert.deepEqual(Object.keys(r.lossPhase),['beforeClock','mid','late']);
 assert.equal(r.version,require('./human_bot.js').VERSION);assert(r.minutes<5&&r.slowestMove<2000);
 const choices=new Set();
 for(let seed=1;seed<=12;seed++){
  const c=createLimitedReference(board.tiles.map(t=>({x:t[0],y:t[1],z:t[2]})),{memoryDecay:1,retryRetention:0},seed);c.beginAttempt();
  const s={alive:[1,1,1,1],tray:[],moves:0,physicalTaps:0,openPeek:-1};Object.defineProperty(s,'faces',{get(){throw Error('private pictures');}});
  c.observe(s,{pictures:[null,null,null,null],roles:['none','none','none','none'],down:[1,1,1,1],takeable:[true,true,true,true],clock:null});
  choices.add(c.decide().index);assert.deepEqual(c.remembered(),[null,null,null,null]);
 }
 assert(choices.size>1,'Independent seeds must produce genuinely different choices among public ties');
 assert.throws(()=>measureHuman(board,{setting:'level-specific',runs:1}));
 console.log('PASS stable selected-setting API, limited reference controls, arbitrary boards, stochastic tie choices and hidden-picture privacy');
}
if(require.main===module)test();module.exports=test;
