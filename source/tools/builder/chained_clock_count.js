'use strict';
// A constructive witness for the other approach. A roof near an ice tile is
// insufficient: the longer approach must really win while avoiding the waiting
// side tile until after the clock. This bounded search never calls it a loss.
const E=require('./engine.js');
function alternative(d,q,opts={}){
  const P=d.solution.slice(0,d.solution.indexOf(d.clock.i)+1),side=q.parkSide??q.side.find(i=>P.includes(i)&&d.faces.filter(f=>f===d.faces[i]).length===2&&!P.some(j=>j!==i&&d.faces[j]===d.faces[i]));
  if(side==null)return null;
  const relaxed={...d,clock:{...d.clock,n:99}},g=E.game(relaxed,{strict:true});let s=E.start(g);
  for(const i of q.take){s=s&&E.step(g,s,i);if(!s)return null;}
  const until=Date.now()+(opts.ms??700),max=opts.nodes??15000,depth=Math.min(24,P.length+7),dead=new Set();let nodes=0;
  function rec(s,path){
    if(++nodes>max||Date.now()>until)return null;
    if(s.clockTaken){
      if(s.alive[q.alternative])return null;
      const tail=E.winnable(g,s,{nodes:80000,ms:400});
      return tail.result==='win'?path.concat(E.flatten(tail.path)):null;
    }
    if(s.moves>=depth||s.moves+g.lb(s.alive)>depth)return null;
    const key=Buffer.from(s.alive).toString('latin1')+'/'+s.tray.map(i=>g.faces[i]).sort((a,b)=>a-b).join(',');
    if(dead.has(key))return null;
    const score=i=>(i===q.alternative?100:0)+(s.tray.some(j=>g.faces[j]===g.faces[i])?40:0)+(i===d.clock.i?20:0)+(g.toClock[i]?5:0)+(P.includes(i)?2:0);
    const legal=E.legal(g,s).filter(Number.isInteger).filter(i=>i!==side&&(i!==d.clock.i||!s.alive[q.alternative])).sort((a,b)=>score(b)-score(a));
    for(const i of legal){const next=E.step(g,s,i);if(!next)continue;const r=rec(next,path.concat(i));if(r)return r;if(nodes>max||Date.now()>until)return null;}
    dead.add(key);return null;
  }
  const solution=rec(s,q.take.slice());if(!solution||!E.replay(relaxed,solution,{strict:true}).ok)return null;
  return {side,clockAt:solution.indexOf(d.clock.i)+1,solution};
}
module.exports={alternative};
