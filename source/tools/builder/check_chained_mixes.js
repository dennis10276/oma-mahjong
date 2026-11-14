'use strict';
// Final selection and fresh audit are bounded separately from collection.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const {job,OUT}=require('./run_chained_mixes.js'),V=require('./verify_chained_mixes.js'),{SHAPES}=require('./chained_shapes.js');
const root=path.resolve(__dirname,'../../..'),REPORT=path.join(root,'codex-tasks/results/chained-mixes-v1');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function select(){
  const dir=path.join(OUT,'examples'),pool=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(file=>({file,r:read(path.join(dir,file))})).filter(p=>p.r.verification?.ok);
  const score=p=>(p.r.card.layers<=3?20:0)+(p.r.card.trap.firstMoves.winning>=3?15:0)+p.r.card.trap.obviousness.preferredBaits.length*3-p.r.card.layers;
  const groups=Object.keys(SHAPES).map(name=>({name,ps:pool.filter(p=>p.r.card.trap.type===name).sort((a,b)=>score(b)-score(a))})).filter(g=>new Set(g.ps.map(p=>p.r.card.layout)).size>=2);
  for(const g of groups){g.pair=[g.ps[0],g.ps.find(p=>p.r.card.layout!==g.ps[0].r.card.layout)];g.score=g.pair.reduce((n,p)=>n+score(p),0);}
  groups.sort((a,b)=>b.score-a.score);
  const chosen=[];
  // Prefer covering each authored link idea before adding more shapes of it.
  for(const mode of ['earlyClock','repeatKeys','roofKey','freezeRight']){const g=groups.find(g=>SHAPES[g.name].mode===mode);if(g)chosen.push(g);}
  for(const g of groups)if(chosen.length<10&&!chosen.includes(g))chosen.push(g);
  const rows=chosen.flatMap(g=>g.pair),needles=rows.filter(p=>p.r.card.trap.firstMoves.winning<3).length;
  const order=[...chosen.map(g=>g.pair[0].file),...chosen.map(g=>g.pair[1].file)];
  return {ok:chosen.length===10&&needles<=4,why:chosen.length<10?'fewerThanTenShapes':needles>4?'tooManyNeedles':null,order,shapes:chosen.map(g=>g.name),needles,available:groups.map(g=>({name:g.name,examples:g.ps.length}))};
}
function command(name,args,env={}){
  const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:300000,env:{...process.env,...env}});
  fs.writeFileSync(path.join(REPORT,name+'.log'),(r.stdout||'')+(r.stderr||''));console.log(JSON.stringify({test:name,ok:r.status===0,status:r.status,error:r.error?.message}));return {ok:r.status===0,status:r.status,error:r.error?.message,log:name+'.log'};
}
async function run(opts={}){
  fs.mkdirSync(REPORT,{recursive:true});
  const selection=select();fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(selection,null,2)+'\n');
  if(!selection.ok){console.log(JSON.stringify(selection));require('./report_chained_mixes.js').run();process.exitCode=1;return;}
  const audit=[],dir=path.join(OUT,'examples'),deadline=Date.now()+15*60000;let cursor=0;
  fs.writeFileSync(path.join(OUT,'history.json'),JSON.stringify(V.history(),null,2)+'\n');
  await Promise.all(Array.from({length:opts.workers??4},async()=>{
    while(cursor<selection.order.length&&Date.now()<deadline){const file=selection.order[cursor++],full=path.join(dir,file),r=await job({mode:'verify',file:full,wallMs:Math.min(90000,deadline-Date.now())});
      const v=r.verification||{ok:false,errors:[r.fail]};audit.push({file,...v,ms:r.hardMs});
      const p=read(full);p.verification=v;fs.writeFileSync(full,JSON.stringify(p,null,2)+'\n');
      fs.writeFileSync(path.join(OUT,'audit-final.json'),JSON.stringify({ok:audit.length===20&&audit.every(a=>a.ok),completed:audit.length,rows:audit},null,2)+'\n');
      console.log(JSON.stringify({audit:file,ok:v.ok,errors:v.errors}));
    }
  }));
  if(audit.length!==20||audit.some(a=>!a.ok)){require('./report_chained_mixes.js').run();process.exitCode=1;return;}
  const results={};
  results.engine=command('engine-regression',['--test','source/tools/builder/test_engine.js']);
  results.mixes=command('trap-mix-regression',['--test','source/tools/builder/test_trap_mixes.js'],{TRAP_MIXES_DELIVERABLES:'1'});
  results.chained=command('chained-tests',['--test','source/tools/builder/test_chained_mixes.js'],{CHAINED_DELIVERABLES:'1'});
  results.markers=command('task13-markers',['source/tests/run.js','ui markers'],{JOBS:'1'});
  results.hard=command('hard-regression',['source/tests/run.js','t_hard'],{JOBS:'1'});
  results.ok=Object.values(results).every(v=>v.ok);fs.writeFileSync(path.join(REPORT,'validation.json'),JSON.stringify(results,null,2)+'\n');
  require('./report_chained_mixes.js').run();if(!results.ok)process.exitCode=1;
}
if(require.main===module){const a=process.argv.slice(2),i=a.indexOf('--workers');run({workers:i<0?4:+a[i+1]}).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={select,run};
