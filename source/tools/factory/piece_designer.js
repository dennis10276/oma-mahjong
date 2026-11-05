'use strict';
const I=require('../lab/ideas.js'),Pieces=require('./pieces.js'),Model=require('./compose.js'),Placement=require('./placement_score.js');
const {roomProfile}=require('./design_traps.js'),{boardKey,digest}=require('./meter.js'),{originOf}=require('./originality.js');
const VERSION='measured-piece-designer-v1';
const clockKinds=new Set(['clock','clockWay','wrongClock']);
const repeatable=new Set(['luckDig','blindTwins','iceChain','frozenPartner','relief','temptingPair']);
const slotObjective=(p,target)=>Math.abs(Math.log(p.family.tries/target))*3+Math.max(0,Math.log(2.5/p.skilled.tries))*4+Math.max(0,Math.log(p.skilled.tries/6))*4;
function parameterKey(p){return Model.settingKey(p);}
function prior(list,effects,base={family:1.2,skilled:1}){
  const map=new Map(effects.map(e=>[e.key,e])),logs={family:Math.log(base.family),skilled:Math.log(base.skilled)};let unknown=0;
  for(const op of list){const e=map.get(parameterKey(op));if(!e){unknown++;continue;}for(const k of ['family','skilled'])logs[k]+=e[k].medianLog;}
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=parameterKey(list[i]),b=parameterKey(list[j]),e=map.get(a+' + '+b)||map.get(b+' + '+a);if(e)for(const k of ['family','skilled'])logs[k]+=e[k].medianLog;
  }
  return {family:{tries:Math.max(1,Math.min(20,Math.exp(logs.family)))},skilled:{tries:Math.max(1,Math.min(20,Math.exp(logs.skilled)))},unknown};
}
function current(b,[kind,i]){if(kind==='down')return b.down.includes(i);if(kind==='ice')return b.obst.ice[i]||0;if(kind==='locks')return b.obst.locks.includes(i);if(kind==='keys')return b.obst.keys;if(kind==='faces')return b.faces[i];if(kind==='clockMate')return b.clockMate??null;return b.clock;}
function assemble(base,list,seed){
  if(list.filter(p=>clockKinds.has(p.name)).length!==1)return null;
  const counts={};for(const p of list){counts[p.name]=(counts[p.name]||0)+1;if(counts[p.name]>(repeatable.has(p.name)?3:1))return null;}
  const way=Pieces.wayFor(base);let out=I.clone(base);
  const ordinal={};for(const op of list){const index=ordinal[op.name]||0;ordinal[op.name]=index+1;
    const stableSeed=parseInt(digest(index?[seed,op.name,index]:[seed,op.name]).slice(0,7),16)+1;out=Pieces.place(op.name,out,way,op.params,I.rngOf(stableSeed));if(!out)return null;}
  // A later "relief" must not simply erase an earlier blind piece. Shared
  // fair timer updates are the explicit exception: the same clock is retained.
  for(const record of out.pieceInstances)for(const p of record.patch){
    if(p.path[0]==='clock'){if(p.after&&out.clock?.i!==p.after.i)return null;}
    else if(JSON.stringify(current(out,p.path))!==JSON.stringify(p.after))return null;
  }
  if(!I.valid(out)||!Placement.readable(out))return null;
  const room=roomProfile(out);if(!room.ok||room.unrelieved>1)return null;
  return {design:out,room};
}
const PATTERNS=[
  ['clock','keys','clockLock'],['clock','keys','clockLock','keyGuard'],['clock','keys','clockLock','iceChain'],
  ['clock','keys','lockedPartners','frozenPartner'],['clock','keys','lockBeside'],
  ['clockWay','keys','clockLock','keyGuard'],['clock','iceChain','frozenPartner'],
  ['wrongClock','keys','lockedPartners'],['clockWay','keys','clockLock','clockIce'],
  ['clock','keys','lockedPartners','iceChain'],['clockWay','keys','lockBeside','frozenPartner'],
  ['clock','keys','clockLock','keyGuard','frozenPartner']
];
function proposals(seed=1,count=96){
  const rng=I.rngOf(seed),pick=a=>a[Math.floor(rng()*a.length)],out=[];
  for(let k=0;k<count;k++){
    let pattern=PATTERNS[k%PATTERNS.length];const waiting=pattern.includes('lockedPartners')||pattern.includes('frozenPartner');
    if(waiting)pattern=pattern.map(name=>name==='clockWay'?'clock':name);
    const settings=name=>[...Pieces.CATALOGUE[name].grid,Pieces.CATALOGUE[name].defaults];
    const params=Object.fromEntries(Object.keys(Pieces.CATALOGUE).map(name=>[name,pick(settings(name))]));
    if(waiting)params.clock=pick(settings('clock').filter(p=>p.spare===1));
    const list=pattern.map(name=>({name,params:params[name]}));
    if(k%4===1)list.push({name:'relief',params:{count:1}});
    if(k%3!==0)list.push({name:'blindWay',params:{count:1}});
    if(k%2===0)list.push({name:'luckDig',params:{count:pick([1,2])}});
    if(k%4===0)list.push({name:'luckDig',params:{count:pick([1,2])}});
    if(k%8===7)list.push({name:'blindTwins',params:{count:1}});
    out.push(list);
  }
  return [...new Map(out.map(list=>[digest(list),list])).values()];
}
function components(board){return board.pieceInstances.flatMap(record=>['ice','locks'].map(kind=>({name:record.name+'@'+record.id+':'+kind,recipe:record.name,kind,
  indices:record.patch.filter(p=>p.path[0]===kind&&p.after).map(p=>p.path[1])})).filter(c=>c.indices.length));}
function replaceOne(row,index,op){
  const list=row.pieces.map((p,i)=>i===index?op:p),old=row.design.pieceInstances[index];if(!old)return null;
  if(clockKinds.has(row.pieces[index].name)||clockKinds.has(op.name))return assemble(row.pieceDesigner.baseDesign,list,row.pieceDesigner.seed);
  const without=Pieces.remove(row.design,old.id);if(!without)return null;
  const ordinal=row.pieces.slice(0,index).filter(p=>p.name===op.name).length,seed=row.pieceDesigner.seed;
  const stableSeed=parseInt(digest(ordinal?[seed,op.name,ordinal]:[seed,op.name]).slice(0,7),16)+1;
  const design=Pieces.place(op.name,without,Pieces.wayFor(without),op.params,I.rngOf(stableSeed));if(!design)return null;
  // Keep every other piece's physical fields. A fair clock deadline may be
  // derived again from the changed dependency; no other key/ice/face may move.
  for(let i=0;i<row.design.pieceInstances.length;i++)if(i!==index)for(const p of row.design.pieceInstances[i].patch)
    if(p.path[0]!=='clock'&&JSON.stringify(current(design,p.path))!==JSON.stringify(p.after))return null;
  const replacement=design.pieceInstances.at(-1);design.pieceInstances=row.design.pieceInstances.map((p,i)=>i===index?replacement:p);
  if(!I.valid(design)||!Placement.readable(design))return null;const room=roomProfile(design);if(!room.ok||room.unrelieved>1)return null;
  return {design,room};
}
function rowOf(result,base,spec,list,seed,model,shape,creationId,creationSlot=spec.level){
  const d=result.design,prediction=Model.predict(model,d),recipe=list.map(p=>p.name==='wrongClock'?'dontGrab':'piece:'+p.name),id=boardKey(d).slice(0,16);
  return {id,level:creationSlot,placementTargetLevel:spec.level,target:spec.target,shape,n:d.tiles.length,design:d,room:result.room,recipe,
    pieces:list,pieceInstances:d.pieceInstances,predicted:{family:prediction.family,skilled:prediction.skilled},
    pieceDesigner:{version:VERSION,seed,modelInput:model.input,base:boardKey(base),baseDesign:base,
      predictedOnCurve:Math.abs(prediction.family.tries-spec.target)<=.5&&prediction.skilled.tries>=2.5&&prediction.skilled.tries<=6},
    origin:{...originOf(d,creationId,'An original level composed from measured local mechanisms',seed),creationSlot},
    playerFeedback:true,useHumanSkilled:true,forcePlanner:true,candidatePool:true,seedSource:'fresh-designed',
    placementScore:Placement.score(d,recipe,shape),trapPlan:{version:'measured-pieces-v1',authoredBoard:boardKey(d),steps:[],components:components(d)}};
}
function suggest(base,spec,model,effects,options={}){
  const seed=options.seed??271771,basePrediction=Model.predict(model,base),list=proposals(seed,options.proposals??96);
  list.sort((a,b)=>slotObjective(prior(a,effects,{family:basePrediction.family.tries,skilled:basePrediction.skilled.tries}),spec.target)-slotObjective(prior(b,effects,{family:basePrediction.family.tries,skilled:basePrediction.skilled.tries}),spec.target));
  // Explore distinct mechanism lists before spending the whole placement
  // allowance on parameter variants of a single apparently promising list.
  const seen=new Set(),first=[],rest=[];for(const ops of list){const key=ops.map(p=>p.name).sort().join('+');if(seen.has(key))rest.push(ops);else{seen.add(key);first.push(ops);}}
  const ordered=[...first,...rest];
  const started=Date.now(),rows=[],failures={};let attempts=0;
  for(const ops of ordered){if(attempts>=(options.placements??36)||Date.now()-started>(options.milliseconds??12000))break;attempts++;
    const made=assemble(base,ops,seed);if(!made){failures.placement=(failures.placement||0)+1;continue;}
    const row=rowOf(made,base,spec,ops,seed,model,options.shape||'',options.creationId||'pieces/'+seed,options.creationSlot??spec.level);
    row.piecePrior=prior(ops,effects,{family:basePrediction.family.tries,skilled:basePrediction.skilled.tries});rows.push(row);
  }
  rows.sort((a,b)=>Number(b.pieceDesigner.predictedOnCurve)-Number(a.pieceDesigner.predictedOnCurve)||slotObjective(a.predicted,spec.target)-slotObjective(b.predicted,spec.target));
  return {rows:rows.slice(0,options.wanted??3),attempts,failures,seconds:(Date.now()-started)/1000};
}
function tuneOne(row,measured,spec,model,effects,options={}){
  const baseline={family:{tries:measured.family},skilled:{tries:measured.skilled}},before=slotObjective(baseline,spec.target),beforeModel=Model.predict(model,row),moves=[];
  for(let index=0;index<row.pieces.length;index++){
    const old=row.pieces[index],oldPrior=prior(row.pieces,effects);
    for(const entry of Object.values(Pieces.CATALOGUE))for(const params of [...new Map([...entry.grid,entry.defaults].map(p=>[Model.settingKey({name:entry.key,params:p}),p])).values()]){
      const op={name:entry.key,params};if(parameterKey(op)===parameterKey(old))continue;
      if(clockKinds.has(old.name)!==clockKinds.has(op.name))continue;
      if(row.pieces.filter((p,i)=>i!==index&&p.name===op.name).length>=(repeatable.has(op.name)?3:1))continue;
      const list=row.pieces.map((p,i)=>i===index?op:p),next=prior(list,effects),estimate={};
      for(const k of ['family','skilled'])estimate[k]={tries:Math.max(1,Math.min(20,baseline[k].tries*next[k].tries/oldPrior[k].tries))};
      const score=slotObjective(estimate,spec.target);if(score<=before+.25)moves.push({index,from:old,to:op,list,estimate,score});
    }
  }
  moves.sort((a,b)=>a.score-b.score);const candidates=[],seed=row.pieceDesigner.seed;
  for(const move of moves.slice(0,options.placements??8)){
    const made=replaceOne(row,move.index,move.to);if(!made)continue;
    // Replaying the same seed must preserve the other pieces' physical fields.
    // A changed fair deadline may propagate; moving another guard/key may not.
    const stable=r=>JSON.stringify(r.patch.filter(p=>p.path[0]!=='clock'));
    if(made.design.pieceInstances.some((r,i)=>i!==move.index&&stable(r)!==stable(row.design.pieceInstances[i])))continue;
    const next=rowOf(made,row.pieceDesigner.baseDesign,spec,move.list,seed,model,row.shape,row.origin.creationId,row.origin.creationSlot);
    if(next.id===row.id)continue;
    const deltaEstimate={};for(const k of ['family','skilled'])deltaEstimate[k]={tries:Math.max(1,Math.min(20,baseline[k].tries*next.predicted[k].tries/beforeModel[k].tries))};
    if(slotObjective(deltaEstimate,spec.target)>=before)continue;
    next.edit='One measured-effect piece change';next.tunedFrom=row.id;next.pieceChange={index:move.index,from:move.from,to:move.to,priorEstimate:move.estimate,modelDeltaEstimate:deltaEstimate,measuredBefore:measured,patch:Pieces.diff(row.design,next.design)};
    candidates.push(next);
  }
  candidates.sort((a,b)=>slotObjective(a.pieceChange.modelDeltaEstimate,spec.target)-slotObjective(b.pieceChange.modelDeltaEstimate,spec.target));return candidates[0]||null;
}
module.exports={VERSION,slotObjective,prior,assemble,proposals,components,replaceOne,suggest,tuneOne};
