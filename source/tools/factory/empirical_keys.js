'use strict';
// Reposition the two existing key markers on a nearby-depth visible pair.
// Pictures, locks, ice, clock tile and spare stay fixed. The bots judge the
// resulting whole board; cover depth is a grammar constraint, not a rating.
const I=require('../lab/ideas.js'),M=require('./meter.js'),P=require('./pieces.js'),Placement=require('./placement_score.js'),Composer=require('./trap_composer.js'),{roomProfile}=require('./design_traps.js');
function reposition(row,options={}){
 if(options.protectedIds?.has(row.id)||options.protectedCreations?.has(row.origin?.creationId)||row.factoryKeep)return[];
 const d=row.design,o=d.obst;if(o.keys.length!==2)return[];
 const c=I.ctxOf(d),hidden=new Set(d.down),special=new Set([d.clock.i,...o.keys,...o.locks,...Object.keys(o.ice).map(Number)]),covers=new Map();
 const cover=i=>{if(!covers.has(i)){const seen=new Set(),todo=[i];while(todo.length)for(const j of c.nb.above[todo.pop()])if(!seen.has(j)){seen.add(j);todo.push(j);}covers.set(i,seen);}return covers.get(i);};
 const depth=p=>cover(p[0]).size+cover(p[1]).size,span=p=>Math.hypot(c.tiles[p[0]].x-c.tiles[p[1]].x,c.tiles[p[0]].y-c.tiles[p[1]].y),current=depth(o.keys),spare=P.spareOf(d);
 const pairs=c.pairs.filter(p=>p.slice(0,2).every(i=>!special.has(i)&&!hidden.has(i))&&Math.abs(depth(p)-current)<=(options.maxDepthChange??4))
  .filter(p=>!row.recipe.includes('deepKeys')||p.slice(0,2).every(i=>cover(i).size>0)&&Math.max(cover(p[0]).size,cover(p[1]).size)>=3)
  .filter(p=>!row.recipe.includes('keysAcross')||span(p)>=span(o.keys)*.75)
  .filter(p=>!row.recipe.some(k=>k==='frozenKey'||k==='chainReaction')||p.slice(0,2).some(i=>[...cover(i)].some(j=>o.ice[j])))
  .sort((a,b)=>Math.abs(depth(a)-current)-Math.abs(depth(b)-current)||Math.abs(span(a)-span(o.keys))-Math.abs(span(b)-span(o.keys)));
 const out=[];for(const p of pairs.slice(0,options.probes??12)){
  const keys=p.slice(0,2);I.setExact(true,{nodes:25000,milliseconds:650});const design=I.withSearchBudget(Date.now()+1400,()=>I.fix({...d,obst:{...o,keys},clock:{...d.clock,n:999}},spare));
  if(!design||!I.valid(design)||P.spareOf(design)!==spare||row.playerFeedback&&!Placement.readable(design))continue;
  const room=roomProfile(design);if(!room.ok||room.unrelieved>1)continue;
  const key=M.boardKey(design),next={...row,id:key.slice(0,16),design,room,forcePlanner:true,tunedFrom:row.id,edit:'key pair repositioned on an existing visible dig',
   production:{...row.production,method:'empirical-key-placement-grade-v1',sparePolicy:'unchanged'},empiricalChange:{what:'existing key pair repositioned',kind:'keyReposition',parent:row.id,patch:P.diff(d,design)},
   trapPlan:{...row.trapPlan,authoredBoard:key,structuralScore:undefined,analysis:Composer.analyze(design),priorSteps:row.trapPlan?.steps,
    steps:(row.recipe||[]).map(recipe=>({recipe,repositionedKeys:{from:o.keys.slice(),to:keys}})),gradedFrom:M.boardKey(d)}};
  delete next.predicted;
  if(row.pieceDesigner||row.frameDesigner){const actual=P.decompose(design),names=new Set(actual.pieces.map(p=>p.name));next.priorAuthoringPieces=row.pieces;next.pieces=(row.pieces||[]).filter(p=>names.has(p.name));next.recipe=row.recipe.filter(k=>!k.startsWith('piece:')||names.has(k.slice(6)));next.pieceDecomposition=actual;delete next.pieceInstances;delete next.pieceDesigner;delete next.frameDesigner;}
  next.placementScore=Placement.score(design,next.recipe,row.shape);out.push(next);
 }
 return out;
}
module.exports={reposition};
