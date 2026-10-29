'use strict';
const assert=require('assert/strict');
// Same-board, unassisted play only: removing more tiles cannot restore ice,
// locks or geometric blockers. Availability is not a tray/clock safety proof.
function createRetryAccessMemory(size,{limit=8}={}){
 assert(Number.isInteger(size)&&size>0&&Number.isInteger(limit)&&limit>0);
 const bits=Array.from({length:size},(_,i)=>1n<<BigInt(i)),full=(1n<<BigInt(size))-1n;
 const witnesses=Array.from({length:size},()=>[]),orientation=Array(size).fill(null);
 function removedMask(alive){assert(Array.isArray(alive)&&alive.length===size&&alive.every(v=>v===0||v===1));let mask=0n;for(let i=0;i<size;i++)if(!alive[i])mask|=bits[i];return mask;}
 function observe(state,observed,attempt){
  const removed=removedMask(state.alive);assert(Number.isInteger(attempt)&&attempt>0&&Number.isInteger(state.physicalTaps)&&state.physicalTaps>=0);
  assert(Array.isArray(observed.takeable)&&observed.takeable.length===size&&observed.takeable.every(v=>v===null||typeof v==='boolean'));
  assert(Array.isArray(observed.down)&&observed.down.length===size&&observed.down.every(v=>v===null||v===0||v===1));
  const relieved=!!state.relieved,count=state.alive.filter(v=>!v).length;
  for(let i=0;i<size;i++)if(state.alive[i]){
   const down=observed.down[i],old=orientation[i];
   if(down!==null){if(!old)orientation[i]={value:down,attempt,physicalTaps:state.physicalTaps};else if(old.value!==down)orientation[i]={value:null,conflicted:true,attempt,physicalTaps:state.physicalTaps};}
   if(observed.takeable[i]!==true)continue;
   const rows=witnesses[i],dominates=(a,b)=>(a.removed&b.removed)===a.removed&&(!a.relieved||b.relieved);
   const next={removed,relieved,count,attempt,physicalTaps:state.physicalTaps};
   if(rows.some(w=>dominates(w,next)))continue;
   witnesses[i]=rows.filter(w=>!dominates(next,w));witnesses[i].push(next);
   witnesses[i].sort((a,b)=>a.count-b.count||Number(a.relieved)-Number(b.relieved)||a.attempt-b.attempt);witnesses[i].splice(limit);
  }
 }
 function canTake(index,removed,relieved,attempt){
  assert(Number.isInteger(index)&&index>=0&&index<size&&typeof removed==='bigint'&&removed>=0n&&(removed&~full)===0n);
  assert(Number.isInteger(attempt)&&attempt>0);
  if(removed&bits[index])return false;
  return witnesses[index].some(w=>w.attempt<attempt&&(!w.relieved||relieved)&&(removed&w.removed)===w.removed);
 }
 function downValue(index,attempt){const f=orientation[index];return f&&f.attempt<attempt&&!f.conflicted?f.value:null;}
 function evidence(index){const at=i=>({index:i,orientation:orientation[i]?{...orientation[i]}:null,witnesses:witnesses[i].map(w=>({attempt:w.attempt,physicalTaps:w.physicalTaps,relieved:w.relieved,removed:bits.flatMap((b,j)=>w.removed&b?[j]:[]),source:'actual public takeability witness; no initial obstacle role inferred'}))});return index===undefined?bits.flatMap((_,i)=>orientation[i]||witnesses[i].length?[at(i)]:[]):at(index);}
 return{observe,removedMask,canTake,downValue,evidence};
}
module.exports={createRetryAccessMemory};
