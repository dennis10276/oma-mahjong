'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {clockMateRouteBudget}=require('./public_clock_mate_budget.js'),{measureHuman}=require('./human_bot.js'),{decodeGame}=require('./personal_game_io.js');
const board=require('./human_clock_mate_budget_fixture.json'),profiles=require('./human_v1_clock_outs_profiles.json');
function test(){
 const r=measureHuman(board,{setting:'dennis',profiles,runs:1,maxAttempts:1,seed:20261028,capture:true}),a=r.results[0].attempts[0],d=a.decisions[0],c=d.observed.clock.i;
 const mate=d.observed.pictures.findIndex((face,i)=>i!==c&&face!==null&&face===d.observed.pictures[c]&&d.observed.roles[i]==='lock');assert(mate>=0);
 const input={alive:d.state.alive,nb:Layouts.neighbors(decodeGame(board).tiles),clock:d.observed.clock,mate,roles:d.observed.roles,down:d.observed.down};Object.defineProperty(input,'faces',{get(){throw Error('Private deck read');}});
 const bound=clockMateRouteBudget(input);assert.equal(bound.required.length,6);assert.equal(bound.outsideAtLeast,1);assert.equal(bound.lowerBound,7);assert.equal(bound.budget,6);assert(!bound.fits);
 const closed=Array.from(input.down);closed[mate]=1;assert(clockMateRouteBudget({...input,down:closed}).fits,'A possible same-tap pair is an optimistic bound, not a proven route');
 const short=structuredClone(profiles);short.Dennis.clockHorizon=2;const hasty=measureHuman(board,{setting:'dennis',profiles:short,runs:1,maxAttempts:1,seed:20261028,capture:true});assert(!hasty.results[0].attempts[0].win,'A short attention cone can pursue the apparently attractive key goal without counting the whole route');assert.equal(hasty.results[0].attempts[0].decisions[0].observed.roles[hasty.results[0].attempts[0].actions[0]],'key');
 assert(a.win,'The bot must use another opening rather than prioritize the over-budget optional mate route');assert(r.verifiedTaps>0);
 console.log('PASS public union/side-access clock-mate lower bound, optimistic closed-pair grace, private-deck getter exclusion and independently replayed alternative win; no board impossibility inferred');
}
if(require.main===module)test();module.exports=test;
