'use strict';
const assert=require('assert/strict'),crypto=require('crypto');
const {normalizeBoard}=require('./public_board_input.js');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const LAB_CONTRACT=Object.freeze({schema:'human-lab-ranking-v1',setting:'dennis',runs:20,seed:20261029,maxAttempts:12,
 primary:'Spearman(human recorded tries, complete simulated averageTries)',minimumSpearman:.5,
 requiredCoverage:'Every recorded Dennis lab target; no missing, censored or constant primary ranking can pass',
 excludedLevels:Object.freeze([10031]),exclusionReason:'Explicit user-defined lab cohort excludes10031',
 secondary:'First-try failure rank and restricted-mean-attempt rank are diagnostics only, never substitutes for an unresolved primary',
 prerequisite:'A passing milestone2 model and retained factory gates; no held-out measurements before human-v1 exists'});
function ranks(values){
 assert(values.every(Number.isFinite));
 const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),result=Array(values.length);
 for(let begin=0;begin<order.length;){let end=begin+1;while(end<order.length&&order[end].value===order[begin].value)end++;
  const rank=(begin+1+end)/2;for(let i=begin;i<end;i++)result[order[i].index]=rank;begin=end;}
 return result;
}
function spearman(left,right){
 assert(left.length===right.length&&left.length>=2);
 const x=ranks(left),y=ranks(right),mean=(left.length+1)/2;let xy=0,xx=0,yy=0;
 for(let i=0;i<x.length;i++){const a=x[i]-mean,b=y[i]-mean;xy+=a*b;xx+=a*a;yy+=b*b;}
 return xx&&yy?xy/Math.sqrt(xx*yy):null;
}
function prepareLabCatalog(input){
 assert(Array.isArray(input.rows));const excluded=[],entries=[];
 for(const row of input.rows){
  if(row.name!=='Dennisisdebeste'||!Number.isInteger(row.lv)||row.lv<10000)continue;
  if(LAB_CONTRACT.excludedLevels.includes(row.lv)){excluded.push({lv:row.lv,reason:LAB_CONTRACT.exclusionReason});continue;}
  if(row.wonOn===undefined||row.wonOn===null||row.wonOn===0){excluded.push({lv:row.lv,reason:'No recorded positive clear-count target'});continue;}
  assert(Number.isInteger(row.wonOn)&&row.wonOn>0,'Invalid recorded lab target');
  const game=normalizeBoard(row.game);entries.push({lv:row.lv,wonOn:row.wonOn,boardSource:row.boardSource,
   historicalBoardExact:row.historicalBoardExact===true,stackedRoles:!!row.stackedRoles,game,boardHash:digest(game)});
 }
 entries.sort((a,b)=>a.lv-b.lv);assert(entries.length>=2,'At least two recorded lab targets are required');
 assert.equal(new Set(entries.map(r=>r.lv)).size,entries.length,'Duplicate recorded lab target IDs');
 return {contract:{...LAB_CONTRACT,levels:entries.map(r=>r.lv),boards:entries.length,dataHash:digest(input),catalogHash:digest(entries)},entries,excluded};
}
function validatePrepared(prepared){
 assert.deepEqual(prepared.contract,{...LAB_CONTRACT,levels:prepared.entries.map(r=>r.lv),boards:prepared.entries.length,dataHash:prepared.contract.dataHash,catalogHash:digest(prepared.entries)},'Prepared lab contract or catalog changed');
 assert(prepared.entries.every(r=>digest(normalizeBoard(r.game))===r.boardHash),'Prepared board identity changed');
}
function summarizeLab(prepared,records){
 validatePrepared(prepared);const issues=[],byId=new Map(),rows=[],contract=prepared.contract;
 for(const r of records){if(byId.has(r.lv))issues.push('Duplicate model result:'+r.lv);byId.set(r.lv,r.measure);}
 for(const id of byId.keys())if(!contract.levels.includes(id))issues.push('Unexpected model result:'+id);
 const versions=new Set(),profiles=new Set();
 for(const entry of prepared.entries){
  const r=byId.get(entry.lv),problems=[];if(!r){issues.push('Missing model result:'+entry.lv);rows.push({lv:entry.lv,humanTries:entry.wonOn,missing:true});continue;}
  if(r.boardHash!==entry.boardHash)problems.push('board hash');
  if(r.runs!==contract.runs||!Array.isArray(r.results)||r.results.length!==contract.runs)problems.push('campaign coverage');
  if(r.seed!==contract.seed)problems.push('seed');
  if(typeof r.version!=='string'||!r.version)problems.push('version');else versions.add(r.version);
  if(typeof r.profileHash!=='string'||!r.profileHash)problems.push('profile identity');else profiles.add(r.profileHash);
  if(r.valid!==true||r.censoredCampaigns!==0||!Number.isFinite(r.firstTryRate)||r.firstTryRate<0||r.firstTryRate>1||!Number.isFinite(r.slowestMove)||r.slowestMove<0||r.slowestMove>=2000||!Number.isFinite(r.minutes)||r.minutes<0||r.minutes>=5)problems.push('validity or timing');
  let mean=null,restricted=null,firstFailure=null,uncleared=null;
  if(!problems.length){
   let sum=0,truncated=0,firstWins=0;uncleared=0;
   for(const campaign of r.results){
    if(!campaign||typeof campaign!=='object'){problems.push('missing campaign');break;}
    const a=campaign.attempts;
    if(!Array.isArray(a)||!a.length||a.length>contract.maxAttempts||a.some((x,i)=>!x||x.attempt!==i+1||x.censored!==false||typeof x.win!=='boolean'||!x.win&&!['clock','tray','stuck'].includes(x.why)||!Number.isInteger(x.taps)||x.taps<=0)||campaign.verifiedTaps!==a.reduce((n,x)=>n+x.taps,0)){
     problems.push('incomplete physical campaign');break;
    }
    if(campaign.wonOn===null){if(a.length!==contract.maxAttempts||a.some(x=>x.win)){problems.push('invalid right censoring');break;}uncleared++;truncated+=contract.maxAttempts;}
    else{if(!Number.isInteger(campaign.wonOn)||campaign.wonOn!==a.length||!a.at(-1).win||a.slice(0,-1).some(x=>x.win)){problems.push('invalid successful attempt');break;}
     sum+=campaign.wonOn;truncated+=campaign.wonOn;if(campaign.wonOn===1)firstWins++;}
   }
   if(!problems.length){
    mean=uncleared?null:sum/contract.runs;restricted=truncated/contract.runs;firstFailure=1-firstWins/contract.runs;
    if(r.averageTries!==mean||Math.abs(r.firstTryRate-(1-firstFailure))>1e-12||r.cleared!==contract.runs-uncleared)problems.push('reported metric disagrees with campaigns');
   }
  }
  if(problems.length)issues.push(entry.lv+': '+problems.join(', '));
  rows.push({lv:entry.lv,humanTries:entry.wonOn,averageTries:mean,restrictedMeanAttempts:restricted,firstTryFailureRate:firstFailure,
   rightCensoredCampaigns:uncleared,slowestMove:r.slowestMove,minutes:r.minutes,issues:problems});
 }
 if(versions.size!==1||profiles.size!==1)issues.push('All boards must use one model version and one fixed person profile');
 const complete=issues.length===0&&rows.every(r=>Number.isFinite(r.averageTries));
 const correlation=key=>issues.length===0&&rows.every(r=>Number.isFinite(r[key]))?spearman(rows.map(r=>r.humanTries),rows.map(r=>r[key])):null;
 const primary=complete?correlation('averageTries'):null;
 return {contract,version:versions.size===1?[...versions][0]:null,profileHash:profiles.size===1?[...profiles][0]:null,issues,rows,
  status:issues.length?'invalid':!complete?'unresolved-right-censoring':primary===null?'unresolved-constant-ranking':'evaluated',
  primarySpearman:primary,secondary:{firstTryFailureSpearman:correlation('firstTryFailureRate'),restrictedMeanSpearman:correlation('restrictedMeanAttempts'),diagnosticOnly:true},
  rankingGateMet:complete&&primary!==null&&primary>=contract.minimumSpearman,
  milestone3Met:false,note:'A ranking result alone cannot certify prior milestones or the frozen prospective check'};
}
module.exports={LAB_CONTRACT,ranks,spearman,prepareLabCatalog,validatePrepared,summarizeLab,digest};
