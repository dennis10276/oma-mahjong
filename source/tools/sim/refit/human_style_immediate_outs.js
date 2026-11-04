'use strict';
const Layouts=require('./physics/layouts.js');
// Only certify the immediate capacity trap: after taking a known picture,
// three occupied slots and no possible free tray match, closed pile pair,
// joker or unknown picture. This is not a route search. Uncertain future
// glyphs/identities are never promoted to observations or to a failure proof.
function certainlyTrappedAfterTake(tiles,nb,iceNb,state,seen,pictures,roles,index){
 const face=pictures[index];
 if(face===null||face===101||state.tray.includes(101))return false;
 const alive=state.alive.slice(),tray=state.tray.slice();alive[index]=0;
 const q=tray.indexOf(face),peek=state.openPeek;
 const onPile=peek>=0&&peek!==index&&alive[peek]&&pictures[peek]===face&&seen.takeable[peek]===true;
 if(q>=0)tray.splice(q,1);else if(onPile)alive[peek]=0;else tray.push(face);
 if(tray.length<3)return false;if(tray.length>=4)return true;
 const couldUnlock=roles[index]==='key'||seen.roles[index]===null||
  onPile&&(roles[peek]==='key'||seen.roles[peek]===null);
 const candidates=[];
 for(let i=0;i<tiles.length;i++)if(alive[i]&&Layouts.isFree(i,alive,nb)){
  if(seen.takeable[i]!==true&&!state.relieved){
   // Cached ice/lock glyphs can be stale after an intervening removal: only
   // the current visible glyph can prove this candidate remains blocked.
   if(seen.roles[i]==='lock'&&!couldUnlock)continue;
   const need=seen.roles[i]==='ice'?1:seen.roles[i]==='ice2'?2:0;
   if(need&&iceNb[i].filter(j=>state.alive[j]&&!alive[j]).length<need)continue;
  }
  candidates.push(i);
 }
 if(candidates.some(i=>pictures[i]===null||pictures[i]===101||tray.includes(pictures[i])))return false;
 for(let a=0;a<candidates.length;a++)for(let b=a+1;b<candidates.length;b++){
  const i=candidates[a],j=candidates[b];
  if(pictures[i]===pictures[j]&&(seen.down[i]!==0||seen.down[j]!==0))return false;
 }
 return true;
}
module.exports={certainlyTrappedAfterTake};
