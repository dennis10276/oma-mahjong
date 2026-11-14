'use strict';
// Reroute a stubborn tail towards its waiting twins. The shared beam's local
// occupancy cost can keep one old orphan forever (alternating 1/2 waiting).
// This beam also estimates how many covers block each waiting picture.
const E=require('./engine.js'),B=require('./builder.js'),Tail=require('./bank/tail.js');
function reroute(d,opts={}){
  const until=Date.now()+(opts.wallMs??12000),g=E.game(d,{strict:true}),c=B.context(d.tiles),k=d.solution.indexOf(d.clock.i)+1;
  let start=E.start(g);for(const i of d.solution.slice(0,k)){start=E.step(g,start,i);if(!start)return {ok:false,why:'prefix'};}
  const above=c.above.map(a=>[...a]),left=c.nb.left.map(a=>[...a]),right=c.nb.right.map(a=>[...a]);
  const heuristic=s=>s.tray.reduce((sum,t)=>sum+Math.min(...g.faceTiles.get(g.faces[t]).filter(i=>s.alive[i]).map(i=>above[i].filter(j=>s.alive[j]).length+Math.min(left[i].filter(j=>s.alive[j]).length,right[i].filter(j=>s.alive[j]).length))),0);
  let beam=[{s:start,cost:0,node:null,run:0}],expanded=0;
  for(let step=k;step<d.tiles.length;step++){
    if(Date.now()>until)return {ok:false,why:'wall',expanded};const next=new Map();
    for(const b of beam){
      const legal=E.legal(g,b.s).filter(Number.isInteger),trayFaces=new Set(b.s.tray.map(i=>g.faces[i])),visible=legal.filter(i=>!g.down[i]);
      const safe=visible.some(i=>trayFaces.has(g.faces[i]))||(b.s.tray.length<=2&&visible.some(i=>visible.some(j=>j!==i&&g.faces[i]===g.faces[j])));
      for(const i of legal){
        const s=E.step(g,b.s,i);if(!s)continue;expanded++;
        const o=b.s.tray.length,run=o>=2?b.run+1:0;
        const cost=b.cost+[.25,0,3,24][o]+(run>4?3:0)+(o>=2&&!safe&&g.down[i]?120:0);
        const key=Buffer.from(s.alive).toString('latin1')+'/'+s.tray.map(j=>g.faces[j]).sort((a,b)=>a-b).join(',');
        const old=next.get(key);if(old&&old.cost<=cost)continue;
        next.set(key,{s,cost,rank:cost+5*heuristic(s),node:{i,prev:b.node},run});
      }
    }
    if(!next.size)return {ok:false,why:'beamDied',expanded};beam=[...next.values()].sort((a,b)=>a.rank-b.rank||a.cost-b.cost).slice(0,opts.width??300);
  }
  const best=beam.find(b=>b.s.tray.length===0);if(!best)return {ok:false,why:'noFinish',expanded};
  const tail=[];for(let node=best.node;node;node=node.prev)tail.push(node.i);tail.reverse();
  const design={...d,solution:d.solution.slice(0,k).concat(tail)},old=Tail.gambleFacts(d),fresh=Tail.gambleFacts(design);
  if(fresh.gamble>old.gamble||fresh.blindOnly>old.blindOnly)return {ok:false,why:'extraBlindGamble',expanded};
  if(!E.replay(design,design.solution,{strict:true}).ok)return {ok:false,why:'replay',expanded};
  return {ok:true,design,occupancy:Tail.occupancy(design),expanded};
}
module.exports={reroute};
