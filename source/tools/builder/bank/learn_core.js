'use strict';
// Counterexample-guided repacking. A new winning shortcut or a broken old
// alternative identifies the next physical access condition to protect.
const fs=require('fs'),path=require('path'),R=require('./compact_range'),G=require('./compact_geometry'),I=require('../preserve_intent'),P=require('../preserve_trap'),F=require('../footprint'),E=require('../engine');
const ROOT=path.resolve(__dirname,'../../../..'),OUT=path.join(ROOT,'source/build/footprint60-250-300'),clone=x=>JSON.parse(JSON.stringify(x));
function physicalRoute(d,goal,pin){
  const g=E.game(clone(d),{strict:true}),s=E.start(g),route=[];
  for(let guard=0;guard<g.n;guard++){
    const legal=E.legal(g,s).filter(i=>i!==pin);if(!legal.length)return null;
    const i=legal.includes(goal)?goal:legal.sort((a,b)=>d.solution.indexOf(a)-d.solution.indexOf(b))[0];
    route.push(i);s.alive[i]=0;if(i===goal)return route;
  }return null;
}
function firstDifference(d,actions){
  const g=E.game(clone(d),{strict:true}),s=E.start(g);
  for(const action of actions){const ids=typeof action==='object'?action.pair:[action],legal=new Set(E.legal(g,s));for(const i of ids)if(!legal.has(i))return i;for(const i of ids)s.alive[i]=0;}
  return null;
}
function learn(before,d,proof,keep){
  const p=I.prepare(before),added=[];
  const protect=i=>{if(i==null)return;if(!keep.core.has(i)){keep.core.add(i);added.push(i);}if(before.design.obst?.ice[i]&&!keep.ice.has(i)){keep.ice.add(i);added.push('ice:'+i);for(const j of keep.iceNb[i])keep.core.add(j);}};
  for(const error of proof.errors){
    let match;
    if((match=/^roleLink:(\d+):(\d+)$/.exec(error))){protect(+match[1]);protect(+match[2]);}
    if((match=/^roleTiming:(\d+):/.exec(error)))protect(+match[1]);
    if((match=/^candidateRoute:(\d+)$/.exec(error)))protect(before.design.solution[+match[1]]);
  }
  for(const [goal,needs]of proof.dependencies||[]){
    const old=p.roleDependencies.find(q=>q[0]===goal)?.[1]||[];
    for(const pin of old.filter(i=>!needs.includes(i))){const route=physicalRoute(d,goal,pin);if(route)protect(firstDifference(before.design,route));}
    for(const pin of needs.filter(i=>!old.includes(i))){const route=physicalRoute(before.design,goal,pin);if(route)protect(firstDifference(d,route));}
  }
  if(proof.errors.includes('clockMinimumChangedOrUnproven')){
    const next=E.clockShortest(E.game(clone(d)),{nodes:1000000,ms:5000});
    if(next&&!next.unsure){if(next.k<p.clock.k)protect(firstDifference(before.design,next.path));else if(next.k>p.clock.k)protect(firstDifference(d,p.clock.path));}
  }
  for(const effect of proof.effects||[])if(effect.beforeK!==effect.afterK){
    const drop=source=>{const r=clone(source);if(effect.kind==='ice')delete r.obst.ice[effect.tile];else r.obst.locks=r.obst.locks.filter(i=>i!==effect.tile);return r;};
    const a=drop(before.design),b=drop(d),ca=E.clockShortest(E.game(a)),cb=E.clockShortest(E.game(b));
    if(ca&&!ca.unsure&&cb&&!cb.unsure)protect(cb.k<ca.k?firstDifference(a,cb.path):firstDifference(b,ca.path));
  }
  for(const price of proof.prices||[])if(price.after.result==='win'&&(price.before.result!==price.after.result||price.before.cost!==price.after.cost)){
    const game={...d,clock:{...d.clock,n:price.after.need}},g=E.game(game);let s=E.start(g);
    try{for(const i of price.tiles)s=E.step(g,s,i);}catch{s=null;}
    const win=s&&E.winnable(g,s,{nodes:1000000,ms:5000,solution:true});
    if(win?.solution)protect(firstDifference(before.design,price.tiles.concat(win.solution)));
  }
  for(const q of proof.probes||[])if(q.before!==q.after){
    const use=q.after==='win'?d:before.design,compare=q.after==='win'?before.design:d,g=E.game(clone(use));let s=p.states[q.step];
    try{s=E.step(g,s,q.tile);}catch{s=null;}
    const w=s&&E.winnable(g,s,{nodes:1000000,ms:5000,solution:true});if(w?.solution)protect(firstDifference(compare,before.design.solution.slice(0,q.step).concat(q.tile,w.solution)));
  }
  return added;
}
function run(levels){
  for(const b of R.baseline().filter(b=>levels.includes(b.level))){
    const file=path.join(OUT,'drafts/level-'+b.level+'.json'),old=JSON.parse(fs.readFileSync(file));if(old.design&&F.measure(old.design,{minimum:58}).ok&&I.verify(b,old).ok){console.log(b.level,'already ready');continue;}
    const prep=I.prepare(b),keep=P.constraints(b);keep.core=new Set(prep.scope);keep.ice=new Set(Object.keys(b.design.obst?.ice||{}).map(Number).filter(i=>b.design.solution.indexOf(i)<=b.design.solution.indexOf(b.design.clock.i)));
    for(const i of keep.ice)for(const j of keep.iceNb[i])keep.core.add(j);
    const started=Date.now(),failures={};let ready=null,attempts=0;
    outer:for(let round=0;round<8;round++){
      let changes=0;
      for(const window of G.enumerateWindows(b.design,8,6.5))for(const extraCount of [0,2,4,8,16,24])for(let seed=1;seed<=12;seed++){
        if(Date.now()-started>30000)break outer;attempts++;
        const d=G.buildRestackedTiles(b.design,b.level,window,{seed,extraCount,useStripShift:false,preserve:keep,jitter:seed>4?25:4});
        if(!d||!F.measure(d,{minimum:58}).ok)continue;
        const proof=I.verify(b,{design:d});
        if(proof.ok){ready={...b,design:d,footprint:F.measure(d,{minimum:58}),preservation:proof,footprintOriginal:b.design,repair:{strategy:'learned-access-core',attempts,ms:Date.now()-started}};break outer;}
        for(const e of proof.errors)failures[e]=(failures[e]||0)+1;
        const added=learn(b,d,proof,keep);changes+=added.length;
        if(added.length)console.log(JSON.stringify({level:b.level,added,protected:keep.core.size}));
      }
      if(!changes)break;
    }
    if(ready)fs.writeFileSync(file,JSON.stringify(ready));
    console.log('RESULT '+JSON.stringify({level:b.level,ok:!!ready,px:ready?.footprint.tilePx,attempts,protected:keep.core.size,failures}));
  }
}
if(require.main===module)run(process.argv[2].split(',').map(Number));
module.exports={learn,run,physicalRoute,firstDifference};
