'use strict';
// Small physical mechanisms. Predictions are learned elsewhere; placement never
// assigns a difficulty. Every successful placement has an exact reversible patch.
const I = require('../lab/ideas.js'), L = global.Layouts;
const { boardKey, digest } = require('./meter.js');
const VERSION = 'trap-pieces-v1';
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const value = (o,k) => Object.hasOwn(o,k) ? I.clone(o[k]) : null;
const cover = (c,i) => { const found=new Set(), todo=[i]; while(todo.length) for(const j of c.nb.above[todo.pop()]) if(!found.has(j)){found.add(j);todo.push(j);} return found; };
const spareOf = b => b.clock ? b.clock.n-b.solution.indexOf(b.clock.i)-1 : null;
function wayFor(b) {
  const c=I.ctxOf(b), options=c.P.filter(i=>cover(c,i).size>=2&&cover(c,i).size<=5);
  options.sort((a,z)=>Math.abs(c.pos[a]/c.n-.25)-Math.abs(c.pos[z]/c.n-.25));
  return { solution:b.solution.slice(), clockTile:b.clock?.i??options[0]??c.P[Math.floor(c.n*.25)] };
}
function diff(before, after) {
  const patches=[];
  const put=(path,a,b)=>{if(!eq(a,b))patches.push({path,before:a,after:b});};
  for(let i=0;i<before.tiles.length;i++){
    put(['faces',i],before.faces[i],after.faces[i]);
    put(['down',i],before.down.includes(i),after.down.includes(i));
    put(['ice',i],before.obst?.ice?.[i]||0,after.obst?.ice?.[i]||0);
    put(['locks',i],!!before.obst?.locks?.includes(i),!!after.obst?.locks?.includes(i));
  }
  put(['keys'],before.obst?.keys||[],after.obst?.keys||[]);
  put(['clock'],before.clock||null,after.clock||null);
  put(['clockMate'],value(before,'clockMate'),value(after,'clockMate'));
  return patches;
}
function readPatch(b,[kind,i]){
  if(kind==='down')return b.down.includes(i);
  if(kind==='ice')return b.obst?.ice?.[i]||0;
  if(kind==='locks')return !!b.obst?.locks?.includes(i);
  if(kind==='keys')return b.obst?.keys||[];
  if(kind==='clock')return b.clock||null;
  if(kind==='clockMate')return value(b,'clockMate');
  return b.faces[i];
}
function writePatch(b,[kind,i],v){
  if(kind==='down'){b.down=b.down.filter(j=>j!==i);if(v)b.down.push(i);b.down.sort((a,z)=>a-z);}
  else if(kind==='ice'){if(v)b.obst.ice[i]=v;else delete b.obst.ice[i];}
  else if(kind==='locks'){b.obst.locks=b.obst.locks.filter(j=>j!==i);if(v)b.obst.locks.push(i);b.obst.locks.sort((a,z)=>a-z);}
  else if(kind==='keys')b.obst.keys=I.clone(v);
  else if(kind==='clock')b.clock=v?I.clone(v):null;
  else if(kind==='clockMate'){if(v===null)delete b.clockMate;else b.clockMate=v;}
  else b.faces[i]=v;
}
function remove(board, instanceId) {
  const records=board.pieceInstances||[], record=records.find(r=>r.id===instanceId);if(!record)return null;
  // A later piece that changes the same field must be removed first. Never
  // silently erase its work and call that an isolated ablation.
  if(record.patch.some(p=>!eq(readPatch(board,p.path),p.after)))return null;
  const out=I.clone(board);for(const p of record.patch.slice().reverse())writePatch(out,p.path,p.before);
  out.pieceInstances=records.filter(r=>r.id!==instanceId);
  if(I.valid(out))return out;
  const limit=out.clock?.n, repaired=I.fix(out,spareOf(out));
  if(!repaired||limit!==undefined&&repaired.clock.n!==limit)return null;
  return repaired;
}
function context(b,way,rng){
  const c=I.ctxOf(b), rank=c.P.map(()=>rng()), occupied=new Set([b.clock?.i,...(b.obst.keys||[]),...(b.obst.locks||[]),...Object.keys(b.obst.ice||{}).map(Number)]);
  const order=xs=>xs.slice().sort((a,z)=>rank[a]-rank[z]);
  return {...c,rank,cover:i=>cover(c,i),order,occupied,anchor:b.clock?.i??way.clockTile,
    iceOK:(i,h)=>c.inb[i].filter(j=>c.pos[j]<c.pos[i]).length>=h};
}
function keyPair(b,c,depth=2,across=false,before=Infinity){
  if(b.obst.keys.length)return b.obst.keys.slice();
  const width=Math.max(...c.tiles.map(t=>t.x))-Math.min(...c.tiles.map(t=>t.x));
  const pairs=c.pairs.filter(([a,z,k])=>k<before&&!c.occupied.has(a)&&!c.occupied.has(z));
  pairs.sort((a,z)=>{
    const score=p=>Math.abs((c.cover(p[0]).size+c.cover(p[1]).size)/2-depth)+(across?Math.max(0,width*.5-Math.abs(c.tiles[p[0]].x-c.tiles[p[1]].x)):0);
    return score(a)-score(z)+.01*(c.rank[a[0]]+c.rank[a[1]]-c.rank[z[0]]-c.rank[z[1]]);
  });
  const best=pairs[0];if(!best)return null;
  if(Math.abs((c.cover(best[0]).size+c.cover(best[1]).size)/2-depth)>1.5)return null;
  if(across&&Math.abs(c.tiles[best[0]].x-c.tiles[best[1]].x)<width*.5)return null;
  return best.slice(0,2);
}
const reveal=(b,ids)=>{b.down=b.down.filter(i=>!ids.includes(i));};
function setKeys(b,c,p,before=Infinity){const keys=keyPair(b,c,p.depth??p.keyDepth??2,!!p.across,before);if(!keys)return null;b.obst.keys=keys;reveal(b,keys);return keys;}
function selectClock(b,c,p,byShare=false){
  if(b.clock)return null;
  const score=i=>byShare?Math.abs((c.cover(i).size+1)*1.5/c.n-p.share):Math.abs(c.cover(i).size-p.depth);
  const options=c.order(c.P.filter(i=>!c.occupied.has(i))).sort((a,z)=>score(a)-score(z));
  for(const i of options.slice(0,8)){
    if(!byShare&&Math.abs(c.cover(i).size-p.depth)>1)continue;
    const x=I.clone(b);x.clock={i,n:999};reveal(x,[i]);const fixed=I.fix(x,p.spare);
    if(fixed&&(!byShare||Math.abs((fixed.solution.indexOf(i)+1)/c.n-p.share)<=.06))return fixed;
  }
  return null;
}
const DEFINITIONS = {
  clock:{name:'Covered clock',params:['depth','spare'],defaults:{depth:2,spare:2},grid:[{depth:0,spare:1},{depth:0,spare:3},{depth:2,spare:1},{depth:2,spare:3},{depth:5,spare:1},{depth:5,spare:3}],make:selectClock},
  clockWay:{name:'Clock route length',params:['share','spare'],defaults:{share:.15,spare:2},grid:[{share:.15,spare:2},{share:.3,spare:2}],make:(b,c,p)=>selectClock(b,c,p,true)},
  keys:{name:'Key route',params:['depth','across'],defaults:{depth:2,across:false},grid:[{depth:0,across:false},{depth:3,across:true}],make(b,c,p){if(b.obst.keys.length)return null;return setKeys(b,c,p)?b:null;}},
  clockLock:{name:'Locked clock',params:['keyDepth'],defaults:{keyDepth:2},grid:[{keyDepth:2}],make(b,c,p){const i=c.anchor;if(b.obst.locks.includes(i)||!setKeys(b,c,p,c.pos[i]))return null;b.obst.locks.push(i);reveal(b,[i]);return b;}},
  clockIce:{name:'Frozen clock',params:['height'],defaults:{height:1},grid:[{height:1},{height:2}],make(b,c,p){const i=c.anchor;if(b.obst.ice[i]||!c.iceOK(i,p.height))return null;b.obst.ice[i]=p.height;reveal(b,[i]);return b;}},
  lockBeside:{name:'Lock beside the clock',params:['keyDepth'],defaults:{keyDepth:2},grid:[{keyDepth:2}],make(b,c,p){
    const ck=c.anchor,near=[...c.nb.left[ck],...c.nb.right[ck],...c.nb.above[ck]];
    for(const i of c.order(near.filter(i=>!c.occupied.has(i)&&c.pos[i]>c.pos[ck]))){
      const x=I.clone(b);if(!setKeys(x,c,p,c.pos[i]))continue;x.obst.locks.push(i);reveal(x,[i]);return x;
    }return null;
  }},
  keyGuard:{name:'Frozen key guard',params:['height'],defaults:{height:1},grid:[{height:1},{height:2}],make(b,c,p){
    const keys=setKeys(b,c,{depth:2});if(!keys)return null;
    for(const i of c.order([...new Set(keys.flatMap(k=>[...c.cover(k)]))]))if(!c.occupied.has(i)&&!keys.includes(i)&&c.iceOK(i,p.height)){b.obst.ice[i]=p.height;reveal(b,[i]);return b;}return null;
  }},
  iceChain:{name:'Thaw chain',params:['length','height'],defaults:{length:2,height:1},grid:[{length:1,height:1},{length:3,height:1}],make(b,c,p){
    for(const start of c.order(c.P.filter(i=>!c.occupied.has(i)&&c.iceOK(i,p.height)))){
      const chain=[start];while(chain.length<p.length){const next=c.order(c.inb[chain.at(-1)].filter(i=>!c.occupied.has(i)&&!chain.includes(i)&&c.pos[i]>c.pos[chain.at(-1)]&&c.iceOK(i,p.height)))[0];if(next===undefined)break;chain.push(next);}
      if(chain.length===p.length){for(const i of chain)b.obst.ice[i]=p.height;reveal(b,chain);return b;}
    }return null;
  }},
  frozenPartner:{name:'Frozen waiting partner',params:['height'],defaults:{height:2},grid:[{height:1},{height:2}],make(b,c,p){
    const pairs=c.pairs.filter(([a,z])=>c.pos[z]-c.pos[a]>=3&&!c.occupied.has(z)&&c.iceOK(z,p.height));
    for(const [,i]of pairs){b.obst.ice[i]=p.height;reveal(b,[i]);return b;}return null;
  }},
  lockedPartners:{name:'Locked waiting partners',params:['count','keyDepth'],defaults:{count:1,keyDepth:2},grid:[{count:1,keyDepth:2},{count:2,keyDepth:2}],make(b,c,p){
    const keys=setKeys(b,c,p);if(!keys)return null;const done=Math.max(...keys.map(i=>c.pos[i]));
    const pairs=c.pairs.filter(([a,z])=>c.pos[a]<done&&c.pos[z]>done&&!c.occupied.has(z)&&!keys.includes(z));
    const ids=[...new Set(pairs.map(x=>x[1]))].slice(0,p.count);if(ids.length!==p.count)return null;b.obst.locks.push(...ids);reveal(b,ids);return b;
  }},
  blindTwins:{name:'Hidden matching twins',params:['count'],defaults:{count:1},grid:[{count:1}],make(b,c,p){
    const pairs=c.pairs.filter(([a,z])=>!c.free0[a]&&!c.free0[z]&&!c.occupied.has(a)&&!c.occupied.has(z)&&!b.down.includes(a)&&!b.down.includes(z)).slice(0,p.count);
    if(pairs.length!==p.count)return null;b.down.push(...pairs.flatMap(x=>x.slice(0,2)));return b;
  }},
  blindWay:{name:'Hidden route tile',params:['count'],defaults:{count:1},grid:[{count:1},{count:2}],make(b,c,p){
    const end=c.pos[c.anchor],ids=c.order(c.P.slice(0,end).filter(i=>!c.free0[i]&&!c.occupied.has(i)&&!b.down.includes(i))).slice(0,p.count);
    if(ids.length!==p.count)return null;b.down.push(...ids);return b;
  }},
  luckDig:{name:'Planned blind dig',params:['count'],defaults:{count:1},grid:[{count:1},{count:2}],make(b,c,p){
    const tray=[],choices=[];for(const i of c.P){const q=tray.findIndex(j=>b.faces[j]===b.faces[i]);if(tray.length>=2&&!c.free0[i]&&!c.occupied.has(i)&&!b.down.includes(i))choices.push(i);if(q<0)tray.push(i);else tray.splice(q,1);}
    const ids=c.order(choices).slice(0,p.count);if(ids.length!==p.count)return null;b.down.push(...ids);return b;
  }},
  relief:{name:'An early matching escape',params:['count'],defaults:{count:1},grid:[{count:1}],make(b,c,p){
    // Reveal an existing concealed escape, or move one matching partner into a
    // currently free position by a two-picture swap. Only those tiles are owned.
    const hidden=c.P.filter(i=>b.down.includes(i)&&!c.occupied.has(i));
    if(hidden.length>=p.count){reveal(b,hidden.slice(0,p.count));return b;}
    for(const [a,z]of c.pairs.filter(([a,z])=>c.pos[z]-c.pos[a]>3&&!c.occupied.has(z))){
      const target=c.order(c.P.filter(i=>i!==a&&c.free0[i]&&!c.occupied.has(i)&&b.faces[i]!==b.faces[a]))[0];
      if(target===undefined)continue;[b.faces[z],b.faces[target]]=[b.faces[target],b.faces[z]];return b;
    }return null;
  }},
  temptingPair:{name:'Visible off-route pair',params:['delay'],defaults:{delay:3},grid:[{delay:3}],make(b,c,p){
    const free=c.order(c.P.filter(i=>c.free0[i]&&!c.occupied.has(i)));
    for(const a of free){const mate=c.pairs.find(([x,z])=>x===a||z===a)?.slice(0,2).find(i=>i!==a);if(mate===undefined||c.occupied.has(mate))continue;
      const z=free.find(i=>i!==a&&b.faces[i]!==b.faces[a]&&c.pos[i]>p.delay);if(z===undefined)continue;
      [b.faces[mate],b.faces[z]]=[b.faces[z],b.faces[mate]];return b;
    }return null;
  }},
  wrongClock:{name:'Free clock with a buried partner',params:['depth','spare'],defaults:{depth:3,spare:1},grid:[{depth:3,spare:1}],make(b,c,p){
    if(b.clock)return null;
    const pairs=c.pairs.filter(([a,z])=>c.free0[a]&&c.cover(z).size>=p.depth&&!c.occupied.has(a)&&!c.occupied.has(z));
    for(const [a,z]of pairs){const x=I.clone(b);x.clock={i:a,n:999};x.clockMate=z;reveal(x,[a,z]);const fixed=I.fix(x,p.spare);if(fixed)return fixed;}return null;
  }}
};
function place(name,board,way=wayFor(board),params={},rng=I.rngOf(1)){
  const def=DEFINITIONS[name];if(!def)throw Error('Unknown piece '+name);
  if(Object.keys(params).some(k=>!def.params.includes(k)))throw Error('Unknown '+name+' parameter');
  const p={...def.defaults,...params};
  if(Object.values(p).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<0)))throw Error('Invalid piece parameter');
  if(p.spare!==undefined&&![1,2,3].includes(p.spare))throw Error('Clock spare must be 1–3');
  if(p.count!==undefined&&(!Number.isInteger(p.count)||p.count<1||p.count>3))throw Error('Piece count must be 1–3');
  if(p.height!==undefined&&![1,2,3].includes(p.height))throw Error('Ice height must be 1–3');
  if(p.length!==undefined&&(!Number.isInteger(p.length)||p.length<1||p.length>4))throw Error('Chain length must be 1–4');
  if(p.share!==undefined&&(p.share<=0||p.share>1))throw Error('Route share must be between zero and one');
  const before=I.clone(board),x=I.clone(board);x.obst||={ice:{},keys:[],locks:[]};
  I.setExact(true,{nodes:20000,milliseconds:350});
  return I.withSearchBudget(Date.now()+1200,()=>{
    let out=def.make(x,context(x,way,rng),p);if(!out)return null;
    if(!I.valid(out)){out=I.fix(out,spareOf(board)??p.spare??2);if(!out)return null;}
    if(board.clock&&out.clock){out=I.fix(out,spareOf(board));if(!out)return null;}
    if(!eq(before.tiles,out.tiles)||!I.valid(out))return null;
    const patch=diff(before,out);if(!patch.length)return null;
    const owned=[...new Set(patch.flatMap(q=>q.path.length===2?[q.path[1]]:q.path[0]==='keys'?[...q.before,...q.after]:q.path[0]==='clock'?[q.before?.i,q.after?.i].filter(Number.isInteger):q.path[0]==='clockMate'?[q.before,q.after].filter(Number.isInteger):[]))].sort((a,z)=>a-z);
    const record={id:digest({name,params:p,patch,ordinal:(board.pieceInstances||[]).length}).slice(0,16),name,params:p,owned,patch,before:boardKey(before),after:boardKey(out)};
    out.pieceInstances=[...(board.pieceInstances||[]),record];return out;
  });
}
const CATALOGUE=Object.freeze(Object.fromEntries(Object.entries(DEFINITIONS).map(([key,d])=>[key,Object.freeze({key,name:d.name,params:d.params,defaults:d.defaults,grid:d.grid,place:(b,w,p,r)=>place(key,b,w,p,r)})])));
function decompose(b){
  // Read physical mechanisms, not recipe labels or measured difficulty. This
  // same representation serves experiments, historical boards and predictions.
  const c=I.ctxOf(b),o=b.obst||{},ice=o.ice||{},keys=o.keys||[],locks=o.locks||[],route=b.clock?c.pos[b.clock.i]+1:0;
  const out=[],add=(name,params,indices=[])=>out.push({name,params,owned:indices});
  if(b.clock){add('clock',{depth:cover(c,b.clock.i).size,spare:spareOf(b)},[b.clock.i]);add('clockWay',{share:route/c.n,spare:spareOf(b)},[b.clock.i]);if(ice[b.clock.i])add('clockIce',{height:ice[b.clock.i]},[b.clock.i]);if(locks.includes(b.clock.i))add('clockLock',{keyDepth:keys.length?keys.reduce((n,i)=>n+cover(c,i).size,0)/keys.length:0},[b.clock.i,...keys]);}
  if(keys.length){const distance=keys.length===2?Math.abs(c.tiles[keys[0]].x-c.tiles[keys[1]].x):0,width=Math.max(...c.tiles.map(t=>t.x))-Math.min(...c.tiles.map(t=>t.x));add('keys',{depth:keys.reduce((n,i)=>n+cover(c,i).size,0)/keys.length,across:distance>width*.5},keys);}
  const guard=new Set(keys.flatMap(k=>[...cover(c,k)]));for(const i of Object.keys(ice).map(Number))if(guard.has(i))add('keyGuard',{height:ice[i]},[i]);
  const frozenPartners=c.pairs.filter(([a,z])=>ice[z]&&c.pos[z]-c.pos[a]>=3).map(x=>x[1]);for(const i of frozenPartners)add('frozenPartner',{height:ice[i]},[i]);
  const rest=Object.keys(ice).map(Number).filter(i=>i!==b.clock?.i&&!guard.has(i)&&!frozenPartners.includes(i));if(rest.length)add('iceChain',{length:rest.length,height:rest.reduce((n,i)=>n+ice[i],0)/rest.length},rest);
  const done=keys.length?Math.max(...keys.map(i=>c.pos[i])):-1,partners=c.pairs.filter(([a,z])=>locks.includes(z)&&c.pos[a]<done&&c.pos[z]>done).map(x=>x[1]);if(partners.length)add('lockedPartners',{count:partners.length,keyDepth:keys.length?keys.reduce((n,i)=>n+cover(c,i).size,0)/keys.length:0},partners);
  if(b.clock){const near=[...c.nb.left[b.clock.i],...c.nb.right[b.clock.i],...c.nb.above[b.clock.i]].filter(i=>locks.includes(i));if(near.length)add('lockBeside',{keyDepth:keys.length?keys.reduce((n,i)=>n+cover(c,i).size,0)/keys.length:0},near);}
  const blind=new Set(b.down),twins=c.pairs.filter(([a,z])=>blind.has(a)&&blind.has(z));if(twins.length)add('blindTwins',{count:twins.length},twins.flatMap(x=>x.slice(0,2)));
  const onWay=b.solution.slice(0,route).filter(i=>blind.has(i));if(onWay.length)add('blindWay',{count:onWay.length},onWay);
  const carried=[],tight=[],escapes=[];let needsRelief=false;
  for(const i of c.P){if(blind.has(i)&&carried.length>=2){tight.push(i);needsRelief=true;}
    const match=carried.findIndex(j=>b.faces[j]===b.faces[i]);if(match<0)carried.push(i);else carried.splice(match,1);
    if(needsRelief&&carried.length<=1){escapes.push(i);needsRelief=false;}}
  const other=tight.filter(i=>!onWay.includes(i));if(other.length)add('luckDig',{count:other.length},other);
  if(escapes.length)add('relief',{count:escapes.length},escapes);
  const alive=new Uint8Array(c.n).fill(1),rules={ice,iceNb:c.inb,locks:new Set(locks),keys};
  const free=c.P.filter(i=>!blind.has(i)&&L.takeable(i,alive,c.nb,rules,alive)),pairs=[];
  for(let a=0;a<free.length;a++)for(let z=a+1;z<free.length;z++)if(b.faces[free[a]]===b.faces[free[z]])pairs.push([free[a],free[z]]);
  const offRoute=pairs.filter(p=>p.some(i=>c.pos[i]>=route));if(offRoute.length)add('temptingPair',{delay:offRoute.reduce((n,p)=>n+Math.max(...p.map(i=>c.pos[i])),0)/offRoute.length},offRoute.flat());
  if(b.clock&&c.free0[b.clock.i]){const mate=b.clockMate??c.pairs.find(p=>p.slice(0,2).includes(b.clock.i))?.slice(0,2).find(i=>i!==b.clock.i);
    if(mate!==undefined&&cover(c,mate).size>=2)add('wrongClock',{depth:cover(c,mate).size,spare:spareOf(b)},[b.clock.i,mate]);}
  // Other lock groups and distribution remain explicit; never pretend every
  // old board can be reconstructed uniquely from a recipe title.
  const unclassified=locks.filter(i=>i!==b.clock?.i&&!partners.includes(i));
  return {version:VERSION,pieces:out,layout:{n:c.n,maxZ:Math.max(...c.tiles.map(t=>t.z)),freeShare:c.free0.filter(Boolean).length/c.n},residual:{locks:unclassified.length,iceTiles:Object.keys(ice).length,hidden:b.down.length}};
}
module.exports={VERSION,CATALOGUE,place,remove,wayFor,decompose,diff,spareOf};
