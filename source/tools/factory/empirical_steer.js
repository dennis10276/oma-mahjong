'use strict';
const fs=require('fs'),path=require('path'),{isMainThread,parentPort}=require('worker_threads');
const M=require('./meter.js'),E=require('./empirical_moves.js'),Confirm=require('./empirical_confirm.js'),Moves=require('./moves.js');
const read=f=>JSON.parse(fs.readFileSync(f));
function prepare(job,meter=M.createMeter()){
 const opts={setting:'family',runs:20,seeds:2},a=meter.measure(job.row.design,{...opts,seed:4711,capture:'tail'}),b=meter.measure(job.row.design,{...opts,seed:18427});
 if(!a.valid||!b.valid)throw Error('Invalid baseline family measurement');
 const load=mode=>{const f=path.join(job.dir,job.row.id+'.'+mode+'.json');return fs.existsSync(f)?read(f):null;},q=load('quality'),c=load('confirm'),key=M.boardKey(job.row.design);
 const skilled=q?.key===key&&q.bot===meter.fingerprint&&(q.skilled?.botValid??q.skilled?.valid)?q.skilled.botExp??q.skilled.exp:c?.key===key&&c.bot===meter.fingerprint&&c.valid?c.skilledBot:null;
 const before={family:(a.expectedTries+b.expectedTries)/2,skilled:skilled??null,captures:[a,b],quality:q};
 const all=E.propose(job.row,before,job.slot,{protectedIds:new Set(job.protectedIds),protectedCreations:new Set(job.protectedCreations),priors:job.priors,breadth:job.breadth}).filter(r=>!job.seen.includes(r.id));
 const first=[],rest=[],kinds=new Set();for(const row of all){const kind=row.empiricalChange.kind;if(kinds.has(kind))rest.push(row);else{first.push(row);kinds.add(kind);}}
 return{input:job.row.id,before:{family:before.family,skilled:before.skilled},proposals:[...first,...rest].slice(0,job.budget??4),results:[]};
}
function measureChild(job,meter=M.createMeter()){
 const {row,before}=job,B=require('./batch_evaluate.js'),base=B.evaluate(row,'rate',meter),rate={id:row.id,key:M.boardKey(row.design),bot:meter.fingerprint,mode:'rate',...base};
 M.atomicJson(path.join(job.dir,row.id+'.rate.json'),rate);
 if(!rate.train||!rate.validation)return{row,result:{id:row.id,valid:false,family:null,skilledBot:null,rate,quality:{eligible:false,reason:rate.reason||'incompleteFamily'}}};
 const family=(rate.train.exp+rate.validation.exp)/2,[lo,hi]=job.slot.productionBand||[job.slot.target-1,job.slot.target+1];
 const near=job.plan&&job.kept?require('./empirical_slots.js').compatibleSlots(job.plan,job.kept,row,rate).length>0:family>=lo&&family<=hi&&Math.abs(rate.train.exp-rate.validation.exp)<=2;
 const result=near?Confirm.confirm(row,meter):{id:row.id,key:M.boardKey(row.design),bot:meter.fingerprint,stage:'family-only',valid:rate.train.valid&&rate.validation.valid,family,skilledBot:null,rate,quality:{eligible:false,reason:'familyFarFromTarget'}};
 if(near){for(const mode of['rate','quality'])M.atomicJson(path.join(job.dir,row.id+'.'+mode+'.json'),result[mode]);M.atomicJson(path.join(job.dir,row.id+'.confirm.json'),result);}
 else M.atomicJson(path.join(job.dir,row.id+'.family-only.json'),result);
 if(job.parent&&before){const entry={id:row.id,parent:job.parent,level:job.slot.level,target:job.slot.productionAim??job.slot.target,n:row.n,recipe:row.recipe,what:row.empiricalChange.what,before:before.family,after:result.family,skilledBefore:before.skilled,skilledAfter:result.skilledBot,valid:result.valid,quality:result.quality.eligible};
  Moves.record(entry);fs.appendFileSync(path.join(job.dir,'measured-steering.jsonl'),JSON.stringify(entry)+'\n');}
 return{row,result};
}
// Retain the synchronous API for callers grading one parent themselves.
function steer(job){const meter=M.createMeter(),state=job.progressFile&&fs.existsSync(job.progressFile)?read(job.progressFile):prepare(job,meter);
 if(job.progressFile)M.atomicJson(job.progressFile,state);
 for(const row of state.proposals)if(!state.results.some(r=>r.row.id===row.id)){state.results.push(measureChild({...job,parent:job.row.id,row,before:state.before},meter));if(job.progressFile)M.atomicJson(job.progressFile,state);}
 return{input:state.input,before:state.before,results:state.results};
}
if(!isMainThread&&require.main===module){const meter=M.createMeter();parentPort.on('message',job=>{const start=Date.now();try{
 const value=job.action==='prepare'?prepare(job,meter):job.action==='measure'?measureChild(job,meter):steer(job);
 parentPort.postMessage({parent:job.parent??job.row.id,value,seconds:(Date.now()-start)/1000});
 }catch(e){parentPort.postMessage({parent:job.parent??job.row.id,error:e.stack});}});}
else{
 async function run(jobs,dir,workers=4){
  if(new Set(jobs.map(j=>j.row.id)).size!==jobs.length)throw Error('Use one grading job per parent in a round');
  fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'steering.json'),config=M.digest({jobs,source:M.sourceHash(__filename)}),saved=fs.existsSync(file)?read(file):null;
  if(saved&&saved.config!==config)throw Error('Empirical steering changed; use another round directory');
  const states=new Map(),progress=id=>path.join(path.resolve(dir),id+'.progress.json');
  M.atomicJson(file,saved||{config,done:[],results:[]});
  for(const job of jobs)if(fs.existsSync(progress(job.row.id)))states.set(job.row.id,read(progress(job.row.id)));
  const pool=require('./empirical_workers.js').pool;
  await pool(jobs.filter(j=>!states.has(j.row.id)).map(j=>({...j,action:'prepare'})),__filename,r=>{states.set(r.parent,r.value);M.atomicJson(progress(r.parent),r.value);console.log('prepared parent',r.parent,r.value.proposals.length,'boards');},workers);
  const tasks=jobs.flatMap(j=>{const s=states.get(j.row.id);return s.proposals.filter(row=>!s.results.some(r=>r.row.id===row.id)).map(row=>({...j,action:'measure',parent:j.row.id,row,before:s.before}));});
  const checkpoint=()=>M.atomicJson(file,{config,done:jobs.filter(j=>{const s=states.get(j.row.id);return s.results.length===s.proposals.length;}).map(j=>j.row.id),results:jobs.map(j=>{const s=states.get(j.row.id);return{input:s.input,before:s.before,results:s.results};})});
  checkpoint();console.log('Grading',tasks.length,'boards in one bounded',workers,'worker pool');
  await pool(tasks,__filename,r=>{const s=states.get(r.parent);s.results.push(r.value);M.atomicJson(progress(r.parent),s);checkpoint();console.log('graded board',r.value.row.id,JSON.stringify({parent:r.parent,family:r.value.result.family,skilled:r.value.result.skilledBot,quality:r.value.result.quality.eligible,seconds:r.seconds}));},workers);
  checkpoint();return read(file).results;
 }
 module.exports={prepare,measureChild,steer,run};
 if(require.main===module)run(read(process.argv[2]),process.argv[3],+(process.argv[4]||4)).catch(e=>{console.error(e);process.exitCode=1;});
}
