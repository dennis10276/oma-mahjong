'use strict';
// Independent evidence of two ideas interacting on the same clock route.
// A physical prerequisite path must join their defining route tiles, and
// relaxing one named constraint must turn another idea's losing offer into
// a winning offer at the SAME clock deadline. This is not a claim of human
// AHA, or of dependency after re-tightening the counterfactual clock.
const E=require('./engine.js');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function links(r){
  const b=r.roles.bait,d=r.design,a=(b.sixLinks||[]).map(q=>({kind:q.kind,take:q.take,anchors:q.kind==='savePair'?[q.third]:[q.host].filter(Number.isInteger),q}));
  if(b.mix.mode==='earlyClock')a.push({kind:'waitForTwin',take:[d.clock.i],anchors:[b.mix.originalClock]});
  if(b.mix.mode==='roofKey')a.push({kind:'clockRoof',take:[b.keyEarly],anchors:[b.keyEarly,...d.obst.locks]});
  if(b.mix.mode==='repeatKeys'||b.repeat)a.push({kind:'lookalikeChoice',take:b.repeat.wrongPair,anchors:[...d.obst.keys,...d.obst.locks]});
  return a.filter(q=>q.take?.length);
}
function pathBetween(d,a,b){
  const g=E.game(d),prefix=new Set([...d.solution.slice(0,d.solution.indexOf(d.clock.i)+1),...a.anchors,...b.anchors]),adj=Array.from({length:g.n},()=>new Set());
  const edge=(i,j)=>{if(prefix.has(i)&&prefix.has(j)){adj[i].add(j);adj[j].add(i);}};
  for(let i=0;i<g.n;i++)for(const j of g.nb.above[i])edge(i,j);
  for(const i of Object.keys(d.obst.ice).map(Number))for(const j of g.iceNb[i])edge(j,i);
  for(const k of d.obst.keys)for(const l of d.obst.locks)edge(k,l);
  const todo=a.anchors.filter(i=>prefix.has(i)).map(i=>[i]),seen=new Set(todo.map(x=>x[0]));
  while(todo.length){const p=todo.shift(),i=p.at(-1);if(b.anchors.includes(i))return p;for(const j of adj[i])if(!seen.has(j)){seen.add(j);todo.push(p.concat(j));}}
  return null;
}
function relaxations(d,a){
  const rows=[];
  if(['selfLocked','clockCount'].includes(a.kind)&&d.obst.ice[a.q.host]){
    const x=structuredClone(d);delete x.obst.ice[a.q.host];rows.push({design:x,change:{kind:'removeIce',tile:a.q.host,sourceIdea:a.kind}});
  }
  if(a.kind==='savePair'){
    const x=structuredClone(d),f=Math.max(...x.faces)+1;for(const i of [a.q.free[1],a.q.buried])x.faces[i]=f;
    rows.push({design:x,change:{kind:'splitFourCopyObligation',tiles:[a.q.free[1],a.q.buried],sourceIdea:a.kind,counterfactualPicture:f}});
  }
  if(a.kind==='lookalikeChoice'||a.kind==='clockRoof')for(const tile of d.obst.locks){
    const x=structuredClone(d);x.obst.locks=x.obst.locks.filter(i=>i!==tile);rows.push({design:x,change:{kind:'removeKeyLockPrerequisite',tile,sourceIdea:a.kind}});
  }
  return rows;
}
function after(d,take,opts){
  const g=E.game(d);let s=E.start(g);try{for(const i of take)s=s&&E.step(g,s,i);}catch{return {result:'illegal'};}
  return s?E.winnable(g,s,{nodes:opts.nodes??250000,ms:opts.ms??1500}):{result:'lose',nodes:0};
}
function measure(r,opts={}){
  const d=r.design,a=links(r),rows=[];
  for(const source of a)for(const target of a){
    if(source===target||source.kind===target.kind)continue;
    const path=pathBetween(d,source,target);if(!path)continue;
    for(const c of relaxations(d,source)){
      if(!E.replay(c.design,c.design.solution,{strict:true}).ok)continue;
      const base=after(d,target.take,opts);if(base.result!=='lose')continue;
      const changed=after(c.design,target.take,opts);
      if(changed.result==='win')rows.push({sourceIdea:source.kind,targetIdea:target.kind,prerequisitePath:path,losingOffer:target.take,clockN:d.clock.n,baseResult:'lose',relaxedResult:'win',change:c.change,baseNodes:base.nodes,relaxedNodes:changed.nodes});
    }
  }
  const o=require('./chained_obviousness.js').measure(d,{baits:r.card.trap.baits,dial:2});
  const firstOffGreedy=!o.greedyFirst.tiles.includes(d.solution[0]);
  return {profile:'interacting-ideas-v1',ok:a.length>=2&&rows.length>0,featuredIdeas:a.map(q=>q.kind).sort(),rows,
    strongerOpening:o.ok&&firstOffGreedy,opening:{firstOffGreedy,greedyPrefix:o.greedyPrefix,rightFreePairs:o.rightFreePairs,preferredLosingOffers:o.preferredBaits},
    interpretation:'Same-route physical prerequisite plus a bait defused at the unchanged timer; a changed clock-route budget is part of this dependency, not ruled out.'};
}
module.exports={measure,links,pathBetween,relaxations};
