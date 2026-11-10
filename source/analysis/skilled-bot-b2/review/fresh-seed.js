'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve('..','gemini-skilled-bot-b2');
const bot=require(path.join(root,'source/analysis/skilled-bot-b2/candidate_measure.js'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'source/analysis/skilled-bot-b2/benchmark_manifest.json')));
const ids=['focal-g9','human-dev-factory2-184','human-dev-factory1-189','builder-qualified-223'];
const out=[];
for (const id of ids) {
 const b=manifest.boards.find(x=>x.id===id);
 const r=bot.measureHuman(b.board,{setting:'planner',seed:99173,runs:20,seeds:2,maxAttempts:20,allResults:true});
 const row={id,name:b.name,boardHash:b.boardHash,seed:99173,runs:20,seeds:2,maxAttempts:20,S:r.expectedTries,styles:r.plannerStyles,firstWins:r.firstTryWins,uncleared:r.unclearedAtAttemptLimit,total:r.totalCampaigns,valid:r.valid,byStyle:r.plannerResultsBySeed,timing:r.plannerTiming};
 out.push(row);fs.writeFileSync('source/build/b2-review/fresh-seed-results.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify({id,S:row.S,firstWins:row.firstWins,total:row.total,uncleared:row.uncleared}));
}
