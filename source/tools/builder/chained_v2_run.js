'use strict';
// TASK 17: bounded workers; launch through loop/heavy.js.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/chained-v2');
const NAMES=['waitThawWay','waitNested','waitThawKey','lookalikeThaw','lookalikeCover','lookalikeWay','roofThawKey','waitLookalikeRoof','waitLookalikeWay','lookalikeCoverThaw'];
if(!isMainThread&&require.main===module){
  try{
    const M=require('./trap_mixes.js'),j=workerData;
    const r=j.mode==='finish'?require('./chained_v2_finish.js').finish(JSON.parse(fs.readFileSync(j.file)),j):M.build(j.name,{layout:j.layout,seed:j.seed,obviousnessDial:j.dial??0,frame:{spare:j.spare??1,...(j.depth!=null?{depth:j.depth}:{})},targets:j.targets||{}},{tries:j.tries??100,wallMs:j.ms-500});
    if(r.design){r.roles.locks=[...r.roles.locks];r.roles.holderSpecials=[...r.roles.holderSpecials];}
    parentPort.postMessage(r);
  }catch(e){parentPort.postMessage({fail:'exception',detail:e.stack});}
}
function job(j){return new Promise(resolve=>{
  const t=Date.now(),w=new Worker(__filename,{workerData:j});let done=false;
  const end=r=>{if(done)return;done=true;clearTimeout(tm);w.terminate();resolve({...r,wall:Date.now()-t});};
  const tm=setTimeout(()=>end({fail:'hardWall'}),j.ms);w.on('message',end);w.on('error',e=>end({fail:'workerError',detail:e.stack}));w.on('exit',c=>end({fail:'workerExit',detail:c}));
});}
async function run(){
  const a=process.argv.slice(2),arg=(n,d)=>{let i=a.indexOf('--'+n);return i<0?d:a[i+1];};
  const mode=arg('mode','build'),workers=+arg('workers',8),until=Date.now()+ +arg('minutes',20)*60000,seed=+arg('seed',11),ms=+arg('ms',10000),names=arg('names',NAMES.join(',')).split(','),targets=JSON.parse(arg('targets','{}'));
  for(const d of ['raw','examples','runs'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
  const B=require('./builder.js'),old=new Set([0,14,18,31,36]);
  const layoutFilter=arg('layouts',null)?.split(',').map(Number),allowShared=+arg('allow-shared-hosts',0);
  const originalHosts={};if(allowShared){const dir=path.resolve(OUT,'../chained-v1/examples');for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){const r=JSON.parse(fs.readFileSync(path.join(dir,f)));(originalHosts[r.brief.story]??=new Set()).add(r.card.layout);}}
  const finished=fs.readdirSync(path.join(OUT,'examples')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(OUT,'examples',f))));
  const have=(name,layout)=>finished.some(r=>r.brief.story===name&&r.card.layout===layout);
  const jobs=mode==='finish'?fs.readdirSync(path.join(OUT,'raw')).filter(f=>f.endsWith('.json')&&names.some(n=>f.startsWith(n+'-'))&&!fs.existsSync(path.join(OUT,'examples',f))).map(f=>({mode,file:path.join(OUT,'raw',f),ms,seed,repairMs:+arg('repair-ms',30000)})):names.flatMap(name=>B.LAYOUTS.map((l,layout)=>({name,layout,seed,spare:+arg('spare',1),ms,mode,targets,depth:arg('depth',null)==null?null:+arg('depth'),tries:+arg('tries',150)})).filter(j=>(allowShared?!originalHosts[name]?.has(j.layout):!old.has(j.layout))&&(!layoutFilter||layoutFilter.includes(j.layout))&&!have(name,j.layout)&&!fs.existsSync(path.join(OUT,'raw',`${name}-L${j.layout}-s${seed}-p${j.spare}.json`))));
  // Rotate the shape order across workers, so the wall limit covers every shape.
  if(mode!=='finish')jobs.sort((a,b)=>a.layout-b.layout||names.indexOf(a.name)-names.indexOf(b.name));
  else jobs.sort((a,b)=>{
    const ja=JSON.parse(fs.readFileSync(a.file)),jb=JSON.parse(fs.readFileSync(b.file));
    const count=j=>new Set(finished.filter(r=>r.brief.story===j.brief.story).map(r=>r.card.layout)).size;
    return count(ja)-count(jb)||ja.card.layout-jb.card.layout;
  });
  let cursor=0;const log=path.join(OUT,'runs',`${mode}-${seed}-${Date.now()}.jsonl`);
  await Promise.all(Array.from({length:workers},async()=>{while(cursor<jobs.length&&Date.now()<until){const j={...jobs[cursor++],dial:+arg('dial',0)};
    if(j.mode==='finish'){
      const raw=JSON.parse(fs.readFileSync(j.file)),name=raw.brief.story,rows=fs.readdirSync(path.join(OUT,'examples')).filter(f=>f.endsWith('.json')&&f.startsWith(name+'-')).map(f=>JSON.parse(fs.readFileSync(path.join(OUT,'examples',f))));
      const eligible=name==='lookalikeCoverThaw'?rows.filter(r=>require('./chained_readability.js').keyRoof(r.design).keyShown>=.65):rows;
      const quota=name==='lookalikeCoverThaw'?2:NAMES.includes(name)?6:1;
      if(new Set(eligible.map(r=>r.card.layout)).size>=quota||eligible.some(r=>r.card.layout===raw.card.layout))continue;
      if(name==='lookalikeCoverThaw'&&require('./chained_readability.js').keyRoof(raw.design).keyShown<.65)continue;
    }
    const r=await job({...j,ms:Math.min(j.ms,until-Date.now())});
    const row={...j,file:j.file&&path.basename(j.file),ok:!!r.design,fail:r.fail,detail:r.detail,fails:r.fails,wall:r.wall};
    if(r.design){const f=j.file?path.basename(j.file):`${j.name}-L${j.layout}-s${seed}-p${j.spare}.json`;fs.writeFileSync(path.join(OUT,mode==='finish'?'examples':'raw',f),JSON.stringify(r,null,2)+'\n');row.output=f;}
    else if(mode==='finish'){
      fs.writeFileSync(path.join(OUT,'runs','failed-'+path.basename(j.file)),JSON.stringify(r,null,2));
      if(r.checkpoint)fs.writeFileSync(j.file,JSON.stringify(r.checkpoint,null,2)+'\n');
    }
    fs.appendFileSync(log,JSON.stringify(row)+'\n');console.log(JSON.stringify(row));
  }}));
}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={OUT,NAMES,job};
