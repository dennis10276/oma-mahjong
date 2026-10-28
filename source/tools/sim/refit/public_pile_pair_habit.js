'use strict';
const {legal,advance}=require('./known_tray_plan.js');
const {analyzeSurvival}=require('./public_survival_continuation.js');
const {goalRoutes}=require('./public_goal_routes.js');
const {keyAccessPath}=require('./public_key_access.js');

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
function clockKeyPairPlan(game,state,primary,{knownKeys=[],deadline=Date.now()+80,nodes=512,taps=20}={}){
 deadline=Math.min(deadline,Date.now()+80);
 if(!game.clock||!state.alive[game.clock.i]||state.tray.length>2||Date.now()>=deadline)return null;
 if(primary.knownWin||primary.safeClockExit||primary.survivalBranches?.necessaryIfSolvable||primary.deadCertificate?.exhaustedKnownGraph)return null;
 const keys=[...new Set(knownKeys)];
 if(keys.length!==2||keys.some(i=>!state.alive[i]||state.pictures[i]===null))return null;
 const publicGame=Object.fromEntries(['tiles','nb','rules','clock','publicFrontier','publicExposure',
  'publicRoleExposure','publicInformationExposure'].filter(f=>game[f]!==undefined).map(f=>[f,game[f]]));
 publicGame.rules={...publicGame.rules,keys};
 const clockRoute=goalRoutes(publicGame,state,game.clock.i);
 if(!clockRoute.alternatives.some(route=>keys.some(i=>route.has(i))))return null;
 const startingSlack=game.clock.n-state.moves-clockRoute.cost;
 for(const route of pilePairRoutes(publicGame,state,{deadline:Math.min(deadline,Date.now()+30),excluded:primary.provedDeadRoots??[]})){
  if(!keys.every(i=>!route.state.alive[i]))continue;
  const exited=!route.state.alive[game.clock.i];
  const endingSlack=exited?null:game.clock.n-route.state.moves-goalRoutes(publicGame,route.state,game.clock.i).cost;
  if(!exited&&endingSlack<startingSlack)continue;
  return {index:route.index,path:route.path,goal:'knownClockKeyPair',knownWin:route.knownWin,
   knownDead:false,safeClockExit:exited,knownProgress:route.removed,information:false,boundary:true,nodes:primary.nodes??0,
   clockKeyPairPreparation:{knownKeys:keys,closedMemberFirst:true,zeroAdditionalTraySlots:true,
    startingEstimatedClockSlack:startingSlack,endingEstimatedClockSlack:endingSlack,
    routeRelevanceAndSlackAreHeuristicsNotProofs:true}};
 }
 // A useful key pair may still be buried. Search only actual known transitions,
 // with a hard two-tile tray ceiling, and stop at every unknown picture or role.
 let best=null,used=0;
 const allowed=legal(publicGame,state),excluded=new Set(primary.provedDeadRoots??[]);
 for(const index of allowed.free){
  if(Date.now()>=deadline||used>=nodes)break;
  if(allowed.uncertain?.includes(index)||excluded.has(index)||state.pictures[index]===null)continue;
  const route=keyAccessPath(publicGame,state,index,taps,Math.min(128,nodes-used),deadline,2,true);used+=route.nodes;
  if(!route.path)continue;
  const exited=!route.state.alive[game.clock.i];
  const endingSlack=exited?null:game.clock.n-route.state.moves-goalRoutes(publicGame,route.state,game.clock.i).cost;
  if(!exited&&endingSlack<0)continue;
  const rank=[+exited,exited?0:endingSlack,-route.path.length];
  if(best){let difference=0;for(let k=0;k<rank.length&&!difference;k++)difference=rank[k]-best.rank[k];if(difference<=0)continue;}
  best={route,exited,endingSlack,rank};
 }
 if(best)return {index:best.route.path[0],path:best.route.path,goal:'knownClockKeyAccess',knownWin:!best.route.state.alive.some(Boolean)&&!best.route.state.tray.length,
  knownDead:false,safeClockExit:best.exited,knownProgress:best.route.removed,information:false,boundary:true,nodes:(primary.nodes??0)+used,
  clockKeyPairPreparation:{knownKeys:keys,knownKeyAccess:true,maximumTray:2,returnsToStartingPressure:true,
   startingEstimatedClockSlack:startingSlack,endingEstimatedClockSlack:best.endingSlack,
   searchNodes:used,searchCapped:used>=nodes||Date.now()>=deadline,shortestKnownWithinSearchGraph:true,
   routeRelevanceAndSlackAreHeuristicsNotProofs:true}};
 return null;
}
module.exports={pilePairRoutes,clockKeyPairPlan};
