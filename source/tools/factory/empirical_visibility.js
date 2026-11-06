'use strict';
const I=require('../lab/ideas.js'),M=require('./meter.js'),P=require('./pieces.js'),Placement=require('./placement_score.js'),Composer=require('./trap_composer.js'),{roomProfile}=require('./design_traps.js');
function grade(row,indices,hidden,options={}){
 if(options.protectedIds?.has(row.id)||options.protectedCreations?.has(row.origin?.creationId)||row.factoryKeep)return null;
 const d=row.design,c=I.ctxOf(d),special=new Set([d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)]);
 if(!indices.length||indices.length>2||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=c.n||hidden&&(special.has(i)||c.free0[i])||d.down.includes(i)===hidden))return null;
 const design={...d,down:hidden?[...d.down,...indices]:d.down.filter(i=>!indices.includes(i))};
 if(design.down.length>c.n/2||!I.valid(design)||row.playerFeedback&&!Placement.readable(design))return null;
 const room=roomProfile(design);if(!room.ok||room.unrelieved>1)return null;
 const key=M.boardKey(design),what=hidden?'luck moment added':indices.length===1?'face-up where the family loses':'two loss-route pictures face-up';
 const next={...row,id:key.slice(0,16),design,room,forcePlanner:true,tunedFrom:row.id,edit:what,
  production:{...row.production,method:'empirical-visibility-grade-v1',sparePolicy:'unchanged'},
  empiricalChange:{what,kind:hidden?'luck':'faceUp',parent:row.id,patch:P.diff(d,design)},
  trapPlan:{...row.trapPlan,authoredBoard:key,analysis:Composer.analyze(design),structuralScore:undefined,gradedFrom:M.boardKey(d)}};
 delete next.predicted;
 if(row.pieceDesigner||row.frameDesigner){const actual=P.decompose(design),names=new Set(actual.pieces.map(p=>p.name));next.priorAuthoringPieces=row.pieces;next.pieces=(row.pieces||[]).filter(p=>names.has(p.name));next.recipe=row.recipe.filter(k=>!k.startsWith('piece:')||names.has(k.slice(6)));next.pieceDecomposition=actual;delete next.pieceInstances;delete next.pieceDesigner;delete next.frameDesigner;}
 next.placementScore=Placement.score(design,next.recipe,row.shape);return next;
}
module.exports={grade};
