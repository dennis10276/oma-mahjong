'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads');
const I=require('../lab/ideas.js'),Hard=require('../../www/hard.js'),D=require('./piece_designer.js'),C=require('./compose.js'),P=require('./pieces.js');
const M=require('./meter.js'),O=require('./originality.js'),Placement=require('./placement_score.js'),Confirm=require('./piece_confirm.js');
const read=f=>JSON.parse(fs.readFileSync(f)),baseOf=r=>r.shape.split(' · ')[0];
function pointFits(row,s){return Math.abs(row.predicted.family.tries-s.target)<=.5&&row.predicted.skilled.tries>=2.5&&row.predicted.skilled.tries<=6;}
function intervalFits(row,s){const f=row.predicted.family.interval,k=row.predicted.skilled.interval;return f[0]<=s.target+.5&&f[1]>=s.target-.5&&k[0]<=6&&k[1]>=2.5;}
function compatibleShape(row,s,picks){return picks.every(p=>Math.abs(p.level-s.level)>10||baseOf(p)!==baseOf(row));}
function build(job){
  const {pile,slots,model,effects,seed,batchId}=job;
  let base=null;for(let attempt=0;attempt<2;attempt++){
    const raw=Hard.makeNow(200,1.6,1,seed+attempt*1777,{tiles:pile.tiles.map(([x,y,z])=>({x,y,z}))});
    if(!raw.solution)continue;const b={...raw,clock:null,down:[],gold:[],obst:{ice:{},keys:[],locks:[]}};delete b.clockMate;delete b.trapObjectives;delete b.pieceInstances;
    if(I.valid(b)){base=b;break;}
  }
  if(!base)return {pile:pile.level,rows:[],reason:'no valid neutral pairing'};
  const hint=slots[pile.level%slots.length],result=D.suggest(base,hint,model,effects,{seed,shape:pile.shape,creationId:batchId+'/pile-'+pile.level,creationSlot:pile.level,placements:36,wanted:4,milliseconds:12000});
  for(const row of result.rows){row.origin.layoutSeed=pile.seed;row.origin.pairingSeed=seed;
    row.predictedSlots=slots.filter(s=>pointFits(row,s)).map(s=>s.level);row.intervalSlots=slots.filter(s=>intervalFits(row,s)).map(s=>s.level);}
  return {pile:pile.level,...result};
}
function selectPredictions(plan,rows,kept,options={}){
  const remaining=plan.levels.filter(s=>!s.keepId).slice(),picks=kept.map(r=>({...r,level:plan.levels.find(s=>s.keepId===r.id)?.level??r.keptAt??r.level})),selected=[],used=new Set(kept.map(r=>r.origin.creationId)),recipes=new Map();
  for(const r of kept){const key=[...new Set(r.recipe)].sort().join('+');recipes.set(key,(recipes.get(key)||0)+1);}
  const key=r=>[...new Set(r.recipe)].sort().join('+');
  const choices=(s,interval)=>rows.filter(r=>!used.has(r.origin.creationId)&&Placement.slotAllows(r,s)&&compatibleShape(r,s,picks)&&
    (recipes.get(key(r))||0)<(plan.originality?.maxSameRecipe??3)&&(interval?intervalFits(r,s):pointFits(r,s)));
  function choose(interval,budget){
    let count=0;while(remaining.length&&count<budget){const candidates=remaining.map(s=>({s,rows:choices(s,interval)})).filter(x=>x.rows.length);
      if(!candidates.length)break;candidates.sort((a,b)=>Number(b.s.big)-Number(a.s.big)||a.rows.length-b.rows.length||a.s.level-b.s.level);
      const {s,rows:available}=candidates[0];available.sort((a,b)=>D.slotObjective(a.predicted,s.target)-D.slotObjective(b.predicted,s.target));const row=available[0];
      selected.push({...row,target:s.target,placementTargetLevel:s.level,selectionBasis:interval?'uncertainty-overlap':'predicted-point-on-curve'});
      picks.push({...row,level:s.level});used.add(row.origin.creationId);recipes.set(key(row),(recipes.get(key(row))||0)+1);remaining.splice(remaining.indexOf(s),1);count++;
    }
  }
  choose(false,remaining.length);choose(true,options.intervalBudget??0);
  return {selected,missing:remaining.map(s=>s.level),pointSelected:selected.filter(r=>r.selectionBasis==='predicted-point-on-curve').length,
    intervalSelected:selected.filter(r=>r.selectionBasis==='uncertainty-overlap').length,method:'bounded greedy prediction placement; not a maximum-coverage proof'};
}
if(!isMainThread&&require.main===module)parentPort.on('message',job=>{try{parentPort.postMessage(build(job));}catch(e){parentPort.postMessage({pile:job.pile.level,rows:[],error:e.stack});}});
else{
 async function generate(planFile,poolFile,modelFile,effectsFile,dir,jobs=4){
  const plan=read(planFile),pool=read(poolFile),model=read(modelFile),effects=read(effectsFile),piles=read(path.resolve(path.dirname(planFile),plan.piles)),kept=pool.filter(r=>plan.levels.some(s=>s.keepId===r.id));
  const playedFile=path.join(path.dirname(planFile),'played-layouts.json'),played=plan.playedLayouts||(fs.existsSync(playedFile)?read(playedFile):[]);
  const reserved=new Set([...played.map(r=>typeof r==='string'?r:r.layout),...kept.map(r=>O.layoutKey(r.design))]);
  const available=piles.filter(p=>p.tiles.length>=72&&!/^block|^blob/.test(p.shape)&&!reserved.has(O.layoutKey(p))).map(pile=>({pile,
    slots:plan.levels.filter(s=>!s.keepId&&s.big===(pile.tiles.length>88)&&compatibleShape(pile,s,kept.map(r=>({...r,level:plan.levels.find(s=>s.keepId===r.id).level}))))})).filter(x=>x.slots.length);
  if(model.bot!==M.createMeter().fingerprint)throw Error('Composition model uses a different bot');
  const config=M.digest({plan,piles,reserved:[...reserved].sort(),model:model.input,modelSource:model.featureSource,effects,implementation:M.sourceHash(__filename)}),file=path.join(dir,'piece-generation.json');fs.mkdirSync(dir,{recursive:true});
  const state=fs.existsSync(file)?read(file):{config,done:[],results:[]};if(state.config!==config)throw Error('Piece factory generation changed; use a new construction directory');
  const queue=available.filter(x=>!state.done.includes(x.pile.level));console.log('Fresh piece layouts',queue.length,'remaining;',reserved.size,'played layouts reserved');
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);
    const next=()=>{const job=queue.shift();if(job)w.postMessage({...job,model,effects,seed:(plan.pieceSeed??317000)+job.pile.level*997,batchId:plan.batchId});else w.terminate().then(resolve,reject);};
    w.on('message',r=>{state.done.push(r.pile);state.results.push(r);M.atomicJson(file,state);console.log('piece layout',r.pile,'candidates',r.rows.length,r.error||r.reason||r.seconds+'s');next();});next();})));
  const rows=[...new Map(state.results.flatMap(r=>r.rows).map(r=>[r.id,r])).values()];M.atomicJson(path.join(dir,'piece-candidates.json'),rows);return rows;
 }
 async function run(planFile,dir,modelFile,effectsFile,jobs=4,botJobs=6){
  const poolFile=path.join(dir,'pool.json'),plan=read(planFile),initial=read(poolFile),model=read(modelFile),effects=read(effectsFile);
  const rows=await generate(planFile,poolFile,modelFile,effectsFile,path.join(dir,'construction'),jobs),kept=initial.filter(r=>plan.levels.some(s=>s.keepId===r.id));
  const selection=selectPredictions(plan,rows,kept,{intervalBudget:plan.pieceModelIntervalBudget??0});M.atomicJson(path.join(dir,'prediction-plan.json'),selection);
  M.atomicJson(path.join(dir,'pre-confirmation-predictions.json'),selection.selected);
  const first=await Confirm.run(selection.selected,dir,botJobs);M.atomicJson(path.join(dir,'initial-confirmations.json'),first);
  const edits=[];
  for(const row of selection.selected){const result=first.find(r=>r.id===row.id);if(!result?.valid)continue;const s=plan.levels.find(s=>s.level===row.placementTargetLevel);
    if(Math.abs(result.family-s.target)<=plan.tolerance&&result.skilledBot>=plan.skilledMin&&result.skilledBot<=plan.skilledMax)continue;
    const edited=D.tuneOne(row,{family:result.family,skilled:result.skilledBot},s,model,effects);if(edited)edits.push(edited);
  }
  M.atomicJson(path.join(dir,'one-piece-repairs.json'),edits);const repaired=await Confirm.run(edits,dir,botJobs);M.atomicJson(path.join(dir,'repair-confirmations.json'),repaired);
  const merged=[...new Map([...initial,...selection.selected,...edits].map(r=>[r.id,r])).values()];
  const trainingFile=path.join(path.dirname(modelFile),'training-data.json'),training=fs.existsSync(trainingFile)?new Map(read(trainingFile).map(r=>[r.id,r])):null;
  for(const row of merged){row.pieceDecomposition=P.decompose(row.design);row.predicted??=C.predict(model,row);const known=training?.get(M.boardKey(row.design));
    row.predictionTrainingOverlap=training?{family:!!known?.family,skilled:!!known?.skilled}:null;
    if(!row.pieces)row.pieces=row.pieceDecomposition.pieces.map(({name,params})=>({name,params}));}
  M.atomicJson(poolFile,merged);
  await require('./final_seed.js').run(planFile,poolFile,dir,botJobs);
  const resolvedPlan={...plan,levelTable:path.resolve(path.dirname(planFile),plan.levelTable)},result=require('./batch_assign.js').assign(resolvedPlan,merged,dir,3000000,false,true);
  M.atomicJson(path.join(dir,'piece-coverage.json'),{qualified:result.rows?.length||0,coverage:result.coverage,nodes:result.nodes,missingPredictionSlots:selection.missing});
  console.log('FINISHED piece factory; qualified',result.rows?.length||0,'/',plan.levels.length);return result;
 }
 module.exports={build,pointFits,intervalFits,selectPredictions,generate,run};
 if(require.main===module)run(process.argv[2],process.argv[3],process.argv[4],process.argv[5],+(process.argv[6]||4),+(process.argv[7]||6)).catch(e=>{console.error(e);process.exitCode=1;});
}
