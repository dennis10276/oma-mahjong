'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads'),M=require('./meter.js'),E=require('./empirical_moves.js'),Confirm=require('./empirical_confirm.js'),Moves=require('./moves.js');
const read=f=>JSON.parse(fs.readFileSync(f));
function steer(job){const meter=M.createMeter(),options={setting:'family',runs:20,seeds:2},a=meter.measure(job.row.design,{...options,seed:4711,capture:'tail'}),b=meter.measure(job.row.design,{...options,seed:18427}),qfile=path.join(job.dir,job.row.id+'.quality.json'),cfile=path.join(job.dir,job.row.id+'.confirm.json'),q=fs.existsSync(qfile)?read(qfile):null,c=fs.existsSync(cfile)?read(cfile):null,key=M.boardKey(job.row.design),skilled=q?.key===key&&q.bot===meter.fingerprint&&(q.skilled?.botValid??q.skilled?.valid)?q.skilled.botExp??q.skilled.exp:c?.key===key&&c.bot===meter.fingerprint&&c.valid?c.skilledBot:null,before={family:(a.expectedTries+b.expectedTries)/2,skilled:skilled??null,captures:[a,b],quality:q};
 if(!a.valid||!b.valid)return{input:job.row.id,error:'Invalid baseline family measurement'};
 const progressFile=job.progressFile,progress=progressFile&&fs.existsSync(progressFile)?read(progressFile):null;
 const all=E.propose(job.row,before,job.slot,{protectedIds:new Set(job.protectedIds),protectedCreations:new Set(job.protectedCreations),priors:job.priors,breadth:job.breadth}).filter(r=>!job.seen.includes(r.id)),first=[],rest=[],kinds=new Set();for(const row of all){const kind=row.empiricalChange.kind;if(kinds.has(kind))rest.push(row);else{first.push(row);kinds.add(kind);}}
 const state=progress||{input:job.row.id,proposals:[...first,...rest].slice(0,job.budget??4),results:[]};if(progressFile&&!progress)M.atomicJson(progressFile,state);
 for(const row of state.proposals){if(state.results.some(r=>r.row.id===row.id))continue;
  const B=require('./batch_evaluate.js'),base=B.evaluate(row,'rate',meter),rate={id:row.id,key:M.boardKey(row.design),bot:meter.fingerprint,mode:'rate',...base},family=(rate.train.exp+rate.validation.exp)/2;M.atomicJson(path.join(job.dir,row.id+'.rate.json'),rate);
  const [lo,hi]=job.slot.productionBand||[job.slot.target-1,job.slot.target+1],near=job.plan&&job.kept?require('./empirical_slots.js').compatibleSlots(job.plan,job.kept,row,rate).length>0:family>=lo&&family<=hi&&Math.abs(rate.train.exp-rate.validation.exp)<=2;
  const result=near?Confirm.confirm(row,meter):{id:row.id,key:M.boardKey(row.design),bot:meter.fingerprint,stage:'family-only',valid:rate.train.valid&&rate.validation.valid,family,skilledBot:null,rate,quality:{eligible:false,reason:'familyFarFromTarget'}};
  if(near){for(const mode of['rate','quality'])M.atomicJson(path.join(job.dir,row.id+'.'+mode+'.json'),result[mode]);M.atomicJson(path.join(job.dir,row.id+'.confirm.json'),result);}else M.atomicJson(path.join(job.dir,row.id+'.family-only.json'),result);
  const entry={id:row.id,parent:job.row.id,level:job.slot.level,target:job.slot.productionAim??job.slot.target,n:row.n,recipe:row.recipe,what:row.empiricalChange.what,before:before.family,after:result.family,skilledBefore:before.skilled,skilledAfter:result.skilledBot,valid:result.valid,quality:result.quality.eligible};
  Moves.record(entry);fs.appendFileSync(path.join(job.dir,'measured-steering.jsonl'),JSON.stringify(entry)+'\n');state.results.push({row,result});if(progressFile)M.atomicJson(progressFile,state);
  console.log('empirical step',row.id,JSON.stringify(entry));
 }
 return{input:job.row.id,before:{family:before.family,skilled:before.skilled},results:state.results};}
if(!isMainThread&&require.main===module)parentPort.on('message',job=>{const start=Date.now();try{parentPort.postMessage({...steer(job),seconds:(Date.now()-start)/1000});}catch(e){parentPort.postMessage({input:job.row.id,error:e.stack});}});
else{
 async function run(jobs,dir,workers=4){fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'steering.json'),config=M.digest({jobs,source:M.sourceHash(__filename)}),state=fs.existsSync(file)?read(file):{config,done:[],results:[]};if(state.config!==config)throw Error('Empirical steering changed; use another round directory');const queue=jobs.filter(j=>!state.done.includes(j.row.id));
  await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const worker=new Worker(__filename);worker.on('error',reject);const next=()=>{const j=queue.shift();if(j)worker.postMessage({...j,progressFile:path.join(path.resolve(dir),j.row.id+'.progress.json')});else worker.terminate().then(resolve,reject);};worker.on('message',r=>{if(r.error){worker.terminate();reject(Error(r.error));return;}state.done.push(r.input);state.results.push(r);M.atomicJson(file,state);console.log('steered',r.input,r.results.length,r.seconds+'s');next();});next();})));
  return state.results;
 }
 module.exports={steer,run};
 if(require.main===module)run(read(process.argv[2]),process.argv[3],+(process.argv[4]||4)).catch(e=>{console.error(e);process.exitCode=1;});
}
