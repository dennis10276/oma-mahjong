'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {trayHorizon}=require('./human_style_tray_horizon.js');
const {createStyleController}=require('./human_style_controller.js');
const profiles=require('./human_style_profiles.json');
function test(){
 const tiles=Array.from({length:3},(_,i)=>({x:i*4,y:0,z:0})),nb=Layouts.neighbors(tiles);
 const state={alive:[0,1,1],tray:[2],moves:1,physicalTaps:1,openPeek:-1};
 const packet={pictures:[null,3,null],roles:[null,'none','key'],down:[null,0,1],takeable:[false,true,true],clock:null};
 for(const face of [0,2]){
  const pictures=[face,3,null],roles=['key','none','key'],s={...state,tray:[face]};
  assert.equal(trayHorizon(tiles,nb,s,packet,pictures,roles,1).get(2),0);
  const prior=JSON.stringify({s,packet,pictures,roles});
  assert(Math.abs(trayHorizon(tiles,nb,s,packet,pictures,roles,1,{keyPictureBelief:.8}).get(2)-9.6)<1e-9,
   'An expected matching key remains probability weighted, including picture zero');
  assert.equal(JSON.stringify({s,packet,pictures,roles}),prior,'Hypotheses cannot alter true picture/role memory');
  assert.equal(trayHorizon(tiles,nb,s,packet,pictures,['key','none','none'],1,{keyPictureBelief:1}).get(2),0,
   'The key relation cannot fabricate arbitrary unknown pictures');
 }
 function player(){
  const c=createStyleController(tiles,{...profiles.Dennis,keyPictureBelief:.8,lapse:0,temperature:.01},31);c.beginAttempt();
  const initial={alive:[1,1,1],tray:[],moves:0,openPeek:-1,physicalTaps:0};
  Object.defineProperty(initial,'down',{enumerable:true,get(){throw Error('Actual hidden down flags accessed');}});
  Object.defineProperty(initial,'faces',{enumerable:true,get(){throw Error('Private deck accessed');}});
  const observed={pictures:[2,3,null],roles:['key','none','key'],down:[0,0,1],takeable:[true,true,true],clock:null};
  Object.defineProperty(observed,'hiddenPictures',{enumerable:true,get(){throw Error('Extra observation field accessed');}});
  c.observe(initial,observed);c.observe(state,packet);
  assert.equal(c.decide().index,2);assert.equal(c.remembered()[2],null,'A strong expectation is not an observation');
  return c;
 }
 const wrong=player();wrong.observe({...state,openPeek:2,physicalTaps:2},{...packet,pictures:[null,3,5]});
 assert.equal(wrong.remembered()[2],5,'The actual reveal overrides the expectation without any fabricated prior memory');
 const matched=player();matched.observe({...state,alive:[0,1,0],tray:[],moves:2,physicalTaps:2},
  {...packet,pictures:[null,3,null],roles:[null,'none',null],down:[null,0,null],takeable:[false,true,false]});
 assert.equal(matched.remembered()[2],2,'An actual observed tray match proves the removed key picture and may enter retry memory');
 console.log('PASS weighted key-picture expectations, hidden-field noninterference, real reveal correction, and proof-only match memory');
}
if(require.main===module)test();module.exports=test;
