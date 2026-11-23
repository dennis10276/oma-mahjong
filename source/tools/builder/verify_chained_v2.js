'use strict';
// Independent v2 acceptance: engine oracles, declarative recipe, and the new
// pressure target. The old greedy-loss/one-waiting-route targets are diagnostics.
const V=require('./verify_trap_mixes.js'),C=require('./verify_chained_mixes.js'),F=require('./bank/feel.js'),O=require('./chained_obviousness.js'),{SHAPES}=require('./chained_shapes.js');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function verify(r,opts={}){
  const v=V.verify(r,{...opts,tailBand:[0,1]}),errors=v.errors.slice(),d=r.design,t=r.card.trap,f=SHAPES[t.type];
  if (r.brief.targets?.requireFullTray) {
    const failure = require('./builder.js').fullTrayFailure(d);
    if (failure) errors.push(failure);
  }
  if (r.brief.targets?.requireStrandedThaw && !require('./bank/thaw_trap.js').findThawTrap(d)) {
    errors.push('strandedThawUnproven');
  }
  if(!f)errors.push('unknownShape');else{errors.push(...C.chainStructure(r,f).map(x=>'chain:'+x));if(t.signature!==f.signature||t.links!==f.links||f.links<3)errors.push('signature');}
  if(f?.newIdea){
    const offers=require('./chained_new_ideas.js').candidates(f.newIdea,d),q=t.newLink;
    if(!q||q.kind!==f.newIdea||!offers.some(o=>same(o.take,q.take)&&same(o.evidence,q.evidence))||!t.baits.some(p=>same(p.tiles,q.take)))errors.push('newLinkEvidence');
    if(f.newIdea==='splitPreparation')for(const i of q?.take||[]){const p=V.reprice(d,r.card.clock.fewestMoves,[i],opts);if(!p.exact||p.result!=='win'||p.cost>r.card.clock.spare)errors.push('individualPreparationNotSafe');}
  }
  if(f?.sixIdea)errors.push(...require('./chained_six_facts.js').audit(r,opts).errors.map(e=>'idea18:'+e));
  if(f?.name==='lookalikeCoverThaw'){
    const q=require('./chained_readability.js').keyRoof(d),stored={...q,minimum:r.roles.bait.keyRoofShownMin??0,roofMinimum:r.roles.bait.keyRoofTopMin??0};
    if(!same(stored,t.keyRoofReadability)||q.keyShown<stored.minimum||q.roofShown<stored.roofMinimum)errors.push('keyRoofReadability');
  }
  const o=O.measure(d,{baits:t.baits,dial:r.brief.obviousnessDial??0});if(!o.ok||!same(o,t.obviousness))errors.push('obviousness');
  if(!f?.sixIdea&&!t.baits.some((p,i)=>t.baits.some((q,j)=>i!==j&&p.tiles.every(x=>!q.tiles.includes(x)))))errors.push('twoDisjointLosingDecisions');
  const mech=new Set([...V.mechanism(d),...r.roles.bait.tiles,r.roles.bait.mix.originalClock,...d.solution.slice(0,r.card.clock.fewestMoves)]);
  if(d.down.length/d.tiles.length<.23||d.down.length/d.tiles.length>.28||d.down.some(i=>mech.has(i)))errors.push('faceDown');
  const feel=F.expert(d,{playouts:16,seed:9}),pp=+(feel.parkAt[1]+feel.parkAt[2]).toFixed(1);
  const tail=r.card.finishProfile?require('./bank/tail.js').measure(d,{seed:977,playouts:800}):r.card.tail;
  if(!require('./chained_finish_profiles.js').check(r,feel,tail))errors.push('pressureTarget');
  if(r.card.finishProfile&&(!same(tail,r.card.tail)))errors.push('tailCard');
  if(r.brief.readabilityProfile){
    const clear=require('./chained_special_readability.js').measure(d);
    if(r.brief.readabilityProfile!==clear.profile||!clear.ok||!same(clear,r.card.specialReadability))errors.push('specialReadability');
  }
  if(!same({...feel,pp,seed:9,playouts:16},r.card.feel))errors.push('feelCard');
  if(!Array.isArray(r.card.wrongIdea)||!r.card.wrongIdea.length||!same(r.card.wrongIdea,[...new Set(r.card.wrongIdea)].sort()))errors.push('wrongIdeaLedger');
  const kinds=[],b=r.roles.bait,mode=b.mix.mode;
  if(mode==='earlyClock')kinds.push('waitForTwin');if(mode==='roofKey')kinds.push('clockRoof');if(mode==='repeatKeys'||b.repeat)kinds.push('lookalikeChoice');if(mode==='freezeRight')kinds.push('innerIce');
  if(t.newLink)kinds.push(t.newLink.kind);
  for(const q of t.newLinks||[])kinds.push(q.kind);
  if(!f?.sixIdea&&b.wrong?.some(i=>t.baits.some(p=>p.tiles.includes(i))))kinds.push('lonelyMelt');
  if(!f?.sixIdea&&t.baits.some(p=>p.tiles.length===1&&d.obst.keys.includes(p.tiles[0])))kinds.push('earlyKey');
  if(!same([...new Set(kinds)].sort(),r.card.wrongIdea))errors.push('wrongIdeaBaitsMismatch');
  return {...v,ok:!errors.length,errors,feel:{...feel,pp},signature:t.signature};
}
module.exports={verify};
