'use strict';
const assert=require('assert/strict');
const Layouts=require('../../../www/layouts.js');
// A deliberately short public-picture thought experiment. Stops at unknown
// faces/orientations/roles and at depth<=6. It never seeks a clock route or
// claims a proof. Actual choices still execute in original production physics.
function trayHorizon(tiles,nb,state,seen,pictures,roles,depth,{keyUnlockBelief=0}={}){
 assert(Number.isInteger(depth)&&depth>=1&&depth<=6);
 assert(Number.isFinite(keyUnlockBelief)&&keyUnlockBelief>=0&&keyUnlockBelief<=1);
 const size=tiles.length;
 const value=s=>(size-s.alive.reduce((a,b)=>a+b,0))*4-s.tray.length*(s.tray.length+1)*4;
 const initial={alive:state.alive.slice(),tray:state.tray.slice(),peek:state.openPeek,unlock:false,unlockFallback:null};
 const baseline=value(initial),scores=new Map();
 function move(s,i){
  if(pictures[i]===null||seen.down[i]===null||pictures[i]===101||s.tray.includes(101))return null;
  const next={...s,alive:s.alive.slice(),tray:s.tray.slice()},f=pictures[i],q=next.tray.indexOf(f);
  if(roles[i]==='lock'&&seen.takeable[i]!==true){
   if(!s.unlock||keyUnlockBelief===0)return null;
   if(next.unlockFallback===null)next.unlockFallback=value(s);
  }
  const mate=s.peek>=0&&s.peek!==i&&s.alive[s.peek]&&pictures[s.peek]===f&&Layouts.isFree(s.peek,s.alive,nb);
  if(q>=0){next.alive[i]=0;next.tray.splice(q,1);if(next.peek===i)next.peek=-1;}
  else if(mate){next.alive[i]=0;next.alive[s.peek]=0;next.peek=-1;}
  else if(seen.down[i]===1&&s.peek!==i){next.peek=i;}
  else{next.alive[i]=0;next.tray.push(f);if(next.peek===i)next.peek=-1;}
  if(roles[i]==='key'||s.peek>=0&&roles[s.peek]==='key'&&!next.alive[s.peek]){
   if(!roles.some((role,j)=>role==='key'&&next.alive[j]))next.unlock=true;
  }
  return next.tray.length>=4?null:next;
 }
 const expected=s=>s.unlockFallback===null?value(s):s.unlockFallback+keyUnlockBelief*(value(s)-s.unlockFallback);
 function choices(s){
  const available=[];
  for(let i=0;i<size;i++)if(s.alive[i]&&Layouts.isFree(i,s.alive,nb)&&
   (seen.takeable[i]===true||roles[i]==='none'||roles[i]==='key'||roles[i]==='lock'&&s.unlock&&keyUnlockBelief>0)){
   const n=move(s,i);if(n)available.push({n,rank:expected(n)});
  }
  return available;
 }
 function continuation(s,left){
  let best=expected(s);if(!left)return best;
  const available=choices(s);
  // Production removals are monotone: a currently legal tile cannot become
  // obstructed by removing another one. The public tap affordance itself is
  // enough here, even if its role symbol is a key or is not visible.
  available.sort((a,b)=>b.rank-a.rank);
  for(const {n} of available.slice(0,6))best=Math.max(best,continuation(n,left-1));
  return best;
 }
 function shortBeam(s,left){
  let best=expected(s),frontier=[s];
  const signature=n=>JSON.stringify([n.alive,n.tray.slice().sort((a,b)=>a-b),n.peek,n.unlock,n.unlockFallback]);
  const visited=new Set([signature(s)]);
  // Keep at most six competing states at each thought step. Extending from
  // four to six physical taps must not turn into an exhaustive route solver.
  for(let step=0;step<left&&frontier.length;step++){
   const next=[];
   for(const state of frontier)for(const option of choices(state)){
    const key=signature(option.n);if(visited.has(key))continue;
    visited.add(key);best=Math.max(best,option.rank);next.push(option);
   }
   next.sort((a,b)=>b.rank-a.rank);frontier=next.slice(0,6).map(option=>option.n);
  }
  return best;
 }
 for(let i=0;i<size;i++)if(seen.takeable[i]===true){
  const n=move(initial,i);
  const known= pictures[i]!==null&&seen.down[i]!==null&&pictures[i]!==101&&!initial.tray.includes(101);
  scores.set(i,n?(depth<=4?continuation(n,depth-1):shortBeam(n,depth-1))-baseline:known?-100:0);
 }
 return scores;
}
module.exports={trayHorizon};
