'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads'),{OUT}=require('./chained_v2_run.js');
if(!isMainThread){try{
  const file=path.join(OUT,'examples',workerData.file),r=JSON.parse(fs.readFileSync(file)),M=require('./trap_mixes.js'),roles={...r.roles,locks:new Set(r.roles.locks),holderSpecials:new Set(r.roles.holderSpecials)},k=r.card.clock.fewestMoves,spare=r.card.clock.spare;
  const p=M.prove(r.brief.story,r.design,roles,{k,spare,obviousnessDial:r.brief.obviousnessDial});
  if(!p.ok)parentPort.postMessage({ok:false,errors:['refresh:'+p.why]});else{
    r.card.trap=p.card;r.card.wrongIdea=require('./chained_v2_finish.js').ideas(r);
    const v=require('./verify_chained_v2.js').verify(r);if(v.ok){r.verification=v;fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');}parentPort.postMessage(v);
  }
}catch(e){parentPort.postMessage({ok:false,errors:[e.stack]});}}
async function run(){
  const a=process.argv.slice(2),arg=(n,d)=>{let i=a.indexOf('--'+n);return i<0?d:a[i+1];},workers=+arg('workers',2),selection=JSON.parse(fs.readFileSync(path.join(OUT,'selection.json'))),files=[...new Set([...selection.order,...selection.clearer])],rows=[];
  let next=0;await Promise.all(Array.from({length:workers},async()=>{while(next<files.length){const file=files[next++],t=Date.now();const v=await new Promise(resolve=>{
    const w=new Worker(__filename,{workerData:{file}});let done=false;const end=r=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(r);};const timer=setTimeout(()=>end({ok:false,errors:['auditWall']}),90000);w.on('message',end);w.on('error',e=>end({ok:false,errors:[e.stack]}));w.on('exit',c=>end({ok:false,errors:['workerExit:'+c]}));
  });rows.push({file,...v,ms:Date.now()-t});fs.writeFileSync(path.join(OUT,'audit-final.json'),JSON.stringify({ok:rows.length===files.length&&rows.every(r=>r.ok),expected:files.length,rows},null,2)+'\n');console.log(JSON.stringify({file,ok:v.ok,errors:v.errors,ms:Date.now()-t}));}}));
  if(rows.some(r=>!r.ok))process.exitCode=1;
}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
