'use strict';
// Public, geometric predicates shared as declarative evidence by the independent
// auditor. A predicate offers a bait; only an exact engine price accepts it.
const E=require('./engine.js'),B=require('./builder.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
const DEFINITIONS={
  pairedFalseMelt:{chain:9,baseSignature:'clock<lock; clock<cover:ice; keyA<cover:ice',sentence:'The wrong idea is that a ready matching pair which advances a frozen gate must be safe before the key route.'},
  sharedThawDetour:{chain:0,baseSignature:'clock<lock; keyA<cover:ice',sentence:'The wrong idea is that advancing two frozen fronts with one tile must beat preparing the key route.'},
  roofBeforeSide:{chain:0,baseSignature:'clock<lock; keyA<cover:ice',sentence:'The wrong idea is to strip the ordinary roof over the clock before preparing its access and keys.'},
  twinChase:{chain:3,baseSignature:'clock<ice; thaw<lock',sentence:'The wrong idea is to dig immediately towards a visible twin instead of saving that matching relief for the chain.'},
  clearLockRoof:{chain:3,baseSignature:'clock<ice; thaw<lock',sentence:'The wrong idea is that pairing away the roof of a locked thaw exit is useful before the key route is ready.'},
  outsideIn:{chain:0,baseSignature:'clock<lock; keyA<cover:ice',sentence:'The wrong idea is to work inward from a free side of the clock stack instead of opening the remote prerequisite first.'},
  splitPreparation:{chain:11,baseSignature:'clock<ice; thaw<lock; keyA<cover:ice',sentence:'The wrong idea is to prepare both fronts at once because either preparation is safe on its own; together they spend the clock margin.'},
};
function candidates(kind,d,opts={}){
  const g=E.game(d),s=E.start(g),c=B.context(d.tiles),free=E.legal(g,s).filter(Number.isInteger).filter(i=>!g.down[i]),ordinary=i=>i!==d.clock.i&&!d.obst.keys.includes(i)&&!d.obst.locks.includes(i)&&!d.obst.ice[i];
  const ice=Object.keys(d.obst.ice).map(Number),gate=d.clock.i,rows=[];
  const visible=tileVisibility(g.tiles,{...s,down:g.down,openPeek:-1},null).tiles;
  const add=(take,evidence)=>{if(new Set(take).size===take.length&&take.every(ordinary))rows.push({take,evidence});};
  const pairs=[];for(let a=0;a<free.length;a++)for(let b=a+1;b<free.length;b++)if(opts.ignoreFaces||d.faces[free[a]]===d.faces[free[b]])pairs.push([free[a],free[b]]);
  if(kind==='pairedFalseMelt')for(const take of pairs)for(const host of ice)if(take.some(i=>g.iceNb[host].includes(i)))add(take,{host,advances:take.filter(i=>g.iceNb[host].includes(i))});
  if(kind==='sharedThawDetour')for(const i of free){const hosts=ice.filter(h=>g.iceNb[h].includes(i));if(hosts.length>=2)add([i],{hosts});}
  if(kind==='roofBeforeSide')for(const i of free)if(c.above[gate].has(i))add([i],{gate,roof:i});
  if(kind==='clearLockRoof')for(const take of pairs)for(const lock of d.obst.locks)if(take.some(i=>c.above[lock].has(i)))add(take,{lock});
  if(kind==='twinChase')for(const i of free.filter(i=>d.solution.indexOf(i)<d.solution.indexOf(gate)))for(const twin of [...Array(g.n).keys()].filter(t=>t!==i&&d.faces[t]===d.faces[i]&&!g.down[t]&&visible[t].picture&&!free.includes(t)&&d.solution.indexOf(t)>d.solution.indexOf(gate)))for(const roof of free)if(c.above[twin].has(roof)&&ordinary(i)&&!ice.some(h=>g.iceNb[h].includes(i)))add([i,roof],{waiting:i,twin,roof});
  if(kind==='outsideIn')for(const i of free)if([...c.nb.left[gate],...c.nb.right[gate]].includes(i)&&!c.above[gate].has(i))add([i],{gate,side:i});
  if(kind==='splitPreparation')for(let a=0;a<free.length;a++)for(let b=a+1;b<free.length;b++){
    const i=free[a],j=free[b],ha=ice.filter(h=>g.iceNb[h].includes(i)),hb=ice.filter(h=>g.iceNb[h].includes(j));
    if(d.faces[i]!==d.faces[j]&&ha.length&&hb.length&&ha.some(h=>!hb.includes(h))&&hb.some(h=>!ha.includes(h)))add([i,j],{frontA:ha,frontB:hb});
  }
  return rows.filter((r,i,a)=>a.findIndex(q=>JSON.stringify(q.take)===JSON.stringify(r.take))===i);
}
function arrange(kind,d,roles,rng){
  if(!['pairedFalseMelt','clearLockRoof'].includes(kind))return;
  const S=require('./bank/separate.js'),geo=S.geometry(d),fixed=new Set(d.obst.keys.map(i=>d.faces[i]));
  const offers=candidates(kind,d,{ignoreFaces:true}).filter(q=>q.take.length===2&&!geo.close[q.take[0]][q.take[1]]&&q.take.every(i=>!fixed.has(d.faces[i])));
  if(!offers.length)return;
  const {take:[a,b]}=offers[Math.floor(rng()*offers.length)];if(d.faces[a]===d.faces[b])return;
  const twins=d.faces.flatMap((f,i)=>f===d.faces[a]&&i!==a&&!d.obst.keys.includes(i)&&i!==b?[i]:[]);
  if(!twins.length)return;const v=twins[Math.floor(rng()*twins.length)];[d.faces[b],d.faces[v]]=[d.faces[v],d.faces[b]];
  const changed=new Set([b,v]),old=roles.bait.pairs.filter(p=>p.some(i=>changed.has(i))),removed=new Set(old.flat());
  roles.bait.pairs=roles.bait.pairs.filter(p=>!p.some(i=>changed.has(i)));
  const keep=(roles.bait.wrong||[]).map((i,k)=>[i,roles.bait.twins[k]]).filter(p=>!p.some(i=>removed.has(i)));
  roles.bait.wrong=keep.map(p=>p[0]);roles.bait.twins=keep.map(p=>p[1]);
  roles.bait.tiles=roles.bait.tiles.filter(i=>!removed.has(i)||d.obst.keys.includes(i));
}
module.exports={DEFINITIONS,candidates,arrange};
