'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
function test(){
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
 const badProfiles=path.join(dir,'bad-profiles.json'),profiles=require('./human_style_profiles.json');
 fs.writeFileSync(badProfiles,JSON.stringify({...profiles,Dennis:{...profiles.Dennis,clockWeight:null}}));
 const bad=path.join(dir,'failed-workers');
 assert.throws(()=>execFileSync(process.execPath,[path.join(__dirname,'human_style_parallel_benchmark.js'),catalog,bad,'1',badProfiles,'4'],{windowsHide:true,stdio:'pipe'}));
 assert(!fs.existsSync(path.join(bad,'summary.json')),'Partial/failed worker output must never become a passing summary');
 assert(JSON.parse(fs.readFileSync(path.join(bad,'worker-exits.json'))).some(e=>e.exitCode!==0));
 console.log('PASS sequential/4-worker exact simulation parity and coverage; worker failures cannot produce a final summary');
}
if(require.main===module)test();module.exports=test;
