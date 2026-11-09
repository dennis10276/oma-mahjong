'use strict';
// Sound dead-state certificates derived from physics/pictures, never a card.
// Each unique face-up lower partner needs two OTHER upper partners removed.
// The first lower partner thus needs three simultaneous unmatched places.
function compile(g) {
  const byFace=new Map();g.faces.forEach((f,i)=>byFace.set(f,(byFace.get(f)||[]).concat(i)));
  const above=g.nb.above.map((_,i)=>{
    const found=new Set(),todo=[i];while(todo.length)for(const h of g.nb.above[todo.pop()])if(!found.has(h)){found.add(h);todo.push(h);}return found;
  });
  const pairs=new Map();
  for(const ids of byFace.values())if(ids.length===2)for(const h of ids) {
    const t=ids.find(i=>i!==h);
    if(!g.down[h]&&!g.down[t]&&g.nb.above[h].length===0&&g.nb.above[t].length>0)pairs.set(h,t);
  }
  // Removing all outside tiles/obstacles can only make this closed set easier.
  let changed=true;while(changed){changed=false;for(const [h,t] of pairs)if([...above[t]].filter(i=>i!==h&&pairs.has(i)).length<2){pairs.delete(h);changed=true;}}
  // Strong components keep downstream held pairs OUTSIDE the cycle. Merging
  // them into a weak component would hide precisely the trapped tray place.
  const adj=new Map([...pairs].map(([h,t])=>[h,[...above[t]].filter(b=>b!==h&&pairs.has(b))]));
  function components(nodes){
    const allowed=new Set(nodes),index=new Map(),low=new Map(),stack=[],on=new Set(),groups=[];let next=0;
    function visit(v){index.set(v,next);low.set(v,next++);stack.push(v);on.add(v);
      for(const w of adj.get(v))if(allowed.has(w)){if(!index.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}else if(on.has(w))low.set(v,Math.min(low.get(v),index.get(w)));}
      if(low.get(v)===index.get(v)){const group=[];let w;do{w=stack.pop();on.delete(w);group.push(w);}while(w!==v);groups.push(group);}
    }
    for(const h of nodes)if(!index.has(h))visit(h);return groups;
  }
  const closed=[];
  function find(nodes){for(const group of components(nodes)){
    const allowed=new Set(group),keep=group.filter(h=>adj.get(h).filter(b=>allowed.has(b)).length>=2);
    if(keep.length<3)continue;if(keep.length===group.length)closed.push(group);else find(keep);
  }}
  find([...pairs.keys()]);const cuts=[];
  for(const heads of closed){
    const tails=heads.map(h=>pairs.get(h)),faces=new Set(heads.map(h=>g.faces[h])),blocked=[];
    for(const [face,ids] of byFace)if(ids.length===2&&!faces.has(face))for(const covered of ids)
      if(tails.some(t=>above[covered].has(t)))blocked.push({face,covered,other:ids.find(i=>i!==covered)});
    if(blocked.length)cuts.push({heads,tails,blocked});
  }
  return cuts;
}
function dead(cuts,alive,trayFaces) {
  if(!trayFaces.length)return false;
  return cuts.some(c=>c.tails.every(t=>alive[t])&&c.blocked.some(b=>alive[b.covered]&&!alive[b.other]&&trayFaces.includes(b.face)));
}
function clockContext(g,cuts) {
  const geo=new Set(g.clock?[g.clock.i]:[]),todo=[...geo];
  while(todo.length)for(const i of g.nb.above[todo.pop()])if(!geo.has(i)){geo.add(i);todo.push(i);}
  const relevant=cuts.filter(c=>c.blocked.some(b=>geo.has(b.other))),goals=new Uint8Array(g.n);
  for(const c of relevant)for(const i of c.heads.concat(c.tails))goals[i]=1;
  return {geo:[...geo],relevant,goals};
}
function clockBound(context,alive) {
  if(!context.relevant.length)return 0;
  const remaining=context.geo.filter(i=>alive[i]);let bound=remaining.length;
  for(const c of context.relevant)if(c.tails.every(t=>alive[t])&&c.blocked.some(b=>remaining.includes(b.other)&&alive[b.covered])) {
    const already=c.heads.filter(h=>!alive[h]).length,geoHeads=c.heads.filter(h=>remaining.includes(h)).length;
    const geoPetal=c.tails.some(t=>remaining.includes(t));
    bound=Math.max(bound,remaining.length+Math.max(0,3-already-geoHeads)+(geoPetal?0:1));
  }
  return bound;
}
module.exports={compile,dead,clockContext,clockBound};
