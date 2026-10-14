/* Offline measurements of a verified HTTP snapshot of the LIVE app. No deployment,
 * game modification, or player/database access. Output is separate from draft audits.
 * Run: node tools/sim/measure_live_information.js [games-per-level=4096]
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const H=require('../../www/hard'),L=require('../../www/layouts'),A=require('./audit_information'),{game}=require('./tighten_clocks');
const ROOT=path.resolve(__dirname,'../..'),BASE='https://dennis10276.github.io/oma-mahjong/play/';
const OUT=path.join(ROOT,'analysis/live-information-80-150'),FROM=80,TO=150,SEED=1210997;
async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+' HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
const sum=(rows,key)=>rows.reduce((s,r)=>s+r[key],0);
function summarize(rows,runs){return {levels:rows.length,games:rows.length*runs,validWinningRoutes:rows.filter(r=>r.route.valid).length,wins:sum(rows,'wins'),zeroUnknownPartnerWins:sum(rows,'zeroUnknownPartnerWins'),levelsWithWins:rows.filter(r=>r.wins>0).length,levelsWithZeroUnknownPartnerWin:rows.filter(r=>r.zeroUnknownPartnerWins>0).length,unknownPartnerSelections:sum(rows,'unknownPartnerSelections'),decisions:sum(rows,'decisions'),gamesWithAllSinglesUnknownAtSomePoint:sum(rows,'gamesWithAllSinglesUnknownAtSomePoint'),clockLosses:sum(rows,'clockLosses'),clockReached:sum(rows,'clockReached')};}
async function main(){
 const runs=+(process.argv[2]||4096);if(!Number.isInteger(runs)||runs<1)throw Error('Positive integer runs required');
 fs.mkdirSync(OUT,{recursive:true});
 const protectedFiles=['www/hard.js','www/levels-hard.js','www/layouts.js','www/js/rules.js','www/js/board.js','www/style.css'];
 const before=Object.fromEntries(protectedFiles.map(f=>[f,A.hash(fs.readFileSync(path.join(ROOT,f)))]));
 const versionBefore=JSON.parse(await get(BASE+'version.json')),v=versionBefore.v;
 if(!/^\d+(\.\d+)*$/.test(v))throw Error('Invalid live version');
 const targets=['index.html','bundle.json',...['levels-hard.js','hard.js','layouts.js','js/board.js','js/rules.js','style.css'].map(f=>'v/'+v+'/'+f)];
 const fetched=await Promise.all(targets.map(async file=>({file,url:BASE+file,bytes:await get(BASE+file)})));
 const versionAfter=JSON.parse(await get(BASE+'version.json'));if(versionAfter.v!==v)throw Error('Live version changed during snapshot');
 const byFile=Object.fromEntries(fetched.map(r=>[r.file,r.bytes])),bundle=JSON.parse(byFile['bundle.json']);
 if(bundle.v!==v)throw Error('App bundle does not match live version');
 const levels=byFile['v/'+v+'/levels-hard.js'],bundleLevels=bundle.js.find(s=>/const HARD_LEVELS\s*=/.test(s));
 if(!bundleLevels||A.hash(Buffer.from(bundleLevels))!==A.hash(levels))throw Error('Browser level table differs from app bundle');
 if(A.hash(byFile['v/'+v+'/layouts.js'])!==before['www/layouts.js'])throw Error('Live legality rules differ from audit oracle; adapt audit before measuring');
 const T=vm.runInNewContext(levels.toString('utf8')+';HARD_LEVELS');
 if(FROM<T.from||TO>=T.from+T.levels.length)throw Error('Live table does not contain the requested range');
 const liveH=vm.runInNewContext(byFile['v/'+v+'/hard.js'].toString('utf8')+';Hard',{Layouts:L});
 for(let lv=FROM;lv<=TO;lv++)if(JSON.stringify(liveH.unpack(lv,T.levels[lv-T.from]))!==JSON.stringify(H.unpack(lv,T.levels[lv-T.from])))throw Error('Live unpack differs at '+lv);
 for(const r of fetched){const target=path.join(OUT,'snapshot',r.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,r.bytes);}
 const manifest={verifiedAt:new Date().toISOString(),base:BASE,version:v,from:FROM,to:TO,appBundleMatchesVersionedLevelTable:true,liveLegalityMatchesAuditOracle:true,liveUnpackerMatchesAuditUnpacker:true,liveFocusedProfileMatchesAudit:JSON.stringify(liveH.persona('focused'))===JSON.stringify(H.persona('focused')),files:fetched.map(({file,url,bytes})=>({file,url,sha256:A.hash(bytes),size:bytes.length})),protectedGameHashes:before};
 fs.writeFileSync(path.join(OUT,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Verified live '+v+', levels '+FROM+'–'+TO+', '+runs+' fresh games per level.');
 const rows=[],report={version:v,from:FROM,to:TO,runs,seed:SEED,source:'Verified live app bundle and versioned browser assets',profile:H.persona('focused'),observerHash:A.hash(H.play.toString()),observerModelVersion:H.MODEL_VERSION,observerNote:'Corrected audit observer; not the older observer shipped with 1.49. Hidden identities cannot affect candidate choices. Profile matches the live focused profile.',visibility:'Non-exactly-covered face-up faces and takeable face-down faces are treated as known. Free peeks are idealised; blocked-tap x-ray and count-based deduction are not simulated.',definition:'Unknown-partner selection: selected single whose matching face is neither in the tray nor among known remaining tiles. It is not equivalent to an unavoidable guess. A zero count is not a proof of deduction-only play.',rows};
 for(let lv=FROM;lv<=TO;lv++){
  const packed=T.levels[lv-T.from],d=H.unpack(lv,packed),g=game(d),route=A.savedRouteMetrics(d);
  if(!route.valid)throw Error('Live full winning witness invalid at '+lv);
  let wins=0,blindWins=0,zeroBlindGames=0,blind=0,decisions=0,forcedGames=0,clockLosses=0,clockReached=0;
  const failureReasons={},examples={win:null,zeroUnknownPartnerWin:null};
  for(let k=0;k<runs;k++){
   const seed=SEED*7919+k*104729,r=H.play(g,H.persona('focused'),seed);
   wins+=+r.win;blindWins+=+(r.win&&r.blind>0);zeroBlindGames+=+(r.blind===0);blind+=r.blind;decisions+=r.decisions;forcedGames+=+(r.forcedBlind>0);clockLosses+=+(r.why==='clock');clockReached+=+(r.at[d.clock.i]>=0);
   if(r.win&&examples.win===null)examples.win={k,seed};if(r.win&&r.blind===0&&examples.zeroUnknownPartnerWin===null)examples.zeroUnknownPartnerWin={k,seed};
   if(!r.win)failureReasons[r.why]=(failureReasons[r.why]||0)+1;
  }
  const r={lv,boardHash:A.hash(JSON.stringify(packed)),tileCount:d.tiles.length,faceDownCount:d.down.length,clock:d.clock,route,witness:d.solution,wins,zeroUnknownPartnerWins:wins-blindWins,winningRunsWithUnknownPartner:blindWins,zeroUnknownPartnerGames:zeroBlindGames,gamesWithAllSinglesUnknownAtSomePoint:forcedGames,unknownPartnerSelections:blind,decisions,clockLosses,clockReached,failureReasons,examples,winRate:wins/runs,unknownPartnerSelectionRate:decisions?blind/decisions:0};
  rows.push(r);report.summary=summarize(rows,runs);fs.writeFileSync(path.join(OUT,'measurements.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({level:lv,wins,zeroUnknownPartnerWins:r.zeroUnknownPartnerWins,clockLosses}));
 }
 report.gameFilesUnchanged=protectedFiles.every(f=>before[f]===A.hash(fs.readFileSync(path.join(ROOT,f))));
 if(!report.gameFilesUnchanged)throw Error('Game files changed during audit');
 report.summary=summarize(rows,runs);report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,'measurements.json'),JSON.stringify(report,null,2)+'\n');
 const csv=['level,games,wins,win_percent,wins_without_unknown_partner_selection,unknown_partner_selections,decisions,clock_losses,clock_reached,winning_route_verified'];
 for(const r of rows)csv.push([r.lv,runs,r.wins,(r.winRate*100).toFixed(3),r.zeroUnknownPartnerWins,r.unknownPartnerSelections,r.decisions,r.clockLosses,r.clockReached,r.route.valid].join(','));
 fs.writeFileSync(path.join(OUT,'measurements.csv'),csv.join('\n')+'\n');
 console.log(JSON.stringify(report.summary));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
