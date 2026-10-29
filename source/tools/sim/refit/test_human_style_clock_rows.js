'use strict';
const assert=require('assert/strict'),{createStyleController}=require('./human_style_controller.js'),profiles=require('./human_style_profiles.json');
function test(){
 const tiles=[...Array.from({length:11},(_,i)=>({x:i*2,y:0,z:0})),{x:40,y:0,z:0},{x:44,y:0,z:0}];
 function choose(preview,urgency=0){
  const p={...profiles.Dennis,clockHorizon:1,trayDepth:0,clockRowPreview:preview,clockRowUrgency:urgency,outWeight:0,lapse:0,temperature:.001};
  const c=createStyleController(tiles,p,31);c.beginAttempt();
  c.observe({alive:tiles.map(()=>1),tray:[],moves:0,physicalTaps:0,openPeek:-1},
   {pictures:tiles.map((_,i)=>i>=11?20:i),down:tiles.map(()=>0),roles:tiles.map(()=> 'none'),takeable:tiles.map((_,i)=>[0,10,11,12].includes(i)),clock:{i:5,n:7,remaining:7}});return c.decide();
 }
 assert([11,12].includes(choose(0).index),'The one-step cone cannot yet see the end of this blocked row');
 assert([0,10].includes(choose(1).index),'Public row geometry must guide an outer removal even with one-step clock lookahead');
 assert(choose(1,1).score>choose(1,0).score,'A small geometric clock margin increases urgency without solving a physical route');
 console.log('PASS visible sideways clock access beyond the action horizon and geometry-margin urgency');
}
if(require.main===module)test();module.exports=test;
