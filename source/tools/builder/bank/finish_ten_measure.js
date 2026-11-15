'use strict';
// Task 20 comparisons use exact clock/opening proofs plus the existing bounded
// tail and pressure measures. No personal-player difficulty bots are run.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const P=require('./narrow_proof'),E=require('../engine'),Tail=require('./tail'),Feel=require('./feel');
const OUT=path.resolve(P.DIR,'../../finish-ten'),CACHE=path.join(OUT,'measurements');
function measure(d,meta){
  const began=Date.now(),r={schema:1,hash:P.hash(d),meta,status:'running',tiles:d.tiles.length,clock:d.clock,strictReplay:E.replay(d,d.solution,{strict:true}),metrics:{}};
  const checkpoint=stage=>{r.stage=stage;r.ms=Date.now()-began;fs.writeFileSync(path.join(CACHE,r.hash+'.json'),JSON.stringify(r,null,2)+'\n');};
  checkpoint('clock');const g=E.game(d),clock=E.clockShortest(g,{nodes:2000000,ms:20000});r.metrics.clock={minimum:clock&&!clock.unsure?clock.k:null,unknown:!clock||!!clock.unsure,spare:clock&&!clock.unsure?d.clock.n-clock.k:null,storedAt:d.solution.indexOf(d.clock.i)+1};
  checkpoint('opening');const state=E.start(g),actions=E.legal(g,state),opening={singles:{win:0,lose:0,unknown:0},pairs:{win:0,lose:0,unknown:0},actions:[]},openingStart=Date.now();
  for(const act of actions){const kind=typeof act==='number'?'singles':'pairs';let result='unknown';if(Date.now()-openingStart<25000){let s;try{s=E.step(g,state,act);}catch{s=null;}result=s?E.winnable(g,s,{nodes:200000,ms:800}).result:'lose';}opening[kind][result]++;opening.actions.push({action:act,result});}
  r.metrics.opening=opening;
  checkpoint('greedy');if(r.strictReplay.ok){r.metrics.greedy=Tail.measure(d,{seed:20261115,playouts:512});r.metrics.feel=Feel.feel(d,{seed:20261115,playouts:256});
    checkpoint('expert');r.metrics.expert=Feel.expert(d,{seed:20261115,playouts:8,nodes:30000,ms:150,wrong:false});
    checkpoint('forced-pressure');r.metrics.cap1=Tail.cappedTail(d,1,{peek:true,nodes:300000,ms:1500});r.metrics.cap2=Tail.cappedTail(d,2,{peek:true,nodes:500000,ms:2000});
  }
  r.status='done';checkpoint('done');return r;
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(measure(workerData.design,workerData.meta));}catch(e){parentPort.postMessage({hash:P.hash(workerData.design),status:'error',error:e.stack,meta:workerData.meta});}}
async function run(){fs.mkdirSync(CACHE,{recursive:true});const original=JSON.parse(fs.readFileSync(path.resolve(P.DIR,'../range-250-300.json'))),packFile=process.argv.includes('--pack')?process.argv[process.argv.indexOf('--pack')+1]:path.resolve(P.DIR,'../narrow-final/pack.json'),pack=JSON.parse(fs.readFileSync(packFile)),jobs=new Map();
  const add=(design,meta)=>{const hash=P.hash(design);if(!jobs.has(hash))jobs.set(hash,{design,meta});};
  for(const row of original.rows.filter(r=>r.level>=251&&r.level<=300))add(row.before.design,{level:row.level,variant:'released'});
  for(const row of pack.rows)add(row.draft.design,{level:row.level,variant:'narrowed',from:row.from,swapFrom:row.swapFrom});
  const list=[...jobs.values()].filter(j=>{const f=path.join(CACHE,P.hash(j.design)+'.json');return !fs.existsSync(f)||JSON.parse(fs.readFileSync(f)).status!=='done';});let next=0;
  fs.writeFileSync(path.join(OUT,'measurement-inputs.json'),JSON.stringify([...jobs].map(([hash,j])=>({hash,...j.meta})),null,2)+'\n');
  await Promise.all(Array.from({length:4},async()=>{while(next<list.length){const job=list[next++],hash=P.hash(job.design),r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:job});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>{const f=path.join(CACHE,hash+'.json'),partial=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{hash,meta:job.meta};end({...partial,status:'timeout'});},120000);w.on('message',end);w.on('error',e=>end({hash,status:'error',error:e.message,meta:job.meta}));});fs.writeFileSync(path.join(CACHE,hash+'.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({level:job.meta.level,variant:job.meta.variant,status:r.status,stage:r.stage,ms:r.ms,clock:r.metrics?.clock?.minimum,opening:r.metrics?.opening?.singles,expert:r.metrics?.expert?.games}));}}));
}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={measure,OUT,CACHE};
