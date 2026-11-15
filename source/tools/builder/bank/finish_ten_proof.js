'use strict';
// Independent Task 20 mechanics checks, including authored proofs after tile
// deletion/reindexing. A missing or budget-limited proof never counts as a pass.
const P=require('./narrow_proof'),E=require('../engine'),I=require('../preserve_intent'),V=require('../verify_trap_mixes'),G=require('./narrow_methods'),F=require('../footprint'),SR=require('../chained_special_readability'),SEP=require('./separate');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),copy=x=>structuredClone(x);
function remapRoles(roles,keep,d){const ids=new Map(keep.map((id,i)=>[id,i])),mp=id=>id==null?null:ids.get(id),arrays=new Set(['tiles','single','pairs','twins','wrong','keepUp','right','links','copies','wrongPair','extraMoves','addedTiles','keys','locks','holderSpecials']);
  const transform=(v,key)=>{if(v==null)return v;if(key==='def'||key==='face'||/Min$|Max$/.test(key))return copy(v);if(v instanceof Set)return new Set([...v].map(mp).filter(i=>i!=null));if(Array.isArray(v)){const walk=a=>a.map(x=>Array.isArray(x)?walk(x):mp(x)).filter(x=>x!=null);return arrays.has(key)?walk(v):copy(v);}if(typeof v==='number')return mp(v);if(typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,transform(x,k)]));return v;};
  const r=Object.fromEntries(Object.entries(roles).map(([key,v])=>[key,key==='ice'?Object.fromEntries(Object.entries(v).map(([i,h])=>[mp(+i),h])):key==='dig'?d.solution.slice(0,d.solution.indexOf(d.clock.i)+1):transform(v,key)]));r.locks=new Set(r.locks);r.holderSpecials=new Set(r.holderSpecials);return r;
}
function ownProof(before,d,keep,k,base){
  if(!base.ctx)return {ok:true,scope:'Recovered special contract; no authored role context is available for this older board.'};
  const originalRoles=before.roles||base.ctx.roles,roles=remapRoles(originalRoles,keep,d);
  try{if(before.roles&&before.brief)return require('../trap_mixes').prove(before.brief.story,d,roles,{k,spare:base.k==null?null:before.design.clock.n-base.k,obviousnessDial:before.brief.obviousnessDial},{skipOpening:true,priceNodes:2000000,proofNodes:20000000,wallMs:60000});
    return require('../trap_stories').reprove('chain',d,roles,base.ctx.brief,before.design.clock.n-base.k,k);
  }catch(e){return {ok:false,why:e.message};}
}
function certify(before,d,keep,prepared){
  const a=before.design,base=prepared||P.prepare(before),errors=[],checks=[],ids=new Map(keep.map((id,i)=>[id,i])),mp=i=>ids.get(i),sp=[a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number)],bait=(before.card?.trap?.baits||[]),fixed=[...new Set([...sp,...bait.flatMap(b=>b.tiles)])];
  if(keep.length!==d.tiles.length||new Set(keep).size!==keep.length||keep.some(i=>!Number.isInteger(i)||i<0||i>=a.tiles.length))return {ok:false,errors:['invalidTileMap']};
  if(d.tiles.some(p=>p.length!==3||p.some(x=>!Number.isInteger(x)||x<0)))errors.push('invalidGrid');
  const counts=new Map();for(const f of d.faces)counts.set(f,(counts.get(f)||0)+1);if(d.faces.length!==d.tiles.length||[...counts].some(([f,n])=>!Number.isInteger(f)||f<0||f>=36||![2,4].includes(n)))errors.push('pictureMultiplicities');
  if(fixed.some(i=>mp(i)==null||d.faces[mp(i)]!==a.faces[i]))errors.push('specialOrWrongMovePicture');
  if(!same(d.obst?.ice,Object.fromEntries(Object.entries(a.obst.ice).map(([i,h])=>[mp(+i),h])))||!same(d.obst?.locks,a.obst.locks.map(mp))||!same(d.obst?.keys,a.obst.keys.map(mp)))errors.push('specials');
  if(d.clock.i!==mp(a.clock.i)||d.clock.n!==a.clock.n)errors.push('clock');
  if(!same(d.down,a.down.filter(i=>ids.has(i)).map(mp)))errors.push('faceDown');
  if(!G.valid(d.tiles))errors.push('supportOrOverlap');
  const xs=d.tiles.map(p=>p[0]),ys=d.tiles.map(p=>p[1]),fp=F.measure(d,{minimum:58});if(!fp.ok||Math.max(...xs)-Math.min(...xs)+2>13||Math.max(...ys)-Math.min(...ys)+2>16)errors.push('footprint');
  if(d.tiles.some((p,i)=>p[2]>2&&p[2]>a.tiles[keep[i]][2]))errors.push('newTower');
  if(!E.replay(d,d.solution,{strict:true}).ok)errors.push('strictWin');else checks.push('fullStrictWin');
  const badges=SR.measure(d),oldBadges=SR.measure(a);if(oldBadges.rows.filter(q=>q.clear).some(q=>!badges.rows.some(r=>r.tile===mp(q.tile)&&r.kind===q.kind&&r.clear)))errors.push('readableBadges');
  const twins=SEP.closeTwins(d);if(twins.visible>base.twins)errors.push('visibleTwins');
  if(errors.length)return {ok:false,errors,checks,footprint:fp};
  const k=P.kOf(d);if(k!==base.k)errors.push('clockMinimum');else checks.push('sameClockMinimumAndSpare');
  const ablations=P.ablations(d),oldAbl=base.abl.map(([kind,i,n])=>[kind,mp(i),n]);if(!same(ablations,oldAbl)||ablations.some(x=>x[2]==null))errors.push('specialEffects');else checks.push('sameSpecialEffects');
  const norm=x=>x.map(([i,r])=>[i,r.slice().sort((a,b)=>a-b)]).sort((a,b)=>a[0]-b[0]),deps=I.prepare({design:d}).roleDependencies,oldDeps=base.prep.roleDependencies.map(([i,r])=>[mp(i),r.map(mp)]);if(!same(norm(deps),norm(oldDeps)))errors.push('specialPrerequisites');else checks.push('sameSpecialPrerequisites');
  const prices=[],spare=a.clock.n-base.k,bites=q=>q.exact&&(q.result==='lose'||q.result==='win'&&q.cost>spare);
  for(const b of bait){const old=V.reprice(a,base.k,b.tiles,{nodes:2000000,callMs:20000}),next=V.reprice(d,base.k,b.tiles.map(mp),{nodes:2000000,callMs:20000});prices.push({tiles:b.tiles,before:old,after:next});if(!old.exact||!next.exact||bites(old)!==bites(next))errors.push('wrongMove:'+b.tiles.join(','));}
  if(!errors.some(e=>e.startsWith('wrongMove:')))checks.push('allAuthoredWrongMovesStillWrong');
  const own=ownProof(before,d,keep,k,base);if(!own.ok)errors.push('authoredProof:'+own.why);else checks.push(base.ctx?'ownAuthoredProof':'olderRecoveredSpecialContract');
  return {ok:!errors.length,errors,checks,k,spare,footprint:fp,ablations,prerequisites:deps,prices,ownProof:{ok:own.ok,why:own.why,scope:own.scope},beforeHash:P.hash(a),afterHash:P.hash(d),policy:'Task 20 same mechanics; geometry and non-trap finish pictures may change.'};
}
module.exports={certify,ownProof,remapRoles};
