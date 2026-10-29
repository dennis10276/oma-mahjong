'use strict';
const assert=require('assert/strict'),{CONTRACT,summarize}=require('./human_style_benchmark.js'),{clockLossTiming}=require('./human_clock_loss_timing.js');
function test(){
 assert.deepEqual(CONTRACT.gates.beforeClock,{Dennis:[.2,.3],family:[.35,.45]});assert(!Object.hasOwn(CONTRACT.gates,'eachClockCaseClockShareAbove'));
 assert.equal(clockLossTiming('clock',null,50),'beforeClock');assert.equal(clockLossTiming('mid',50,50),'clockContact');assert.equal(clockLossTiming('mid',50,48),'clockContact');assert.equal(clockLossTiming('mid',50,47),'mid');assert.equal(clockLossTiming('late',10,8),'clockContact');assert.equal(clockLossTiming('late',12,8),'late');assert.equal(clockLossTiming('unknown',null,50),'unknown');assert.equal(clockLossTiming(null,50,48),null);
 const rows=[89,91,...Array.from({length:72},(_,i)=>92+i)].map(lv=>({lv,measure:{valid:true,minutesPerBoard:.001,settings:Object.fromEntries(['Dennis','family'].map(name=>{const c=CONTRACT.cohorts[name];let wins=name==='Dennis'?10:6;if(c.risk.includes(lv))wins=name==='Dennis'?4:2;if(c.controls.includes(lv))wins=name==='Dennis'?16:10;if(lv===142&&name==='Dennis')wins=12;const before=name==='Dennis'?25:40;return[name,{runs:20,firstTryRate:wins/20,firstTryWins:wins,cleared:20,lossCounts:{clock:before,mid:95-before,late:5},lossShares:{clock:before/100,mid:(95-before)/100,late:.05},lossTiming:{counts:{beforeClock:before,clockContact:10,mid:85-before,late:5}}}];}))}}));
 const s=summarize(rows,12);assert(s.finalGatesMet);assert(s.settings.Dennis.checks.c);assert(s.settings.family.checks.c);assert(s.settings.Dennis.lossTiming.complete);assert.equal(s.settings.Dennis.clockCases[135],.25,'Obsolete case majority is diagnostic only');
 const clone=x=>JSON.parse(JSON.stringify(x));let bad=clone(rows);bad.find(r=>r.lv===142).measure.settings.Dennis.firstTryRate=.5;assert(!summarize(bad,12).settings.Dennis.checks.level142);
 bad=clone(rows);bad.find(r=>r.lv===142).measure.settings.family.cleared=0;assert(!summarize(bad,12).settings.family.checks.level142);
 bad=clone(rows);delete bad[4].measure.settings.Dennis.lossTiming;assert(!summarize(bad,12).finalGatesMet,'Legacy rows cannot invent clock-contact coverage');
 bad=clone(rows);bad[4].measure.settings.Dennis.lossTiming.counts.clockContact++;assert(!summarize(bad,12).finalGatesMet,'Duplicated contact losses cannot produce a passing gate');
 for(const name of ['Dennis','family']){const c=CONTRACT.cohorts[name];assert.equal(c.risk.length,10);assert.equal(c.controls.length,10);assert(c.risk.every(lv=>!c.controls.includes(lv)));}
 console.log('PASS approved person-specific phases/cohorts, independent clock-contact accounting, unchanged first rates, replacement risk gate and142 repair gate; statistical fixtures do not assert physical model success');
}
if(require.main===module)test();module.exports=test;
