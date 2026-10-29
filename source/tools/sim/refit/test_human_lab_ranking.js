'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {ranks,spearman,prepareLabCatalog,summarizeLab}=require('./human_lab_ranking.js');
const {assertPrerequisites,verifyArchive}=require('./human_lab_benchmark.js');
function test(){
 assert.deepEqual(ranks([3,1,1,4]),[3,1.5,1.5,4]);
 assert.equal(spearman([1,2,3],[1,2,3]),1);assert.equal(spearman([1,2,3],[3,2,1]),-1);
 assert(Math.abs(spearman([1,1,2,3],[1,2,3,4])-.9486832980505138)<1e-12,'Tied values require average ranks, not the untied shortcut');
 assert.equal(spearman([1,2,3],[1,1,1]),null);assert.throws(()=>spearman([1,2],[1,null]));
 const game={tiles:[[0,0,0],[4,0,0]],faces:[1,1],down:[]};
 Object.defineProperty(game,'wonOn',{get(){throw Error('Model board read a human label');}});
 const rows=[1,2,3].map((wonOn,i)=>({name:'Dennisisdebeste',lv:[10011,10012,10015][i],wonOn,game,boardSource:'synthetic-statistical-fixture',historicalBoardExact:true}));
 const input={rows:rows.concat({name:'Dennisisdebeste',lv:10031,wonOn:2,game},{name:'Dennisisdebeste',lv:10050,game},{name:'Other',lv:10060,wonOn:2,game})};
 const prepared=prepareLabCatalog(input);assert.deepEqual(prepared.contract.levels,[10011,10012,10015]);assert.equal(prepared.excluded.length,2);assert(!Object.hasOwn(prepared.entries[0].game,'wonOn'));
 assert(prepareLabCatalog({rows:rows.concat({name:'Dennisisdebeste',lv:10060,wonOn:4,game,stackedRoles:true})}).contract.levels.includes(10060),'A newly recorded target joins the cohort; unsupported flags cannot silently remove it');
 assert.throws(()=>prepareLabCatalog({rows:rows.concat(rows[0])}));
 const clone=x=>JSON.parse(JSON.stringify(x));
 function measurement(entry,tries){
  const results=Array.from({length:20},()=>({wonOn:tries,verifiedTaps:tries??12,
   attempts:Array.from({length:tries??12},(_,i)=>({attempt:i+1,win:tries!==null&&i===tries-1,censored:false,taps:1,why:tries!==null&&i===tries-1?'cleared':'tray'}))}));
  return {lv:entry.lv,measure:{boardHash:entry.boardHash,runs:20,seed:20261029,version:'synthetic-statistical-model',profileHash:'one-fixed-profile',valid:true,censoredCampaigns:0,slowestMove:1,minutes:.001,
   firstTryRate:tries===1?1:0,averageTries:tries,cleared:tries===null?0:20,results}};
 }
 const complete=prepared.entries.map((e,i)=>measurement(e,i+1)),scored=summarizeLab(prepared,complete);
 assert.equal(scored.primarySpearman,1);assert(scored.rankingGateMet);assert.equal(scored.milestone3Met,false,'Statistical fixtures and a ranking alone do not certify the milestone');
 const capped=clone(complete);capped[2]=measurement(prepared.entries[2],null);const unresolved=summarizeLab(prepared,capped);
 assert.equal(unresolved.status,'unresolved-right-censoring');assert.equal(unresolved.primarySpearman,null);assert.equal(unresolved.secondary.restrictedMeanSpearman,1);assert(!unresolved.rankingGateMet,'A perfect restricted-mean diagnostic cannot replace an unresolved full-cohort primary');
 capped[2].measure.averageTries=12;assert.equal(summarizeLab(prepared,capped).status,'invalid','Never report a capped failure as clearing on the limit');
 assert.equal(summarizeLab(prepared,complete.slice(0,2)).primarySpearman,null,'Missing boards cannot be dropped to improve correlation');
 assert.equal(summarizeLab(prepared,complete.concat(complete[0])).status,'invalid');
 const mixed=clone(complete);mixed[1].measure.version='different-model';assert.equal(summarizeLab(prepared,mixed).status,'invalid');
 mixed[1].measure.version=complete[1].measure.version;mixed[1].measure.boardHash='different-board';assert.equal(summarizeLab(prepared,mixed).status,'invalid');
 const perfectSolver=prepared.entries.map(e=>measurement(e,1));assert.equal(summarizeLab(prepared,perfectSolver).status,'unresolved-constant-ranking','An always-perfect reference is not a measured human difficulty ranking');
 const changed=clone(prepared);changed.contract.minimumSpearman=0;assert.throws(()=>summarizeLab(changed,complete));
 assert.throws(()=>assertPrerequisites({finalGatesMet:false},{passed:true},[],[]),/Milestone2 is not passed/);
 assert.throws(()=>assertPrerequisites({finalGatesMet:true,valid:true,developmentScreen:false},{passed:true},[],[]),/coverage/,'A claimed green cannot replace full calibration evidence');
 const root=path.resolve(__dirname,'../../../..'),dir=path.join(root,'.codex-runs/human-style/lab-prepare-test-'+process.pid+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'input.json'),out=path.join(dir,'prepared');fs.writeFileSync(file,JSON.stringify(input));
 execFileSync(process.execPath,[path.join(__dirname,'human_lab_benchmark.js'),'--prepare',file,out],{windowsHide:true,stdio:'pipe'});
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'status.json'))).modelRuns,0);assert(!fs.existsSync(path.join(out,'records.jsonl')));
 const archive=path.join(dir,'archive');fs.mkdirSync(path.join(archive,'sources'),{recursive:true});fs.writeFileSync(path.join(archive,'sources/actor.js'),'one source');
 const crypto=require('crypto'),hash=crypto.createHash('sha256').update('one source').digest('hex'),identity=crypto.createHash('sha256').update(JSON.stringify([['actor.js',hash]])).digest('hex');
 fs.writeFileSync(path.join(archive,'source-manifest.json'),JSON.stringify({files:['actor.js'],hash:identity}));verifyArchive(archive);
 fs.appendFileSync(path.join(archive,'sources/actor.js'),' changed');assert.throws(()=>verifyArchive(archive),/modified/,'A passing source identity cannot survive archive tampering');
 fs.writeFileSync(path.join(archive,'source-manifest.json'),JSON.stringify({files:['../../outside'],hash:'unused'}));assert.throws(()=>verifyArchive(archive),/leaves/);
 const real=prepareLabCatalog(JSON.parse(fs.readFileSync(path.join(root,'source/analysis/lab-clears.json'))));
 assert.deepEqual(real.contract.levels,[10011,10012,10015,10032,10033,10041,10042,10044,10045,10046,10047,10048,10049,10052,10053]);
 console.log('PASS lab cohort and target isolation, tied Spearman, full-coverage/censoring/model-identity guards, prior-milestone rejection and preparation with zero model runs; no real lab performance measured');
}
if(require.main===module)test();module.exports=test;
