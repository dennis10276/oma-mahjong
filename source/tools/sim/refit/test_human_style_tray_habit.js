'use strict';
const assert=require('assert/strict'),{createStyleController}=require('./human_style_controller.js');
const profiles=require('./human_style_profiles.json');
function test(){
 const tiles=Array.from({length:8},(_,i)=>({x:i*4,y:0,z:0}));
 function choose(bonus,clock=null,tray=[7,8,9]){
  const p={...profiles.Dennis,trayDepth:6,clockTrayDepth:3,futureWeight:2,pairReward:12,outWeight:5,trayRestoreBonus:0,lapse:0,temperature:.01};
  if(bonus!==undefined)p.trayRestoreBonus=bonus;
  const c=createStyleController(tiles,p,31);c.beginAttempt();
  c.observe({alive:Array(8).fill(1),tray,openPeek:1,moves:0,physicalTaps:0,relieved:false},
   {pictures:[7,4,4,1,1,2,2,3],roles:Array(8).fill('none'),down:[0,1,0,0,0,0,0,0],takeable:Array(8).fill(true),clock});
  return c.decide();
 }
 assert.equal(choose(undefined).index,2,'Control fixture must expose the old preference to clear a pile pair while retaining three tray tiles');
 assert.equal(choose(18).index,0,'Dennis should restore two occupied spots immediately when no clock route competes');
 assert.equal(choose(18,null,[7,8]).index,0,'The clean-tray habit also applies at two occupied spots');
 assert.deepEqual(choose(0,null,[]),choose(18,null,[]),'The habit must not bias choices when the tray is empty');
 const clock={i:7,n:10,remaining:10};
 assert.deepEqual(choose(0,clock),choose(18,clock),'Clock-route decisions keep their own planning tradeoff; do not blindly empty the tray');
 console.log('PASS personal clean-tray habit prefers an immediate escape from pressure and preserves clock-route/empty-tray choices');
}
if(require.main===module)test();module.exports=test;
