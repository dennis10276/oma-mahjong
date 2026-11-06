'use strict';
// Optional batch-level rule. Missing slots never masquerade as a complete window.
function windows(plan, scores) {
  const rule=plan.curveWindow;if(!rule)return [];
  if(!Number.isInteger(rule.size)||rule.size<1||!Number.isFinite(rule.tolerance)||rule.tolerance<0)throw Error('Invalid curve window rule');
  const result=[];
  for(let i=0;i+rule.size<=plan.levels.length;i++){
    const slots=plan.levels.slice(i,i+rule.size);if(slots.some((s,j)=>s.level!==slots[0].level+j))continue;
    const offsets=slots.map(s=>Number.isFinite(scores.get(s.level))?scores.get(s.level)-s.target:null),complete=offsets.every(Number.isFinite);
    const mean=complete?offsets.reduce((n,x)=>n+x,0)/rule.size:null;
    result.push({from:slots[0].level,to:slots.at(-1).level,complete,meanOffset:mean,eligible:complete?Math.abs(mean)<=rule.tolerance+1e-9:null});
  }
  return result;
}
function accepts(plan,scores){return windows(plan,scores).every(w=>w.eligible!==false);}
function primaryCost(plan,row,slot){return Math.abs(row.exp-slot.target);}
module.exports={windows,accepts,primaryCost};
