'use strict';
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const {measureHuman}=require('./human_style_measure.js');
const {captureSources}=require('./human_level_sources.js');
const CONTRACT={schema:'human-style-pattern-contract-v1',seed:20261028,runs:20,
 progression:{from:92,to:163,count:72},risk:[132,144,91,89,99,122,142,96,143,94],
 controls:[97,102,103,105,107,110,112,113,114,117],clockCases:[132,135,142,144],
 controlsSource:'first ten ascending levels92-163 with >=1 win and zero observed clock/tray/stuck losses across all cached plays.json players; archival coverage ends Dennis150, Mrs103; absence of observed loss is not proof nobody ever lost',
 lateDefinition:'after clock, at most10 remaining tiles',
 gates:{DennisFirst:[.50,.55],familyFirst:[.25,.35],clock:[.55,.60],mid:[.30,.45],lateBelow:.10,
  riskMinusControlLossAtLeast:.10,eachClockCaseClockShareAbove:.50},
 caveats:['risk labels supplied by user; archived plays coverage is incomplete','89 and91 may use reconstructed boards; preserve provenance',
 'one-attempt screens are development only; final aggregate requires multi-attempt campaigns','no per-level policy parameters'],
 stopRule:'Stop after eight experiments without progress on a-c. Baseline is prerequisite, not completion.'};
function summarize(rows,maxAttempts){
 const result={};
 for(const name of ['Dennis','family']){
  const main=rows.filter(r=>r.lv>=92&&r.lv<=163),samples=main.reduce((a,r)=>a+r.measure.settings[name].runs,0);
  const first=main.reduce((a,r)=>a+r.measure.settings[name].firstTryWins,0)/samples;
  const counts={clock:0,mid:0,late:0};
  for(const r of main)for(const k of Object.keys(counts))counts[k]+=r.measure.settings[name].lossCounts[k];
  const total=Object.values(counts).reduce((a,b)=>a+b,0),shares=Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,total?n/total:null]));
  const cohortLoss=ids=>{const rs=ids.map(lv=>rows.find(r=>r.lv===lv));assert(rs.every(Boolean));return rs.reduce((a,r)=>a+1-r.measure.settings[name].firstTryRate,0)/rs.length;};
  const riskLoss=cohortLoss(CONTRACT.risk),controlLoss=cohortLoss(CONTRACT.controls);
  const clockCases=Object.fromEntries(CONTRACT.clockCases.map(lv=>[lv,rows.find(r=>r.lv===lv).measure.settings[name].lossShares.clock]));
  const interval=name==='Dennis'?CONTRACT.gates.DennisFirst:CONTRACT.gates.familyFirst;
  const checks={a:first>=interval[0]&&first<=interval[1],
   b:shares.clock>=.55&&shares.clock<=.60&&shares.mid>=.30&&shares.mid<=.45&&shares.late<.10,
   c:riskLoss-controlLoss>=.10&&Object.values(clockCases).every(value=>value!==null&&value>.5)};
  result[name]={firstTryRate:first,samples,lossCounts:counts,lossShares:shares,riskLoss,controlLoss,clockCases,checks};
 }
 const valid=rows.every(r=>r.measure.valid),patterns=valid&&Object.values(result).every(s=>Object.values(s.checks).every(Boolean));
 return {settings:result,developmentScreen:maxAttempts<12,patternGatesMet:patterns,finalGatesMet:maxAttempts===12&&patterns,
  valid,minutesPerBoard:rows.reduce((a,r)=>a+r.measure.minutesPerBoard,0)/rows.length};
}
function main(){
 const [catalogFile,outDirectory,attempts='1',profileFile]=process.argv.slice(2);assert(catalogFile&&outDirectory);
 fs.mkdirSync(outDirectory,{recursive:true});
 const sources=captureSources(module),root=path.resolve(__dirname,'../../..');
 for(const file of sources.files){const to=path.join(outDirectory,'sources',file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,file),to,fs.constants.COPYFILE_EXCL);}
 fs.writeFileSync(path.join(outDirectory,'source-manifest.json'),JSON.stringify({hash:sources.hash,files:sources.files},null,2)+'\n',{flag:'wx'});
 const contractFile=path.join(outDirectory,'contract.json');fs.writeFileSync(contractFile,JSON.stringify(CONTRACT,null,2)+'\n',{flag:'wx'});
 const profiles=profileFile?JSON.parse(fs.readFileSync(profileFile)):require('./human_style_profiles.json');
 fs.writeFileSync(path.join(outDirectory,'profiles.json'),JSON.stringify(profiles,null,2)+'\n',{flag:'wx'});
 const catalog=JSON.parse(fs.readFileSync(catalogFile)),rows=[],maxAttempts=+attempts;
 const entries=catalog.entries.filter(e=>e.lv>=92&&e.lv<=163||CONTRACT.risk.includes(e.lv)).sort((a,b)=>a.lv-b.lv);
 assert.equal(entries.length,74);
 assert.equal(new Set(entries.map(e=>e.lv)).size,74,'Duplicate benchmark board');
 assert.equal(entries.filter(e=>e.lv>=92&&e.lv<=163).length,72);
 fs.writeFileSync(path.join(outDirectory,'catalog.json'),JSON.stringify({observedAt:catalog.observedAt,entries},null,2)+'\n',{flag:'wx'});
 for(const e of entries){
  sources.verify();
  const measure=measureHuman(e.game,{runs:CONTRACT.runs,seed:CONTRACT.seed,maxAttempts,profiles});
  rows.push({lv:e.lv,boardSource:e.boardSource,historicalBoardExact:e.historicalBoardExact,measure});
  fs.appendFileSync(path.join(outDirectory,'records.jsonl'),JSON.stringify(rows.at(-1))+'\n');
 }
 const summary=summarize(rows,maxAttempts);
 sources.verify();
 fs.writeFileSync(path.join(outDirectory,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));if(!summary.valid)process.exitCode=2;
}
if(require.main===module)main();
module.exports={CONTRACT,summarize};
