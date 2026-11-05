'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{Worker,isMainThread,parentPort}=require('worker_threads');
const M=require('./meter.js'),{evaluate}=require('./batch_evaluate.js'),Evidence=require('./skilled_evidence.js');
const SCHEMA='piece-confirmation-v1';
function confirm(row,meter){
  const key=M.boardKey(row.design);assert.equal(row.id,key.slice(0,16));
  const opts={runs:20,seeds:2,seed:4711,setting:'family'},base=evaluate(row,'rate',meter);
  // Every prospective confirmation gets both full family seeds, even when the
  // first score is outside the ordinary queue's coarse rating band.
  let rate=base;if(!base.validation){const v=meter.measure(row.design,{...opts,seed:18427});rate={...base,validation:{exp:v.expectedTries,first:v.firstTryRate,valid:v.valid,seed:18427}};}
  const md=meter.measure(row.design,{...opts,setting:'planner'}),effective=Evidence.rating(row,md.expectedTries,md.valid);
  const quality=evaluate({...row,forcePlanner:true},'quality',meter),meta={id:row.id,key,bot:meter.fingerprint};
  return {schema:SCHEMA,...meta,valid:rate.train?.valid&&rate.validation.valid&&md.valid,
    family:(rate.train.exp+rate.validation.exp)/2,skilledBot:md.expectedTries,skilledEffective:effective.exp,
    predicted:row.predicted,pieceChange:row.pieceChange||null,placementTargetLevel:row.placementTargetLevel,
    rate:{...meta,mode:'rate',...rate},quality:{...meta,mode:'quality',...quality}};
}
if(!isMainThread&&require.main===module){const meter=M.createMeter();parentPort.on('message',({row,config})=>{const started=Date.now(),calls=meter.stats.calls,hits=meter.stats.hits;
  try{parentPort.postMessage({...confirm(row,meter),config,calls:meter.stats.calls-calls,hits:meter.stats.hits-hits,seconds:(Date.now()-started)/1000});}
  catch(e){parentPort.postMessage({id:row.id,config,error:e.stack});}});
}else{
 async function run(input,dir,jobs=6){const rows=typeof input==='string'?JSON.parse(fs.readFileSync(input)):input,meter=M.createMeter(),implementation=M.sourceHash(__filename),queue=[],results=[];
  fs.mkdirSync(dir,{recursive:true});
  for(const row of rows){const config=M.digest({schema:SCHEMA,row,bot:meter.fingerprint,implementation}),file=path.join(dir,row.id+'.confirm.json'),saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
    if(saved?.config===config&&saved.valid){results.push(saved);for(const mode of ['rate','quality'])if(!fs.existsSync(path.join(dir,row.id+'.'+mode+'.json')))M.atomicJson(path.join(dir,row.id+'.'+mode+'.json'),saved[mode]);}
    else queue.push({row,config});}
  console.log('Confirming piece designs:',queue.length,'new,',results.length,'cached');
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);
    const next=()=>{const item=queue.shift();if(item)w.postMessage(item);else w.terminate().then(resolve,reject);};
    w.on('message',r=>{M.atomicJson(path.join(dir,r.id+'.confirm.json'),r);if(!r.error)for(const mode of ['rate','quality'])M.atomicJson(path.join(dir,r.id+'.'+mode+'.json'),r[mode]);
      results.push(r);console.log('confirmation',r.id,r.error||JSON.stringify({family:r.family,skilled:r.skilledBot,quality:r.quality.eligible,reason:r.quality.reason,seconds:r.seconds}));next();});next();})));
  return results;
 }
 module.exports={SCHEMA,confirm,run};
 if(require.main===module)run(process.argv[2],process.argv[3],+(process.argv[4]||6)).catch(e=>{console.error(e);process.exitCode=1;});
}
