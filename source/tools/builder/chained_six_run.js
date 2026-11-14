'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/new-ideas');
if(!isMainThread&&require.main===module){
  try{
    const j=workerData,M=require('./trap_mixes.js');
    let r;
    if(j.mode==='finish'){
      const raw=JSON.parse(fs.readFileSync(j.file));
      const obsolete=(raw.roles.bait.sixLinks||[raw.roles.bait.six]).some(q=>q.kind==='clockCount'&&!Number.isInteger(q.parkSide));
      r=obsolete?{fail:'obsoleteClockCountRecipe'}:require('./chained_v2_finish.js').finish(raw,{seed:j.seed,tuneMs:j.tuneMs??30000,repairMs:j.repairMs??20000});
    }
    else if(j.mode==='refresh'){
      const row=JSON.parse(fs.readFileSync(j.file)),roles={...row.roles,locks:new Set(row.roles.locks),holderSpecials:new Set(row.roles.holderSpecials)};
      const p=M.prove(row.brief.story,row.design,roles,{k:row.card.clock.fewestMoves,spare:row.card.clock.spare,obviousnessDial:2,existingLinks:row.card.trap.newLinks||[row.card.trap.newLink]});
      if(!p.ok)r={fail:'proof:'+p.why};else{
        row.card.trap=p.card;row.card.wrongIdea=require('./chained_v2_finish.js').ideas(row);
        row.verification=require('./verify_chained_v2.js').verify(row);
        r=row.verification.ok?row:{fail:'verification',errors:row.verification.errors};
      }
    }
    else if(j.mode==='verify')r=require('./verify_chained_v2.js').verify(JSON.parse(fs.readFileSync(j.file)));
    else r=M.build(j.name,{layout:j.layout,seed:j.seed,obviousnessDial:2,...(j.readabilityProfile?{readabilityProfile:j.readabilityProfile}:{}),frame:{spare:1,...(j.depth!=null?{depth:j.depth}:{})},targets:{digBefore:[2,8],maxDown:.2,...j.targets}},{tries:j.tries??250,wallMs:j.ms-500,onAttempt:x=>parentPort.postMessage({progress:x})});
    if(r.design){r.roles.locks=[...r.roles.locks];r.roles.holderSpecials=[...r.roles.holderSpecials];}
    parentPort.postMessage({result:r});
  }catch(e){parentPort.postMessage({result:{fail:'exception',detail:e.stack}});}
}
function job(j){return new Promise(resolve=>{
  let progress,done=false;const t=Date.now(),w=new Worker(__filename,{workerData:j});
  const end=r=>{if(done)return;done=true;clearTimeout(tm);w.terminate();resolve({...r,wall:Date.now()-t,...(progress?{progress}:{})});};
  const tm=setTimeout(()=>end({fail:'hardWall',fails:progress?.fails}),j.ms);
  w.on('message',m=>{if(m.progress)progress=m.progress;else end(m.result);});w.on('error',e=>end({fail:'exception',detail:e.stack}));w.on('exit',c=>end({fail:'exit:'+c}));
});}
async function run(){
  const a=process.argv.slice(2),arg=(n,d)=>{const i=a.indexOf('--'+n);return i<0?d:a[i+1];};
  const mode=arg('mode','build'),seed=+arg('seed',1),ms=+arg('ms',15000),until=Date.now()+ +arg('minutes',6)*60000,workers=+arg('workers',4);
  for(const p of ['raw','examples','checked','held','runs'])fs.mkdirSync(path.join(OUT,p),{recursive:true});
  const B=require('./builder.js'),Six=require('./chained_six_ideas.js'),names=arg('names',Object.keys(Six.DEFINITIONS).join(',')).split(','),layouts=arg('layouts','').split(',').filter(Boolean).map(Number);
  const examples=fs.readdirSync(path.join(OUT,'checked')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(OUT,'checked',f)))).filter(r=>(r.roles.bait.sixLinks||[r.roles.bait.six]).every(q=>q.kind!=='clockCount'||Number.isInteger(q.parkSide)));
  let jobs=['finish','verify','refresh'].includes(mode)?fs.readdirSync(path.join(OUT,mode==='finish'?'raw':'examples')).filter(f=>names.some(n=>f.startsWith(n+'-'))&&f.endsWith('.json')&&(mode!=='finish'||!fs.existsSync(path.join(OUT,'examples',f)))).map(f=>({mode,file:path.join(OUT,mode==='finish'?'raw':'examples',f),seed,ms})):names.flatMap(name=>B.LAYOUTS.map((l,layout)=>({name,layout,seed,ms,mode,targets:JSON.parse(arg('targets','{}'))})).filter(j=>(arg('all-layers','0')==='1'||B.LAYOUTS[j.layout].tiles.every(t=>t[2]<=2))&&(!layouts.length||layouts.includes(j.layout))&&!examples.some(r=>r.brief.story===name&&r.card.layout===j.layout)));
  if(arg('hosts',null)&&mode==='build')jobs=JSON.parse(fs.readFileSync(arg('hosts'))).map(j=>({...j,seed,ms,mode,targets:j.targets||{}}));
  if(arg('files',null)&&mode!=='build'){
    const files=new Set(arg('files','').split(',').map(f=>path.basename(f)));
    jobs=jobs.filter(j=>files.has(path.basename(j.file)));
  }
  if(mode==='build')jobs.sort((a,b)=>a.layout-b.layout||names.indexOf(a.name)-names.indexOf(b.name));
  if(arg('reverse','0')==='1')jobs.reverse();
  let cursor=0;const log=path.join(OUT,'runs',`${mode}-s${seed}-${Date.now()}.jsonl`);
  await Promise.all(Array.from({length:workers},async()=>{while(cursor<jobs.length&&Date.now()<until){
    const j={...jobs[cursor++],...(arg('readability',null)?{readabilityProfile:arg('readability')}:{}),...(arg('depth',null)!=null?{depth:+arg('depth',0)}:{})},r=await job({...j,repairMs:+arg('repair-ms',20000),tuneMs:+arg('tune-ms',30000),ms:Math.min(j.ms,until-Date.now())});
    const row={...j,file:j.file&&path.basename(j.file),ok:!!r.design||(mode==='verify'&&r.ok),fail:r.fail,errors:r.errors,detail:r.detail,fails:r.fails,wall:r.wall,attempts:r.progress?.attempt};
    if(r.design){const file=j.file?path.basename(j.file):`${j.name}-L${j.layout}-s${seed}-p1.json`;fs.writeFileSync(path.join(OUT,mode==='refresh'?'checked':mode==='finish'?'examples':'raw',file),JSON.stringify(r,null,2)+'\n');row.output=file;}
    else if(mode==='finish'){
      fs.writeFileSync(path.join(OUT,'runs','failed-'+path.basename(j.file)),JSON.stringify(r,null,2));
      if(r.checkpoint)fs.writeFileSync(j.file,JSON.stringify(r.checkpoint,null,2)+'\n');
    }
    else if(mode==='refresh'){
      const old=path.join(OUT,'checked',path.basename(j.file));
      if(fs.existsSync(old))fs.renameSync(old,path.join(OUT,'held',path.basename(j.file,'.json')+'-stale-'+Date.now()+'.json'));
    }
    fs.appendFileSync(log,JSON.stringify(row)+'\n');console.log(JSON.stringify(row));
    if(r.design&&mode==='build'&&arg('finish-each','0')==='1'){
      const file=path.join(OUT,'raw',row.output),fin=await job({mode:'finish',file,seed,ms:Math.min(+arg('finish-ms',90000),until-Date.now())});
      const fr={mode:'finish',file:row.output,ok:!!fin.design,fail:fin.fail,wall:fin.wall};
      if(fin.design)fs.writeFileSync(path.join(OUT,'examples',row.output),JSON.stringify(fin,null,2)+'\n');
      else if(fin.checkpoint)fs.writeFileSync(file,JSON.stringify(fin.checkpoint,null,2)+'\n');
      fs.appendFileSync(log,JSON.stringify(fr)+'\n');console.log(JSON.stringify(fr));
    }
  }}));
}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={OUT,job};
