'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{execFileSync,spawn}=require('child_process');
async function test(){
 const root=path.resolve(__dirname,'../../../..'),dir=path.join(root,'.codex-runs/human-style/parallel-test-'+process.pid+'-'+Date.now());
 fs.mkdirSync(dir,{recursive:true});
 const tiles=Array.from({length:6},(_,i)=>({x:i*4,y:0,z:0}));
 const game={tiles,faces:[1,1,2,2,3,3],down:Array(6).fill(0)};
 const catalog=path.join(dir,'catalog.json');
 fs.writeFileSync(catalog,JSON.stringify({entries:[89,91,...Array.from({length:72},(_,i)=>92+i)].map(lv=>({lv,game,boardSource:'syntheticParityFixture',historicalBoardExact:false}))}));
 const serial=path.join(dir,'serial'),parallel=path.join(dir,'parallel');
 execFileSync(process.execPath,[path.join(__dirname,'human_style_benchmark.js'),catalog,serial,'1'],{windowsHide:true,stdio:'pipe'});
 execFileSync(process.execPath,[path.join(__dirname,'human_style_parallel_benchmark.js'),catalog,parallel,'1','','4'],{windowsHide:true,stdio:'pipe'});
 const read=folder=>fs.readFileSync(path.join(folder,'records.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 const scientific=rows=>rows.map(r=>({lv:r.lv,hash:r.measure.boardHash,seed:r.measure.seed,
  settings:Object.fromEntries(Object.entries(r.measure.settings).map(([name,s])=>[name,{rate:s.firstTryRate,counts:s.lossCounts,
   results:s.results.map(c=>({wonOn:c.wonOn,attempts:c.attempts,verified:c.verifiedTaps}))}]))}));
 assert.deepEqual(scientific(read(parallel)),scientific(read(serial)),'Worker scheduling must not change the games, seeds, coverage, censoring or rates');
 assert(JSON.parse(fs.readFileSync(path.join(parallel,'worker-exits.json'))).every(e=>e.exitCode===0));
 assert(JSON.parse(fs.readFileSync(path.join(parallel,'worker-exits.json'))).every(e=>e.entrypoint.startsWith(path.join(parallel,'sources'))));
 const manifest=JSON.parse(fs.readFileSync(path.join(parallel,'source-manifest.json'))),live=path.join(dir,'isolated-live-source');
 for(const file of manifest.files){const to=path.join(live,file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(parallel,'sources',file),to);}
 const isolated=path.join(dir,'snapshot-isolation'),liveActor=path.join(live,'tools/sim/refit/human_style_controller.js');
 // Change only a disposable copied checkout after its worker task is written.
 // The real workspace is never edited by this concurrency test.
 const helper=spawn(process.execPath,['-e',
  'const fs=require("fs"),[task,actor]=process.argv.slice(1);const t=setInterval(()=>{if(fs.existsSync(task)){fs.appendFileSync(actor,"\\n// isolated test edit\\n");clearInterval(t);process.exit(0);}},5);setTimeout(()=>process.exit(2),10000);',
  path.join(isolated,'worker-0/task.json'),liveActor],{windowsHide:true,stdio:'ignore'});
 const helperExit=new Promise((resolve,reject)=>{helper.on('error',reject);helper.on('close',code=>resolve(code));});
 execFileSync(process.execPath,[path.join(live,'tools/sim/refit/human_style_parallel_benchmark.js'),catalog,isolated,'1','','4'],{windowsHide:true,stdio:'pipe'});
 assert.equal(await helperExit,0);assert(fs.readFileSync(liveActor,'utf8').includes('// isolated test edit'));
 assert.deepEqual(scientific(read(isolated)),scientific(read(serial)),'Editing a live copied checkout must not contaminate an already archived run');
 const archiveProfile=path.join(parallel,'sources/tools/sim/refit/human_style_profiles.json');
 const beforeBytes=fs.statSync(path.join(parallel,'worker-0/records.jsonl')).size;
 fs.appendFileSync(archiveProfile,' ');
 assert.throws(()=>execFileSync(process.execPath,[path.join(parallel,'sources/tools/sim/refit/human_style_parallel_benchmark.js'),'--worker',path.join(parallel,'worker-0/task.json')],{windowsHide:true,stdio:'pipe'}));
 assert.equal(fs.statSync(path.join(parallel,'worker-0/records.jsonl')).size,beforeBytes,'A tampered snapshot must fail before adding any game result');
 const badProfiles=path.join(dir,'bad-profiles.json'),profiles=require('./human_style_profiles.json');
 fs.writeFileSync(badProfiles,JSON.stringify({...profiles,Dennis:{...profiles.Dennis,clockWeight:null}}));
 const bad=path.join(dir,'failed-workers');
 assert.throws(()=>execFileSync(process.execPath,[path.join(__dirname,'human_style_parallel_benchmark.js'),catalog,bad,'1',badProfiles,'4'],{windowsHide:true,stdio:'pipe'}));
 assert(!fs.existsSync(path.join(bad,'summary.json')),'Partial/failed worker output must never become a passing summary');
 assert(JSON.parse(fs.readFileSync(path.join(bad,'worker-exits.json'))).some(e=>e.exitCode!==0));
 console.log('PASS sequential/4-worker exact parity, live-edit snapshot isolation, archive tamper rejection and failed-worker accounting');
}
if(require.main===module)test().catch(error=>{console.error(error.stack);process.exitCode=1;});module.exports=test;
