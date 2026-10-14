/* Fresh observation-only bot runs; descriptive measurement, never a no-guess proof. */
'use strict';
const fs=require('fs'),path=require('path'),H=require('../../www/hard'),{game}=require('./tighten_clocks'),A=require('./audit_information');
const runs=+(process.argv[2]||1024),seed=1210997,T=A.readTable('www/levels-hard.js'),rows=[];
const report={runs,seed,profile:H.persona('focused'),observerHash:A.hash(H.play.toString()),visibility:'Existing observer: non-exactly-covered face-up faces and all takeable face-down faces are known. Blocked-tap x-ray is not simulated. Free peeks are idealised.',definition:'An unknown-partner selection is a deliberately selected single tile whose matching face is neither in the tray nor among currently known remaining tiles. This is not synonymous with an unavoidable guess. Zero such selections does not prove a guaranteed winning strategy.',rows};
for(let lv=80;lv<=269;lv++){
 const row=T.levels[lv-T.from],d=H.unpack(lv,row),g=game(d);let wins=0,blindWins=0,zeroBlindGames=0,blind=0,decisions=0,forcedGames=0;
 for(let k=0;k<runs;k++){
  const r=H.play(g,H.persona('focused'),seed*7919+k*104729);
  wins+=+r.win;blindWins+=+(r.win&&r.blind>0);zeroBlindGames+=+(r.blind===0);blind+=r.blind;decisions+=r.decisions;forcedGames+=+(r.forcedBlind>0);
 }
 rows.push({lv,boardHash:A.hash(JSON.stringify(row)),wins,zeroUnknownPartnerWins:wins-blindWins,winningRunsWithUnknownPartner:blindWins,zeroUnknownPartnerGames:zeroBlindGames,gamesWithAllSinglesUnknownAtSomePoint:forcedGames,unknownPartnerSelections:blind,decisions,winRate:wins/runs,unknownPartnerSelectionRate:blind/decisions});
 if(lv%10===0)console.log(lv+' measured');
}
report.summary={games:rows.length*runs,wins:rows.reduce((s,r)=>s+r.wins,0),zeroUnknownPartnerWins:rows.reduce((s,r)=>s+r.zeroUnknownPartnerWins,0),levelsWithZeroUnknownPartnerWin:rows.filter(r=>r.zeroUnknownPartnerWins>0).length,unknownPartnerSelections:rows.reduce((s,r)=>s+r.unknownPartnerSelections,0),decisions:rows.reduce((s,r)=>s+r.decisions,0)};
fs.writeFileSync(path.resolve(__dirname,'../../analysis/information-measurement.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
