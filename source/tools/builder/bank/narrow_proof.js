'use strict';
// Task 19: strict certification around narrow.js. Never treats a missing authored
// proof as acceptance. Historical build recovery only obtains matched role IDs;
// all candidate checks run on the actual released and narrowed designs.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=require('../engine'),I=require('../preserve_intent'),F=require('../footprint'),N=require('./narrow'),SEP=require('./separate');
const ROOT=path.resolve(__dirname,'../../../..'),DIR=path.join(ROOT,'source/analysis/builder/footprint60/narrow');
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=d=>crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function original(level){return read(path.join(ROOT,'source/analysis/builder/footprint60/range-250-300.json')).rows.find(r=>r.level===level).before;}
function relations(g,roles){const out=[];for(const i of roles)for(const j of roles)if(i<j)out.push([i,j,g.nb.above[i].includes(j),g.nb.above[j].includes(i),!!g.iceH[i]&&g.iceNb[i].includes(j),!!g.iceH[j]&&g.iceNb[j].includes(i)]);return out;}
function kOf(d){const q=E.clockShortest(E.game(clone(d)),{nodes:1000000,ms:10000});return q&&!q.unsure&&Number.isInteger(q.k)?q.k:null;}
function ablations(d){const out=[];for(const [kind,i]of[...Object.keys(d.obst.ice).map(i=>['ice',+i]),...d.obst.locks.map(i=>['lock',i])]){const q=clone(d);if(kind==='ice')delete q.obst.ice[i];else q.obst.locks=q.obst.locks.filter(j=>j!==i);out.push([kind,i,kOf(q)]);}return out;}
function context(before){
  if(before.brief&&before.roles){
    const ctx=require('./save_pair').mixCtx(before),roles={...before.roles,locks:new Set(before.roles.locks),holderSpecials:new Set(before.roles.holderSpecials)};
    return {...ctx,prove:(d,k)=>require('../trap_mixes').prove(before.brief.story,d,roles,{k,spare:ctx.spare,obviousnessDial:before.brief.obviousnessDial},{skipOpening:true})};
  }
  if(!before.card?.poolId)return null;
  const cacheFile=path.join(DIR,'contexts',`level-${before.level}.json`);
  let recovered;
  if(fs.existsSync(cacheFile))recovered=read(cacheFile);
  else{
    const T=require('../trap_stories'),R=require('./retune'),C=require('../compact_footprint');
    const stem=before.card.poolId.replace(/-[^-]+$/,'.json');
    const roots=[ROOT,path.resolve(ROOT,'../cc-builder-loop')];
    const file=roots.flatMap(root=>['batch-pool','batch-pool-2'].map(dir=>path.join(root,'source/build/traps',dir,stem))).find(fs.existsSync);
    if(!file)throw Error('Missing historical pool job '+stem);
    const job=read(file).job,old=C.compact;
    let rb;
    // The historical jobs predate automatic compact_footprint. Recreating that
    // stage is necessary for exact geometry/clock/obstacle identity, not a proof
    // exemption. Restore immediately, before certifying either board.
    try{C.compact=r=>r;rb=R.rebuild(job,before.design);}finally{C.compact=old;}
    if(!rb.r)throw Error('Historical role recovery: '+rb.why);
    recovered={job,roles:rb.r.roles,brief:rb.r.brief,clock:rb.r.card.clock,identity:[rb.r.design.tiles,rb.r.design.clock.i,rb.r.design.obst]};
    recovered.roles={...recovered.roles,locks:[...recovered.roles.locks],holderSpecials:[...recovered.roles.holderSpecials]};
    fs.mkdirSync(path.dirname(cacheFile),{recursive:true});fs.writeFileSync(cacheFile,JSON.stringify(recovered,null,1)+'\n');
  }
  if(!same(recovered.identity,[before.design.tiles,before.design.clock.i,before.design.obst]))throw Error('Recovered roles do not match released board');
  const roles={...recovered.roles,locks:new Set(recovered.roles.locks),holderSpecials:new Set(recovered.roles.holderSpecials)},b=roles.bait||{},spare=recovered.clock.spare;
  return {spare,roleTiles:[...(b.tiles||[]),...(b.twins||[]),...(b.wrong||[]),...Object.values(roles).filter(Number.isInteger)],roles,brief:recovered.brief,
    prove:(d,k)=>require('../trap_stories').reprove('chain',d,roles,recovered.brief,spare,k)};
}
function prepare(before){
  const prep=I.prepare(before),ctx=context(before),M=N.trapSet(before,prep);
  for(const i of ctx?.roleTiles||[])M.add(i);
  const a=before.design,k=prep.clock&&!prep.clock.unsure?prep.clock.k:null;
  if(k==null)throw Error('Released clock minimum unproven');
  const base={M,roles:prep.roles,rel:relations(prep.g,prep.roles).map(q=>q.slice(2)),deps:prep.roleDependencies,k,abl:ablations(a),twins:SEP.closeTwins(a).visible,ctx,prep};
  if(base.abl.some(q=>q[2]==null))throw Error('Released special effect unproven');
  if(ctx){const proof=ctx.prove(a,k);if(!proof.ok)throw Error('Released authored proof: '+proof.why);base.originalProof=proof;}
  return base;
}
function certify(before,cand,base,opts={}){
  const a=before.design,b=cand.design,errors=[],checks=[],notices=[],reviewPolicy=opts.reviewSideChanges?'workshop-behaviour':'strict-geometry';
  for(const key of ['down','gold','obst','clock'])if(!same(a[key],b[key]))errors.push('changed:'+key);
  if(a.tiles.length!==b.tiles.length)errors.push('tileCount');
  if(b.tiles.some(t=>t.length!==3||t.some(v=>!Number.isInteger(v)||v<0)))errors.push('invalidGrid');
  if(!require('./narrow_methods').valid(b.tiles))errors.push('unsupportedOrOverlapping');
  if(!same(a.faces.slice().sort((x,y)=>x-y),b.faces.slice().sort((x,y)=>x-y)))errors.push('pictureMultiplicities');
  const fit=F.measure(b,{minimum:58});if(!fit.ok)errors.push('footprint');
  if(!E.replay(b,b.solution,{strict:true}).ok)errors.push('strictReplay');else checks.push('fullStrictWin');
  const releasedPrefix=a.solution.slice(0,a.solution.indexOf(a.clock.i)+1),prefixGame=E.game(b,{strict:true});let prefixState=E.start(prefixGame);
  for(const i of releasedPrefix){try{prefixState=E.step(prefixGame,prefixState,i)}catch{prefixState=null;}if(!prefixState)break;}
  const keptClockRoute=same(releasedPrefix,b.solution.slice(0,releasedPrefix.length));
  if(prefixState&&!keptClockRoute)errors.push('discardedReleasedClockRoute');else checks.push(prefixState?'retainedReleasedClockRoute':'releasedClockRouteNoLongerLegal');
  const core=[...base.M].sort((x,y)=>x-y);
  if(!same(relations(E.game(a),core),relations(E.game(b),core)))errors.push('trapRelations');else checks.push('sameCoverAndThawRelationsWithinTrap');
  const sides=d=>{const g=E.game(d);return core.map(i=>['left','right'].map(side=>g.nb[side][i].filter(j=>base.M.has(j)).sort((x,y)=>x-y)));};
  if(!same(sides(a),sides(b))){if(opts.reviewSideChanges)notices.push('Side access changed; behavioural checks below were rerun.');else errors.push('trapSideRelations');}else checks.push('sameSideRelationsWithinTrap');
  const SR=require('../chained_special_readability'),ra=SR.measure(a),rb=SR.measure(b);
  for(const r of ra.rows.filter(q=>q.clear))if(!rb.rows.some(q=>q.tile===r.tile&&q.kind===r.kind&&q.clear))errors.push('badge:'+r.tile+':'+r.kind);
  if(!errors.some(q=>q.startsWith('badge:')))checks.push('retainedReadableSpecialBadges');
  const oldTwins=SEP.closeTwins(a),newTwins=SEP.closeTwins(b),pairKey=q=>q.slice(0,2).join(','),oldVisible=new Set(oldTwins.closeVisible.map(pairKey));
  if(newTwins.visible>base.twins||newTwins.closeVisible.some(q=>!oldVisible.has(pairKey(q))))errors.push('visibleTwins');else checks.push('noAdditionalVisibleCloseTwins');
  const changed=a.faces.map((f,i)=>f!==b.faces[i]?i:null).filter(i=>i!=null);
  const coreFaces=new Set(core.map(i=>a.faces[i]));
  if(changed.some(i=>base.M.has(i)||coreFaces.has(a.faces[i])||coreFaces.has(b.faces[i])))errors.push('trapPicturesChanged');
  if(errors.length)return {ok:false,errors,checks,notices,reviewPolicy};
  // Older released boards can store a legal route longer than their true
  // minimum. Keep that route when legal and measure the minimum independently;
  // authored chain proofs additionally require the stored shortest route.
  const k=kOf(b);if(k!==base.k||(base.ctx&&b.solution.indexOf(b.clock.i)+1!==base.k))errors.push('clockMinimum');else checks.push('sameProvenClockMinimumAndSpare');
  const abl=ablations(b);if(abl.some(q=>q[2]==null)||!same(abl,base.abl))errors.push('specialEffects');else checks.push('sameProvenIceAndLockAblationEffects');
  const p=I.prepare({design:b,card:before.card});if(!same(p.roleDependencies,base.prep.roleDependencies))errors.push('specialRoleOrder');else checks.push('sameSpecialRolePrerequisites');
  const prices=[];for(const bait of before.card?.trap?.baits||[]){const V=require('../verify_trap_mixes'),old=V.reprice(a,base.k,bait.tiles,{nodes:1000000,callMs:10000}),next=V.reprice(b,base.k,bait.tiles,{nodes:1000000,callMs:10000});prices.push({tiles:bait.tiles,before:old,after:next});if(!old.exact||!next.exact||!same(old,next))errors.push('baitPrice:'+bait.tiles.join(','));}
  if(!errors.some(q=>q.startsWith('baitPrice:')))checks.push('sameFreshlyMeasuredAuthoredBaitPrices');
  let ownProof=null;if(base.ctx){ownProof=base.ctx.prove(b,base.k);if(!ownProof.ok)errors.push('ownTrapProof:'+ownProof.why);else checks.push('ownAuthoredTrapProofAndGates');}
  else checks.push('olderBoardRecoveredSpecialContract');
  return {ok:!errors.length,errors,checks,notices,reviewPolicy,beforeHash:hash(a),afterHash:hash(b),k,spare:a.clock.n-base.k,keptClockRoute,ablations:abl,baits:prices,ownProof:ownProof?{ok:ownProof.ok,why:ownProof.why,card:ownProof.proof?.card||ownProof.card}:null,
    scope:'Preserves trap cover/thaw relations, special prerequisites/effects, authored baits and readable badges. Filler accessibility and the winning tail order may change.'};
}
module.exports={ROOT,DIR,original,prepare,certify,context,relations,kOf,ablations,hash};
if(require.main===module){
  const levels=(process.argv[2]||'252,253,254,257,258,274,282,293,299').split(',').map(Number);
  for(const level of levels){try{
    const before=original(level),file=path.join(DIR,`level-${level}.json`),cand=read(file),base=prepare(before),certificate=certify(before,cand,base);
    cand.certificate=certificate;cand.proof=certificate.ok?(base.ctx?'own trap proof holds':'older board: recovered special contract holds'):'HELD: '+certificate.errors.join(', ');
    fs.writeFileSync(file,JSON.stringify(cand,null,1)+'\n');
    const result={level,ok:certificate.ok,errors:certificate.errors,checks:certificate.checks};console.log(JSON.stringify(result));fs.appendFileSync(path.join(DIR,'certification.jsonl'),JSON.stringify(result)+'\n');
  }catch(e){const result={level,ok:false,error:e.stack};console.log(JSON.stringify(result));fs.appendFileSync(path.join(DIR,'certification.jsonl'),JSON.stringify(result)+'\n');}}
}
