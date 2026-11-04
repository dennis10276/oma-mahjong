'use strict';
const assert=require('assert/strict');
const Layouts=require('./physics/layouts.js');
const {trayHorizon}=require('./human_style_tray_horizon.js');
const {certainlyTrappedAfterTake}=require('./human_style_immediate_outs.js');
const {goalRoutes}=require('./public_goal_routes.js');
const {inferMatchedPicture}=require('./public_matched_picture.js');

// Only geometry and observed packets enter this policy. No board identity,
// hidden deck, exact route solver, or human attempt labels are available here.
function createStyleController(tiles,profile,seed){
 const p={...profile},random=Layouts.rng(seed),nb=Layouts.neighbors(tiles),iceNb=Layouts.iceNeighbors(tiles);
 let memory=tiles.map(()=>null),roles=tiles.map(()=>null),state,seen,visits=new Map(),attempt=0,lastDecision=null;
 assert(Number.isInteger(seed));
 const allowed=['clockHorizon','clockRowPreview','clockRowUrgency','clockTrayDepth','partnerHorizon','clockWeight','postClockKeyWeight','clockUrgencyPower','keyUnlockBelief','keyPictureBelief','iceReleaseBelief','trayCost','trayRestoreBonus','safePeekBonus','safePeekMinTray','pairReward','exploration','temperature','lapse','memoryDecay','retryRetention','peekPatience','outWeight','trayDepth','futureWeight'];
 assert(Object.entries(p).every(([key,value])=>allowed.includes(key)&&Number.isFinite(value)&&value>=0),'Only finite global behavioral parameters are allowed');
 assert(['clockWeight','trayCost','pairReward','exploration'].every(key=>Number.isFinite(p[key])),'Missing required behavioral weight');
 for(const key of ['clockHorizon','partnerHorizon'])assert(Number.isInteger(p[key])&&p[key]>=0&&p[key]<=4);
 assert(p.trayDepth===undefined||Number.isInteger(p.trayDepth)&&p.trayDepth>=0&&p.trayDepth<=6);
 assert(p.clockTrayDepth===undefined||Number.isInteger(p.clockTrayDepth)&&p.clockTrayDepth>=0&&p.clockTrayDepth<=4);
 assert(p.clockUrgencyPower===undefined||p.clockUrgencyPower>=0&&p.clockUrgencyPower<=2);
 assert(p.keyUnlockBelief===undefined||p.keyUnlockBelief>=0&&p.keyUnlockBelief<=1);
 assert(p.iceReleaseBelief===undefined||p.iceReleaseBelief>=0&&p.iceReleaseBelief<=1);
 assert(p.keyPictureBelief===undefined||p.keyPictureBelief>=0&&p.keyPictureBelief<=1);
 assert(p.safePeekMinTray===undefined||Number.isInteger(p.safePeekMinTray)&&p.safePeekMinTray>=0&&p.safePeekMinTray<=3);
 for(const key of ['memoryDecay','retryRetention','lapse'])assert(p[key]>=0&&p[key]<=1);
 assert(p.temperature>0&&p.peekPatience>=0);
 function begin(){
  if(attempt++)memory=memory.map(value=>random()<p.retryRetention?value:null);
  // Ice/lock state resets on a real retry. A late 'none' observation cannot
  // certify an occluded starting role. Picture identity is unchanged.
  roles=tiles.map(()=>null);
  visits=new Map();lastDecision=null;
 }
 function observe(s,o){
  if(lastDecision){
   const proof=inferMatchedPicture(lastDecision,lastDecision.index,
    {alive:s.alive,moves:s.moves,openPeek:s.openPeek,physicalTaps:s.physicalTaps,tray:s.tray});
   if(proof){memory=memory.slice();memory[proof.index]=proof.picture;}
   lastDecision=null;
  }
  state={alive:Array.from(s.alive),tray:Array.from(s.tray),moves:s.moves,openPeek:s.openPeek,
   relieved:!!s.relieved,arriving:Array.from(s.arriving??[]),physicalTaps:s.physicalTaps};
  seen={pictures:Array.from(o.pictures),roles:Array.from(o.roles),down:Array.from(o.down),takeable:Array.from(o.takeable),
   clock:o.clock?{i:o.clock.i,n:o.clock.n,remaining:o.clock.remaining}:null};
  memory=memory.map((value,i)=>o.pictures[i]!==null?o.pictures[i]:s.alive[i]&&random()<p.memoryDecay?null:value);
  roles=roles.map((value,i)=>o.roles[i]??value);
 }
 function decide(){
  assert(state&&seen);
  const {alive,tray,openPeek}=state,legal=seen.takeable.flatMap((value,i)=>value===true?[i]:[]);
  if(!legal.length)return null;
  const blockers=i=>{
   const top=nb.above[i].filter(j=>alive[j]),left=nb.left[i].filter(j=>alive[j]),right=nb.right[i].filter(j=>alive[j]);
   // Compare just the next local obstruction on each side. Counting the two
   // immediate side lists equally can make a dependency point back at itself.
   const localCost=indices=>indices.reduce((sum,j)=>sum+1+nb.above[j].filter(k=>alive[k]).length+
    +(nb.left[j].some(k=>alive[k])&&nb.right[j].some(k=>alive[k])),0);
   const side=left.length&&right.length?(localCost(left)<=localCost(right)?left:right):[];
   const ice=roles[i]==='ice'||roles[i]==='ice2'?iceNb[i].filter(j=>alive[j]):[];
   return [...new Set([...top,...side,...ice])];
  };
  // A shallow dependency cone, never a search for a complete clock route.
  const attraction=new Map(),clock=seen.clock;
  function attract(i,depth,weight,path=new Set()){
   if(path.has(i))return;
   attraction.set(i,Math.max(attraction.get(i)??0,weight));
   if(depth>0)for(const j of blockers(i))attract(j,depth-1,weight*.8,new Set([...path,i]));
  }
  if(clock)attract(clock.i,p.clockHorizon,p.clockWeight);
  let clockGeometryCost=null;
  if(clock&&p.clockRowPreview){
   const ice=Object.fromEntries(roles.flatMap((role,i)=>role==='ice'||role==='ice2'?[[i,(role==='ice2'?2:1)+iceNb[i].filter(j=>!alive[j]).length]]:[]));
   const game={tiles,nb,rules:{ice,iceNb,locks:new Set(roles.flatMap((r,i)=>r==='lock'?[i]:[])),keys:roles.flatMap((r,i)=>r==='key'?[i]:[])}};
   // See the visible row's geometry, not a solved sequence of physical taps.
   const route=goalRoutes(game,state,clock.i);clockGeometryCost=route.cost;
   for(const i of route.frontier)attraction.set(i,Math.max(attraction.get(i)??0,p.clockWeight*.8));
  }
  const needsKeys=clock?[...attraction.keys()].some(i=>alive[i]&&roles[i]==='lock'):
   roles.some((role,i)=>alive[i]&&role==='lock');
  if(needsKeys)for(let i=0;i<tiles.length;i++)
   if(alive[i]&&roles[i]==='key')attract(i,p.clockHorizon,(clock?p.clockWeight*.8:p.postClockKeyWeight??p.clockWeight*.8));
  const signature=alive.join('')+'|'+tray.join(',');
  const depth=clock?Math.min(p.trayDepth??0,p.clockTrayDepth??4):p.trayDepth;
  const future=depth?trayHorizon(tiles,nb,state,seen,memory,roles,depth,
   {keyUnlockBelief:p.keyUnlockBelief??0,keyPictureBelief:p.keyPictureBelief??0,iceReleaseBelief:p.iceReleaseBelief??0,iceNb}):new Map();
  const matchingNow=legal.some(i=>memory[i]!==null&&(tray.includes(memory[i])||
   openPeek>=0&&i!==openPeek&&memory[i]===memory[openPeek]));
  const scored=legal.map(i=>{
   const face=memory[i],down=seen.down[i]===1,peek=down&&openPeek!==i;
   const trayMatch=face!==null&&tray.includes(face);
   const twin=face===null?null:legal.find(j=>j!==i&&memory[j]===face);
   const openTwin=openPeek>=0&&openPeek!==i&&face!==null&&memory[openPeek]===face;
   const hasTwin=twin!==undefined&&twin!==null;
   const knownDig=peek&&face!==null&&!trayMatch&&!openTwin&&!hasTwin&&!(face===101&&tray.length);
   const knownFatal=tray.length>=3&&face!==null&&!trayMatch&&!openTwin&&face!==101&&!tray.includes(101)&&(!peek||knownDig);
   const reachable=face===null?false:memory.some((other,j)=>j!==i&&alive[j]&&other===face&&roles[j]!==null&&roles[j]!=='lock'&&blockers(j).length<=p.partnerHorizon);
   const visitsKey=signature+'|'+i,count=visits.get(visitsKey)??0;
   // Human deadline pressure over the same short cone, not an exact route
   // solver. An optional tray match must not consume the clock's final move.
   const urgency=clock?Math.max(1,(p.clockHorizon/Math.max(1,clock.remaining))**(p.clockUrgencyPower??2),
    p.clockRowUrgency&&clockGeometryCost!==null?1+p.clockRowUrgency/Math.max(1,clock.remaining-clockGeometryCost):1):1;
   const goal=Math.max(attraction.get(i)??0,openTwin?attraction.get(openPeek)??0:0);
   let score=(knownFatal?0:goal*urgency)+nb.above.filter(row=>row.includes(i)).length*.2;
   if(trayMatch)score+=p.pairReward*2;
   else if(face===101&&tray.length)score+=p.pairReward*2;
   else if(openTwin)score+=p.pairReward*2.2;
   else if(hasTwin)score+=p.pairReward+(down||seen.down[twin]===1?3:0);
   else if(peek&&face===null)score+=p.exploration+(tray.length>=2?3:0)+
    (!clock&&!matchingNow&&tray.length>=(p.safePeekMinTray??0)?(p.safePeekBonus??0):0);
   else{
    score-=p.trayCost*Math.max(1,tray.length*2);
    if(reachable)score+=p.trayCost*.8;
    if(tray.length>=2&&!reachable)score-=p.trayCost*2;
   }
   if(trayMatch&&!clock&&tray.length>=2)score+=(p.trayRestoreBonus??0)*(tray.length-1);
   // Reopening an already known, unmatched tile is preparation for a take,
   // not new information. Evaluate its intended removal and its tray pressure.
   if(knownDig)score-=.25;
   if(p.outWeight&&(!peek||knownDig)){
    // One hypothetical removal, then at most one partner/blocker: no route
    // search and no guessed pictures. The preference is for visible outs.
    const next=alive.slice();next[i]=0;if(openTwin)next[openPeek]=0;
    const nextTray=trayMatch?tray.filter(f=>f!==face):openTwin?tray:tray.concat(face===null?[-1]:[face]);
    const usableAfter=j=>{
     if(!Layouts.isFree(j,next,nb))return false;
     if(roles[j]==='none'||roles[j]==='key')return true;
     const ice=roles[j]==='ice'?1:roles[j]==='ice2'?2:null;
     return ice!==null&&iceNb[j].filter(k=>alive[k]&&!next[k]).length>=ice;
    };
    const newlyFree=tiles.flatMap((_,j)=>next[j]&&!legal.includes(j)&&usableAfter(j)?[j]:[]);
    for(const j of newlyFree){
     if(memory[j]!==null&&nextTray.includes(memory[j]))score+=p.outWeight*3;
     else if(memory[j]!==null&&legal.some(k=>k!==i&&next[k]&&memory[k]===memory[j]))score+=p.outWeight;
     else score+=p.outWeight*.12;
    }
    // At high pressure, do not deliberately enter a fourth unmatched tile.
    if(tray.length>=2&&!trayMatch&&!openTwin&&face!==null){
     const directMate=memory.some((other,j)=>next[j]&&other===face&&usableAfter(j));
     if(!directMate)score-=p.outWeight*2;
    }
   }
   if(peek)score-=Math.max(0,count-p.peekPatience+1)*8;
   if(!peek&&count)score-=count;
   score+=(future.get(i)??0)*(p.futureWeight??1)*(clock ? .25 : 1);
   if(knownDig&&tray.length>=3)score-=100*(p.futureWeight??1)*(clock ? .25 : 1);
   if((!peek||knownDig)&&certainlyTrappedAfterTake(tiles,nb,iceNb,state,seen,memory,roles,i))score-=800;
   const noisy=score-p.temperature*Math.log(-Math.log(Math.max(1e-12,Math.min(1-1e-12,random()))));
   return {index:i,score,noisy,visitsKey};
  });
  const selected=random()<p.lapse?scored[Math.floor(random()*scored.length)]:scored.reduce((a,b)=>a.noisy>=b.noisy?a:b);
  visits.set(selected.visitsKey,(visits.get(selected.visitsKey)??0)+1);
  lastDecision={...state,pictures:memory.slice(),down:seen.down.slice(),index:selected.index};
  return {index:selected.index,score:selected.score};
 }
 return {beginAttempt:begin,observe,decide,remembered:()=>memory.slice()};
}
module.exports={createStyleController};
