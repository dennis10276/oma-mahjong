'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads'),M=require('./meter.js'),E=require('./empirical_moves.js'),Confirm=require('./piece_confirm.js'),Moves=require('./moves.js');
const read=f=>JSON.parse(fs.readFileSync(f));
function steer(job){const meter=M.createMeter(),options={setting:'family',runs:20,seeds:2},a=meter.measure(job.row.design,{...options,seed:4711,capture:'tail'}),b=meter.measure(job.row.design,{...options,seed:18427}),md=meter.measure(job.row.design,{...options,seed:4711,setting:'planner'}),before={family:(a.expectedTries+b.expectedTries)/2,skilled:md.expectedTries,captures:[a,b]};
 if(!a.valid||!b.valid||!md.valid)return{input:job.row.id,error:'Invalid baseline measurement'};
 const moves=E.propose(job.row,before,job.slot,{protectedIds:new Set(job.protectedIds),protectedCreations:new Set(job.protectedCreations)}).filter(r=>!job.seen.includes(r.id)).slice(0,job.budget??4),results=[];
 for(const row of moves){const result=Confirm.confirm(row,meter),meta={...result,mode:'confirm'};for(const mode of['rate','quality'])M.atomicJson(path.join(job.dir,row.id+'.'+mode+'.json'),result[mode]);M.atomicJson(path.join(job.dir,row.id+'.confirm.json'),meta);
  const entry={id:row.id,parent:job.row.id,level:job.slot.level,target:job.slot.productionAim??job.slot.target,n:row.n,recipe:row.recipe,what:row.empiricalChange.what,before:before.family,after:result.family,skilledBefore:before.skilled,skilledAfter:result.skilledBot,valid:result.valid,quality:result.quality.eligible};
  Moves.record(entry);fs.appendFileSync(path.join(job.dir,'measured-steering.jsonl'),JSON.stringify(entry)+'\n');results.push({row,result});
  console.log('empirical step',row.id,JSON.stringify(entry));
 }
 return{input:job.row.id,before:{family:before.family,skilled:before.skilled},results};}
if(!isMainThread&&require.main===module)parentPort.on('message',job=>{const start=Date.now();try{parentPort.postMessage({...steer(job),seconds:(Date.now()-start)/1000});}catch(e){parentPort.postMessage({input:job.row.id,error:e.stack});}});
else{
 async function run(jobs,dir,workers=4){fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'steering.json'),config=M.digest({jobs,source:M.sourceHash(__filename)}),state=fs.existsSync(file)?read(file):{config,done:[],results:[]};if(state.config!==config)throw Error('Empirical steering changed; use another round directory');const queue=jobs.filter(j=>!state.done.includes(j.row.id));
  await Promise.all(Array.from({length:Math.min(workers,queue.length)},()=>new Promise((resolve,reject)=>{const worker=new Worker(__filename);worker.on('error',reject);const next=()=>{const j=queue.shift();if(j)worker.postMessage(j);else worker.terminate().then(resolve,reject);};worker.on('message',r=>{if(r.error){worker.terminate();reject(Error(r.error));return;}state.done.push(r.input);state.results.push(r);M.atomicJson(file,state);console.log('steered',r.input,r.results.length,r.seconds+'s');next();});next();})));
  return state.results;
 }
 module.exports={steer,run};
 if(require.main===module)run(read(process.argv[2]),process.argv[3],+(process.argv[4]||4)).catch(e=>{console.error(e);process.exitCode=1;});
}
