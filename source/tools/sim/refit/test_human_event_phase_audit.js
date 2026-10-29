'use strict';
const assert=require('assert/strict'),{auditEvents}=require('./human_event_phase_audit.js');
function test(){
 const rows=[{aid:'a',lv:132,k:'start',at:1,ck:6,t:1},{aid:'a',lv:132,k:'clock',ml:0,left:76,t:2},{aid:'a',lv:132,k:'end',r:'stuck',left:76,tm:4,t:3},
 {aid:'b',lv:132,k:'start',at:2,ck:6,t:4},{aid:'b',lv:132,k:'end',r:'stuck',ck:1,left:76,t:5},
 {aid:'c',lv:132,k:'start',at:3,ck:6,t:6},{aid:'c',lv:132,k:'clock',ml:1,left:77,t:7},{aid:'c',lv:132,k:'end',r:'win',left:0,t:8},
 {aid:'replay',lv:132,k:'start',at:4,ck:6,t:9},{aid:'replay',lv:132,k:'end',r:'stuck',ck:1,left:76,t:10},
 {aid:'unknown',lv:135,k:'start',at:1,ck:8,t:11},{aid:'unknown',lv:135,k:'end',r:'stuck',left:80,t:12},
 {aid:'daily',lv:132,m:'d',d:'2026-10-29',k:'start',ck:6,t:0},{aid:'daily',lv:132,m:'d',d:'2026-10-29',k:'end',r:'win',left:0,t:.5},
 {aid:'unfinished',lv:136,k:'start',at:1,ck:8,t:13}];
 const r=auditEvents(rows,{from:132,to:136});assert.equal(r.summary.losses,3);assert.deepEqual(r.summary.counts,{beforeClock:1,mid:1,late:0,unknown:1});
 assert.deepEqual(r.summary.lossTimingCounts,{beforeClock:1,clockContact:1,mid:0,late:0,unknown:1});
 assert.equal(r.summary.clockContactFailures,1);assert.equal(r.attempts[0].phase,'mid','Clock-tile tray loss happens after the saved-clock event, even with zero moves left');
 assert.equal(r.summary.quality.afterFirstWinGroups,1);assert.equal(r.summary.quality.missingEnd,1);assert.equal(r.summary.quality.excludedNonLevelEvents,2);assert.equal(r.attempts[0].maxTray,4);assert.equal(r.summary.phaseShareBounds.beforeClock.lower,1/3);assert.equal(r.summary.phaseShareBounds.beforeClock.upper,2/3);
 assert.deepEqual(r.summary.quality.missingLevels,[133,134]);
 console.log('PASS saved-clock vs expiry semantics, last-move tray contact, explicit/unknown phase bounds, natural first-clear replay exclusion and missing-end censoring');
}
if(require.main===module)test();module.exports=test;
