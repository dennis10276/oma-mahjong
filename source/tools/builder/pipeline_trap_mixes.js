'use strict';
// Run all dependent stages under ONE heavy.js reservation, so a finishing job
// does not relinquish its cores between construction, tuning and verification.
const fs=require('fs'),path=require('path');
const M=require('./trap_mixes.js'),{job,OUT}=require('./run_trap_mixes.js'),S=require('./select_trap_mixes.js');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
async function run(opts={}){
  const workers=opts.workers??4,deadline=Date.now()+(opts.minutes??30)*60000,dir=path.join(OUT,'examples'),rows=[];
  fs.mkdirSync(dir,{recursive:true});
  const baseline=S.history(opts.historyCheckout),counts={},layouts={},pool=[];
  const retired=[];
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){let r,reason=null;try{r=read(path.join(dir,file));}catch{reason='incomplete saved JSON';}
    if(r&&M.FAMILIES[r.brief.story]?.mode!==r.card.trap.mechanism.mode)reason='superseded recipe; not counted as a new family';
    if(reason){const reserve=path.join(OUT,'reserves');fs.mkdirSync(reserve,{recursive:true});const from=path.resolve(dir,file),to=path.resolve(reserve,file),root=path.resolve(OUT)+path.sep;if(!from.startsWith(root)||!to.startsWith(root))throw Error('artifact path escaped');fs.renameSync(from,to);retired.push({file,reason});continue;}
    for(const e of r.card.trap.effects)if(e.by==='baitDefused'){delete e.costWithout;e.winsAt=r.design.clock.n;}
    const pf=r.card.pressureFacts;r.card.pressureFacts={capProof:pf.capProof,needsWaiting:pf.needsWaitingProven?pf.needsWaiting:null,needsWaitingProven:pf.needsWaitingProven};
    fs.writeFileSync(path.join(dir,file),JSON.stringify(r,null,2)+'\n');pool.push({file,r});}
  if(retired.length)fs.writeFileSync(path.join(OUT,'retired-examples.json'),JSON.stringify(retired,null,2)+'\n');
  function refresh(){for(const k of Object.keys(counts))delete counts[k];for(const k of Object.keys(layouts))delete layouts[k];for(const p of pool){const n=p.r.brief.story;counts[n]=(counts[n]||0)+1;(layouts[n]??=new Set()).add(p.r.card.layout);}}
  refresh();let selected=null,stop=false;
  const inflight=new Set(),familyOrder=Object.keys(M.FAMILIES),rotation=j=>(j.layout-familyOrder.indexOf(j.name)*11+480)%48;
  function check(){
    if(pool.length<30||Object.values(layouts).filter(s=>s.size>=2).length<12)return false;
    const out=S.select(pool,baseline,{wallMs:2000});if(!out.ok)return false;
    selected=out;stop=true;return true;
  }
  function snapshot(){fs.writeFileSync(path.join(OUT,'pipeline-run.json'),JSON.stringify({completed:rows.length,counts,qualified:Object.keys(layouts).filter(n=>layouts[n].size>=2),rows},null,2)+'\n');}
  async function execute(jobs){
    let cursor=0;
    await Promise.all(Array.from({length:workers},async()=>{
      while(cursor<jobs.length&&!stop&&Date.now()<deadline){
        const j=jobs[cursor++],key=j.name+':'+j.layout;if(layouts[j.name]?.has(j.layout)||(layouts[j.name]?.size||0)>=5||inflight.has(key))continue;
        const wallMs=Math.min(j.mode==='finish'?90000:65000,deadline-Date.now());if(wallMs<1000)break;
        inflight.add(key);const r=await job({...j,wallMs,tries:100});inflight.delete(key);
        const row={name:j.name,layout:j.layout,seed:j.seed,spare:j.spare,mode:j.mode,ok:!!r.design,fail:r.fail||null,ms:r.hardMs,errors:r.verification?.errors};
        if(r.design){const file=j.mode==='finish'?path.basename(j.file):`${j.name}-L${j.layout}-s${j.seed}-p${j.spare}.json`;
          fs.writeFileSync(path.join(dir,file),JSON.stringify(r,null,2)+'\n');pool.push({file,r});refresh();row.file=file;
          check();
        }
        rows.push(row);snapshot();console.log(JSON.stringify({...row,qualified:Object.values(layouts).filter(s=>s.size>=2).length,examples:pool.length}));
      }
    }));
  }
  const raw=path.join(OUT,'raw');
  const existing=fs.existsSync(raw)?fs.readdirSync(raw).filter(f=>f.endsWith('.json')&&!fs.existsSync(path.join(dir,f))).map(file=>{
    const r=read(path.join(raw,file));return {name:r.brief.story,layout:r.card.layout,seed:r.brief.seed,spare:r.card.clock.spare,mode:'finish',file:path.join(raw,file)};
  }):[];
  const abundance={};for(const j of existing)abundance[j.name]=(abundance[j.name]||0)+1;
  existing.sort((a,b)=>(counts[a.name]||0)-(counts[b.name]||0)||(abundance[a.name]-abundance[b.name])||rotation(a)-rotation(b));
  await execute(existing);
  const known={};
  for(const f of fs.readdirSync(OUT).filter(f=>/^sweep.*\.json$/.test(f)))for(const r of read(path.join(OUT,f)).rows||[])if(r.ok)(known[r.name]??=new Set()).add(r.layout);
  for(const [seed,spare]of[[3,1],[4,2],[5,1],[6,2],[7,1],[8,2],[9,1],[10,2]]){
    if(stop||Date.now()>=deadline)break;
    const names=Object.keys(M.FAMILIES).sort((a,b)=>(layouts[a]?.size||0)-(layouts[b]?.size||0));
    const jobs=[];
    for(const name of names){
      if((layouts[name]?.size||0)>=5)continue;
      const order=(a,b)=>rotation({name,layout:a})-rotation({name,layout:b});
      const first=[...(known[name]||[])].sort(order),rest=[...Array(48).keys()].filter(l=>!first.includes(l)).sort(order);
      const ls=(seed<=4&&first.length>=2?first:first.concat(rest));
      for(const layout of ls)if(!layouts[name]?.has(layout))jobs.push({name,layout,seed,spare,mode:'make'});
    }
    await execute(jobs);
  }
  if(!selected)check();
  fs.writeFileSync(path.join(OUT,'ledger-history.json'),JSON.stringify(baseline,null,2)+'\n');
  let result=selected||{ok:false,why:Date.now()>=deadline?'pipelineWall':'candidatesExhausted',examples:pool.length,qualified:Object.keys(layouts).filter(n=>layouts[n].size>=2)};
  fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(result,null,2)+'\n');snapshot();console.log(JSON.stringify(result));
  if(result.ok){
    S.applySelection(result);
    const families=[...new Set(result.order.map(f=>read(path.join(dir,f)).brief.story))],hostJobs=families.flatMap(name=>Array.from({length:48},(_,layout)=>({name,layout}))),hostRows=[];let hostCursor=0;
    const sourceSha=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'trap_mixes.js'))).digest('hex');
    await Promise.all(Array.from({length:workers},async()=>{
      while(hostCursor<hostJobs.length){const j=hostJobs[hostCursor++],r=await job({...j,mode:'build',seed:11,spare:1,wallMs:4000,tries:60});
        hostRows.push({...j,seed:11,spare:1,wallMs:4000,tries:60,ok:!!r.design,fail:r.fail||null,fails:r.fails||{},ms:r.hardMs});
        fs.writeFileSync(path.join(OUT,'sweep-final-current.json'),JSON.stringify({sourceSha,started:hostJobs.length,completed:hostRows.length,rows:hostRows},null,2)+'\n');
      }
    }));
    const tasks=[];let previous=baseline;
    for(const file of result.order){const r=read(path.join(dir,file));tasks.push({file,previous});previous=previous.concat(M.Ledger.signature(r.design,r.card));}
    const audit=[];let cursor=0;
    await Promise.all(Array.from({length:workers},async()=>{
      while(cursor<tasks.length){const task=tasks[cursor++],full=path.join(dir,task.file),r=await job({mode:'verify',file:full,previous:task.previous,wallMs:90000});
        const v=r.verification||{ok:false,errors:[r.fail||'missingAudit']};
        if(v.ok){const b=read(full);b.verification=v;b.card.trap.firstMoves=v.firstMoves;fs.writeFileSync(full,JSON.stringify(b,null,2)+'\n');}
        else fs.unlinkSync(full);
        audit.push({file:task.file,...v,ms:r.hardMs,deleted:!v.ok});
        console.log(JSON.stringify({audit:task.file,ok:v.ok,errors:v.errors}));
        fs.writeFileSync(path.join(OUT,'audit-final.json'),JSON.stringify({ok:audit.every(a=>a.ok),completed:audit.length,rows:audit},null,2)+'\n');
      }
    }));
    if(audit.some(a=>!a.ok))result={...result,ok:false,why:'independentAudit',deleted:audit.filter(a=>!a.ok).map(a=>a.file)};
    if(result.ok){
      const reportDir=path.resolve(__dirname,'../../../codex-tasks/results/trap-variety-v1');fs.mkdirSync(reportDir,{recursive:true});
      const suite=require('child_process').spawnSync(process.execPath,['--test',path.join(__dirname,'test_trap_mixes.js')],{encoding:'utf8',env:{...process.env,TRAP_MIXES_DELIVERABLES:'1'}});
      fs.writeFileSync(path.join(reportDir,'tests-final.log'),(suite.stdout||'')+(suite.stderr||''));
      result={...result,unitTests:{ok:suite.status===0,tests:10,log:'tests-final.log'}};
      if(suite.status!==0)result={...result,ok:false,why:'unitTests'};
      fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(result,null,2)+'\n');
      require('./report_trap_mixes.js').catalogue();
    }
    fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(result,null,2)+'\n');
  }
  console.log(JSON.stringify(result));return result;
}
if(require.main===module){const a=process.argv.slice(2),opt=(n,d)=>{const i=a.indexOf('--'+n);return i<0?d:a[i+1];};run({workers:+opt('workers',4),minutes:+opt('minutes',30),historyCheckout:opt('history-checkout',null)}).then(r=>{if(!r.ok)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={run};
