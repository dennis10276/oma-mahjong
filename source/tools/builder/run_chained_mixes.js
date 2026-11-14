'use strict';
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/chained-v1');
if(!isMainThread){
  try{
    const M=require('./trap_mixes.js'),j=workerData;
    let r;
    if(j.mode==='fronts')r=require('./augment_chained_fronts.js').augment(JSON.parse(fs.readFileSync(j.file,'utf8')));
    else if(j.mode==='loosen')r=require('./loosen_chained.js').loosen(JSON.parse(fs.readFileSync(j.file,'utf8')));
    else if(j.mode==='verify')r={verification:require('./verify_chained_mixes.js').verify(JSON.parse(fs.readFileSync(j.file,'utf8')))};
    else if(j.mode==='finish')r=M.finishExample(JSON.parse(fs.readFileSync(j.file,'utf8')),{seed:j.seed,sepMs:5000,tailMs:10000});
    else r=M.build(j.name,{layout:j.layout,seed:j.seed,frame:{spare:j.spare??1},targets:j.targets||{},obviousnessDial:j.dial??0},{tries:j.tries??70,wallMs:j.wallMs-300,onAttempt:p=>parentPort.postMessage({progress:p})});
    if(r.design){r.roles.locks=[...r.roles.locks];r.roles.holderSpecials=[...r.roles.holderSpecials];}
    parentPort.postMessage(r);
  }catch(e){parentPort.postMessage({fail:'exception',detail:e.stack});}
}
function job(j){return new Promise(resolve=>{
  const t0=Date.now(),w=new Worker(__filename,{workerData:j});let done=false,last;
  const end=r=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve({...r,hardMs:Date.now()-t0});};
  const timer=setTimeout(()=>end({fail:'hardWall',fails:last?.fails}),j.wallMs);
  w.on('message',r=>r.progress?last=r.progress:end(r));w.on('error',e=>end({fail:'workerError',detail:e.stack}));w.on('exit',c=>{if(!done)end({fail:'workerExit',detail:c});});
});}
async function run(opts={}){
  const {SHAPES}=require('./chained_shapes.js'),T=require('./trap_stories.js');
  const version=require('crypto').createHash('sha256').update(['trap_mixes.js','repair_chained_twins.js','chained_tail.js','verify_chained_mixes.js','verify_trap_mixes.js','chained_facts.js','chained_obviousness.js','chained_shapes.js','loosen_chained.js','chained_tail_route.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('')).digest('hex');
  const workers=opts.workers??4,deadline=Date.now()+(opts.minutes??20)*60000,raw=path.join(OUT,'raw'),examples=path.join(OUT,'examples'),rows=[];
  fs.mkdirSync(raw,{recursive:true});fs.mkdirSync(examples,{recursive:true});
  const counts=()=>Object.fromEntries(Object.keys(SHAPES).map(name=>[name,new Set(fs.readdirSync(examples).filter(f=>f.startsWith(name+'-')&&f.endsWith('.json')).map(f=>f.match(/-L(\d+)-/)[1])).size]));
  const have=(dir,name,layout)=>fs.readdirSync(dir).some(f=>f.startsWith(name+'-L'+layout+'-')&&f.endsWith('.json'));
  const snapshot=()=>fs.writeFileSync(path.join(OUT,opts.tag||'collection.json'),JSON.stringify({counts:counts(),rows},null,2)+'\n');
  async function execute(jobs){let cursor=0;await Promise.all(Array.from({length:workers},async()=>{
    while(cursor<jobs.length&&Date.now()<deadline){const j=jobs[cursor++];if(counts()[j.name]>=2||have(examples,j.name,j.layout))continue;
      const r=await job({...j,wallMs:Math.min(j.mode==='finish'?150000:opts.buildMs??9000,deadline-Date.now())});
      const row={...j,ok:!!r.design,fail:r.fail,detail:r.detail,fails:r.fails,verification:r.verification?.errors,ms:r.hardMs};
      if(r.design){const file=`${j.name}-L${j.layout}-s${j.seed}-p${r.card.clock.spare}.json`;fs.writeFileSync(path.join(j.mode==='finish'?examples:raw,file),JSON.stringify(r,null,2)+'\n');row.file=file;}
      else if(j.mode==='finish'){const failures=path.join(OUT,'failures');fs.mkdirSync(failures,{recursive:true});fs.writeFileSync(path.join(failures,path.basename(j.file)),JSON.stringify({job:j,version,...r},null,2)+'\n');}
      rows.push(row);snapshot();console.log(JSON.stringify(row));
    }
  }));}
  async function finishRaw(){
    const jobs=fs.readdirSync(raw).filter(f=>f.endsWith('.json')&&(!opts.names||opts.names.some(n=>f.startsWith(n+'-')))&&!fs.existsSync(path.join(examples,f))&&(!fs.existsSync(path.join(OUT,'failures',f))||JSON.parse(fs.readFileSync(path.join(OUT,'failures',f),'utf8')).version!==version)).map(file=>{const r=JSON.parse(fs.readFileSync(path.join(raw,file),'utf8'));return {name:r.brief.story,layout:r.card.layout,seed:r.brief.seed,spare:r.card.clock.spare,mode:'finish',file:path.join(raw,file)};});
    await execute(jobs);
  }
  if(opts.mode==='finish'){await finishRaw();return;}
  const layouts=T.readableLayouts().ranked.sort((a,b)=>a.layers-b.layers||b.score-a.score).filter(r=>r.layers<=(opts.layers??3)).map(r=>r.layout);
  for(let seed=opts.seed??1;seed<(opts.seed??1)+(opts.rounds??2)&&Date.now()<deadline;seed++){
    const jobs=Object.keys(SHAPES).filter(n=>!opts.names||opts.names.includes(n)).flatMap(name=>layouts.filter(layout=>!fs.existsSync(path.join(raw,`${name}-L${layout}-s${seed}-p${opts.spare??1}.json`))).map(layout=>({name,layout,seed,spare:opts.spare??1,mode:'build'})));
    await execute(jobs);if(opts.mode!=='sweep')await finishRaw();
    if(Object.values(counts()).filter(n=>n>=2).length>=10)break;
  }
}
if(isMainThread&&require.main===module){const a=process.argv.slice(2),opt=(n,d)=>{const i=a.indexOf('--'+n);return i<0?d:a[i+1];};run({workers:+opt('workers',4),minutes:+opt('minutes',20),layers:+opt('layers',3),seed:+opt('seed',1),rounds:+opt('rounds',2),mode:opt('mode','collect'),buildMs:+opt('build-ms',9000),spare:+opt('spare',1),tag:opt('tag','collection.json'),names:opt('names',null)?.split(',')}).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={job,run,OUT};
