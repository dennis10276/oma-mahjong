'use strict';
const assert=require('assert/strict');
// UI clockMove logs 'clock' when the clock tile is REMOVED. A zero remaining
// count in that event is a saved last-move clock, not an expired clock.
function auditEvents(input,{from=92,to=163,lateAtMost=10}={}){
 assert(Number.isInteger(from)&&Number.isInteger(to)&&from<=to);
 const raw=Array.isArray(input)?input:Object.values(input??{}),nonLevel=r=>r?.m==='d'||r?.mode==='daily'||r?.d!==undefined,events=raw.filter(r=>!nonLevel(r)),attempts=[],quality={excludedNonLevelEvents:raw.filter(nonLevel).length,missingLevels:[],missingStart:0,missingEnd:0,multipleEnds:0,winsWithoutSave:0,afterFirstWinGroups:0};
 for(let lv=from;lv<=to;lv++){
  const groups=new Map();for(const r of events.filter(r=>r?.lv===lv&&r.aid&&Number.isFinite(r.t)).sort((a,b)=>a.t-b.t)){if(!groups.has(r.aid))groups.set(r.aid,[]);groups.get(r.aid).push(r);}
  if(!groups.size){quality.missingLevels.push(lv);continue;}
  let cleared=false;
  for(const [aid,rows] of [...groups].sort((a,b)=>a[1][0].t-b[1][0].t)){
   if(cleared){quality.afterFirstWinGroups++;continue;}
   const start=rows.find(r=>r.k==='start'),ends=rows.filter(r=>r.k==='end');
   if(!ends.length){if(start)quality.missingEnd++;continue;}if(ends.length!==1){quality.multipleEnds++;continue;}
   if(!start)quality.missingStart++;const end=ends[0],save=rows.filter(r=>r.k==='clock'&&r.t<=end.t).at(-1),win=end.r==='win',explicit=end.ck===1;
   let phase=null;if(!win){if(save&&!explicit)phase=Number.isFinite(end.left)?end.left<=lateAtMost?'late':'mid':'unknown';else if(explicit&&!save)phase='beforeClock';else if(!save&&start?.ck===0)phase=Number.isFinite(end.left)?end.left<=lateAtMost?'late':'mid':'unknown';else phase='unknown';}
   if(win&&!save&&start?.ck>0)quality.winsWithoutSave++;
   attempts.push({lv,aid,attempt:start?.at??end.at??null,startPresent:!!start,win,why:end.r,phase,explicitClockFailure:explicit,clockSaved:!!save,clockSaveMovesRemaining:save?.ml??null,leftAtClock:save?.left??null,endLeft:end.left??null,maxTray:end.tm??null,clockContactFailure:!win&&!!save&&save.left===end.left});if(win)cleared=true;
  }
 }
 const losses=attempts.filter(r=>!r.win),counts=Object.fromEntries(['beforeClock','mid','late','unknown'].map(k=>[k,losses.filter(r=>r.phase===k).length]));
 const bounds=Object.fromEntries(['beforeClock','mid','late'].map(k=>[k,{lower:losses.length?counts[k]/losses.length:null,upper:losses.length?(counts[k]+counts.unknown)/losses.length:null}]));
 return {contract:{from,to,lateAtMost,naturalFirstClearOnly:true,clockEvent:'saved clock, including ml=0',unknown:'No saved-clock event and no explicit clock-expiry flag cannot prove the phase; retain unknown'},summary:{levels:new Set(attempts.map(r=>r.lv)).size,attempts:attempts.length,wins:attempts.filter(r=>r.win).length,losses:losses.length,counts,phaseShareBounds:bounds,clockContactFailures:losses.filter(r=>r.clockContactFailure).length,quality},attempts};
}
module.exports={auditEvents};
if(require.main===module){const fs=require('fs'),[input,output]=process.argv.slice(2);assert(input&&output);const r=auditEvents(JSON.parse(fs.readFileSync(input)));fs.writeFileSync(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(r.summary));}
