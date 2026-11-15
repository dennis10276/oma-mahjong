'use strict';
// A separate behavioural certificate for a restack whose ordinary blockers move.
// This does not claim complete physical graph equivalence. The intended role chain,
// its timing, shortest route, counterfactual effects and wrong decisions must agree.
const E=require('./engine'),V=require('./verify_trap_mixes');
const crypto=require('crypto'),clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const cache=new WeakMap();
const closureCache=new WeakMap();
function pinnedClosure(d,pin){
  const signature=JSON.stringify([d.tiles,d.obst]);
  let entry=closureCache.get(d);if(!entry||entry.signature!==signature){entry={signature,memo:new Map()};closureCache.set(d,entry);}const memo=entry.memo;if(memo.has(pin))return memo.get(pin);
  const g=E.game(clone(d),{strict:true}),s=E.start(g);
  // Physical monotone closure: unlimited removals, no tray or clock budget.
  // No constructor's necessity function is used by this certificate.
  for(let changed=true;changed;){changed=false;for(const i of E.legal(g,s))if(i!==pin){s.alive[i]=0;changed=true;}}
  const result=Array.from(s.alive);memo.set(pin,result);return result;
}
function causal(record){
  const d=record.design,prefix=d.solution.slice(0,d.solution.indexOf(d.clock.i)+1),necessary=prefix.filter(i=>i===d.clock.i||pinnedClosure(d,i)[d.clock.i]);
  const needs=new Map(necessary.map(i=>[i,new Set(necessary.filter(j=>j!==i&&pinnedClosure(d,j)[i]))]));
  const direct=necessary.flatMap(i=>[...needs.get(i)].filter(j=>![...needs.get(i)].some(k=>k!==j&&needs.get(k)?.has(j))).map(j=>[j,i]));
  return {necessary,needs,direct};
}
function roleDependencies(d,roles){
  return roles.map(goal=>[goal,roles.filter(pin=>pin!==goal&&pinnedClosure(d,pin)[goal]).sort((a,b)=>a-b)]);
}
function prepare(record,opts={}){
  const signature=JSON.stringify([record.design,record.card,opts.nodes??1000000,opts.ms??10000]);
  if(cache.get(record)?.signature===signature)return cache.get(record).value;
  const d=record.design,g=E.game(clone(d)),t=record.card?.trap,roles=new Set([d.clock.i,...(d.obst?.keys||[]),...(d.obst?.locks||[]),...Object.keys(d.obst?.ice||{}).map(Number)]);
  if(t?.mechanism?.originalClock!=null)roles.add(t.mechanism.originalClock);
  const baits=t?.baits||[],states=[],scope=new Set([...roles,...baits.flatMap(q=>q.tiles)]);
  const faces=new Set([...scope].map(i=>d.faces[i]));d.faces.forEach((f,i)=>{if(faces.has(f))scope.add(i)});
  let state=E.start(g);states.push(state);for(const i of d.solution){try{state=E.step(g,state,i)}catch{state=null}if(!state)break;states.push(state);}
  const value={d,g,t,roles:[...roles],scope:[...scope],states,clock:E.clockShortest(g,{nodes:opts.nodes??1000000,ms:opts.ms??10000}),causal:causal(record),roleDependencies:roleDependencies(d,[...roles]),effects:new Map(),prices:new Map(),probes:new Map()};
  cache.set(record,{signature,value});return value;
}
function verify(before,after,opts={}){
  const a=before.design,b=after.design||after,errors=[],checks=[],budget={nodes:opts.nodes??1000000,ms:opts.ms??10000};
  for(const k of ['faces','down','gold','obst','clock','solution'])if(!same(a[k]??null,b[k]??null))errors.push('changed:'+k);
  if(a.tiles.length!==b.tiles.length)errors.push('tileCount');if(errors.length)return {ok:false,errors};
  for(let i=0;i<b.tiles.length;i++){
    const tile=b.tiles[i];
    if(tile.length!==3||tile.some(v=>!Number.isInteger(v)||v<0||v>63))errors.push('invalidPosition:'+i);
    for(let j=0;j<i;j++)if(tile[2]===b.tiles[j][2]&&Math.abs(tile[0]-b.tiles[j][0])<2&&Math.abs(tile[1]-b.tiles[j][1])<2)errors.push('overlap:'+i+':'+j);
  }
  if(errors.length)return {ok:false,errors};
  const p=prepare(before,opts),ga=p.g,gb=E.game(clone(b)),t=p.t;
  const pos=new Map(a.solution.map((v,i)=>[v,i]));
  const relations=(g,i,j)=>({above:g.nb.above[i].includes(j),below:g.nb.above[j].includes(i),thawI:!!g.iceH[i]&&g.iceNb[i].includes(j),thawJ:!!g.iceH[j]&&g.iceNb[j].includes(i)});
  // Every authored link and every direct link between two special roles is kept.
  const links=[...(t?.linkPairs||[])];for(const i of p.roles)for(const j of p.roles)if(i<j)links.push([i,j]);
  for(const [i,j]of links)if(!same(relations(ga,i,j),relations(gb,i,j)))errors.push('roleLink:'+i+':'+j);
  const shape=t?.type&&require('./chained_shapes').SHAPES[t.type];
  if(shape){for(const [label,d]of[['before',a],['after',b]])errors.push(...require('./verify_chained_mixes').chainStructure({...before,design:d},shape).map(e=>label+':chain:'+e));}
  if(errors.length)return {ok:false,errors};
  const dependencies=roleDependencies(b,p.roles);
  for(let i=0;i<dependencies.length;i++)if(!same(dependencies[i],p.roleDependencies[i]))errors.push('roleCausality:'+dependencies[i][0]);
  if(errors.length)return {ok:false,errors,dependencies};
  const roleTimes=[];let state=E.start(gb);
  for(let step=0;step<a.solution.length;step++){
    const source=p.states[step];if(!source){errors.push('baselineRoute');break;}
    const la=new Set(E.legal(ga,source).filter(x=>typeof x==='number')),lb=new Set(E.legal(gb,state).filter(x=>typeof x==='number'));
    for(const i of p.roles)if(la.has(i)!==lb.has(i))errors.push('roleTiming:'+i+':'+step);
    if(errors.length)break;
    roleTimes.push(p.roles.filter(i=>la.has(i)));
    try{state=E.step(gb,state,a.solution[step])}catch{state=null}
    if(!state){errors.push('candidateRoute:'+step);break;}
  }
  if(errors.length)return {ok:false,errors};
  const SR=require('./chained_special_readability'),ra=SR.measure({...a,obst:a.obst||{ice:{},keys:[],locks:[]}}),rb=SR.measure({...b,obst:b.obst||{ice:{},keys:[],locks:[]}});
  for(const r of ra.rows.filter(r=>r.clear))if(!rb.rows.some(s=>s.tile===r.tile&&s.kind===r.kind&&s.clear))errors.push('badge:'+r.tile+':'+r.kind);
  const ca=p.clock,cb=E.clockShortest(gb,budget);
  if(!ca||!cb||ca.unsure||cb.unsure||!Number.isInteger(ca.k))errors.push('clockMinimumChangedOrUnproven');
  else if(ca.k!==cb.k)errors.push('clockMinimumChangedOrUnproven');
  if(errors.length)return {ok:false,errors};
  checks.push('samePicturesSpecialsDeadlineAndWinningRoute','sameAuthoredAndSpecialRoleLinks','sameOrderFreePrerequisitesBetweenSpecialRoles','sameGateAvailabilityAtEveryWitnessState','sameProvenClockMinimumAndSpare');
  const effects=[];
  for(const [kind,i]of[...(a.obst?.locks||[]).map(i=>['lock',i]),...Object.keys(a.obst?.ice||{}).map(i=>['ice',+i])]){
    const drop=d=>{const x=clone(d);if(kind==='lock')x.obst.locks=x.obst.locks.filter(j=>j!==i);else delete x.obst.ice[i];return x};
    const key=kind+':'+i;let old=p.effects.get(key);if(!old){old=E.clockShortest(E.game(drop(a)),budget);p.effects.set(key,old);}
    const next=E.clockShortest(E.game(drop(b)),budget);
    effects.push({kind,tile:i,beforeK:old?.k,afterK:next?.k});
    if(!old||!next||old.unsure||next.unsure||!Number.isInteger(old.k))errors.push('specialCounterfactual:'+key);
    else if(old.k!==next.k)errors.push('specialCounterfactual:'+key);
  }
  if(errors.length)return {ok:false,errors,effects};
  checks.push('sameClockEffectOfRemovingEachIceOrLock');
  const prices=[],baitAtDeadline=[];
  for(const q of t?.baits||[]){
    const key=JSON.stringify(q.tiles);let old=p.prices.get(key);if(!old){old=V.reprice(a,ca.k,q.tiles,opts);p.prices.set(key,old);}
    const next=V.reprice(b,ca.k,q.tiles,opts);prices.push({tiles:q.tiles,before:old,after:next});
    // Older authored cards used different pricing horizons. Re-measure the
    // frozen released board, and prove the wrong move loses at its real deadline.
    const prior=V.oracle(a,a.clock.n,q.tiles,opts),current=V.oracle(b,b.clock.n,q.tiles,opts);
    baitAtDeadline.push({tiles:q.tiles,deadline:a.clock.n,before:prior,after:current});
    if(!old.exact||!next.exact||old.result!==next.result||old.cost!==next.cost||prior!=='lose'||current!=='lose')errors.push('baitChangedOrUnproven:'+key);
  }
  if(errors.length)return {ok:false,errors,effects,prices};
  // Compare alternative decisions involving a role or its matching picture at
  // the opening and immediately before every special on the pre-clock route.
  const probeSteps=[...new Set([0,...p.roles.map(i=>pos.get(i)).filter(s=>s!=null&&s<=pos.get(a.clock.i))])],probes=[];
  for(const step of probeSteps){
    const s=p.states[step],la=E.legal(ga,s).filter(x=>typeof x==='number'&&p.scope.includes(x)),lb=new Set(E.legal(gb,s).filter(x=>typeof x==='number'));
    for(const i of la){
      if(!lb.has(i)){errors.push('offerMissing:'+step+':'+i);continue;}
      const key=step+':'+i;let old=p.probes.get(key);
      const result=g=>{let ns;try{ns=E.step(g,s,i)}catch{return 'illegal'}return ns?E.winnable(g,ns,{nodes:opts.nodes??1000000,ms:opts.callMs??3000}).result:'lose'};
      if(!old){old=result(ga);p.probes.set(key,old);}const next=result(gb);
      probes.push({step,tile:i,before:old,after:next});
      if(old==='unknown'||next==='unknown'||old!==next)errors.push('roleDecisionChangedOrUnproven:'+key);
    }
  }
  checks.push('sameAuthoredBaitPrices','sameRoleDecisionResultsAtCriticalStages');
  const hash=d=>crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
  return {ok:!errors.length,scope:'authored-role-contract-v1',errors,checks,clockMinimum:ca.k,actualClockMinimum:cb.k,spare:a.clock.n-ca.k,effects,prices,baitAtDeadline,probes,roleTimeline:roleTimes,beforeHash:hash(a),afterHash:hash(b)};
}
function constraints(record,opts={}){
  const p=prepare(record),g=p.g,d=p.d,pos=new Map(d.solution.map((v,i)=>[v,i])),rules=d.tiles.map(()=>new Map());
  const add=(i,j,horizontal=false)=>{
    if(i===j)return;
    const put=(a,b)=>rules[a].set(b,{other:b,above:g.nb.above[a].includes(b),below:g.nb.above[b].includes(a),ice:!!(g.iceH[a]||g.iceH[b]),adjacent:g.iceNb[a].includes(b),horizontal,
      left:g.nb.left[a].includes(b),right:g.nb.right[a].includes(b)});
    put(i,j);put(j,i);
  };
  for(const [i,j]of p.t?.linkPairs||[])add(i,j);
  for(const i of p.roles)for(const j of p.roles)if(i<j)add(i,j);
  for(const i of opts.criticalPairs?p.roles:[]){
    const above=g.nb.above[i].slice().sort((a,b)=>pos.get(b)-pos.get(a));if(above.length)add(i,above[0]);
    if(g.nb.left[i].length&&g.nb.right[i].length)for(const side of ['left','right'])add(i,g.nb[side][i].slice().sort((a,b)=>pos.get(b)-pos.get(a))[0],true);
    if(g.iceH[i]){const ns=g.iceNb[i].slice().sort((a,b)=>pos.get(a)-pos.get(b));for(const j of ns.slice(0,g.iceH[i]))add(i,j);}
  }
  const opens=new Map(p.roles.map(i=>[i,p.states.findIndex(s=>E.legal(g,s).includes(i))]));
  return {rules:rules.map(m=>[...m.values()]),opens};
}
module.exports={verify,prepare,constraints,causal};
