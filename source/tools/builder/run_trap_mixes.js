'use strict';
// Every build/finishing operation lives in a disposable worker: the hard wall
// includes placement and every nested engine call, not just between attempts.
const fs=require('fs'),path=require('path');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const M=require('./trap_mixes.js');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/variety-v1');
if(!isMainThread){
  try {
    const {name,layout,seed,wallMs,tries,mode,file,spare}=workerData;
    let r;
    if(mode==='finish') r=M.finishExample(JSON.parse(fs.readFileSync(file,'utf8')),{seed});
    else if(mode==='verify') r={verification:require('./verify_trap_mixes.js').verify(JSON.parse(fs.readFileSync(file,'utf8')),{previous:workerData.previous})};
    else {
      r=M.build(name,{layout,seed,frame:{spare:spare??1}},{wallMs:mode==='make'?8000:wallMs-500,tries,onAttempt:progress=>parentPort.postMessage({progress})});
      if(mode==='make'&&r.design)r=M.finishExample(r,{seed});
    }
    if(r.design){r.roles.locks=[...r.roles.locks];r.roles.holderSpecials=[...r.roles.holderSpecials];}
    if(r.fail){
      const dir=path.join(OUT,'failures');fs.mkdirSync(dir,{recursive:true});
      const key=String(name||'unknown').replace(/[^A-Za-z0-9_-]/g,'_')+'-L'+layout+'-s'+seed+'-p'+(spare??1)+'-'+(mode||'build')+'.json';
      fs.writeFileSync(path.join(dir,key),JSON.stringify({job:workerData,fail:r.fail,fails:r.fails||null,notes:r.notes||null,verification:r.verification||null},null,2)+'\n');
    }
    parentPort.postMessage(r);
  } catch(e){parentPort.postMessage({fail:'exception',detail:e.stack});}
} else if(require.main===module){main().catch(e=>{console.error(e);process.exitCode=1;});}

function job(data){return new Promise(resolve=>{
  const t0=Date.now(),w=new Worker(__filename,{workerData:data});let done=false,last=null;
  const finish=r=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve({...r,hardMs:Date.now()-t0});};
  const timer=setTimeout(()=>finish({fail:'hardWall',fails:last?.fails,lastAttempt:last?.attempt}),data.wallMs);
  w.on('message',r=>{if(r.progress)last=r.progress;else finish(r);});w.on('error',e=>finish({fail:'workerError',detail:e.stack}));
  w.on('exit',code=>{if(!done)finish({fail:'workerExit',detail:code});});
});}
async function main(){
  const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
  const names=opt('families',Object.keys(M.FAMILIES).join(',')).split(','),layouts=opt('layouts',[...Array(48).keys()].join(',')).split(',').map(Number);
  const mode=opt('mode','build'),wallMs=+opt('wall-ms',mode==='build'?10000:90000),workers=+opt('workers',4),seed=+opt('seed',1),tries=+opt('tries',40),tag=opt('tag',mode==='build'?'sweep':mode);
  fs.mkdirSync(path.join(OUT,'raw'),{recursive:true});
  const jobs=['build','make'].includes(mode)?names.flatMap(name=>layouts.map(layout=>({name,layout,seed,wallMs,tries,mode,spare:+opt('spare',1)}))):fs.readdirSync(path.join(OUT,mode==='finish'?'raw':'examples')).filter(f=>f.endsWith('.json')&&names.some(n=>f.startsWith(n+'-'))&&!(mode==='finish'&&args.includes('--resume')&&fs.existsSync(path.join(OUT,'examples',f)))).map(f=>({name:f.split('-L')[0],layout:+f.split('-L')[1].split('-')[0],file:path.join(OUT,mode==='finish'?'raw':'examples',f),seed,wallMs,mode}));
  if(mode==='verify'&&fs.existsSync(path.join(OUT,'selection.json'))){
    const sel=JSON.parse(fs.readFileSync(path.join(OUT,'selection.json'),'utf8'));
    if(sel.ok){jobs.sort((a,b)=>sel.order.indexOf(path.basename(a.file))-sel.order.indexOf(path.basename(b.file)));
      let previous=JSON.parse(fs.readFileSync(path.join(OUT,'ledger-history.json'),'utf8'));
      for(const j of jobs){j.previous=previous;const r=JSON.parse(fs.readFileSync(j.file,'utf8'));previous=previous.concat(M.Ledger.signature(r.design,r.card));}
    }
  }
  const rows=[];let cursor=0;
  await Promise.all(Array.from({length:Math.min(workers,jobs.length)},async()=>{
    while(cursor<jobs.length){const j=jobs[cursor++],r=await job(j);const row={...j,ok:!!r.design||r.verification?.ok===true,fail:r.fail||null,fails:r.fails||{},ms:r.hardMs,detail:r.detail};
      if(r.design){const file=mode==='finish'?path.basename(j.file):j.name+'-L'+j.layout+'-s'+j.seed+'-p'+j.spare+'.json',dest=path.join(OUT,['finish','make'].includes(mode)?'examples':'raw');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,file),JSON.stringify(r,null,2)+'\n');row.file=file;row.k=r.card.clock.fewestMoves;}
      if(r.verification)row.verification=r.verification;
      if(mode==='verify'&&!row.ok){fs.unlinkSync(j.file);row.deleted=true;}
      if(r.notes && r.fail)row.notes=r.notes;
      rows.push(row);fs.writeFileSync(path.join(OUT,tag+'.json'),JSON.stringify({started:jobs.length,completed:rows.length,rows},null,2)+'\n');
      console.log(JSON.stringify(row));
    }
  }));
}
module.exports={job,OUT};
