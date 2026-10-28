'use strict';
const assert=require('assert/strict');
const Layouts=require('../../../www/layouts.js');
// A deliberately short public-picture thought experiment. Stops at unknown
// faces/orientations/roles and at depth<=4. It never seeks a clock route or
// claims a proof. Actual choices still execute in original production physics.
function trayHorizon(tiles,nb,state,seen,pictures,roles,depth){
 assert(Number.isInteger(depth)&&depth>=1&&depth<=4);
 const size=tiles.length;
 const value=s=>(size-s.alive.reduce((a,b)=>a+b,0))*4-s.tray.length*(s.tray.length+1)*4;
 const initial={alive:state.alive.slice(),tray:state.tray.slice(),peek:state.openPeek};
 const baseline=value(initial),scores=new Map();
 function move(s,i){
  if(pictures[i]===null||seen.down[i]===null||pictures[i]===101||s.tray.includes(101))return null;
  const next={alive:s.alive.slice(),tray:s.tray.slice(),peek:s.peek},f=pictures[i],q=next.tray.indexOf(f);
  const mate=s.peek>=0&&s.peek!==i&&s.alive[s.peek]&&pictures[s.peek]===f&&Layouts.isFree(s.peek,s.alive,nb);
  if(q>=0){next.alive[i]=0;next.tray.splice(q,1);if(next.peek===i)next.peek=-1;}
  else if(mate){next.alive[i]=0;next.alive[s.peek]=0;next.peek=-1;}
  else if(seen.down[i]===1&&s.peek!==i){next.peek=i;}
  else{next.alive[i]=0;next.tray.push(f);if(next.peek===i)next.peek=-1;}
  return next.tray.length>=4?null:next;
 }
 function continuation(s,left){
  let best=value(s);if(!left)return best;
  const choices=[];
  // Production removals are monotone: a currently legal tile cannot become
  // obstructed by removing another one. The public tap affordance itself is
  // enough here, even if its role symbol is a key or is not visible.
  for(let i=0;i<size;i++)if(s.alive[i]&&Layouts.isFree(i,s.alive,nb)&&
   (seen.takeable[i]===true||roles[i]==='none'||roles[i]==='key')){
   const n=move(s,i);if(n)choices.push({n,rank:value(n)});
  }
  choices.sort((a,b)=>b.rank-a.rank);
  for(const {n} of choices.slice(0,6))best=Math.max(best,continuation(n,left-1));
  return best;
 }
 for(let i=0;i<size;i++)if(seen.takeable[i]===true){
  const n=move(initial,i);
  const known= pictures[i]!==null&&seen.down[i]!==null&&pictures[i]!==101&&!initial.tray.includes(101);
  scores.set(i,n?continuation(n,depth-1)-baseline:known?-100:0);
 }
 return scores;
}
module.exports={trayHorizon};
