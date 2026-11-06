'use strict';
const I=require('../lab/ideas.js'),P=require('./pieces.js'),F=require('./pressure_frame.js'),Model=require('./frame_model.js'),E=require('./frame_experiment.js'),M=require('./meter.js'),O=require('./originality.js'),Placement=require('./placement_score.js'),D=require('./piece_designer.js'),{roomProfile}=require('./design_traps.js');
const VERSION='pressure-frame-designer-v1';
const PATTERNS=[['keys','clockLock'],['keys','clockLock','keyGuard'],['keys','lockedPartners','frozenPartner'],['iceChain','frozenPartner'],['keys','lockBeside'],['keys','lockedPartners','iceChain'],['keys','clockLock','clockIce'],['keys','clockLock','frozenPartner'],['clock','keys','clockLock'],['clock','keys','lockedPartners'],['clockWay','iceChain','frozenPartner'],['wrongClock','keys','lockedPartners']];
const objective=(p,target)=>Math.abs(Math.log(p.family.tries/target))*3+Math.max(0,Math.log(2.5/p.skilled.tries))*4+Math.max(0,Math.log(p.skilled.tries/6))*4;
function field(b,[k,i]){if(k==='faces')return b.faces[i];if(k==='down')return b.down.includes(i);if(k==='ice')return b.obst.ice[i]||0;if(k==='locks')return b.obst.locks.includes(i);if(k==='keys')return b.obst.keys;if(k==='clockMate')return b.clockMate??null;return b.clock;}
function assemble(base,frame,list,seed,options={}){let design=options.framed?I.clone(options.framed):F.construct(base,frame,seed,options);if(!design)return null;
 const ordinal={};for(const op of list){const n=ordinal[op.name]||0;ordinal[op.name]=n+1;design=E.apply(base,design,op,parseInt(M.digest([seed,op.name,n]).slice(0,7),16)+1,options);if(!design)return null;}
 for(const r of design.pieceInstances||[])for(const p of r.patch)if(p.path[0]!=='clock'&&JSON.stringify(field(design,p.path))!==JSON.stringify(p.after))return null;
 const room=roomProfile(design);if(!I.valid(design)||!Placement.readable(design)||!room.ok||room.unrelieved>1)return null;return{design,room};}
function lists(seed,count=96){const random=I.rngOf(seed),pick=a=>a[Math.floor(random()*a.length)];return Array.from({length:count},(_,k)=>{
 const out=PATTERNS[k%PATTERNS.length].map(name=>{const settings=[...new Map([...P.CATALOGUE[name].grid,P.CATALOGUE[name].defaults].map(p=>[JSON.stringify(p),p])).values()];return{name,params:['clock','clockWay','wrongClock'].includes(name)?settings[Math.floor(k/PATTERNS.length)%settings.length]:pick(settings)};});
 if(k%3===0)out.push({name:'relief',params:{count:1}});if(k%2===0)out.push({name:'blindWay',params:{count:1}});out.push({name:'luckDig',params:{count:pick([1,2])}});if(k%4===0)out.push({name:'blindTwins',params:{count:1}});return out;});}
function prior(frame,list,effects){const logs={family:Math.log(frame.family.exp),skilled:Math.log(frame.skilled.exp)},available=effects.filter(e=>e.frame===frame.id),key=p=>require('./compose.js').settingKey(p),map=new Map(available.map(e=>[e.key,e]));
 for(const op of list){const e=map.get(key(op));if(e)for(const k of['family','skilled'])logs[k]+=e[k].medianLog;}
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=key(list[i]),b=key(list[j]),e=map.get(a+' + '+b)||map.get(b+' + '+a);if(e)for(const k of['family','skilled'])logs[k]+=e[k].medianLog;}
 return Object.fromEntries(['family','skilled'].map(k=>[k,{tries:Math.max(1,Math.min(20,Math.exp(logs[k])))}]));}
function rowOf(base,frame,list,made,spec,model,seed,shape,creationId,creationSlot){const design=made.design,id=M.boardKey(design).slice(0,16),recipe=['frame:'+frame.share+'/'+frame.depth+'/'+frame.spare,...list.map(p=>'piece:'+p.name)];
 return{id,level:creationSlot,placementTargetLevel:spec.level,target:spec.target,n:design.tiles.length,shape,design,room:made.room,pieces:list,pieceInstances:design.pieceInstances||[],frame,frameDesigner:{version:VERSION,seed,baseDesign:base,modelInput:model.input},predicted:Model.predict(model,design),
  origin:{...O.originOf(design,creationId,'A new pressure frame with conditional local traps',seed),creationSlot},recipe,playerFeedback:true,useHumanSkilled:true,forcePlanner:true,candidatePool:true,seedSource:'fresh-designed',placementScore:Placement.score(design,recipe,shape),trapPlan:{version:VERSION,authoredBoard:M.boardKey(design),steps:[],components:D.components({...design,pieceInstances:design.pieceInstances||[]})}};}
function suggest(base,spec,model,frames,effects,options={}){const seed=options.seed??811000,all=frames.flatMap(f=>lists(seed,options.proposals??96).map(list=>({frame:f,list,prior:prior(f,list,effects)})));all.sort((a,b)=>objective(a.prior,spec.target)-objective(b.prior,spec.target));
 const result=[],deadline=Date.now()+(options.milliseconds??18000),seen=new Set(),frameCache=new Map();let attempts=0;
 for(const option of all){if(Date.now()>deadline||attempts>=(options.placements??20))break;const requested=option.frame.sample.requested,key=M.digest([requested,option.list]);if(seen.has(key))continue;seen.add(key);attempts++;
  const frameKey=M.digest(requested);if(!frameCache.has(frameKey))frameCache.set(frameKey,F.construct(base,requested,seed,{milliseconds:Math.min(1800,Math.max(1,deadline-Date.now()))}));
  const framed=frameCache.get(frameKey);if(!framed)continue;
  const made=assemble(base,requested,option.list,seed,{framed,milliseconds:Math.min(1800,Math.max(1,deadline-Date.now()))});if(!made)continue;
  const row=rowOf(base,requested,option.list,made,spec,model,seed,options.shape,options.creationId,options.creationSlot);row.framePrior=option.prior;row.frameCalibration=option.frame.id;result.push(row);
 }
 return [...new Map(result.map(r=>[r.id,r])).values()].sort((a,b)=>objective(a.predicted,spec.target)-objective(b.predicted,spec.target)).slice(0,options.keep??4);}
function tuneOne(row,measured,spec,model,frames,effects){
 const before=Model.predict(model,row),actual={family:{tries:measured.family},skilled:{tries:measured.skilled}},candidates=[],baselineObjective=objective(actual,spec.target);
 const moves=[];for(let index=0;index<row.pieces.length;index++){const old=row.pieces[index],def=P.CATALOGUE[old.name];for(const params of[...def.grid,def.defaults])if(JSON.stringify(params)!==JSON.stringify(old.params))moves.push({index,from:old,to:{name:old.name,params}});}
 for(const spare of[1,2,3])if(spare!==F.describe(row.design).spare)moves.push({frame:true,from:F.describe(row.design).spare,to:spare});
 let placements=0;for(const move of moves){if(placements>=12)break;let made;
  if(move.frame){const design=F.grade(row.design,move.to);if(!design)continue;made={design,room:roomProfile(design)};}
  else{const control=effects.filter(e=>e.frame===row.frameCalibration),old=control.find(e=>e.key===require('./compose.js').settingKey(move.from)),next=control.find(e=>e.key===require('./compose.js').settingKey(move.to));if(!old||!next)continue;
   made=D.replaceOne({...row,pieceDesigner:{baseDesign:row.frameDesigner.baseDesign,seed:row.frameDesigner.seed}},move.index,move.to);if(!made)continue;move.calibratedDelta=Object.fromEntries(['family','skilled'].map(k=>[k,Math.exp(next[k].medianLog-old[k].medianLog)]));}
  placements++;const predicted=Model.predict(model,made.design),estimate=Object.fromEntries(['family','skilled'].map(k=>[k,{tries:Math.max(1,Math.min(20,actual[k].tries*predicted[k].tries/before[k].tries))}]));if(objective(estimate,spec.target)>=baselineObjective)continue;
  const next={...row,id:M.boardKey(made.design).slice(0,16),design:made.design,room:made.room,pieces:row.pieces.map((p,i)=>!move.frame&&i===move.index?move.to:p),pieceInstances:made.design.pieceInstances||[],predicted,target:spec.target,placementTargetLevel:spec.level,
   ...(move.frame?{frame:{...row.frame,spare:move.to}}:{}),edit:'One conditional measured-effect piece/frame grade',tunedFrom:row.id,pieceChange:{...move,measuredBefore:measured,modelDeltaEstimate:estimate,patch:P.diff(row.design,made.design)}};
  if(move.frame)next.recipe=['frame:'+next.frame.share+'/'+next.frame.depth+'/'+next.frame.spare,...next.recipe.slice(1)];
  next.trapPlan={...row.trapPlan,authoredBoard:M.boardKey(next.design),components:D.components({...next.design,pieceInstances:next.pieceInstances})};next.placementScore=Placement.score(next.design,next.recipe,next.shape);candidates.push(next);
 }
 return candidates.sort((a,b)=>objective(a.pieceChange.modelDeltaEstimate,spec.target)-objective(b.pieceChange.modelDeltaEstimate,spec.target))[0]||null;
}
module.exports={VERSION,PATTERNS,objective,assemble,lists,prior,rowOf,suggest,tuneOne};
