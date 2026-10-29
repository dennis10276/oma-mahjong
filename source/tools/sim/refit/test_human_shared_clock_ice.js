'use strict';
const assert=require('assert/strict'),board=require('./human_shared_ice_fixture.json');
const {measureHuman}=require('./human_bot.js'),{PROFILES,createFactoryController}=require('./human_factory_controller.js');
function test(){
 const options={setting:'dennis',runs:1,maxAttempts:1,seed:20261028,capture:true};
 const control=measureHuman(board,options),profiles={Dennis:{...PROFILES.dennis,sharedClockIce:1},family:PROFILES.family},fixed=measureHuman(board,{...options,profiles});
 assert.equal(control.results[0].attempts[0].why,'clock');assert.equal(fixed.firstTryRate,1);assert(fixed.verifiedTaps>0);
 assert.equal(fixed.results[0].attempts[0].left,0);assert.equal(fixed.lossTiming.counts.beforeClock,0);
 assert(fixed.results[0].attempts[0].clockLeft>0,'A real clock-removal transition must be recorded, even in a winning attempt');
 assert.throws(()=>createFactoryController(board.tiles,{...PROFILES.dennis,sharedClockIce:2},3));
 console.log('PASS public shared clock/ice prerequisite repair on a recorded counterexample, frozen-profile clock-loss control and independently replayed physical win; one case does not certify cohort performance');
}
if(require.main===module)test();module.exports=test;
