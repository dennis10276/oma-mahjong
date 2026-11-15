'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const ROOT=path.resolve(__dirname,'../../..'),BANK=path.join(ROOT,'source/analysis/builder/bank'),OUT=path.join(BANK,'range-320-400'),TMP=path.join(ROOT,'source/build/320-400');
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i<0?d:process.argv[i+1];};
if(!isMainThread){try{const r=JSON.parse(fs.readFileSync(workerData.file)),dep=require('./combined_dependency.js').measure(r),readability=require('./chained_special_readability.js').measure(r.design);parentPort.postMessage({file:workerData.file,dependency:dep,readability,ideas:r.card.wrongIdea,links:r.card.trap.links,layout:r.card.layout,source:r.brief.story});}catch(e){parentPort.postMessage({file:workerData.file,error:e.stack});}}
async function main(){
  fs.mkdirSync(path.join(OUT,'audits'),{recursive:true});
  const dirs=String(arg('dirs','range-320-400/candidates,new-ideas/checked,new-ideas-light,chained-gentle')).split(',').map(d=>path.join(BANK,d));
  const todo=dirs.filter(fs.existsSync).flatMap(d=>fs.readdirSync(d).filter(f=>f.endsWith('.json')).map(f=>({file:path.join(d,f),id:path.basename(d)+'__'+f})));
  let next=0;await Promise.all(Array.from({length:+arg('workers',3)},async()=>{while(next<todo.length){const j=todo[next++],out=path.join(OUT,'audits',j.id);if(fs.existsSync(out)&&arg('retry','0')!=='1')continue;
    const r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:j});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>end({file:j.file,error:'hardWall'}),+arg('ms',18000));w.on('message',end);w.on('error',e=>end({file:j.file,error:e.stack}));w.on('exit',c=>end({file:j.file,error:'exit '+c}));});
    fs.writeFileSync(out,JSON.stringify(r,null,1));console.log(path.basename(j.file),r.error?'ERROR':`dependent=${r.dependency.ok} subtle=${r.dependency.strongerOpening} clear=${r.readability.ok}`);
  }}));
}
if(isMainThread&&require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
