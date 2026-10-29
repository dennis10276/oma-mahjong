'use strict';
const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const {measureHuman}=require('./human_style_measure.js');
const {captureSources}=require('./human_level_sources.js');
const CONTRACT=require('./human_style_contract_v2.json');
function summarize(rows,maxAttempts){
 const result={};
 for(const name of ['Dennis','family']){
  const main=rows.filter(r=>r.lv>=92&&r.lv<=163),samples=main.reduce((a,r)=>a+r.measure.settings[name].runs,0);
  const first=main.some(r=>r.measure.settings[name].firstTryCensored>0)?null:main.reduce((a,r)=>a+r.measure.settings[name].firstTryWins,0)/samples;
  const counts={clock:0,mid:0,late:0};
  for(const r of main)for(const k of Object.keys(counts))counts[k]+=r.measure.settings[name].lossCounts[k];
  const total=Object.values(counts).reduce((a,b)=>a+b,0),shares=Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,total?n/total:null]));
  const cohortLoss=ids=>{const rs=ids.map(lv=>rows.find(r=>r.lv===lv));assert(rs.every(Boolean));return rs.some(r=>r.measure.settings[name].firstTryRate===null)?null:rs.reduce((a,r)=>a+1-r.measure.settings[name].firstTryRate,0)/rs.length;};
  const riskLoss=cohortLoss(CONTRACT.cohorts[name].risk),controlLoss=cohortLoss(CONTRACT.cohorts[name].controls);
  const clockCases=Object.fromEntries(CONTRACT.clockCases.map(lv=>[lv,rows.find(r=>r.lv===lv).measure.settings[name].lossShares.clock]));
  const interval=name==='Dennis'?CONTRACT.gates.DennisFirst:CONTRACT.gates.familyFirst;
  const phaseInterval=CONTRACT.gates.beforeClock[name],level142=rows.find(r=>r.lv===142)?.measure.settings[name];
  const timingCounts={beforeClock:0,clockContact:0,mid:0,late:0};let timingComplete=true,timingConsistent=true;
  for(const r of main){const t=r.measure.settings[name].lossTiming;if(!t){timingComplete=false;continue;}const values=Object.keys(timingCounts).map(k=>t.counts?.[k]);if(!values.every(v=>Number.isInteger(v)&&v>=0)||values.reduce((a,b)=>a+b,0)!==Object.values(r.measure.settings[name].lossCounts).reduce((a,b)=>a+b,0)||t.counts.beforeClock!==r.measure.settings[name].lossCounts.clock)timingConsistent=false;for(const k of Object.keys(timingCounts))timingCounts[k]+=t.counts[k];}
  const checks={a:first!==null&&first>=interval[0]&&first<=interval[1],
   b:shares.clock!==null&&shares.clock>=phaseInterval[0]&&shares.clock<=phaseInterval[1],
   c:riskLoss!==null&&controlLoss!==null&&riskLoss-controlLoss>=CONTRACT.gates.riskMinusControlLossAtLeast,
   level142:name==='Dennis'?level142?.firstTryRate>CONTRACT.gates.level142.DennisFirstAbove:level142?.cleared/level142?.runs>=CONTRACT.gates.level142.familyClearedRateAtLeast};
  const lossTiming={complete:timingComplete,consistent:timingConsistent,counts:timingComplete?timingCounts:null,shares:timingComplete?Object.fromEntries(Object.entries(timingCounts).map(([k,n])=>[k,total?n/total:null])):null};
  result[name]={firstTryRate:first,samples,lossCounts:counts,lossShares:shares,riskLoss,controlLoss,clockCases,lossTiming,checks};
 }
 const valid=rows.every(r=>r.measure.valid),patterns=valid&&Object.values(result).every(s=>Object.values(s.checks).every(Boolean)&&s.lossTiming.complete&&s.lossTiming.consistent);
 return {settings:result,developmentScreen:maxAttempts<12,patternGatesMet:patterns,finalGatesMet:maxAttempts===12&&patterns&&Object.values(result).every(r=>r.lossTiming.complete),contractSchema:CONTRACT.schema,
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
