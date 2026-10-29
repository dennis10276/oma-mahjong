'use strict';
const assert=require('assert/strict'),{normalizeBoard}=require('./public_board_input.js'),{decodeGame}=require('./personal_game_io.js');
const {createSessionFactory}=require('./production_physical_session.js'),{observeBoard}=require('./human_board_visibility.js');
const {verifyAttempt}=require('./human_reference_campaign.js'),{createFactoryController,PROFILES}=require('./human_factory_controller.js');
function test(){
 const tiles=[...Array.from({length:13},(_,i)=>({x:i*2,y:0,z:1})),{x:0,y:6,z:0},{x:4,y:6,z:0},{x:8,y:6,z:0},{x:12,y:6,z:0},{x:12,y:0,z:0}],unknown=[1,2,3,4,5,7,8,9,10,11,17];
 const settings={seed:20261111,choiceLimit:128,tapMs:1000},path=[13,14,0,1,2,2,3,4,4,5,6,7,8,8,9,10,10,11,17,12,15,16],choices=[];let verified=0;
 for(const swap of [false,true]){
  const faces=[1,1,2,2,3,3,4,4,5,5,6,6,7,99,99,100,100,7];if(swap){faces[2]=faces[3]=3;faces[4]=faces[5]=2;}
  const encoded=normalizeBoard({tiles,faces,down:tiles.map((_,i)=>+unknown.includes(i)),clock:{i:6,n:9}}),game=decodeGame(encoded),factory=createSessionFactory();
  const witness=factory(game,settings);for(const index of path)witness.tap(index);assert(witness.view().win,'This public-clock-access state has a constructive physical winning continuation');verified+=verifyAttempt(encoded,path,settings,witness.audit());
  const session=factory(game,settings);session.tap(13);session.tap(14);const frame=session.view(),legal=new Set(frame.legalTiles),observed=observeBoard(game.tiles,frame.state,game.clock,{picture:i=>game.faces[i],role:()=> 'none',takeable:i=>legal.has(i)});
  const state=Object.fromEntries(['alive','tray','moves','openPeek','relieved','arriving','physicalTaps'].map(key=>[key,frame.state[key]]));
  Object.defineProperty(state,'faces',{get(){throw Error('Hidden deck read');}});Object.defineProperty(state,'down',{get(){throw Error('Private orientations read');}});
  function choose(preview){const c=createFactoryController(tiles,{...PROFILES.dennis,clockHorizon:1,clockRowPreview:preview,lapse:0,temperature:.001},31);c.beginAttempt();c.observe(state,observed);const choice=c.decide();assert.equal(c.planningAttention().clockHorizon,1);assert(unknown.every(i=>c.remembered()[i]===null),'Seeing the side row cannot fabricate its pictures');return choice;}
  assert([15,16].includes(choose(0).index),'The control exposes the original unrelated-pair preference on the final clock margin');
  choices.push(choose(1));assert.equal(choices.at(-1).index,0,'A person sees the end of the clock row even when it lies beyond the short action cone');factory.verifySource();
 }
 assert.deepEqual(choices[0],choices[1],'Concealed-picture variants cannot affect the pre-reveal row choice');
 assert.throws(()=>createFactoryController(tiles,{...PROFILES.dennis,clockRowPreview:2},31));
 console.log('PASS visible long-row clock access with one-step thought, hidden-picture invariance, original-policy control and '+verified+' independently replayed physical winning taps');
}
if(require.main===module)test();module.exports=test;
