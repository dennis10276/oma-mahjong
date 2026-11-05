'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads');
const {createMeter,atomicJson,boardKey,digest}=require('./meter.js');
const SCHEMA='piece-measure-v1';
function campaignSpread(m){const values=m.results.map(r=>r.wonOn??r.attempts.length),mean=values.reduce((n,v)=>n+v,0)/values.length;
  return {n:values.length,mean,sd:Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/Math.max(1,values.length-1)),atCap:values.filter(v=>v>=20).length};}
function measure(sample,meter){
  const opts={runs:20,seeds:2,seed:4711},a=meter.measure(sample.design,{...opts,setting:'family'}),b=meter.measure(sample.design,{...opts,setting:'family',seed:18427}),s=meter.measure(sample.design,{...opts,setting:'planner'});
  return {schema:SCHEMA,id:sample.id,board:boardKey(sample.design),bot:meter.fingerprint,input:digest(sample),valid:a.valid&&b.valid&&s.valid,
    family:{exp:(a.expectedTries+b.expectedTries)/2,seeds:[a.expectedTries,b.expectedTries],first:(a.firstTryRate+b.firstTryRate)/2,spread:[campaignSpread(a),campaignSpread(b)]},
    skilled:{exp:s.expectedTries,first:s.firstTryRate,styles:s.plannerStyles,spread:campaignSpread(s)},sample};
}
if(!isMainThread){const meter=createMeter();parentPort.on('message',sample=>{const started=Date.now(),calls=meter.stats.calls,hits=meter.stats.hits;
  try{parentPort.postMessage({...measure(sample,meter),seconds:(Date.now()-started)/1000,calls:meter.stats.calls-calls,hits:meter.stats.hits-hits});}
  catch(e){parentPort.postMessage({id:sample.id,error:e.stack});}});
}else{
 async function run(input,dir,jobs=6){const rows=typeof input==='string'?JSON.parse(fs.readFileSync(input)):input,meter=createMeter();fs.mkdirSync(dir,{recursive:true});
  const results=[],queue=[];
  for(const row of rows){const file=path.join(dir,row.id+'.piece.json'),saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
   if(saved?.schema===SCHEMA&&saved.bot===meter.fingerprint&&saved.input===digest(row)&&saved.valid)results.push(saved);else queue.push(row);}
  console.log('piece measurements',queue.length,'new,',results.length,'cached');
  await Promise.all(Array.from({length:Math.min(jobs,queue.length)},()=>new Promise((resolve,reject)=>{const w=new Worker(__filename);w.on('error',reject);
   const next=()=>{const row=queue.shift();if(row)w.postMessage(row);else w.terminate().then(resolve,reject);};
   w.on('message',r=>{atomicJson(path.join(dir,r.id+'.piece.json'),r);results.push(r);console.log('piece',r.id,r.error||JSON.stringify({family:r.family.exp,skilled:r.skilled.exp,valid:r.valid,seconds:r.seconds}));next();});next();})));
  atomicJson(path.join(dir,'measurements.json'),results);return results;
 }
 module.exports={SCHEMA,measure,campaignSpread,run};
 if(require.main===module)run(process.argv[2],process.argv[3],+(process.argv[4]||6)).catch(e=>{console.error(e);process.exitCode=1;});
}
