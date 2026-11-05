'use strict';
const assert=require('assert/strict'),crypto=require('crypto'),{performance}=require('perf_hooks');
const {normalizeBoard}=require('./public_board_input.js');
const {campaign}=require('./human_style_environment.js');
const defaults=require('./human_style_profiles.json');
const {createFactoryController}=require('./human_factory_controller.js');
const release=require('./human_release.js');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function estimateDifficulty(campaigns){
 const N=campaigns.length;
 let clearedSum=0,clearedCount=0,unclearedCount=0,totalAttempts=0;
 for(const c of campaigns){
  if(c.wonOn!==null){clearedSum+=c.wonOn;clearedCount++;totalAttempts+=c.wonOn;}
  else{unclearedCount++;totalAttempts+=c.attempts.length;}
 }
 const firstWins=campaigns.filter(c=>c.wonOn===1).length,firstTryRate=firstWins/N;
 if(unclearedCount===0){
  const exp=clearedSum/N;
  const label=(exp<=2.2&&firstTryRate>=0.25)||firstTryRate>=0.45?'easy':exp<=4.8?'right':'hard';
  return {expectedTries:Number(exp.toFixed(2)),label};
 }
 // human-g6.1 (Dennis 2026-11-02: "why does the bot have a cap at 12 tries? 150 is more tries for them"): a run that
 // is not won counts as all the tries it was allowed (now 20), the same cap as the yardstick puts on each player's
 // count; before, it counted as 4.5-8 tries, so no board could rate above 8.
 const exp=(clearedSum+campaigns.filter(c=>c.wonOn===null).reduce((t,c)=>t+c.attempts.length,0))/N;
 const label=(exp<=2.2&&firstTryRate>=0.25)||firstTryRate>=0.45?'easy':exp<=5.0?'right':'hard';
 return {expectedTries:Number(exp.toFixed(2)),label};
}

function measureHuman(board,options={}){
 assert(Object.keys(options).every(key=>['runs','seed','maxAttempts','profiles','capture','choiceLimit','setting','seeds'].includes(key)));
 const {runs=20,maxAttempts=20,profiles=defaults,capture=false,choiceLimit=1024,seeds=2}=options;
 const seed=options.seed??crypto.randomBytes(4).readUInt32LE();
 assert(Number.isInteger(runs)&&runs>0&&runs<=1000&&Number.isInteger(seed));
 assert(Number.isInteger(maxAttempts)&&maxAttempts>0&&maxAttempts<=40);
 assert(Number.isInteger(choiceLimit)&&choiceLimit>0);
 assert(Number.isInteger(seeds)&&seeds>=1&&seeds<=10);
 assert.deepEqual(Object.keys(profiles).sort(),['Dennis','family']);
 assert(options.setting===undefined||['dennis','family','planner'].includes(options.setting));
 // 'planner' (Claude 2026-11-03): Dennis's profile with his planning calibrated from the recordings - a take that
 // leaves 3 waiting after the clock costs, a look-ahead over known tiles, safe pairs first, turning tiles over, the full
 // work to the clock counted, and a route planner to the clock. His tray reaches 3 in 10.5% of his takes after the
 // clock; this player 10.7%. Used for "a skilled player can do it" and for luck, not as the difficulty meter.
  // routeNeed (2026-11-05, Dennis: "see how you would play the level and apply that logic in the bot"): the way to the clock
 // counts what the clock still needs (cover, ice, the locks beside it, the keys and their covers) and, when no whole way
 // shows, the best partial way that keeps a tray spot free. Two-island board 329724e3: 9.8 -> 2.1 tries; Dennis's 24 lab
 // boards: off by 2.18 -> 2.05, wrongly over 6 on 3 -> 2 (blind 183 14.8 -> 5.6, he needed 6); live 85-174: 1.08 -> 1.10.
 const PLANNER={spotPenalty:200,lookDepth:2,lookPenalty:150,lookFrom:1,pairFirst:100,freePeekBonus:70,clockNeedFull:1,routePlan:300,routeBeam:300,routeNeed:1,routeNeedTray:2};
 const pick=options.setting==='family'?'family':'Dennis';
 const encoded=normalizeBoard(board),start=performance.now(),settings={};
 const releasedProfiles=release.profiles;
 const selectedProfiles=options.setting&&!options.profiles?releasedProfiles:profiles;
 const isReleased=Object.entries(releasedProfiles).every(([name,reference])=>Object.keys(selectedProfiles[name]).length===Object.keys(reference).length&&Object.entries(reference).every(([key,value])=>selectedProfiles[name][key]===value));
 for(let [name,profile] of Object.entries(selectedProfiles)){
  if(options.setting&&name!==pick)continue;
  if(options.setting==='planner')profile={...profile,...PLANNER};
  const started=performance.now(),results=[],pooled=[];
  for(let run=0;run<runs;run++)results.push(campaign(encoded,profile,(seed+Math.imul(run+1,0x9e3779b9))|0,{maxAttempts,capture,choiceLimit,...(options.setting?{controllerFactory:createFactoryController}:{})}));
  pooled.push(...results);
  for(let s=1;s<seeds;s++){
   const seedS=(seed+s*7919)|0;
   for(let run=0;run<runs;run++)pooled.push(campaign(encoded,profile,(seedS+Math.imul(run+1,0x9e3779b9))|0,{maxAttempts,capture,choiceLimit,...(options.setting?{controllerFactory:createFactoryController}:{})}));
  }
  const phases={clock:0,mid:0,late:0},firstTryWins=results.filter(r=>r.wonOn===1).length;
  const firstTryCensored=results.filter(r=>r.attempts[0].censored).length;
  for(const r of results)for(const a of r.attempts)if(a.phase)phases[a.phase]++;
  const timingCounts={beforeClock:0,clockContact:0,mid:0,late:0};
  for(const r of results)for(const a of r.attempts)if(a.clockTiming)timingCounts[a.clockTiming]++;
  const losses=Object.values(phases).reduce((a,b)=>a+b,0),cleared=results.filter(r=>r.wonOn!==null);
  const diff=estimateDifficulty(pooled);
  settings[name]={firstTryRate:firstTryCensored?null:firstTryWins/runs,firstTryWins,firstTryCensored,runs,
   averageTries:cleared.length===runs?cleared.reduce((a,r)=>a+r.wonOn,0)/runs:null,
   averageTriesAmongCleared:cleared.length?cleared.reduce((a,r)=>a+r.wonOn,0)/cleared.length:null,
   expectedTries:diff.expectedTries,label:diff.label,
   cleared:cleared.length,censoredCampaigns:results.filter(r=>r.attempts.some(a=>a.censored)).length,
   unclearedAtAttemptLimit:results.filter(r=>r.wonOn===null&&!r.attempts.some(a=>a.censored)).length,
   lossTiming:{counts:timingCounts,shares:Object.fromEntries(Object.entries(timingCounts).map(([k,n])=>[k,losses?n/losses:null])),clockContactMaxRemovedTiles:2},
   lossCounts:phases,lossShares:Object.fromEntries(Object.entries(phases).map(([key,n])=>[key,losses?n/losses:null])),
   slowestMove:Math.max(...results.map(r=>r.slowestMove)),verifiedTaps:results.reduce((a,r)=>a+r.verifiedTaps,0),
   minutesPerBoard:(performance.now()-started)/60000,results};
 }
 if(options.setting){const r=settings[pick];return {firstTryRate:r.firstTryRate,averageTries:r.averageTries,expectedTries:r.expectedTries,label:r.label,lossPhase:{beforeClock:r.lossShares.clock,mid:r.lossShares.mid,late:r.lossShares.late},runs,slowestMove:r.slowestMove,minutes:r.minutesPerBoard,version:isReleased?release.version:'human-v1-development',calibrationStatus:isReleased?release.calibrationStatus:'experimental-not-calibrated',valid:r.slowestMove<2000&&r.censoredCampaigns===0,seed,boardHash:hash(encoded),profileHash:hash(selectedProfiles),...r};}
 return {schema:'human-style-measure-v1',calibrationStatus:'experimental-not-calibrated',seed,runs,maxAttempts,boardHash:hash(encoded),profileHash:hash(profiles),
  lateDefinition:'after clock, at most 10 tiles remaining',settings,minutesPerBoard:(performance.now()-start)/60000,
  valid:Object.values(settings).every(s=>s.slowestMove<2000&&s.censoredCampaigns===0)};
}
module.exports={measureHuman};
if(require.main===module){
 const fs=require('fs'),input=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
 process.stdout.write(JSON.stringify(measureHuman(input,{runs:Number(process.argv[3]??20)}),null,2)+'\n');
}
