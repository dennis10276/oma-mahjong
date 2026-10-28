'use strict';
const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto'),path=require('path');
const {campaign}=require('./human_style_environment.js');
const {captureSources}=require('./human_level_sources.js');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function publicKeyEvents(result){
 const events=[];
 for(const attempt of result.attempts){
  const decisions=attempt.decisions??[],knownRoles=[];
  for(let k=0;k+1<decisions.length;k++){
   const before=decisions[k],after=decisions[k+1];
   before.observed.roles.forEach((role,i)=>{if(role!==null)knownRoles[i]=role;});
   const keys=knownRoles.flatMap((role,i)=>role==='key'&&before.state.alive[i]?[i]:[]);
   if(!keys.includes(before.index)||after.state.alive[before.index]||keys.some(i=>after.state.alive[i]))continue;
   const locks=before.observed.roles.flatMap((role,i)=>role==='lock'&&before.state.alive[i]&&after.state.alive[i]
    &&['none','lock'].includes(after.observed.roles[i])?[i]:[]);
   if(!locks.length)continue;
   const answers=locks.map(i=>after.observed.roles[i]==='none');
   assert(answers.every(answer=>answer===answers[0]),'Inconsistent publicly observed global lock transition');
   events.push({unlocked:answers[0],knownKeysBefore:keys.length,observedLocks:locks.length,
    evidenceSha256:hash({keys,before:{state:before.state,observed:before.observed,index:before.index},
     after:{state:after.state,observed:after.observed}})});
  }
 }
 return events;
}
function summarizeEvents(events){
 const unlocked=events.filter(e=>e.unlocked).length;
 return {observations:events.length,unlocked,remainedLocked:events.length-unlocked,
  empiricalRate:events.length?unlocked/events.length:null,beta11Mean:(unlocked+1)/(events.length+2)};
}
function main(){
 const [catalogFile,out,profileFile]=process.argv.slice(2);assert(catalogFile&&out&&profileFile);
 const source=captureSources(module),catalog=JSON.parse(fs.readFileSync(catalogFile)),profiles=JSON.parse(fs.readFileSync(profileFile));
 const entries=catalog.entries.filter(e=>e.lv>=17&&e.lv<92).sort((a,b)=>a.lv-b.lv);
 assert.equal(entries.length,75);assert(entries.every(e=>e.lv<92),'Training must precede the evaluation cohort');
 const settings={};
 for(const [name,p] of Object.entries(profiles)){
  const events=[];
  for(const e of entries){
   source.verify();
   const result=campaign(e.game,p,20261029,{maxAttempts:1,capture:true});
   for(const event of publicKeyEvents(result))events.push({trainingLevel:e.lv,...event});
  }
  settings[name]={...summarizeEvents(events),events};
 }
 source.verify();
 const result={schema:'public-earlier-board-key-experience-v1',sourceHash:source.hash,sourceFiles:source.files,
  trainingRange:[17,91],boards:entries.length,trainingCatalogHash:hash(entries.map(e=>e.game)),profiles,
  note:'Only selected public key glyphs, observed removals and later visible lock glyphs label events. No hidden rules, full key counts, pictures or human successful-attempt labels are used. This estimates a belief, never a proof of future unlocking.',settings};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(Object.entries(settings).map(([name,s])=>[name,{observations:s.observations,unlocked:s.unlocked,empiricalRate:s.empiricalRate,beta11Mean:s.beta11Mean}]))));
}
if(require.main===module)main();
module.exports={publicKeyEvents,summarizeEvents};
