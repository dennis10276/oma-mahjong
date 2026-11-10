'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-skilled-bot-b3');
const bot=require(path.join(root,'source/analysis/skilled-bot-b3/candidate_measure.js'));
const m=JSON.parse(fs.readFileSync(path.join(root,'source/analysis/skilled-bot-b3/benchmark_manifest.json')));
const ids=['builder-qualified-223','human-reserved-blind1-185'];const out=[];
for(const id of ids){
 const b=m.boards.find(x=>x.id===id);if(!b)throw Error('Missing '+id);
 const r=bot.measureHuman(b.board,{setting:'planner',seed:424243,runs:20,seeds:2,maxAttempts:20,allResults:true});
 const row={id,boardHash:b.boardHash,seed:424243,runs:20,seeds:2,maxAttempts:20,S:r.expectedTries,styles:r.plannerStyles,firstWins:r.firstTryWins,uncleared:r.unclearedAtAttemptLimit,total:r.totalCampaigns,valid:r.valid,byStyle:r.plannerResultsBySeed,timing:r.plannerTiming};
 out.push(row);fs.writeFileSync('source/build/b3-review/fresh-seed-results.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify({id,S:row.S,firstWins:row.firstWins,uncleared:row.uncleared,total:row.total}));
}
