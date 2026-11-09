'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-skilled-bot-b1');
const base=require(path.join(root,'source/tools/sim/refit/human_planner_measure_fast.js'));
const cand=require(path.join(root,'source/analysis/skilled-bot-b1/candidate_measure.js'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const labs=read('source/analysis/factory/dennis-plays.json').boards;
const qualified=fs.readFileSync(path.join(root,'source/analysis/builder/data/qualified-200-225.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const cases=[['G9',read('source/analysis/skilled-bot-b1/evidence/g9-board.json')],['factory2-184',labs.find(b=>b.key==='factory2-184').board],...qualified.filter(q=>[201,223].includes(q.level)).map(q=>['qualified-'+q.level,q.design])];
const results=[];
for (const [name,board] of cases) {
 const row={name,seed:18427,runs:20,seeds:2,maxAttempts:20,faceDown:board.down?.length};
 for(const [label,bot] of [['baseline',base],['candidate',cand]]) {
  const r=bot.measureHuman(board,{setting:'planner',seed:18427,runs:20,seeds:2,maxAttempts:20,allResults:true});
  const cs=r.results;
  row[label]={S:r.expectedTries,styles:r.plannerStyles,pooledFirst:cs.filter(c=>c.wonOn===1).length,pooledUncleared:cs.filter(c=>c.wonOn===null).length,campaigns:cs.length,valid:r.valid,resultsBySeed:r.resultsBySeed};
 }
 results.push(row);fs.writeFileSync('source/build/b1-review/fresh-seed-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(row));
}
