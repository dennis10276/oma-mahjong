'use strict';
// Alternate geometry search for the SAME waitNested signature. Start with a
// priced far-key dig, move the roof key to a separate free cell, then make the
// ordinary clock roof depend on an icy neighbour. All effects are re-proven.
const B=require('./builder.js');
function addLonely(c,r,P,rng,T){
  const v=T.vis0Of(c),shuffle=a=>a.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]),special=new Set([r.clock,...r.keys,...r.locks,...Object.keys(r.ice).map(Number)]);
  const wrongs=shuffle([...new Set(Object.keys(r.ice).flatMap(h=>T.thawNbs(c,+h)))].filter(i=>c.free0[i]&&v[i].picture&&!special.has(i)&&!P.includes(i)));
  for(const wrong of wrongs){
    const twins=shuffle([...Array(c.n).keys()].filter(i=>!P.includes(i)&&!special.has(i)&&i!==wrong&&v[i].picture&&c.above[i].size>=2&&!c.above[i].has(wrong)&&![...c.above[i]].some(j=>P.includes(j)||special.has(j))));
    if(!twins.length)continue;const twin=twins[0];r.bait.wrong=[wrong];r.bait.twins=[twin];r.bait.pairs=[[wrong,twin]];r.bait.tiles.push(wrong,twin);r.bait.keepUp.push(wrong,twin,...c.above[twin]);return;
  }
}
function place(c,brief,rng,T){
  const r=T.STORIES.keyOnClock.place(c,{...brief,targets:{...brief.targets,clockCover:[1,5],keyCover:[1,5],digBefore:[2,10]}},rng);if(r.fail)return r;
  const v=T.vis0Of(c),old=r.bait.keyB;
  const shuffle=a=>a.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  const free=shuffle([...Array(c.n).keys()].filter(i=>i!==old&&c.free0[i]&&v[i].role&&!r.keys.includes(i)&&!c.above[r.clock].has(i)&&!c.above[r.keys[0]].has(i)));
  if(!free.length)return {fail:'nested:noSeparateFreeKey'};
  const key=free[0];r.keys=r.keys.map(i=>i===old?key:i);
  const roofs=shuffle([...c.above[r.clock]].filter(i=>c.free0[i]&&v[i].role&&!r.keys.includes(i)&&c.inb[i].length>=2));
  const combos=roofs.flatMap(roof=>T.thawNbs(c,roof).filter(i=>i!==r.clock&&!r.keys.includes(i)&&v[i].role&&c.above[i].size<=2&&T.thawNbs(c,i).filter(j=>j!==roof&&!r.keys.includes(j)).length>=2).map(inner=>({roof,inner})));
  if(!combos.length)return {fail:'nested:noIcyNeighbour'};
  const {roof,inner}=shuffle(combos)[0];r.ice={[roof]:2,[inner]:2};
  const P=B.planDig(c,r,rng);if(!P||![roof,inner].every(i=>P.includes(i)))return {fail:'nested:unusedGate'};
  r.dig=P;r.bait={...r.bait,keyEarly:key,keyB:key,wrong:[],twins:[],pairs:[],tiles:[key],keepUp:[...new Set([...r.bait.keepUp,key,roof,inner,...c.inb[roof],...c.inb[inner]])],def:T.CHAIN_DEFS[10],clockCover:roof,frozen:roof,special:inner};
  return r;
}
function direct(c,brief,rng,T){
  const v=T.vis0Of(c),shuffle=a=>a.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  const below=i=>[...Array(c.n).keys()].filter(j=>c.above[j].has(i));
  const clocks=shuffle([...Array(c.n).keys()].filter(i=>v[i].role&&c.above[i].size>=1&&c.above[i].size<=6&&below(i).length>=2));
  for(const clock of clocks.slice(0,12)){
    const roofs=shuffle([...c.above[clock]].filter(i=>c.free0[i]&&v[i].role&&T.thawNbs(c,i).length>=2));
    for(const roof of roofs.slice(0,3))for(const inner of shuffle(T.thawNbs(c,roof).filter(i=>i!==clock&&v[i].role&&c.above[i].size<=2&&T.thawNbs(c,i).filter(j=>j!==roof).length>=2)).slice(0,4)){
      const forbidden=new Set([clock,roof,inner,...c.above[clock],...c.above[inner]]);
      const fars=shuffle([...Array(c.n).keys()].filter(i=>!forbidden.has(i)&&v[i].role&&c.above[i].size>=1&&c.above[i].size<=6&&![...c.above[i]].some(j=>[clock,roof,inner].includes(j))));
      for(const far of fars.slice(0,8)){
        const route=B.planDig(c,{clock:far,ice:{},keys:[],locks:new Set(),holderSpecials:new Set()},rng);
        if(!route||route.length<5||route.length>11||(route.length-1)%2)continue;
        const frees=shuffle([...Array(c.n).keys()].filter(i=>!forbidden.has(i)&&i!==far&&c.free0[i]&&v[i].role&&!route.includes(i)));
        for(const key of frees.slice(0,3)){
          const r={clock,ice:{[roof]:2,[inner]:brief.targets?.nestedThin?1:2},keys:[far,key],locks:new Set([clock]),holderSpecials:new Set()};
          const branch=[];
          if(brief.targets?.nestedBranch){
            const alternatives=T.thawNbs(c,roof).filter(i=>i!==inner).sort((a,b)=>Number(r.keys.includes(b))-Number(r.keys.includes(a))||T.digCost(c,a)-T.digCost(c,b));
            for(const i of alternatives.slice(1)){if(r.keys.includes(i)||!v[i].role)continue;r.locks.add(i);branch.push(i);}
          }
          const P=B.planDig(c,r,rng);if(!P||![roof,inner].every(i=>P.includes(i)))continue;
          r.dig=P;r.bait={type:'chain',chain:T.CHAIN_SHAPES[10],def:T.CHAIN_DEFS[10],keyEarly:key,keyB:key,wrong:[],twins:[],pairs:[],single:[key],tiles:[key],keepUp:[...new Set([clock,roof,inner,far,key,...c.above[clock],...c.above[far],...c.above[inner],...c.inb[roof],...c.inb[inner]])],clockCover:roof,frozen:roof,special:inner,links:[],parallelLocks:branch};
          addLonely(c,r,P,rng,T);return r;
        }
      }
    }
  }
  return {fail:'nested:noDirectGeometry'};
}
function innerKey(c,brief,rng,T){
  const v=T.vis0Of(c),shuffle=a=>a.map(x=>[rng(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  const clocks=shuffle([...Array(c.n).keys()].filter(i=>v[i].role&&c.above[i].size>=1&&c.above[i].size<=6&&[...Array(c.n).keys()].filter(j=>c.above[j].has(i)).length>=2));
  for(const clock of clocks.slice(0,16))for(const roof of shuffle([...c.above[clock]].filter(i=>c.free0[i]&&v[i].role&&T.thawNbs(c,i).length>=2)).slice(0,4)){
    for(const inner of shuffle(T.thawNbs(c,roof).filter(i=>i!==clock&&v[i].role&&c.above[i].size<=2&&T.thawNbs(c,i).filter(j=>j!==roof).length>=2)).slice(0,8)){
      const ice={[roof]:2,[inner]:2},route=B.planDig(c,{clock:inner,ice,keys:[],locks:new Set(),holderSpecials:new Set()},rng);
      if(!route||route.length<5||route.length>11||(route.length-1)%2)continue;
      const frees=shuffle([...Array(c.n).keys()].filter(i=>c.free0[i]&&v[i].role&&!route.includes(i)&&![clock,roof,inner].includes(i)&&!c.above[clock].has(i)));
      for(const key of frees.slice(0,5)){
        const r={clock,ice,keys:[inner,key],locks:new Set([clock]),holderSpecials:new Set()},P=B.planDig(c,r,rng);if(!P||![roof,inner].every(i=>P.includes(i)))continue;
        r.dig=P;r.bait={type:'chain',chain:T.CHAIN_SHAPES[10],def:T.CHAIN_DEFS[10],keyEarly:key,keyB:key,wrong:[],twins:[],pairs:[],single:[key],tiles:[key],keepUp:[...new Set([clock,roof,inner,key,...c.above[clock],...c.above[inner],...c.inb[roof],...c.inb[inner]])],clockCover:roof,frozen:roof,special:inner,links:[],nestedKeyOnInner:true};addLonely(c,r,P,rng,T);return r;
      }
    }
  }
  return {fail:'nested:noInnerKeyGeometry'};
}
module.exports={place,direct,innerKey};
