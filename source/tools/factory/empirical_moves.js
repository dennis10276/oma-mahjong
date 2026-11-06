'use strict';
// Graded interventions from the measured journal. No extra trap and no spare edit.
const I=require('../lab/ideas.js'),P=require('./pieces.js'),Placement=require('./placement_score.js'),M=require('./meter.js'),Moves=require('./moves.js'),{roomProfile}=require('./design_traps.js');
function lossOrder(measurements){const counts=new Map();for(const m of measurements)for(const r of m.results||[])for(const a of r.attempts||[])if(!a.win&&!a.censored)for(const take of(a.decisions||[]).slice(-5))counts.set(take.index,(counts.get(take.index)||0)+1);return[...counts].sort((a,b)=>b[1]-a[1]).map(([i])=>i);}
function objective(family,skilled,slot){const [lo,hi]=slot.productionBand||[slot.target-1,slot.target+1],distance=Math.max(lo-family,family-hi,0);return distance+2*Math.max(2.5-skilled,skilled-6,0);}
function propose(row,measurement,slot,options={}){
 if(options.protectedIds?.has(row.id)||options.protectedCreations?.has(row.origin.creationId)||row.factoryKeep)return[];
 const d=row.design,c=I.ctxOf(d),spare=P.spareOf(d),rank=lossOrder(measurement.captures||[]),ordered=xs=>[...new Set([...rank.filter(i=>xs.includes(i)),...xs])],special=new Set([d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)]),out=[],seen=new Set([M.boardKey(d)]),aim=slot.productionAim??slot.target;
 const add=(what,edited,structural=false,removedKind=null)=>{
  let design=edited;if(structural){I.setExact(true,{nodes:20000,milliseconds:350});design=I.withSearchBudget(Date.now()+1400,()=>I.fix({...edited,clock:{...edited.clock,n:999}},spare));}
  if(!design||P.spareOf(design)!==spare||JSON.stringify(design.tiles)!==JSON.stringify(d.tiles)||!I.valid(design)||row.playerFeedback&&!Placement.readable(design))return;
  const room=roomProfile(design);if(!room.ok||room.unrelieved>1)return;
  const components=(row.trapPlan?.components||[]).map(x=>({...x,indices:x.indices.filter(i=>x.kind==='ice'?design.obst.ice[i]>0:design.obst.locks.includes(i))}));
  // Do not erase a named mechanism while retaining its recipe as a label.
  if(components.some((x,i)=>!x.indices.length&&(row.trapPlan?.components||[])[i].indices.length&&x.kind!==removedKind))return;
  const id=M.boardKey(design).slice(0,16);if(seen.has(M.boardKey(design)))return;seen.add(M.boardKey(design));
  const next={...row,id,design,room,target:slot.target,placementTargetLevel:slot.level,edit:what,tunedFrom:row.id,forcePlanner:true,
   production:{...row.production,method:'empirical-journal-steering-v1',aim,band:slot.productionBand,step:(row.production?.step||0)+1},
   empiricalChange:{what,kind:Moves.kindOf(what),parent:row.id,before:{family:measurement.family,skilled:measurement.skilled},patch:P.diff(d,design)},
   trapPlan:{...row.trapPlan,authoredBoard:M.boardKey(design),components:components.filter(c=>c.indices.length),analysis:require('./trap_composer.js').analyze(design),structuralScore:undefined,gradedFrom:M.boardKey(d)}};delete next.predicted;
  if(removedKind){next.recipe=require('./original_variants.js').remainingRecipe(row.recipe,[removedKind]);next.trapPlan.recipe=next.recipe;next.trapPlan.steps=(row.trapPlan?.steps||[]).filter(s=>next.recipe.includes(s.recipe));next.trapPlan.gradeHistory=[...(row.trapPlan?.gradeHistory||[]),{what,removedKind,priorRecipe:row.recipe,priorBoard:M.boardKey(d)}];}
  if(row.pieceDesigner||row.frameDesigner){const actual=P.decompose(design),names=new Set(actual.pieces.map(p=>p.name));next.priorAuthoringPieces=row.priorAuthoringPieces||row.pieces;next.pieces=(row.pieces||[]).filter(p=>names.has(p.name));next.recipe=next.recipe.filter(k=>!k.startsWith('piece:')||names.has(k.slice(6)));next.pieceDecomposition=actual;delete next.pieceInstances;delete next.pieceDesigner;delete next.frameDesigner;}
  next.placementScore=Placement.score(design,next.recipe,next.shape);out.push(next);
 };
 const knownSkilled=Number.isFinite(measurement.skilled),softer=measurement.family>aim||knownSkilled&&measurement.skilled>6,harder=measurement.family<aim||knownSkilled&&measurement.skilled<2.5;
 if(measurement.quality?.idle?.includes('ice'))add('idle specials removed',{...d,obst:{...d.obst,ice:{}}},true,'ice');
 if(softer){const ice=ordered(Object.keys(d.obst.ice).map(Number));for(const i of ice.filter(i=>d.obst.ice[i]>=2).slice(0,3))add('one ice softer',{...d,obst:{...d.obst,ice:{...d.obst.ice,[i]:d.obst.ice[i]-1}}},true);
  if(ice.length>=2){const next={...d.obst.ice};for(const i of ice.slice(0,Math.ceil(ice.length/2)))delete next[i];add('half the ice thawed',{...d,obst:{...d.obst,ice:next}},true);}
  for(const i of ordered(d.down).slice(0,4))add('face-up where the family loses',{...d,down:d.down.filter(j=>j!==i)});
 }
 if(harder){const alive=new Uint8Array(c.n).fill(1),candidates=ordered(c.P.filter(i=>!special.has(i)&&!d.down.includes(i)&&!global.Layouts.isFree(i,alive,c.nb)));
  for(const i of candidates.slice(0,4))if(d.down.length<c.n/2)add('luck moment added',{...d,down:[...d.down,i]});
 }
 if(options.allowClock!==false&&!d.obst.locks.includes(d.clock.i)&&!d.obst.ice[d.clock.i]&&d.clockMate===undefined){
  for(const direction of[...(softer?[-1]:[]),...(harder?[1]:[])])for(const delta of[2,4]){const next=c.P[c.pos[d.clock.i]+direction*delta];if(next===undefined||special.has(next))continue;
   if(row.recipe.includes('frozenGuards')&&!c.nb.above[next].some(i=>d.obst.ice[i]))continue;
   if(row.recipe.includes('clockBesideLock')&&![...c.nb.above[next],...c.nb.left[next],...c.nb.right[next]].some(i=>d.obst.locks.includes(i)))continue;
   add('clock route '+(direction<0?'shortened':'lengthened'),{...d,clock:{i:next,n:999},down:d.down.filter(i=>i!==next)},true);
  }
 }
 const priors=options.priors||Moves.priors(),direction=measurement.family<aim?1:-1;
 return out.sort((a,b)=>{const score=r=>{const p=priors[r.empiricalChange.kind];return p?.n>=3?((p.factor-1)*direction>0?0:2)-Math.min(p.n,100)*.001:1;};return score(a)-score(b);});
}
module.exports={lossOrder,objective,propose};
