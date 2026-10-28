'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {spawn}=require('child_process'),{performance}=require('perf_hooks');
const {measureHuman}=require('./human_style_measure.js');
const {CONTRACT,summarize}=require('./human_style_benchmark.js');
const {captureSources}=require('./human_level_sources.js');
const snapshot=captureSources(module);
function json(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function worker(file){
 const job=JSON.parse(fs.readFileSync(file));assert.equal(snapshot.hash,job.sourceHash);
 let valid=true;
 for(const e of job.entries){
  snapshot.verify();
  const measure=measureHuman(e.game,{runs:CONTRACT.runs,seed:CONTRACT.seed,maxAttempts:job.maxAttempts,profiles:job.profiles});
  valid=valid&&measure.valid;
  fs.appendFileSync(path.join(path.dirname(file),'records.jsonl'),JSON.stringify({lv:e.lv,
   boardSource:e.boardSource,historicalBoardExact:e.historicalBoardExact,measure})+'\n');
 }
 snapshot.verify();if(!valid)process.exitCode=2;
}
async function main(args=process.argv.slice(2)){
 if(args[0]==='--worker')return worker(args[1]);
 const [catalogFile,out,attempts='1',profileFile='',jobs='4']=args;
 assert(catalogFile&&out,'Usage: parallel_benchmark.js catalog.json new-out-dir [attempts=1] [profiles.json] [jobs=4]');
 const maxAttempts=Number(attempts),workers=Number(jobs),started=performance.now();
 assert(Number.isInteger(workers)&&workers>=1&&workers<=4);
 assert(Number.isInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=12);
 const output=path.resolve(out);assert(!fs.existsSync(output),'Use a new output directory');
 fs.mkdirSync(output,{recursive:true});
 const root=path.resolve(__dirname,'../../..');
 for(const file of snapshot.files){const to=path.join(output,'sources',file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,file),to,fs.constants.COPYFILE_EXCL);}
 json(path.join(output,'source-manifest.json'),{hash:snapshot.hash,files:snapshot.files});
 const catalog=JSON.parse(fs.readFileSync(catalogFile)),profiles=profileFile?JSON.parse(fs.readFileSync(profileFile)):require('./human_style_profiles.json');
 const entries=catalog.entries.filter(e=>e.lv>=92&&e.lv<=163||CONTRACT.risk.includes(e.lv)).sort((a,b)=>a.lv-b.lv);
 assert.equal(entries.length,74);assert.equal(new Set(entries.map(e=>e.lv)).size,74);
 json(path.join(output,'catalog.json'),{observedAt:catalog.observedAt,entries});
 json(path.join(output,'profiles.json'),profiles);json(path.join(output,'contract.json'),CONTRACT);
 // Each child runs one single-threaded game at a time. No simulation is
 // restarted on observation timeout; native close events are authoritative.
 const children=[],exits=await Promise.all(Array.from({length:workers},(_,i)=>new Promise(resolve=>{
  const dir=path.join(output,'worker-'+i);fs.mkdirSync(dir);
  const task=path.join(dir,'task.json');json(task,{sourceHash:snapshot.hash,maxAttempts,profiles,entries:entries.filter((_,n)=>n%workers===i)});
  const log=fs.openSync(path.join(dir,'native.log'),'wx');
  const child=spawn(process.execPath,[__filename,'--worker',task],{windowsHide:true,stdio:['ignore',log,log]});
  fs.closeSync(log);children.push(child);
  child.on('error',error=>{for(const own of children)if(own!==child)own.kill();resolve({worker:i,exitCode:null,error:error.message});});
  child.on('close',(code,signal)=>resolve({worker:i,pid:child.pid,exitCode:code,signal}));
 })));
 json(path.join(output,'worker-exits.json'),exits);snapshot.verify();
 assert(exits.every(e=>e.exitCode===0),'A worker failed; inspect worker-exits.json and native.log; no final summary produced');
 const rows=exits.flatMap(e=>fs.readFileSync(path.join(output,'worker-'+e.worker,'records.jsonl'),'utf8').trim().split('\n').map(JSON.parse)).sort((a,b)=>a.lv-b.lv);
 assert.deepEqual(rows.map(r=>r.lv),entries.map(e=>e.lv),'Missing or duplicate board result');
 fs.writeFileSync(path.join(output,'records.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n',{flag:'wx'});
 const summary={...summarize(rows,maxAttempts),workers,wallMinutes:(performance.now()-started)/60000};
 json(path.join(output,'summary.json'),summary);console.log(JSON.stringify(summary));if(!summary.valid)process.exitCode=2;
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={main};
