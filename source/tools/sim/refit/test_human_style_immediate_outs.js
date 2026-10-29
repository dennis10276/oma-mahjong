'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {createSession}=require('./production_physical_session.js');
const {certainlyTrappedAfterTake}=require('./human_style_immediate_outs.js');
function test(){
 const random=Layouts.rng(20261029),tiles=Array.from({length:8},(_,i)=>({x:i*4,y:0,z:0})),nb=Layouts.neighbors(tiles),iceNb=Layouts.iceNeighbors(tiles);
 let certified=0,uncertain=0,branches=0;
 for(let caseId=0;caseId<36;caseId++){
  const faces=[1,2,3,...Array.from({length:5},()=>4+Math.floor(random()*5))];
  const down=Uint8Array.from(tiles,(_,i)=>i>=3?+(random()<.5):0);
  const mode=caseId%3;
  const rules=mode?{ice:mode===2?{4:1}:{},iceNb,keys:mode===1?[2]:[6],locks:new Set([3])}:null;
  if(mode)faces[3]=1;
  const game={tiles,nb,faces,down,rules,clock:null};
  function replay(actions){const session=createSession(game,{seed:20261111,tapMs:1000,choiceLimit:64});let frame=session.view();
   for(const i of actions){assert(frame.legalTiles.includes(i));frame=session.tap(i);}return{session,frame};}
  const {frame}=replay([0,1]);
  const roles=tiles.map((_,i)=>rules?.ice[i]?'ice':rules?.locks.has(i)?'lock':rules?.keys.includes(i)?'key':'none');
  const seen={pictures:faces.slice(),roles,down:Array.from(down),takeable:tiles.map((_,i)=>frame.legalTiles.includes(i)),clock:null};
  const trapped=certainlyTrappedAfterTake(tiles,nb,iceNb,frame.state,seen,faces,roles,2);
  if(!trapped){uncertain++;continue;}certified++;
  const after=replay([0,1,2]).frame,before=after.state.alive.reduce((a,b)=>a+b,0);
  assert.equal(after.state.tray.length,3);
  // Independent actual production branches, including first opening a closed
  // tile, must not find a physical escape from a claimed capacity dead end.
  for(const i of after.legalTiles){
   const first=replay([0,1,2,i]).frame;branches++;
   if(first.type==='productionPhysicalEnd-v1'){assert(!first.win);continue;}
   assert.equal(first.state.alive.reduce((a,b)=>a+b,0),before,'False proof: one actual tap removes tiles safely');
   for(const j of first.legalTiles){const second=replay([0,1,2,i,j]).frame;branches++;
    if(second.type==='productionPhysicalEnd-v1'){assert(!second.win);continue;}
    assert.equal(second.state.alive.reduce((a,b)=>a+b,0),before,'False proof: opening then matching frees a real pair');
   }
  }
 }
 assert(certified>=3&&uncertain>=3&&branches>20);
 const specialTiles=Array.from({length:8},(_,i)=>({x:i*4,y:0,z:0})),specialNb=Layouts.neighbors(specialTiles),specialIce=Layouts.iceNeighbors(specialTiles);
 const special={tiles:specialTiles,nb:specialNb,faces:[7,8,9,2,2,7,8,9],down:Uint8Array.from([0,0,0,1,0,0,0,0]),
  rules:{ice:{},iceNb:specialIce,keys:[3],locks:new Set([5,6,7])},clock:null};
 const session=createSession(special,{seed:20261111,tapMs:1000,choiceLimit:64});let view=session.view();
 for(const index of [0,1,2,3])view=session.tap(index);
 const observed={pictures:[null,null,null,2,2,7,8,9],roles:[null,null,null,'key','none','lock','lock','lock'],
  down:[null,null,null,1,0,0,0,0],takeable:specialTiles.map((_,i)=>view.legalTiles.includes(i)),clock:null};
 assert(!certainlyTrappedAfterTake(specialTiles,specialNb,specialIce,view.state,observed,observed.pictures,observed.roles,4),
  'An on-pile match removes the open key indirectly and can unlock the only remaining tray exits');
 for(const index of [4,5,6,7])view=session.tap(index);
 assert(view.win,'Original production must validate the claimed key-pile escape all the way to a clear');
 console.log('PASS public immediate-out certifications vs '+branches+' original-production branches across36 mixed key/lock/ice/closed-picture states ('+certified+' certified, '+uncertain+' uncertain)');
}
if(require.main===module)test();module.exports=test;
