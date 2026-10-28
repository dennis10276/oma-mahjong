'use strict';
const {legal,advance}=require('./known_tray_plan.js');
const {safeClosedInspection}=require('./public_safe_closed_inspection.js');
const {goalRoutes}=require('./public_goal_routes.js');
const protectedPlan=p=>p.knownWin||p.safeClockExit||p.survivalBranches?.necessaryIfSolvable||p.deadCertificate?.exhaustedKnownGraph;
function projectedPressure(game,state,plan){
 let position=state;
 for(const index of plan.path??[plan.index]){
  const allowed=legal(game,position);if(!allowed.free.includes(index))break;
  const moved=advance(game,position,index);if(moved.uncertain)return position.tray.length;
  if(moved.lost)return 4;position=moved.state;
 }
 return position.tray.length;
}
function trayInformationGuard(game,state,primary,{deadline=Infinity,nodes=512,milliseconds=60,knownKeys=game.rules?.keys??[]}={}){
 if(protectedPlan(primary))return null;
 const pressure=projectedPressure(game,state,primary);
 if(state.tray.length<3&&pressure<3)return null;
 if(state.tray.length===3&&pressure<3&&(primary.path?.length??1)===1)return null;
 deadline=Math.min(deadline,Date.now()+milliseconds);
 const targets=[...new Set([...(game.clock&&state.alive[game.clock.i]?[game.clock.i]:[]),...knownKeys.filter(i=>state.alive[i])])];
 const focused=targets.map(index=>({index,route:goalRoutes(game,state,index)})).filter(g=>g.route.frontier.has(primary.index));
 const goalProgress=item=>!focused.length||focused.some(g=>!item.state.alive[g.index]
  ||[...g.route.frontier].some(i=>state.alive[i]&&!item.state.alive[i])
  ||item.informationIndex!==undefined&&g.route.frontier.has(item.informationIndex));
 const excluded=new Set(primary.provedDeadRoots??[]);
 const queue=[{state,path:[],removed:0}],seen=new Set();let expanded=0,depthCapped=false,fallback=null;
 const identity=p=>JSON.stringify([p.alive,p.tray,p.moves,p.openPeek,p.relieved,p.arriving]);
 const report=(item,information)=>({index:item.path[0],path:item.path,goal:state.tray.length===3?'restoreTrayHeadroom':'avoidThirdSpotInformation',
  knownWin:!item.state.alive.some(Boolean)&&!item.state.tray.length,knownDead:false,safeClockExit:false,
  knownProgress:item.removed,information,boundary:true,nodes:(primary.nodes??0)+expanded,
  traySafety:{startingPressure:state.tray.length,projectedPressure:item.state.tray.length,searchNodes:expanded,
   returnsToAtMostTwo:true,shortestKnownTapPrefix:true,unknownPicturesNeverAssumed:true,
   clockOrKeyRoutePriority:!!focused.length,routeConeIsHeuristicNotNecessityProof:true}});
 for(let cursor=0;cursor<queue.length&&expanded<nodes&&Date.now()<deadline;cursor++){
  const item=queue[cursor],position=item.state,key=identity(position);if(seen.has(key))continue;seen.add(key);expanded++;
  if(item.path.length>=12){depthCapped=true;continue;}
  const allowed=legal(game,position),roots=allowed.free.filter(i=>!allowed.uncertain?.includes(i)&&(!item.path.length?!excluded.has(i):true));
  roots.sort((a,b)=>+(b===primary.index)-+(a===primary.index));
  for(const index of roots){
   if(Date.now()>=deadline)break;
   const moved=advance(game,position,index),path=[...item.path,index];
   if(moved.uncertain){
    if(state.tray.length<=2&&position.tray.length<=2&&safeClosedInspection(position,index,game.clock,true)
      &&goalProgress({...item,informationIndex:index})&&!fallback)fallback={item:{...item,path},information:true};
    continue;
   }
   if(moved.lost)continue;
   const next={state:moved.state,path,removed:item.removed+moved.removed};
   if(state.tray.length===3&&moved.state.tray.length<=2&&goalProgress(next))return report(next,false);
   if(state.tray.length<=2&&moved.state.tray.length<=2){
    const gained=(game.publicInformationExposure??game.publicExposure)?.(moved.state)??[];
    const clockExit=!!(game.clock&&state.alive[game.clock.i]&&!moved.state.alive[game.clock.i]);
    // Cleanup is useful even without new information. Only preserve a selected
    // clock/key route over unrelated cleanup;the dependency cone is a planning
    // preference,never a necessity or impossibility certificate.
    if(goalProgress(next)&&(next.removed>0||gained.length||clockExit||moved.win)){
     if(moved.state.tray.length<state.tray.length||clockExit||moved.win){
      const result=report(next,!!gained.length);
      result.safeClockExit=clockExit;result.traySafety.realOut=true;return result;
     }
     if(!fallback)fallback={item:next,information:!!gained.length};
    }
   }
   if(queue.length<nodes)queue.push(next);
  }
 }
 if(fallback){const result=report(fallback.item,fallback.information);
  result.traySafety.searchedKnownReliefFirst=true;result.traySafety.searchCapped=expanded>=nodes||depthCapped||Date.now()>=deadline;return result;}
 return {noOverride:true,traySafety:{startingPressure:state.tray.length,projectedPressure:pressure,
  thirdSpotLastResortWithinBudget:true,searchNodes:expanded,
  searchCapped:expanded>=nodes||queue.length>=nodes||depthCapped||Date.now()>=deadline,
  clockOrKeyRoutePriority:!!focused.length,routeConeIsHeuristicNotNecessityProof:true,
  noAlternativeFoundIsNotImpossibility:true}};
}
module.exports={trayInformationGuard,projectedPressure};
