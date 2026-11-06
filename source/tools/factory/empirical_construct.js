'use strict';
// Fresh whole-board attempts selected by observed recipe hits, never a predictor.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads'),C=require('./construct_original.js'),M=require('./meter.js'),{portable}=require('./candidate_pool.js');
const read=f=>JSON.parse(fs.readFileSync(f));
function explicitBrief(spec){const {alternatives,...brief}=spec;return brief;}
function construct(job){const diagnostic={},row=C.construct(job.pile,explicitBrief(job.spec),job.plan,job.attempt,diagnostic,[]);if(!row)return{key:job.key,diagnostic};
 if(JSON.stringify(row.recipe)!==JSON.stringify(job.spec.recipe))throw Error('Construction changed the empirically selected recipe');
 row.origin.creationId=job.plan.batchId+'/layout-'+job.pile.level;row.origin.creationSlot=job.pile.level;
 const result=portable(row);result.level=job.pile.level;result.placementTargetLevel=job.spec.level;result.target=job.spec.target;result.useHumanSkilled=true;result.forcePlanner=true;
 result.production={method:'empirical-recipe-production-v1',round:job.round,attempt:job.attempt,recipeChoice:job.recipeChoice,aim:job.spec.productionAim??job.spec.target,band:job.spec.productionBand??null,sparePolicy:'fixed initial grade; never a steering lever'};
 return{key:job.key,row:result,diagnostic};}
if(!isMainThread&&require.main===module)parentPort.on('message',job=>{const start=Date.now();try{parentPort.postMessage({...construct(job),seconds:(Date.now()-start)/1000});}catch(e){parentPort.postMessage({key:job.key,error:e.stack});}});
else{
 async function run(jobs,dir,workers=4){fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'construction.json'),config=M.digest({jobs,source:M.sourceHash(__filename)}),state=fs.existsSync(file)?read(file):{config,done:[],results:[],rows:[]};if(state.config!==config)throw Error('Empirical construction inputs/source changed; use a new round directory');const pending=jobs.filter(j=>!state.done.includes(j.key));
  console.log('Empirical construction',pending.length,'attempts remaining');await Promise.all(Array.from({length:Math.min(workers,pending.length)},()=>new Promise((resolve,reject)=>{const worker=new Worker(__filename);worker.on('error',reject);const next=()=>{const job=pending.shift();if(job)worker.postMessage(job);else worker.terminate().then(resolve,reject);};worker.on('message',r=>{if(r.error){worker.terminate();reject(Error(r.error));return;}state.done.push(r.key);state.results.push({...r,row:undefined});if(r.row&&!state.rows.some(x=>x.id===r.row.id))state.rows.push(r.row);M.atomicJson(file,state);console.log('empirical construction',state.done.length,r.row?r.row.id:r.diagnostic?.stage,r.seconds+'s');next();});next();})));
  M.atomicJson(path.join(dir,'input.json'),state.rows);return state.rows;
 }
 module.exports={explicitBrief,construct,run};
 if(require.main===module)run(read(process.argv[2]),process.argv[3],+(process.argv[4]||4)).catch(e=>{console.error(e);process.exitCode=1;});
}
