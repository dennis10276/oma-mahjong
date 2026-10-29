'use strict';
const assert=require('assert/strict'),{createStyleController}=require('./human_style_controller.js'),profiles=require('./human_style_profiles.json');
function test(){
 const tiles=[{x:0,y:0,z:0},{x:4,y:0,z:0},{x:8,y:0,z:0}];
 function choose(weight,clock=null){
  const c=createStyleController(tiles,{...profiles.Dennis,postClockKeyWeight:weight,trayDepth:0,lapse:0,temperature:.01},31);c.beginAttempt();
  c.observe({alive:[1,1,1],tray:[],moves:0,physicalTaps:0,openPeek:-1},{pictures:[1,2,3],roles:['key','none','lock'],down:[0,0,0],takeable:[true,true,false],clock});return c.decide();
 }
 assert.equal(choose(16).index,0);assert.equal(choose(16).score-choose(8).score,8);
 const clock={i:2,n:10,remaining:10};assert.deepEqual(choose(8,clock),choose(16,clock),'Post-clock key patience must not change the urgency of keys needed for the current clock');
 assert.throws(()=>createStyleController(tiles,{...profiles.Dennis,postClockKeyWeight:-1},31));
 console.log('PASS post-clock key patience is global, nonnegative, and independent of immediate clock urgency');
}
if(require.main===module)test();module.exports=test;
