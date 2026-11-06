'use strict';
// A physical rewrite of an unsuccessful free-clock puzzle. The existing locks
// become the clock objective; no extra lock/ice, face swap or spare adjustment.
const I=require('../lab/ideas.js'),M=require('./meter.js'),P=require('./pieces.js'),Placement=require('./placement_score.js'),Composer=require('./trap_composer.js'),{roomProfile}=require('./design_traps.js');
function rebuildClock(row,options={}){
 if(options.protectedIds?.has(row.id)||options.protectedCreations?.has(row.origin?.creationId)||row.factoryKeep)return[];
 if(!row.recipe?.some(r=>r==='keyToEscape'||r==='dontGrab'))return[];
 const d=row.design;if(d.clockMate===undefined||d.obst.keys.length!==2)return[];
 const spare=P.spareOf(d),out=[],c=I.ctxOf(d),targets=[...d.obst.locks].filter(i=>i!==d.clock.i).sort((a,b)=>(a===d.clockMate?-1:b===d.clockMate?1:Math.abs(c.pos[a]-c.pos[d.clock.i])-Math.abs(c.pos[b]-c.pos[d.clock.i])));
 for(const i of targets.slice(0,options.limit??3)){
  const edited={...d,clock:{i,n:999},down:d.down.filter(j=>j!==i)};delete edited.clockMate;
  I.setExact(true,{nodes:25000,milliseconds:700});const design=I.withSearchBudget(Date.now()+1600,()=>I.fix(edited,spare));
  if(!design||!I.valid(design)||P.spareOf(design)!==spare||row.playerFeedback&&!Placement.readable(design))continue;
  const room=roomProfile(design);if(!room.ok||room.unrelieved>1)continue;
  const recipe=['lockedClock',...row.recipe.filter(k=>k!=='keyToEscape'&&k!=='dontGrab')],key=M.boardKey(design),next={...row,id:key.slice(0,16),design,recipe,room,forcePlanner:true,
   brief:'Pair the existing keys before taking the locked clock; reserve tray room through their covered route.',
   tunedFrom:row.id,edit:'clock moved from free lure to existing locked route',
   production:{...row.production,method:'empirical-clock-route-rebuild-v1',sparePolicy:'preserved from parent'},
   empiricalChange:{what:'clock moved to existing lock',kind:'clockRouteRebuild',parent:row.id,patch:P.diff(d,design)},
   trapPlan:{...row.trapPlan,recipe,authoredBoard:key,analysis:Composer.analyze(design),structuralScore:undefined,
    steps:[{recipe:'lockedClock',clock:i,keys:design.obst.keys.slice(),locks:design.obst.locks.slice(),rebuiltFrom:row.id}],
    gradeHistory:[...(row.trapPlan?.gradeHistory||[]),{priorRecipe:row.recipe,priorBoard:M.boardKey(d),what:'physically moved clock to existing lock; removed free-clock claim'}]}};
  // Old motif/piece instances describe a different objective.
  delete next.predicted;delete next.pieceDesigner;delete next.frameDesigner;delete next.pieceInstances;
  next.placementScore=Placement.score(design,recipe,row.shape);out.push(next);
 }
 return out;
}
module.exports={rebuildClock};
