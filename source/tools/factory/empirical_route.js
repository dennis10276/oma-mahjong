'use strict';
// Move the clock and its existing lock along the authored route. The component
// moves with its owned tile, rather than leaving an ornamental lock behind.
const I=require('../lab/ideas.js'),M=require('./meter.js'),P=require('./pieces.js'),Placement=require('./placement_score.js'),Composer=require('./trap_composer.js'),{roomProfile}=require('./design_traps.js');
function moveLockedClock(row,offsets,options={}){
 if(options.protectedIds?.has(row.id)||options.protectedCreations?.has(row.origin?.creationId)||row.factoryKeep)return[];
 const d=row.design,o=d.obst,old=d.clock.i;if(!o.locks.includes(old)||o.ice[old]||d.clockMate!==undefined)return[];
 const c=I.ctxOf(d),at=c.pos[old],spare=P.spareOf(d),out=[],seen=new Set();
 for(const offset of offsets){const i=c.P[at+offset];if(i===undefined||i===old||o.keys.includes(i)||o.locks.includes(i)||o.ice[i]||seen.has(i))continue;seen.add(i);
  const edited={...d,clock:{i,n:999},obst:{...o,locks:o.locks.map(j=>j===old?i:j)},down:d.down.filter(j=>j!==i)};
  I.setExact(true,{nodes:25000,milliseconds:600});const design=I.withSearchBudget(Date.now()+1400,()=>I.fix(edited,spare));
  if(!design||!I.valid(design)||P.spareOf(design)!==spare||row.playerFeedback&&!Placement.readable(design))continue;
  const room=roomProfile(design);if(!room.ok||room.unrelieved>1)continue;
  const key=M.boardKey(design),next={...row,id:key.slice(0,16),design,room,forcePlanner:true,tunedFrom:row.id,edit:'locked clock moved along existing route',
   production:{...row.production,method:'empirical-clock-route-grade-v1',offset,sparePolicy:'unchanged'},
   empiricalChange:{what:'locked clock route moved',kind:'clockReposition',parent:row.id,patch:P.diff(d,design)},
   trapPlan:{...row.trapPlan,authoredBoard:key,structuralScore:undefined,analysis:Composer.analyze(design),
    components:(row.trapPlan?.components||[]).map(x=>({...x,indices:x.kind==='locks'?x.indices.map(j=>j===old?i:j):x.indices.slice()})),
    steps:(row.trapPlan?.steps||[]).map(x=>({...x,repositionedClock:{from:old,to:i}})),gradedFrom:M.boardKey(d)}};
  delete next.predicted;
  if(row.pieceDesigner||row.frameDesigner){const actual=P.decompose(design),names=new Set(actual.pieces.map(p=>p.name));next.priorAuthoringPieces=row.pieces;next.pieces=(row.pieces||[]).filter(p=>names.has(p.name));next.recipe=row.recipe.filter(k=>!k.startsWith('piece:')||names.has(k.slice(6)));next.pieceDecomposition=actual;delete next.pieceInstances;delete next.pieceDesigner;delete next.frameDesigner;}
  next.placementScore=Placement.score(design,next.recipe,row.shape);out.push(next);
 }
 return out;
}
module.exports={moveLockedClock};
