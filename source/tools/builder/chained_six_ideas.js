'use strict';
// TASK 18: author geometry and the picture obligations BEFORE picture planning.
// No search for a losing move on a finished host. Evidence is checked separately
// in chained_six_facts.js, including the initial, face-up explanation.
const B=require('./builder.js'),T=require('./trap_stories.js');
const {DEFINITIONS,family,compose}=require('./chained_six_specs.js');
const uniq=a=>[...new Set(a)],shuffle=(a,rng)=>a.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
function place(kind,c,r,brief,rng){
  let P=r.dig.slice();const b=r.bait,v=T.vis0Of(c),all=[...Array(c.n).keys()];
  const special=new Set([r.clock,...r.keys,...r.locks,...Object.keys(r.ice).map(Number)]);
  const ordinary=i=>!special.has(i)&&!b.tiles.includes(i),shown=i=>v[i].picture&&v[i].role;
  const geo=c._mixGeo||(c._mixGeo=require('./bank/separate.js').geometry({tiles:c.tiles,down:[]}));
  const free=all.filter(i=>c.free0[i]&&ordinary(i)&&shown(i));
  let q=null;
  if(kind==='savePair'){
    const reserved=new Set((b.sixLinks||[]).filter(q=>q.kind==='clockCount').flatMap(q=>q.orphans));
    const route=shuffle(P.filter((i,k)=>ordinary(i)&&!reserved.has(i)&&shown(i)&&!c.free0[i]&&k>=2&&k<P.length-1),rng);
    const fs=shuffle(free.filter(i=>!P.includes(i)),rng);
    const buried=shuffle(all.filter(i=>ordinary(i)&&shown(i)&&!P.includes(i)&&!c.free0[i]&&c.above[i].size>=2),rng);
    outer:for(const t of route)for(const a of fs.filter(a=>!geo.close[a][t]))for(const z of fs.filter(z=>z!==a&&!geo.close[z][a]&&!geo.close[z][t])){
      const x=buried.find(x=>x!==a&&x!==z&&!c.above[x].has(a)&&!c.above[x].has(z)&&![a,z,t].some(i=>geo.close[x][i]));
      if(x==null)continue;
      q={kind,free:[a,z],third:t,buried:x,take:[a,z],visible:[a,z,t,x]};
      P.splice(P.indexOf(t)+1,0,a);b.pairs.push([z,x]);
      if(brief.sixMode==='earlyClock'&&P.length%2){
        if(brief.sixSetup!=null&&P.includes(brief.sixSetup))P=P.filter(i=>i!==brief.sixSetup);
        else{const filler=fs.find(i=>i!==a&&i!==z&&!P.includes(i));if(filler==null)return {fail:'savePairWaitParity'};P.splice(P.indexOf(brief.sixOriginalClock),0,filler);}
      }
      break outer;
    }
  }else if(kind==='selfLocked'){
    const hosts=shuffle(Object.keys(r.ice).map(Number),rng);
    const lonePool=all.filter(i=>c.free0[i]&&!special.has(i)&&shown(i));
    outer:for(const host of hosts)for(const lone of shuffle(c.inb[host].filter(i=>lonePool.includes(i)&&!P.includes(i)),rng)){
      const twin=shuffle(all.filter(i=>ordinary(i)&&shown(i)&&!P.includes(i)&&c.above[i].has(host)&&i!==lone&&!geo.close[i][lone]),rng)[0];
      if(twin==null)continue;
      q={kind,host,lone,twin,take:[lone],visible:[host,lone,twin]};
      const old=b.wrong.indexOf(lone);if(old>=0){const oldTwin=b.twins[old];b.pairs=b.pairs.filter(p=>!p.includes(lone));b.wrong.splice(old,1);b.twins.splice(old,1);b.tiles=b.tiles.filter(i=>i!==oldTwin);}
      b.pairs.push([lone,twin]);b.wrong.push(lone);b.twins.push(twin);break outer;
    }
  }else if(kind==='freeMelt'){
    const need=brief.targets?.freeMeltNeed??2;
    const hosts=shuffle(P.filter(i=>(r.keys.includes(i)||Object.keys(r.ice).some(h=>c.inb[+h].includes(i)))&&!r.ice[i]&&v[i].role&&c.inb[i].filter(j=>P.indexOf(j)>=0&&P.indexOf(j)<P.indexOf(i)).length>=need),rng);
    outer:for(const host of hosts){
      const ns=shuffle(c.inb[host].filter(i=>free.includes(i)&&!P.includes(i)),rng);
      if(ns.length<1)continue;
      const outside=ns.slice(0,2),twins=[];
      for(const i of outside){const x=shuffle(all.filter(x=>ordinary(x)&&shown(x)&&!P.includes(x)&&!outside.includes(x)&&!twins.includes(x)&&c.above[x].size>=2&&!c.above[x].has(i)&&!c.above[x].has(host)),rng)[0];if(x==null)continue outer;twins.push(x);}
      r.ice[host]=need;
      q={kind,host,route:c.inb[host].filter(j=>P.indexOf(j)>=0&&P.indexOf(j)<P.indexOf(host)),outside,twins,take:outside,visible:[host,...outside,...twins]};
      outside.forEach((i,k)=>{b.pairs.push([i,twins[k]]);b.wrong.push(i);b.twins.push(twins[k]);});break;
    }
  }else if(kind==='clockCount'){
    // A free roof over an alternative thaw neighbour. The authored winning dig
    // uses the other neighbours. The roof's pair is deliberately off that dig.
    outer:for(const host of shuffle(Object.keys(r.ice).map(Number),rng))for(const alt of shuffle(c.inb[host].filter(i=>!P.includes(i)&&!special.has(i)&&shown(i)),rng)){
      const sides=shuffle(c.inb[host].filter(i=>P.includes(i)&&i!==r.clock&&i!==brief.sixOriginalClock&&!r.keys.includes(i)&&!r.ice[i]&&!c.above[host].has(i)),rng);
      if(!sides.length)continue;
      const roofs=shuffle([...c.above[alt]].filter(i=>free.includes(i)&&!P.includes(i)),rng);
      for(const roof of roofs){const mate=shuffle(free.filter(i=>i!==roof&&!P.includes(i)&&!c.above[alt].has(i)&&c.dist(i,roof)>3),rng)[0];if(mate==null)continue;
        const parkSide=sides[0],other=P.find(i=>i!==parkSide&&i!==r.clock&&i!==brief.sixOriginalClock&&!r.keys.includes(i));if(other==null)continue;
        q={kind,host,alternative:alt,roof,pair:[roof,mate],take:[roof,mate],parkSide,orphans:[parkSide,other],side:c.inb[host].filter(i=>P.includes(i)),visible:[host,alt,roof,mate,parkSide]};b.pairs.push([roof,mate]);break outer;}
    }
  }else if(kind==='keysLater'){
    if(r.keys.length)return {fail:'keysLaterNeedsUnkeyedBase'};
    const keys=shuffle(free.filter(i=>!P.includes(i)),rng).slice(0,2);
    const locks=shuffle(all.filter(i=>ordinary(i)&&v[i].role&&!P.includes(i)&&!keys.includes(i)&&c.above[i].size>=1&&!keys.some(k=>c.above[k].has(i))),rng);
    if(brief.sixMode==='earlyClock')locks.sort((a,b)=>Number(c.above[b].has(brief.sixOriginalClock))-Number(c.above[a].has(brief.sixOriginalClock)));
    const lock=locks[0];
    if(keys.length===2&&lock!=null&&c.dist(...keys)>3){
      r.keys=keys;r.locks.add(lock);q={kind,keys,lock,take:keys,visible:[...keys,lock]};
      if(brief.targets?.keysClockRelief&&brief.sixMode!=='earlyClock'&&P.length%2){
        // With an odd dig the clock itself waits as the third picture. Author
        // its free relief before picture planning, so the fixed tail keys do
        // not try to open a fourth slot in the planner's first tail move.
        const relief=free.find(i=>!P.includes(i)&&!keys.includes(i)&&i!==lock&&!geo.close[i][r.clock]);
        if(relief==null)return {fail:'keysLaterClockRelief'};
        q.relief=relief;q.visible.push(relief);P.splice(P.indexOf(r.clock),0,relief);
      }
    }
  }else if(kind==='doubleMelt'){
    const hosts=shuffle(Object.keys(r.ice).map(Number),rng);
    outer:for(const a of hosts)for(const z of hosts.filter(z=>z!==a)){
      const pool=all.filter(i=>c.free0[i]&&!special.has(i)&&shown(i)),rightA=pool.filter(i=>c.inb[a].includes(i)),rightB=pool.filter(i=>c.inb[z].includes(i));
      for(const u of rightA)for(const w of rightB.filter(i=>i!==u&&!geo.close[u][i])){
        const loneA=rightA.find(i=>i!==u&&i!==w),loneB=rightB.find(i=>i!==w&&i!==u&&i!==loneA);
        if(loneA==null||loneB==null)continue;
        const ice={...r.ice,[a]:1,[z]:1},inb=c.inb.map((ns,i)=>i===a?[u]:i===z?[w]:ns);
        const dig=B.planDig({...c,inb},{...r,ice},rng);
        if(!dig||[loneA,loneB].some(i=>dig.includes(i))||![u,w].every(i=>dig.includes(i)))continue;
        const twins=[];for(const l of [loneA,loneB]){const t=all.find(i=>!dig.includes(i)&&![loneA,loneB,...twins].includes(i)&&!special.has(i)&&shown(i)&&c.above[i].size>=2&&!geo.close[l][i]);if(t==null)continue outer;twins.push(t);}
        r.ice=ice;P=[u,w,...dig.filter(i=>i!==u&&i!==w)];
        b.pairs=b.pairs.filter(p=>!p.some(i=>[u,w,loneA,loneB].includes(i)));b.wrong=[loneA,loneB];b.twins=twins;b.pairs.push([loneA,twins[0]],[loneB,twins[1]]);
        b.tiles=uniq([...(b.keyEarly!=null?[b.keyEarly]:[]),loneA,loneB,...twins]);
        q={kind,hosts:[a,z],right:[u,w],twins,take:[loneA,loneB],visible:[a,z,u,w,loneA,loneB,...twins]};break outer;
      }
    }
  }
  if(!q)return {fail:'place18:'+kind+':geometry'};
  const pictures=kind==='savePair'?[...q.free,q.third,q.buried]:kind==='selfLocked'?[q.lone,q.twin]:kind==='freeMelt'?[...q.outside,...q.twins]:kind==='doubleMelt'?[...q.right,...q.take]:kind==='clockCount'?[...q.take,q.parkSide]:kind==='keysLater'&&q.relief!=null?[...q.take,q.relief]:q.take;
  b.six=q;(b.sixLinks??=[]).push(q);b.extraMoves=[...(b.extraMoves||[]),q.take];b.tiles=uniq([...b.tiles,...pictures]);b.keepUp=uniq([...b.keepUp,...q.visible,...q.visible.flatMap(i=>[...c.above[i]])]);r.dig=P;
  return r;
}
function pictures(kind,c,r,plan){
  const q=r.bait.sixLinks.find(q=>q.kind===kind);
  if(kind==='savePair'){
    const [a,b]=q.free,t=q.third,x=q.buried;
    if(plan.pairOf[t]!==a||plan.pairOf[b]!==x)return 'savePairSchedule';
    const f=plan.faces[t],z=plan.faces[b];
    if(f===z||plan.faces.filter(v=>v===f).length!==2||plan.faces.filter(v=>v===z).length!==2)return 'savePairCopies';
    plan.faces[b]=plan.faces[x]=f;
  }
  if(kind==='doubleMelt'&&plan.faces[q.right[0]]!==plan.faces[q.right[1]])return 'doubleMeltRightPair';
  if(kind==='clockCount'&&!plan.dig.orphans.includes(q.parkSide))return 'clockCountSideMustWait';
  if(kind==='keysLater'&&q.relief!=null&&plan.pairOf[r.clock]!==q.relief)return 'keysLaterReliefPicture';
  return null;
}
function prove(kind,d,roles,ctx,opts={}){
  const E=require('./engine.js'),q=(roles.bait.sixLinks||[roles.bait.six]).find(q=>q.kind===kind);
  const facts=require('./chained_six_facts.js').evidence(kind,d,q);
  if(!facts.ok)return {ok:false,why:facts.why};
  const p=require('./trap_mixes.js').price(d,q.take,ctx.k,opts);
  if(!p?.exact||!(p.result==='lose'||p.result==='win'&&p.cost>ctx.spare))return {ok:false,why:'baitSurvives'};
  const g=E.game(d);let s=E.start(g);for(const i of q.take)s=s&&E.step(g,s,i);
  if(s&&E.winnable(g,s,{nodes:400000,ms:4000}).result!=='lose')return {ok:false,why:'shippingLossUnproven'};
  const prior=opts.existing?.top;
  const top=kind==='clockCount'?(require('./chained_six_facts.js').clockAlternativeWitness(d,q,prior)?prior:require('./chained_clock_count.js').alternative(d,q)):null;
  if(kind==='clockCount'&&(!top||top.clockAt<=d.clock.n))return {ok:false,why:'topApproachUnproven'};
  return {ok:true,price:p,link:{kind,sentence:DEFINITIONS[kind].see,take:q.take,evidence:facts.evidence,result:'lose',...(top?{top}: {}),...(kind==='keysLater'?{clockRelays:require('./chained_six_facts.js').postClockRelays(d,q.lock)}:{})}};
}
const LINK_KINDS=Object.fromEntries(Object.keys(DEFINITIONS).map(kind=>[kind,{
  ...DEFINITIONS[kind],place:(c,r,b,rng)=>place(kind,c,r,b,rng),pictures:(c,r,p)=>pictures(kind,c,r,p),prove:(d,r,c,o)=>prove(kind,d,r,c,o),
}]));
module.exports={DEFINITIONS,LINK_KINDS,family,compose,place,pictures,prove};
