'use strict';
const assert=require('assert/strict'),fixtures=require('./human_clock_outs_fixtures.json');
const {measureHuman}=require('./human_bot.js'),base=require('./human_v1_row_profiles.json');
function test(){
 const control=structuredClone(base),fixed=structuredClone(base);for(const name of ['Dennis','family']){control[name].sharedClockIce=1;fixed[name].sharedClockIce=1;fixed[name].clockOutsPlan=1;}
 const options={setting:'dennis',runs:1,maxAttempts:1,seed:20261028,capture:true};
 for(const [key,game]of Object.entries(fixtures).filter(([key])=>key!=='deadlineInspection')){
  const a=measureHuman(game,{...options,profiles:control}),b=measureHuman(game,{...options,profiles:fixed});const old=a.results[0].attempts[0],now=b.results[0].attempts[0];
  const clockMove=now.decisions.find(d=>d.index===game.clock.i);assert(clockMove);assert(clockMove.state.tray.includes(clockMove.remembered[game.clock.i]),'Preserve a known matching out for the clock');assert(now.clockLeft!==null);
  if(key==='matchingBlocker'){assert.equal(old.why,'clock');assert(now.win);assert(clockMove.state.tray.length===3,'A temporary third spot can be necessary for a clock pair');}
  else{const before=old.decisions.find(d=>!d.observed.clock),after=now.decisions.find(d=>!d.observed.clock);assert(before.state.tray.length>=3);assert(after.state.tray.length<=1);assert(now.left<old.left,'A later loss is diagnostic progress, not a certified clear');}
 }
 const {campaign}=require('./human_style_environment.js'),{createFactoryController}=require('./human_factory_controller.js');
 const once=campaign(fixtures.deadlineInspection,fixed.Dennis,(20261028+Math.imul(3,0x9e3779b9))|0,{maxAttempts:1,controllerFactory:createFactoryController});
 assert.equal(once.attempts.length,1);assert(!once.attempts[0].censored,'Known reinspection loop must end in a real production outcome, not a fake retry or cap');assert(once.verifiedTaps>0);
 const hidden=structuredClone(fixtures.matchingBlocker);assert.equal(hidden.down[60],1);hidden.faces[60]=19;
 const a=measureHuman(fixtures.matchingBlocker,{...options,profiles:fixed}),b=measureHuman(hidden,{...options,profiles:fixed});assert.deepEqual(a.results[0].attempts[0].actions.slice(0,5),b.results[0].attempts[0].actions.slice(0,5),'Concealed picture cannot change decisions before its reveal');
 console.log('PASS public clock/key matching outs, safe clock exit tray, necessary temporary third spot, concealed-picture prefix invariance and independent production replay; one win plus later-loss repair are not cohort certification');
}
if(require.main===module)test();module.exports=test;
