'use strict';
const {legal,advance}=require('./known_tray_plan.js');
const {publicEscapeFeatures}=require('./public_escape_features.js');
const {predict}=require('./public_escape_critic.js');
const {safeClosedInspection}=require('./public_safe_closed_inspection.js');
const frozenModel=require('./public_escape_model_v1.json');
const {pilePairRoutes}=require('./public_pile_pair_habit.js');

// Q estimates describe the root action under the earlier behavior policy. A
// known prefix is a constructive route to relief, not a learned proof of a win.
function learnedEscapePlan(game,state,actions,primary,context={},settings={}) {
  if(primary.knownWin||primary.safeClockExit||primary.survivalBranches?.necessaryIfSolvable
    ||primary.deadCertificate?.exhaustedKnownGraph)return null;
  const deadline=Math.min(settings.deadline??Infinity,Date.now()+(settings.milliseconds??70));
  const learnedDomain=state.tray.length>=2||!!(game.clock&&state.alive[game.clock.i]);
  const pairs=pilePairRoutes(game,state,{deadline:Math.min(deadline,Date.now()+25),excluded:primary.provedDeadRoots??[]})
    .filter(pair=>actions.some(a=>a.index===pair.index));
  if(!learnedDomain){
    if(!pairs.length)return null;
    const best=pairs.find(pair=>pair.knownWin)??pairs[0];
    return{index:best.index,path:best.path,goal:'publicPilePairHabit',knownWin:best.knownWin,knownDead:false,
      safeClockExit:!!(game.clock&&state.alive[game.clock.i]&&!best.state.alive[game.clock.i]),
      knownProgress:best.removed,information:false,boundary:!best.knownWin,nodes:primary.nodes??0,
      pilePairHabit:{faceDownMember:true,newTraySpots:0,knownPrefixOnly:true},
      learnedEscape:{probability:null,estimatedNotProved:true,outsideTrainingDomain:true,ranking:'public matching habit'}};
  }
  const maxNodes=settings.nodes??512,model=settings.model??frozenModel;
  const allowed=legal(game,state),uncertain=new Set(allowed.uncertain??[]),excluded=new Set(primary.provedDeadRoots??[]);
  const candidates=[];let nodes=0;
  // Score the incumbent first so budget exhaustion cannot silently remove it.
  const roots=[...new Set([primary.index,...actions.map(a=>a.index)])];
  for(const index of roots){
    if(Date.now()>=deadline)break;
    if(!allowed.free.includes(index)||uncertain.has(index)||excluded.has(index))continue;
    const moved=advance(game,state,index);
    if(!moved.uncertain&&moved.lost)continue;
    const x=publicEscapeFeatures(game,state,index,context),probability=predict(model,x);
    if(Date.now()>=deadline)break;
    const pair=pairs.find(p=>p.index===index);
    candidates.push({index,probability,moved,pair,
      preservesTrayHabit:!!pair||!moved.uncertain&&moved.state.tray.length<state.tray.length});
  }
  // Search safe known prefixes in learned root order. Unknown pictures/roles,
  // deadlines and caps remain boundaries. They never reject a branch.
  // Known zero-slot pile matches and immediate tray relief take precedence over
  // speculative commitments. Learn which of those outs is most promising.
  const preferHabit=candidates.some(c=>c.pair);
  candidates.sort((a,b)=>+(preferHabit&&b.preservesTrayHabit)-+(preferHabit&&a.preservesTrayHabit)
    ||b.probability-a.probability||+(b.index===primary.index)-+(a.index===primary.index));
  const relief=p=>p.tray.length<state.tray.length
    ||!!(game.clock&&state.alive[game.clock.i]&&!p.alive[game.clock.i]);
  const identity=p=>JSON.stringify([p.alive,p.tray,p.moves,p.openPeek,p.relieved,p.arriving]);
  const routes=[];
  for(const root of candidates){
    if(Date.now()>=deadline)break;
    let path=root.pair?.path??[root.index],position=root.pair?.state??root.moved.state??state,removed=root.pair?.removed??root.moved.removed??0;
    let found=!root.moved.uncertain&&(root.moved.win||relief(position));
    const progresses=item=>item.removed>0&&item.state.tray.length<=state.tray.length;
    let progressPrefix=!root.moved.uncertain&&progresses({state:position,removed})?{state:position,path,removed}:null;
    let rootNodes=0;
    // Known peeks can return to the exact starting state. Such a prefix adds
    // no information and must not smuggle an excluded initial root into a
    // supposedly different route. Keep the parent in each root's visited set.
    const queue=root.moved.uncertain?[]:[{state:position,path,removed}],seen=new Set([identity(state)]);
    for(let cursor=0;!found&&cursor<queue.length&&nodes<maxNodes&&rootNodes<64&&Date.now()<deadline;cursor++){
      const item=queue[cursor];if(item.path.length>=12)continue;
      const key=identity(item.state);
      if(seen.has(key))continue;seen.add(key);nodes++;rootNodes++;
      const nextAllowed=legal(game,item.state);
      const nextRoots=nextAllowed.free.filter(i=>!nextAllowed.uncertain?.includes(i)&&item.state.pictures[i]!==null);
      nextRoots.sort((a,b)=>+item.state.tray.includes(item.state.pictures[b])-+item.state.tray.includes(item.state.pictures[a]));
      for(const index of nextRoots){
        if(Date.now()>=deadline)break;
        const moved=advance(game,item.state,index);if(moved.uncertain||moved.lost)continue;
        const next={state:moved.state,path:[...item.path,index],removed:item.removed+moved.removed};
        if(moved.win||relief(next.state)){({path,state:position,removed}=next);found=true;break;}
        if(!progressPrefix&&progresses(next))progressPrefix=next;
        // Never expand a non-progressing peek repeatedly into a large queue.
        if(queue.length<maxNodes)queue.push(next);
      }
    }
    // An unseen closed tile is a safe information boundary only when its
    // actual public clock/availability permits all possible match effects.
    if(root.moved.uncertain&&!safeClosedInspection(state,root.index,game.clock,true))continue;
    if(!found&&progressPrefix)({path,state:position,removed}=progressPrefix);
    // A remembered-picture peek alone is not an out. Q was learned under the
    // earlier follow-up policy; repeatedly selecting its safest-looking peek
    // changes that policy and can cycle forever without new information.
    if(!found&&!progressPrefix&&!root.moved.uncertain)continue;
    routes.push({...root,path,position,removed,knownRelief:found,
      constructiveProgress:!!progressPrefix||found,rootSearchCapped:rootNodes>=64});
    // Root ranking is fixed by the learned Q. Further lower-ranked routes
    // cannot improve that estimate; caps do not pretend to prove them worse.
    break;
  }
  const best=routes[0];if(!best)return null;
  const won=best.knownRelief&&!best.position.alive.some(Boolean)&&!best.position.tray.length;
  const clockExit=best.knownRelief&&!!(game.clock&&state.alive[game.clock.i]&&!best.position.alive[game.clock.i]);
  return{index:best.index,path:best.path,goal:'learnedEscapePlan',knownWin:won,knownDead:false,safeClockExit:clockExit,
    knownProgress:best.removed,information:!!best.moved.uncertain,boundary:!won&&!clockExit,nodes:(primary.nodes??0)+nodes,
    ...(best.pair?{pilePairHabit:{faceDownMember:true,newTraySpots:0,knownPrefixOnly:true}}:{}),
    learnedEscape:{probability:best.probability,horizonPhysicalTaps:12,knownRelief:best.knownRelief,
      constructiveProgress:best.constructiveProgress,rootSearchCapped:best.rootSearchCapped,
      estimatedNotProved:true,behaviorPolicyEstimate:true,scoredRoots:candidates.length,searchNodes:nodes,
      capped:nodes>=maxNodes||Date.now()>=deadline,modelKind:model.kind}};
}
module.exports={learnedEscapePlan};
