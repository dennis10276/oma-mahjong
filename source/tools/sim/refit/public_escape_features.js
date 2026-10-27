'use strict';
const assert=require('assert/strict');
const {legal,advance}=require('./known_tray_plan.js');
const FEATURES=Object.freeze(['trayPressure','orphanTray','trayMatches','safePilePairs','knownShare','unknownClosed',
 'knownKeyAccess','knownKeys','visibleLocks','liveClock','clockRoom','openPeek','rootUnknown','rootTrayMatch',
 'rootPileMatch','rootHasPartner','rootKey','rootKnownSafe','rootCertainLoss','nextTrayPressure','nextTrayMatches',
 'nextPilePairs','nextOrphanTray','nextKnownKeyAccess','rootClockExit','rootHeadroomGain']);
const cap=(n,scale)=>Math.max(0,Math.min(1,n/scale));
function publicEscapeFeatures(game,state,index,{roles=state.alive.map(()=>null),knownKeys=[]}={}){
 assert(Number.isInteger(index)&&index>=0&&index<state.alive.length);
 assert(roles.length===state.alive.length);assert(knownKeys.every(Number.isInteger));
 const available=position=>{const result=legal(game,position),uncertain=new Set(result.uncertain??[]);return result.free.filter(i=>!uncertain.has(i));};
 const pairs=(position,free)=>{
  const groups=new Map();for(const i of free){const p=position.pictures[i];if(p===null||p===101)continue;
   if(!groups.has(p))groups.set(p,[]);groups.get(p).push(i);}
  let total=0;
  for(const group of groups.values()){
   let found=false;
   for(const a of group){const first=advance(game,position,a);if(first.uncertain||first.lost)continue;
    if(first.removed===2&&first.state.tray.length<=position.tray.length){found=true;break;}
    if(first.removed)continue;
    const secondFree=new Set(available(first.state));
    for(const b of group){if(a===b||!secondFree.has(b))continue;const second=advance(game,first.state,b);
     if(!second.uncertain&&!second.lost&&second.removed===2&&second.state.tray.length<=position.tray.length){found=true;break;}}
    if(found)break;
   }
   total+=+found;
  }
  return total;
 };
 const stats=position=>{const free=available(position),freePictures=new Set(free.map(i=>position.pictures[i]).filter(p=>p!==null));
  return{free,matches:free.filter(i=>position.pictures[i]!==null&&position.tray.includes(position.pictures[i])).length,
   pairs:pairs(position,free),orphans:position.tray.filter(p=>!freePictures.has(p)).length,
   keys:knownKeys.filter(i=>position.alive[i]&&free.includes(i)).length};};
 const before=stats(state);assert(before.free.includes(index),'Escape features require an actually/publicly guaranteed available root');
 const moved=advance(game,state,index),next=!moved.uncertain&&!moved.lost?moved.state:state,after=next===state?before:stats(next);
 const picture=state.pictures[index],clockLive=!!(game.clock&&state.alive[game.clock.i]),alive=state.alive.filter(Boolean).length;
 const values=[cap(state.tray.length,3),cap(before.orphans,3),cap(before.matches,4),cap(before.pairs,6),
  alive?state.pictures.filter((p,i)=>state.alive[i]&&p!==null).length/alive:1,
  cap(before.free.filter(i=>state.pictures[i]===null&&state.down[i]===1&&state.openPeek!==i).length,6),
  cap(before.keys,2),cap(knownKeys.filter(i=>state.alive[i]).length,2),cap(roles.filter(r=>r==='lock').length,8),
  +clockLive,clockLive?Math.max(-1,Math.min(1,(game.clock.n-state.moves)/40)):0,+(state.openPeek>=0),
  +(picture===null),+(picture!==null&&state.tray.includes(picture)),+(!moved.uncertain&&moved.removed===2&&next.tray.length<=state.tray.length),
  +(picture!==null&&before.free.some(i=>i!==index&&state.pictures[i]===picture)),+knownKeys.includes(index),
  +(!moved.uncertain&&!moved.lost),+(!moved.uncertain&&!!moved.lost),cap(next.tray.length,3),cap(after.matches,4),
  cap(after.pairs,6),cap(after.orphans,3),cap(after.keys,2),+(clockLive&&!moved.uncertain&&!moved.lost&&!next.alive[game.clock.i]),
  !moved.uncertain&&!moved.lost?(state.tray.length-next.tray.length)/3:0];
 assert.equal(values.length,FEATURES.length);assert(values.every(Number.isFinite));return values;
}
// Positive means survived AND found relief within the observed horizon,not proved eventual success.
function escapeLabel(frames,start,status,horizon=12){
 assert(Number.isInteger(start)&&start>=0&&start<frames.length-1);assert(Number.isInteger(horizon)&&horizon>0);
 const initial=frames[start],end=Math.min(start+horizon,frames.length-1),window=frames.slice(start+1,end+1);
 if(window.some(frame=>frame.lost))return 0;
 const complete=window.some(frame=>frame.won);
 if(end<start+horizon&&!complete)return null; // Censoring is not a failure or death certificate.
 return +(complete||window.some(frame=>frame.tray<initial.tray||initial.clockLive&&!frame.clockLive));
}
module.exports={FEATURES,publicEscapeFeatures,escapeLabel};
