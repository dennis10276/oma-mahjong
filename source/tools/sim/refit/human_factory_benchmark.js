'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {measureHuman}=require('./human_bot.js');
const {captureSources}=require('./human_level_sources.js');
const KEYS=['factory1-175','factory1-189','factory2-184','factory2-192','factory2-175'];
function main(){
 const [input,out,runsText='20',profileFile]=process.argv.slice(2);assert(input&&out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
 const profiles=profileFile?JSON.parse(fs.readFileSync(profileFile)):undefined;
 const raw=fs.readFileSync(input),data=JSON.parse(raw),source=captureSources(module),root=path.resolve(__dirname,'../../..');
 const contract={milestone:'human-v0',dataRef:'586f970ba01a4f75a65a17b98e4c7864e683d1b2',dataSha256:crypto.createHash('sha256').update(raw).digest('hex'),keys:KEYS,profiles:profiles??null,runs:Number(runsText),seed:20261029,maxAttempts:12,gates:{easyFirstStrictAbove:.5,hardBelowEveryEasyBy:.20,hardClockStrictAbove:.5,minutesStrictBelow:5,slowestMoveStrictBelow:2000},note:'Factory development benchmark, not prospective evidence; thresholds declared before runs; no labels or reference solutions passed to policy'};
 fs.writeFileSync(path.join(out,'contract.json'),JSON.stringify(contract,null,2));fs.writeFileSync(path.join(out,'input.json'),raw);
 for(const file of source.files){const to=path.join(out,'sources',file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,file),to);}
 source.verify();fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify(source,null,2));
 const rows=[];
 for(const key of KEYS){source.verify();const board=data.boards.find(b=>b.key===key);assert(board&&board.board);
  const result=measureHuman(board.board,{setting:'dennis',runs:contract.runs,seed:contract.seed,maxAttempts:contract.maxAttempts,...(profiles?{profiles}:{})});
  rows.push({key,...result});fs.appendFileSync(path.join(out,'records.jsonl'),JSON.stringify(rows.at(-1))+'\n');
  console.log(key,JSON.stringify({rate:result.firstTryRate,clock:result.lossPhase.beforeClock,minutes:result.minutes,slowestMove:result.slowestMove,valid:result.valid}));
 }
 source.verify();const easy=rows.slice(0,4),hard=rows[4],g=contract.gates;
 const checks={d:easy.every(r=>r.firstTryRate>g.easyFirstStrictAbove),e:easy.every(r=>r.firstTryRate-hard.firstTryRate>=g.hardBelowEveryEasyBy)&&hard.lossPhase.beforeClock>g.hardClockStrictAbove,timing:rows.every(r=>r.minutes<g.minutesStrictBelow&&r.slowestMove<g.slowestMoveStrictBelow),valid:rows.every(r=>r.valid)};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({contract,checks,passed:Object.values(checks).every(Boolean),rows:rows.map(({results,...r})=>r)},null,2));
 console.log(JSON.stringify(checks));
}
if(require.main===module)main();module.exports={main,KEYS};
