'use strict';
const assert=require('assert/strict'),crypto=require('crypto'),{performance}=require('perf_hooks');
const {normalizeBoard}=require('./public_board_input.js');
const {campaign}=require('./human_style_environment.js');
const defaults=require('./human_style_profiles.json');
const {createFactoryController,PROFILES:factoryProfiles}=require('./human_factory_controller.js');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function measureHuman(board,options={}){
 assert(Object.keys(options).every(key=>['runs','seed','maxAttempts','profiles','capture','choiceLimit','setting'].includes(key)));
 const {runs=20,maxAttempts=12,profiles=defaults,capture=false,choiceLimit=1024}=options;
 const seed=options.seed??crypto.randomBytes(4).readUInt32LE();
 assert(Number.isInteger(runs)&&runs>0&&runs<=1000&&Number.isInteger(seed));
 assert(Number.isInteger(maxAttempts)&&maxAttempts>0&&maxAttempts<=12);
 assert(Number.isInteger(choiceLimit)&&choiceLimit>0);
 assert.deepEqual(Object.keys(profiles).sort(),['Dennis','family']);
 assert(options.setting===undefined||['dennis','family'].includes(options.setting));
 const encoded=normalizeBoard(board),start=performance.now(),settings={};
 const selectedProfiles=options.setting&&!options.profiles?{Dennis:factoryProfiles.dennis,family:factoryProfiles.family}:profiles;
 for(const [name,profile] of Object.entries(selectedProfiles)){
  if(options.setting&&name!==(options.setting==='dennis'?'Dennis':'family'))continue;
  const started=performance.now(),results=[];
  for(let run=0;run<runs;run++)results.push(campaign(encoded,profile,(seed+Math.imul(run+1,0x9e3779b9))|0,{maxAttempts,capture,choiceLimit,...(options.setting?{controllerFactory:createFactoryController}:{})}));
  const phases={clock:0,mid:0,late:0},firstTryWins=results.filter(r=>r.wonOn===1).length;
  const firstTryCensored=results.filter(r=>r.attempts[0].censored).length;
  for(const r of results)for(const a of r.attempts)if(a.phase)phases[a.phase]++;
  const losses=Object.values(phases).reduce((a,b)=>a+b,0),cleared=results.filter(r=>r.wonOn!==null);
  settings[name]={firstTryRate:firstTryCensored?null:firstTryWins/runs,firstTryWins,firstTryCensored,runs,
   averageTries:cleared.length===runs?cleared.reduce((a,r)=>a+r.wonOn,0)/runs:null,
   averageTriesAmongCleared:cleared.length?cleared.reduce((a,r)=>a+r.wonOn,0)/cleared.length:null,
   cleared:cleared.length,censoredCampaigns:results.filter(r=>r.attempts.some(a=>a.censored)).length,
   unclearedAtAttemptLimit:results.filter(r=>r.wonOn===null&&!r.attempts.some(a=>a.censored)).length,
   lossCounts:phases,lossShares:Object.fromEntries(Object.entries(phases).map(([key,n])=>[key,losses?n/losses:null])),
   slowestMove:Math.max(...results.map(r=>r.slowestMove)),verifiedTaps:results.reduce((a,r)=>a+r.verifiedTaps,0),
   minutesPerBoard:(performance.now()-started)/60000,results};
 }
 if(options.setting){const r=settings[options.setting==='dennis'?'Dennis':'family'];return {firstTryRate:r.firstTryRate,averageTries:r.averageTries,lossPhase:{beforeClock:r.lossShares.clock,mid:r.lossShares.mid,late:r.lossShares.late},runs,slowestMove:r.slowestMove,minutes:r.minutesPerBoard,version:'human-v0',calibrationStatus:options.setting==='dennis'?'milestone1-factory-validated':'experimental-not-calibrated',valid:r.slowestMove<2000&&r.censoredCampaigns===0,seed,boardHash:hash(encoded),profileHash:hash(selectedProfiles),...r};}
 return {schema:'human-style-measure-v1',calibrationStatus:'experimental-not-calibrated',seed,runs,maxAttempts,boardHash:hash(encoded),profileHash:hash(profiles),
  lateDefinition:'after clock, at most 10 tiles remaining',settings,minutesPerBoard:(performance.now()-start)/60000,
  valid:Object.values(settings).every(s=>s.slowestMove<2000&&s.censoredCampaigns===0)};
}
module.exports={measureHuman};
if(require.main===module){
 const fs=require('fs'),input=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
 process.stdout.write(JSON.stringify(measureHuman(input,{runs:Number(process.argv[3]??20)}),null,2)+'\n');
}
