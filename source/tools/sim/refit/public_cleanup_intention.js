'use strict';
const {legal,advance}=require('./known_tray_plan.js');
const {safeClosedInspection}=require('./public_safe_closed_inspection.js');
function createCleanupIntention(){
 let saved=null;
 return{
  clear(){saved=null;},
  remember(plan,knowledge){if(!saved&&plan.path?.length>1&&(plan.information||plan.boundary))saved={path:plan.path.slice(),knowledge};},
  acknowledge(index,accepted){if(!accepted){saved=null;return;}if(saved?.path[0]===index)saved.path.shift();if(saved&&!saved.path.length)saved=null;},
  propose(game,state,primary,knowledge){
   if(!saved)return null;
   if(saved.knowledge!==knowledge||primary.knownWin||primary.safeClockExit||primary.survivalBranches?.necessaryIfSolvable
    ||primary.deadCertificate?.exhaustedKnownGraph){saved=null;return null;}
   const remaining=saved.path.filter(i=>state.alive[i]);if(!remaining.length||primary.provedDeadRoots?.includes(remaining[0])){saved=null;return null;}
   let position=state,removed=0,information=false;const path=[];
   for(const index of remaining){const allowed=legal(game,position);
    if(!allowed.free.includes(index)||allowed.uncertain?.includes(index)){saved=null;return null;}
    const moved=advance(game,position,index);
    if(moved.uncertain){if(!safeClosedInspection(position,index,game.clock,true)){saved=null;return null;}path.push(index);information=true;break;}
    if(moved.lost){saved=null;return null;}path.push(index);position=moved.state;removed+=moved.removed;
   }
   saved.path=remaining;
   return{index:path[0],path,goal:'resumeInformationIntention',knownDead:false,knownWin:!information&&!position.alive.some(Boolean)&&!position.tray.length,
    safeClockExit:!!(game.clock&&state.alive[game.clock.i]&&!position.alive[game.clock.i]),knownProgress:removed,information,boundary:information,
    nodes:0,cleanupIntention:{revalidated:true,newInformationInvalidates:true,notAWinningProof:information}};
  }
 };
}
module.exports={createCleanupIntention};
