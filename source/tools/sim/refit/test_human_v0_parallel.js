'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const {measureHuman,VERSION}=require('./human_bot.js'),{CONTRACT}=require('./human_style_benchmark.js');
function test(){
 const root=path.resolve(__dirname,'../../../..'),out=path.join(root,'.codex-runs/human-style/v0-parallel-test-'+process.pid+'-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const game={tiles:[[0,0,0],[4,0,0],[8,0,0],[12,0,0]],faces:[1,1,2,2],down:[]};
 const catalog=path.join(out,'catalog.json');fs.writeFileSync(catalog,JSON.stringify({entries:[89,91,...Array.from({length:72},(_,i)=>92+i)].map(lv=>({lv,game,boardSource:'synthetic-version-parity',historicalBoardExact:false}))}));
 const destination=path.join(out,'parallel');execFileSync(process.execPath,[path.join(__dirname,'human_style_parallel_benchmark.js'),catalog,destination,'12','','2','human-v0'],{windowsHide:true,stdio:'pipe'});
 const rows=fs.readFileSync(path.join(destination,'records.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(rows.length,74);const science=s=>({first:s.firstTryRate,wins:s.firstTryWins,lossCounts:s.lossCounts,mean:s.averageTries,results:s.results.map(r=>({wonOn:r.wonOn,attempts:r.attempts,verifiedTaps:r.verifiedTaps}))});
 for(const [name,setting] of [['Dennis','dennis'],['family','family']]){
  const serial=measureHuman(game,{runs:20,seed:CONTRACT.seed,maxAttempts:12,setting});
  for(const row of rows){assert.equal(row.measure.model,VERSION);assert.deepEqual(science(row.measure.settings[name]),science(serial));assert.equal(row.measure.settings[name].version,VERSION);}
 }
 assert.equal(JSON.parse(fs.readFileSync(path.join(destination,'summary.json'))).model,VERSION);
 assert(JSON.parse(fs.readFileSync(path.join(destination,'worker-exits.json'))).every(x=>x.exitCode===0));
 console.log('PASS selected human-v0 benchmark runs both actual model profiles, preserves serial games/physical replay and measures all74 boards with immutable workers');
}
if(require.main===module)test();module.exports=test;
