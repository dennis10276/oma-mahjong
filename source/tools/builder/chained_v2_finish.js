'use strict';
const M=require('./trap_mixes.js'),E=require('./engine.js'),S=require('./bank/separate.js'),Tl=require('./bank/tail.js'),F=require('./bank/feel.js');
function ideas(r){
  const b=r.roles.bait,mode=b.mix.mode,a=[];
  if(mode==='earlyClock')a.push('waitForTwin');
  if(mode==='roofKey')a.push('clockRoof');
  if(mode==='repeatKeys'||b.repeat)a.push('lookalikeChoice');
  if(mode==='freezeRight')a.push('innerIce');
  if(r.card.trap.newLink)a.push(r.card.trap.newLink.kind);
  for(const q of r.card.trap.newLinks||[])a.push(q.kind);
  // TASK 18 counts authored link kinds. Generic classifications of the same
  // key/ice moves stay in the priced bait list, not as extra featured ideas.
  if(M.FAMILIES[r.brief.story]?.sixIdea)return [...new Set(a)].sort();
  if(b.wrong?.some(i=>r.card.trap.baits.some(p=>p.tiles.includes(i))))a.push('lonelyMelt');
  if(r.card.trap.baits.some(p=>p.tiles.length===1&&r.design.obst.keys.includes(p.tiles[0])))a.push('earlyKey');
  return [...new Set(a)].sort();
}
function finish(raw,opts={}){
  const name=raw.brief.story,spare=raw.card.clock.spare,roles={...raw.roles,locks:new Set(raw.roles.locks),holderSpecials:new Set(raw.roles.holderSpecials)},notes=[];
  let d=structuredClone(raw.design),k=raw.card.clock.fewestMoves;
  if(M.FAMILIES[name]?.newIdea){
    const q=raw.card.trap.newLink,offers=require('./chained_new_ideas.js').candidates(name,d);
    if(!q||!offers.some(o=>JSON.stringify(o.take)===JSON.stringify(q.take)))return {fail:'staleNewIdea'};
    roles.bait.tiles=[...new Set([...(roles.bait.keyEarly!=null?[roles.bait.keyEarly]:[]),...(roles.bait.wrong||[]),...(roles.bait.twins||[]),...q.take])];
    roles.bait.extraMoves=[q.take];
  }
  if(roles.bait.six)roles.bait.keepUp=[...new Set([...roles.bait.keepUp,...roles.bait.six.visible])];
  const validate=x=>{const rt=M.retime(x,spare);if(!rt.ok)return rt;return M.prove(name,rt.design,roles,{k:rt.k,spare},{skipOpening:true});};
  for(let pass=0;pass<3&&!S.closeTwins(d).meets;pass++){
    const s=S.separate(d,{k,seed:(opts.seed??1)+pass*17,wallMs:6000,freeze:[...roles.bait.tiles,...d.obst.keys,...(roles.bait.repeat?.copies||[])],validate});
    notes.push({stage:'separate',after:S.summary(s.after)});if(s.validated)d=s.design;
  }
  if(!S.closeTwins(d).meets){const rr=require('./repair_chained_twins.js').repair(d,roles,name,spare,{wallMs:opts.repairMs??30000,seed:opts.seed});d=rr.design;notes.push({stage:'repair',...rr,design:undefined});}
  if(!S.closeTwins(d).meets){const kk=d.solution.indexOf(d.clock.i)+1;return {fail:'separation',notes,checkpoint:{...raw,design:d,roles:{...roles,locks:[...roles.locks],holderSpecials:[...roles.holderSpecials]},card:{...raw.card,clock:{fewestMoves:kk,spare,n:d.clock.n,tile:d.clock.i}}}};}
  let rt=M.retime(d,spare);if(!rt.ok)return {fail:rt.why,notes};d=rt.design;k=rt.k;
  const protect=new Set([...M.mechanismOf(d),...d.solution.slice(0,k),...roles.bait.tiles,roles.bait.mix.originalClock]);
  d.down=d.down.filter(i=>!protect.has(i));d=Tl.addFaceDown(d,{protect,target:.25,cap:.28,seed:opts.seed??1}).design;
  if(d.down.length/d.tiles.length<.23)return {fail:'faceDownTarget',notes};
  const freeze=[...new Set([...roles.bait.tiles,...d.obst.keys,...(roles.bait.repeat?.copies||[])])];
  let feel=F.expert(d,{playouts:16,seed:9}),pp=+(feel.parkAt[1]+feel.parkAt[2]).toFixed(1);
  if(pp<1.5||pp>3||feel.waiting[3]>.1||feel.lostGames){
    const tune=require('./bank/feel_retune.js').tuneFeel(d,{target:{parks:1.9,parksMax:2.6,max3:.075},ms:opts.tuneMs??45000,seed:opts.seed??1,freeze,validate});
    notes.push({stage:'feel',...tune,design:undefined});if(!tune.ok)return {fail:'feel',notes};d=tune.design;
  }
  rt=M.retime(d,spare);if(!rt.ok)return {fail:rt.why,notes};d=rt.design;k=rt.k;
  // Tuning can discover a different shortest route. Keep every final pre-clock tile up.
  const protectedFinal=new Set([...M.mechanismOf(d),...d.solution.slice(0,k),...roles.bait.tiles,roles.bait.mix.originalClock]);
  d.down=d.down.filter(i=>!protectedFinal.has(i));d=Tl.addFaceDown(d,{protect:protectedFinal,target:.25,cap:.28,seed:(opts.seed??1)+53}).design;
  const proof=M.prove(name,d,roles,{k,spare,obviousnessDial:raw.brief.obviousnessDial});if(!proof.ok)return {fail:'proof:'+proof.why,notes};
  feel=F.expert(d,{playouts:16,seed:9});pp=+(feel.parkAt[1]+feel.parkAt[2]).toFixed(1);
  if(pp<1.5||pp>3||feel.waiting[3]>.1||feel.lostGames){
    const again=require('./bank/feel_retune.js').tuneFeel(d,{target:{parks:1.9,parksMax:2.6,max3:.075},ms:30000,seed:(opts.seed??1)+101,freeze,validate});
    notes.push({stage:'feelFinalRetry',...again,design:undefined});
    if(again.ok){d=again.design;rt=M.retime(d,spare);if(rt.ok){d=rt.design;k=rt.k;}}
    feel=F.expert(d,{playouts:16,seed:9});pp=+(feel.parkAt[1]+feel.parkAt[2]).toFixed(1);
    if(pp<1.5||pp>3||feel.waiting[3]>.1||feel.lostGames)return {fail:'feelFinal',pp,feel,notes};
  }
  const finalProof=M.prove(name,d,roles,{k,spare,obviousnessDial:raw.brief.obviousnessDial});if(!finalProof.ok)return {fail:'finalProof:'+finalProof.why,notes};
  const r={...raw,schema:'chained-v2',design:d,roles,notes,card:{...raw.card,clock:{fewestMoves:k,spare,n:d.clock.n,tile:d.clock.i},trap:finalProof.card,layers:Math.max(...d.tiles.map(t=>t[2]))+1,faceDownShare:d.down.length/d.tiles.length,twins:S.summary(S.closeTwins(d)),pressure:require('./verify_trap_mixes.js').storedPressure(d),tail:Tl.measure(d,{seed:977,playouts:800}),tailOccupancy:Tl.occupancy(d),feel:{...feel,pp,seed:9,playouts:16}}};
  r.card.wrongIdea=ideas(r);
  const v=require('./verify_chained_v2.js').verify(r);if(!v.ok)return {fail:'independentVerification',verification:v,notes};r.verification=v;return r;
}
module.exports={finish,ideas};
