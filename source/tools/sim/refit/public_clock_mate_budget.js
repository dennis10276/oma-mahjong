'use strict';
const assert=require('assert/strict'),Layouts=require('./physics/layouts.js');
// A lower bound for this optional key/mate route, never a death certificate for
// the board. Unknown orientations optimistically permit a same-tap pair.
function clockMateRouteBudget({alive,nb,clock,mate,roles,down}){
 const c=clock.i,n=alive.length;assert(Number.isInteger(c)&&c>=0&&c<n&&Number.isInteger(mate)&&mate>=0&&mate<n&&mate!==c);assert(Number.isInteger(clock.remaining)&&clock.remaining>=0);
 const required=new Set([c,mate]);for(let i=0;i<n;i++)if(alive[i]&&roles[i]==='key')required.add(i);
 const stack=[...required];while(stack.length){const i=stack.pop();for(const j of nb.above[i])if(alive[j]&&!required.has(j)){required.add(j);stack.push(j);}}
 const after=Array.from(alive);for(const i of required)if(i!==c&&i!==mate)after[i]=0;
 const mateReady=Layouts.isFree(mate,after,nb);after[mate]=0;
 const clockReady=Layouts.isFree(c,after,nb);
 // Either missing side access requires at least one tile outside the union.
 // Count it only once: a shared removal might release both targets.
 const outsideAtLeast=mateReady&&clockReady?0:1;
 const pairGrace=down[c]!==0||down[mate]!==0?1:0;
 const lowerBound=required.size+outsideAtLeast,budget=clock.remaining+pairGrace;
 return {required:[...required].sort((a,b)=>a-b),outsideAtLeast,pairGrace,lowerBound,budget,fits:lowerBound<=budget};
}
module.exports={clockMateRouteBudget};
