'use strict';
const assert=require('assert/strict'),{createStyleController}=require('./human_style_controller.js');
const profiles=require('./human_style_profiles.json');
function test(){
 const tiles=Array.from({length:5},(_,i)=>({x:i*4,y:0,z:0}));
 const state={alive:Array(5).fill(1),tray:[],openPeek:-1,moves:0,physicalTaps:0,relieved:false};
 const packet={pictures:[1,1,null,2,null],roles:Array(5).fill('none'),down:[0,0,1,0,1],takeable:Array(5).fill(true),clock:null};
 function make(bonus,minTray=0){const c=createStyleController(tiles,{...profiles.Dennis,trayDepth:6,clockTrayDepth:3,
  futureWeight:2,pairReward:12,outWeight:5,trayRestoreBonus:18,safePeekBonus:bonus,safePeekMinTray:minTray,lapse:0,temperature:.01},31);c.beginAttempt();return c;}
 const greedy=make(0);greedy.observe(state,packet);assert([0,1].includes(greedy.decide().index));
 const informed=make(64);informed.observe(state,packet);const first=informed.decide().index;
 assert([2,4].includes(first),'Proactive information gathers a currently free unknown closed picture before consuming unrelated known pairs');
 const pictures=packet.pictures.slice();pictures[first]=2;
 informed.observe({...state,openPeek:first,physicalTaps:1},{...packet,pictures});
 assert.equal(informed.decide().index,3,'Finish the newly observed on-pile match before exploring another unknown picture');
 const tray=make(64);tray.observe({...state,tray:[1]},packet);
 assert([0,1].includes(tray.decide().index),'An already available tray match takes precedence over proactive information');
 const choices=[0,64].map(bonus=>{const c=make(bonus);c.observe(state,{...packet,clock:{i:0,n:12,remaining:12}});return c.decide();});
 assert.deepEqual(choices[0],choices[1],'Post-clock information preference must not alter the short clock policy');
 const light=make(64,2);light.observe(state,packet);assert([0,1].includes(light.decide().index),'A pressure-only information habit leaves empty-tray pair choices unchanged');
 const pressure=make(64,2);pressure.observe({...state,tray:[7,8]},packet);
 assert([2,4].includes(pressure.decide().index),'At two occupied spots, inspect an unknown closed picture before adding pressure');
 console.log('PASS safe post-clock information preference; immediate tray/pile matches and clock choices retain priority');
}
if(require.main===module)test();module.exports=test;
