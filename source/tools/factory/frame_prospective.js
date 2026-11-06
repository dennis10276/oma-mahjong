'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads'),assert=require('assert/strict');
const I=require('../lab/ideas.js'),Hard=require('../../www/hard.js'),M=require('./meter.js'),O=require('./originality.js'),D=require('./frame_designer.js'),Placement=require('./placement_score.js'),F=require('./piles_for.js');
const read=f=>JSON.parse(fs.readFileSync(f)),baseOf=r=>r.shape.split(' · ')[0],VERSION='frame-prospective-v1';
function build(job){const {pile,slots,model,frames,effects,seed,batchId}=job;let base=null;
 for(let k=0;k<2;k++){const raw=Hard.makeNow(200,1.6,1,seed+k*1777,{tiles:pile.tiles.map(([x,y,z])=>({x,y,z}))});if(!raw.solution)continue;const x={...raw,clock:null,down:[],gold:[],obst:{ice:{},keys:[],locks:[]}};delete x.clockMate;delete x.pieceInstances;delete x.pressureFrame;delete x.trapObjectives;if(I.valid(x)){base=x;break;}}
 if(!base)return{pile:pile.level,rows:[],reason:'no valid neutral pairing'};
 const hint=slots[pile.level%slots.length],rows=D.suggest(base,hint,model,frames,effects,{seed,shape:pile.shape,creationId:batchId+'/frame-pile-'+pile.level,creationSlot:pile.level});for(const r of rows){r.origin.layoutSeed=pile.seed;r.origin.pairingSeed=seed;}return{pile:pile.level,rows};}
function select(plan,rows,kept,budget=12){const remaining=plan.levels.filter(s=>!s.keepId),selected=[],used=new Set(kept.map(r=>r.origin.creationId)),picks=kept.map(r=>({...r,level:plan.levels.find(s=>s.keepId===r.id)?.level??r.level}));
 const recipes=new Map();for(const r of picks){const key=[...new Set(r.recipe)].sort().join('+');recipes.set(key,(recipes.get(key)||0)+1);}
 const key=r=>[...new Set(r.recipe)].sort().join('+'),allows=(row,s)=>Placement.slotAllows(row,s)&&(row.n>88)===s.big&&!used.has(row.origin.creationId)&&(recipes.get(key(row))||0)<(plan.originality?.maxSameRecipe??3)&&picks.every(p=>(Math.abs(p.level-s.level)>10||baseOf(p)!==baseOf(row)&&F.share(row.design.tiles,F.spots(p.design.tiles)[0])<=.75)&&!O.compare(row,p,plan.originality?.maxLayoutShare));
 while(remaining.length&&selected.length<budget){let choices=remaining.map(s=>({s,rows:rows.filter(r=>allows(r,s))})).filter(x=>x.rows.length);if(!choices.length)break;
  choices.sort((a,b)=>Number(b.s.big)-Number(a.s.big)||a.rows.length-b.rows.length||a.s.level-b.s.level);const {s,rows:available}=choices[0];
  const point=r=>Math.abs(r.predicted.family.tries-s.target)<=plan.tolerance&&r.predicted.skilled.tries>=2.5&&r.predicted.skilled.tries<=6;
  available.sort((a,b)=>Number(point(b))-Number(point(a))||D.objective(a.predicted,s.target)-D.objective(b.predicted,s.target)||a.id.localeCompare(b.id));const r=available[0];
  selected.push({...r,placementTargetLevel:s.level,target:s.target,selectionBasis:point(r)?'frame-model-point-on-curve':'frame-model-closest-feasible-proposal'});picks.push({...r,level:s.level});used.add(r.origin.creationId);recipes.set(key(r),(recipes.get(key(r))||0)+1);remaining.splice(remaining.indexOf(s),1);
 }
 return{selected,missing:remaining.map(s=>s.level),pointSelected:selected.filter(r=>r.selectionBasis==='frame-model-point-on-curve').length};}
if(!isMainThread&&require.main===module)parentPort.on('message',job=>{const started=Date.now();try{parentPort.postMessage({...build(job),seconds:(Date.now()-started)/1000});}catch(e){parentPort.postMessage({pile:job.pile.level,error:e.stack});}});
else{
 async function generate(planFile,poolFile,modelFile,framesFile,effectsFile,dir,jobs=4){const plan=read(planFile),pool=read(poolFile),model=read(modelFile),frames=read(framesFile),effects=read(effectsFile),piles=read(path.resolve(path.dirname(planFile),plan.piles)),kept=pool.filter(r=>plan.levels.some(s=>s.keepId===r.id));
  const played=plan.playedLayouts||[],reserved=new Set([...played.map(r=>typeof r==='string'?r:r.layout),...kept.map(r=>O.layoutKey(r.design))]),open=plan.levels.filter(s=>!s.keepId),queue=piles.filter(p=>p.tiles.length>=72&&!/^block|^blob/.test(p.shape)&&!reserved.has(O.layoutKey(p))).map(pile=>({pile,slots:open.filter(s=>s.big===(pile.tiles.length>88)&&kept.every(r=>Math.abs((plan.levels.find(s=>s.keepId===r.id)?.level??r.level)-s.level)>10||baseOf(r)!==baseOf(pile)))})).filter(j=>j.slots.length);
  const config=M.digest({plan,model:model.input,frames,effects,piles,source:M.sourceHash(__filename)}),file=path.join(dir,'generation.json');fs.mkdirSync(dir,{recursive:true});const state=fs.existsSync(file)?read(file):{config,done:[],results:[]};if(state.config!==config)throw Error('Prospective generation inputs/source changed; use a new directory');
  const pending=queue.filter(j=>!state.done.includes(j.pile.level));console.log('Frame prospective layouts',pending.length);
  await Promise.all(Array.from({length:Math.min(jobs,pending.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);const next=()=>{const j=pending.shift();if(j)w.postMessage({...j,model,frames,effects,seed:811000+j.pile.level*997,batchId:plan.batchId});else w.terminate().then(resolve,reject);};w.on('message',r=>{if(r.error){w.terminate();reject(Error(r.error));return;}state.done.push(r.pile);state.results.push(r);M.atomicJson(file,state);console.log('frame prospective',r.pile,r.rows.length,r.seconds+'s');next();});next();})));
  const rows=[...new Map(state.results.flatMap(r=>r.rows).map(r=>[r.id,r])).values()];M.atomicJson(path.join(dir,'candidates.json'),rows);return{rows,kept};
 }
 function preregister(planFile,modelFile,dir){fs.mkdirSync(dir,{recursive:true});const plan=read(planFile),model=read(modelFile),file=path.join(dir,'protocol.json');const protocol={version:VERSION,createdAt:new Date().toISOString(),source:M.sourceHash(__filename),modelInput:model.input,modelSource:model.featureSource,bot:model.bot,expected:12,minimumSuccesses:8,targets:plan.levels.filter(s=>!s.keepId).map(s=>({level:s.level,target:s.target,big:s.big})),keep:plan.levels.filter(s=>s.keepId).map(s=>({level:s.level,id:s.keepId})),rules:[
  'Targets are the sixteen slots empty in the accepted v12 handback; part-one reuse matches are provisional alternatives, not additional immutable pins.',
  'Choose twelve distinct new creations by the frozen frame model; exact point predictions are preferred, then closest model-ranked physically feasible proposals. No uncertainty-probe bonus.',
  'Save and hash the exact board list and predictions before any full confirmation. No replacement, refit or parameter change after seeing outcomes.',
  'Success per board requires valid full pooled family within one try of its fixed target AND current skilled 2.5–6 inclusive. Missing boards count as failures out of twelve.',
  'Report seed disagreement and all quality gates separately; numeric test success does not waive a delivery gate.',
  'If fewer than eight succeed, stop model-driven filling; preserve all results and explain failures. The reserved seed never feeds selection or tuning.',
  'A computationally invalid result may be retried on the identical physical board only; all attempts remain in the audit.'
 ]};if(fs.existsSync(file))return read(file);M.atomicJson(file,protocol);return protocol;}
 async function run(planFile,poolFile,modelFile,framesFile,effectsFile,dir,measurements){const protocol=preregister(planFile,modelFile,dir);assert.equal(protocol.modelInput,read(modelFile).input);assert.equal(protocol.source,M.sourceHash(__filename));
  const frozen=path.join(dir,'locked-input.json');let locked;if(fs.existsSync(frozen))locked=read(frozen);else{const made=await generate(planFile,poolFile,modelFile,framesFile,effectsFile,path.join(dir,'construction'));locked=select(read(planFile),made.rows,made.kept,12);M.atomicJson(frozen,locked);M.atomicJson(path.join(dir,'locked-manifest.json'),{lockedAt:new Date().toISOString(),digest:M.digest(locked),physical:locked.selected.map(r=>({id:r.id,board:M.boardKey(r.design),target:r.target,level:r.placementTargetLevel,predicted:r.predicted})),protocol:M.digest(protocol)});}
  assert.equal(M.digest(locked),read(path.join(dir,'locked-manifest.json')).digest);
  const confirmed=await require('./piece_confirm.js').run(locked.selected,measurements,6);M.atomicJson(path.join(dir,'confirmations.json'),confirmed);
  const outcomes=locked.selected.map(row=>{const r=confirmed.find(c=>c.id===row.id);return{id:row.id,level:row.placementTargetLevel,target:row.target,predicted:row.predicted,selectionBasis:row.selectionBasis,family:r?.family,skilled:r?.skilledBot,valid:r?.valid??false,success:!!r?.valid&&Math.abs(r.family-row.target)<=1+1e-9&&r.skilledBot>=2.5&&r.skilledBot<=6,qualityPassed:r?.quality?.eligible??false,qualityReason:r?.quality?.reason??null,seedGap:r?.rate?.validation?Math.abs(r.rate.train.exp-r.rate.validation.exp):null};});
  const successes=outcomes.filter(r=>r.success).length,report={expected:12,selected:outcomes.length,missingCount:12-outcomes.length,successes,required:8,passed:successes>=8,modelInput:protocol.modelInput,locked:M.digest(locked),outcomes};M.atomicJson(path.join(dir,'prospective-result.json'),report);
  console.log('PREREGISTERED RESULT',JSON.stringify({successes,expected:12,passed:report.passed}));return{report,rows:locked.selected};
 }
 module.exports={VERSION,build,select,generate,preregister,run};
 if(require.main===module)run(...process.argv.slice(2,9)).catch(e=>{console.error(e);process.exitCode=1;});
}
