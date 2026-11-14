'use strict';
// Finishing checks share a single reservation (four workers by default; --workers 1 for a busy PC). Every search has an
// inner budget and every audit worker has a hard outer wall.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const M=require('./trap_mixes.js'),S=require('./select_trap_mixes.js'),{job,OUT}=require('./run_trap_mixes.js');
const root=path.resolve(__dirname,'../../..'),report=path.join(root,'codex-tasks/results/trap-variety-v1'),read=f=>JSON.parse(fs.readFileSync(f));
function command(name,args,env={}){console.log('Checking '+name);const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:300000,env:{...process.env,...env}});const log=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(report,name+'.log'),log);console.log(log.trim());return {ok:r.status===0,status:r.status,error:r.error?.message,log:name+'.log'};}
async function run(){
 if(process.argv.includes('--ribbon-only')){
   const results=read(path.join(report,'validation-final.json'));delete results.ok;
   results.ribbon=command('ribbon-tests',['source/tests/run.js','ribbon'],{JOBS:'1',CAPTURE_RIBBON_DIR:report});
   results.ok=Object.values(results).every(r=>r.ok);fs.writeFileSync(path.join(report,'validation-final.json'),JSON.stringify(results,null,2)+'\n');
   require('./report_trap_mixes.js').catalogue();if(!results.ok)process.exitCode=1;return;
 }
 const wi=process.argv.indexOf('--workers'),workers=wi<0?4:Math.max(1,Math.min(4,+process.argv[wi+1]));
 const results={};results.ribbon=command('ribbon-tests',['source/tests/run.js','ribbon'],{JOBS:'1',CAPTURE_RIBBON_DIR:report});
 results.markers=command('marker-dependency-tests',['source/tests/run.js','ui markers'],{JOBS:'1'});
 results.engine=command('engine-regression-tests',['--test','source/tools/builder/test_engine.js']);
 results.builder=command('tests-final',['--test','source/tools/builder/test_trap_mixes.js'],{TRAP_MIXES_DELIVERABLES:'1'});
 const selection=read(path.join(OUT,'selection.json')),dir=path.join(OUT,'examples');let previous=S.history();const tasks=[];
 for(const file of selection.order){const r=read(path.join(dir,file));tasks.push({file,previous});previous=previous.concat(M.Ledger.signature(r.design,r.card));}
 const rows=[];let cursor=0;
 await Promise.all(Array.from({length:workers},async()=>{while(cursor<tasks.length){const t=tasks[cursor++],full=path.join(dir,t.file),r=await job({mode:'verify',file:full,previous:t.previous,wallMs:90000}),v=r.verification||{ok:false,errors:[r.fail]};rows.push({file:t.file,...v,ms:r.hardMs,deleted:!v.ok});if(v.ok){const b=read(full);b.verification=v;b.card.trap.firstMoves=v.firstMoves;fs.writeFileSync(full,JSON.stringify(b,null,2)+'\n');}else fs.unlinkSync(full);console.log(JSON.stringify({audit:t.file,ok:v.ok,errors:v.errors}));fs.writeFileSync(path.join(OUT,'audit-final.json'),JSON.stringify({ok:rows.every(r=>r.ok),completed:rows.length,rows},null,2)+'\n');}}));
 results.audit={ok:rows.length===30&&rows.every(r=>r.ok),completed:rows.length};
 const P=require('./prototype_ribbon.js'),pd=path.join(OUT,'prototypes/ribbon'),pa=[];previous=S.history();
 for(const file of read(path.join(pd,'examples.json')).files){const full=path.join(pd,file),v=await P.job({file:full,verify:true,previous});pa.push({file,...v});if(v.ok){const b=read(full);b.verification=v;b.card.ribbon.see='Clear the numbered source before its arrow tile, then follow the melt route without parking the clock too early.';fs.writeFileSync(full,JSON.stringify(b,null,2)+'\n');previous.push(M.Ledger.signature(b.design,b.card));}}
 results.prototypeAudit={ok:pa.length===2&&pa.every(r=>r.ok),rows:pa};fs.writeFileSync(path.join(pd,'audit-final.json'),JSON.stringify(results.prototypeAudit,null,2)+'\n');
 const R=require('./report_trap_mixes.js');selection.unitTests={ok:results.builder.ok,tests:12,log:'tests-final.log'};fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(selection,null,2)+'\n');R.catalogue();
 for(const file of read(path.join(pd,'examples.json')).files){const r=read(path.join(pd,file));fs.writeFileSync(path.join(pd,file.replace('.json','.svg')),R.svg(r));fs.writeFileSync(path.join(pd,file.replace('.json','.md')),`# Ribbon prototype · layout ${r.card.layout}\n\n${r.card.ribbon.see}\n\nTake tile ${r.card.ribbon.source} (1) before tile ${r.card.ribbon.target} (1→). Removing this link reduces the exact clock route from ${r.card.clock.fewestMoves} to ${r.card.ribbon.kWithout}. This is a separate demonstration board, not a numbered level.\n\n`+R.cardMarkdown(r,file).replace(/^# [^\n]*\n/,''));}
 results.render=command('schematic-render',['source/tools/builder/render_trap_mixes.js','splitThawLocks-L46-s7-p1.svg','frozenRoofShared-L18-s6-p2.svg']);
 results.ok=Object.values(results).every(r=>r.ok);fs.writeFileSync(path.join(report,'validation-final.json'),JSON.stringify(results,null,2)+'\n');if(!results.ok)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
