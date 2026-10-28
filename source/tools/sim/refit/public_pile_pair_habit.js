'use strict';
const {legal,advance}=require('./known_tray_plan.js');
const {analyzeSurvival}=require('./public_survival_continuation.js');

// Open the known closed member first. Taking its face-up mate first would
// unnecessarily occupy the tray. An already open peek needs only its mate.
function pilePairRoutes(game,state,{deadline=Date.now()+30,excluded=[]}={}){
 const allowed=legal(game,state),uncertain=new Set(allowed.uncertain??[]),rejected=new Set(excluded),routes=[];
 const publicModel=Object.fromEntries(['tiles','nb','rules','clock','publicFrontier','publicExposure',
  'publicRoleExposure','publicInformationExposure'].filter(f=>game[f]!==undefined).map(f=>[f,game[f]]));
 const check=(path,position,removed)=>{
  if(Date.now()>=deadline)return;
  const won=!position.alive.some(Boolean)&&!position.tray.length;
  if(!won){
   const free=legal(game,position).free;
   const proof=analyzeSurvival(publicModel,position,free.map(index=>({index})),
    {nodes:64,milliseconds:Math.max(1,Math.min(8,deadline-Date.now())),deadline});
   if(proof.knownDead)return; // A cap/unknown frontier never passes for death.
  }
  routes.push({index:path[0],path,state:position,removed,knownWin:won});
 };
 for(const index of allowed.free){
  if(Date.now()>=deadline)break;
  const picture=state.pictures[index];
  if(uncertain.has(index)||rejected.has(index)||picture===null||picture===101||state.tray.includes(picture))continue;
  const first=advance(game,state,index);if(first.uncertain||first.lost)continue;
  const peek=state.openPeek;
  if(first.removed===2&&peek>=0&&state.pictures[peek]===picture
    &&(state.down[index]===1||state.down[peek]===1)&&first.state.tray.length===state.tray.length){
   check([index],first.state,2);continue;
  }
  if(state.down[index]!==1||first.removed!==0||first.state.openPeek!==index)continue;
  const next=legal(game,first.state);
  for(const mate of next.free){
   if(Date.now()>=deadline)break;
   if(mate===index||next.uncertain?.includes(mate)||state.pictures[mate]!==picture)continue;
   const second=advance(game,first.state,mate);
   if(second.uncertain||second.lost||second.removed!==2||second.state.alive[index]||second.state.alive[mate]
     ||second.state.tray.length!==state.tray.length)continue;
   check([index,mate],second.state,2);
  }
 }
 return routes;
}
module.exports={pilePairRoutes};
