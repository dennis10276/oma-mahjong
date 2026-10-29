'use strict';
const assert=require('assert/strict'),fs=require('fs'),crypto=require('crypto'),path=require('path');
const {campaign}=require('./human_style_environment.js');
const {captureSources}=require('./human_level_sources.js');
const {inferMatchedPicture}=require('./public_matched_picture.js');
const Layouts=require('../../../www/layouts.js');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function publicKeyEvents(result){
 const events=[];
 for(const attempt of result.attempts){
  const decisions=[...(attempt.decisions??[]),...(attempt.terminal?[attempt.terminal]:[])],knownRoles=[];
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
function publicKeyPictureEvents(result){
 const events=[],done=new Set();
 for(const attempt of result.attempts){
  const frames=[...(attempt.decisions??[]),...(attempt.terminal?[attempt.terminal]:[])],keys=new Set(),pictures=[],sources=[];
  function recordPairs(){
   const known=[...keys].filter(i=>pictures[i]!==undefined);
   for(let a=0;a<known.length;a++)for(let b=a+1;b<known.length;b++){
    const pair=[known[a],known[b]].sort((x,y)=>x-y),signature=pair.join(',');if(done.has(signature))continue;done.add(signature);
    events.push({matching:pictures[pair[0]]===pictures[pair[1]],
     evidenceSha256:hash(pair.map(index=>({index,picture:pictures[index],source:sources[index]})))});
   }
  }
  for(let k=0;k<frames.length;k++){
   const current=frames[k];
   current.observed.roles.forEach((role,i)=>{if(role==='key')keys.add(i);});
   current.observed.pictures.forEach((face,i)=>{if(face!==null){
    if(pictures[i]!==undefined)assert.equal(pictures[i],face);
    pictures[i]=face;sources[i]={kind:'visiblePicture',sha256:hash({state:current.state,observed:current.observed})};
   }});
   const after=frames[k+1];
   if(after&&Number.isInteger(current.index)){
    const knownPictures=current.state.alive.map((_,i)=>pictures[i]??null);
    const proof=inferMatchedPicture({...current.state,pictures:knownPictures,down:current.observed.down},current.index,
     {alive:after.state.alive,moves:after.state.moves,openPeek:after.state.openPeek,physicalTaps:after.state.physicalTaps,tray:after.state.tray});
    if(proof){pictures[proof.index]=proof.picture;sources[proof.index]={kind:proof.source,sha256:hash({before:current,after})};}
   }
   recordPairs();
  }
 }
 return events;
}
function summarizeEvents(events){
 const unlocked=events.filter(e=>e.unlocked).length;
 return {observations:events.length,unlocked,remainedLocked:events.length-unlocked,
  empiricalRate:events.length?unlocked/events.length:null,beta11Mean:(unlocked+1)/(events.length+2)};
}
function publicIceEvents(tiles,result){
 const neighbors=Layouts.iceNeighbors(tiles),events=[];
 for(const attempt of result.attempts){
  const frames=[...(attempt.decisions??[]),...(attempt.terminal?[attempt.terminal]:[])];
  for(let k=0;k+1<frames.length;k++){
   const before=frames[k],after=frames[k+1];
   if(after.state.physicalTaps!==before.state.physicalTaps+1)continue;
   for(let i=0;i<tiles.length;i++){
    const need=before.observed.roles[i]==='ice'?1:before.observed.roles[i]==='ice2'?2:0;
    if(!need||!before.state.alive[i]||!after.state.alive[i]||after.observed.roles[i]===null)continue;
    const removed=neighbors[i].filter(j=>before.state.alive[j]&&!after.state.alive[j]).length;
    if(removed<need)continue;
    events.push({nonblocking:['none','key'].includes(after.observed.roles[i]),glyphBefore:before.observed.roles[i],
     glyphAfter:after.observed.roles[i],neighborsRemoved:removed,evidenceSha256:hash({index:i,
      before:{state:before.state,observed:before.observed},after:{state:after.state,observed:after.observed}})});
   }
  }
 }
 return events;
}
function main(){
 const [catalogFile,out,profileFile]=process.argv.slice(2);assert(catalogFile&&out&&profileFile);
 const source=captureSources(module),catalog=JSON.parse(fs.readFileSync(catalogFile)),profiles=JSON.parse(fs.readFileSync(profileFile));
 const archive=out+'.sources',root=path.resolve(__dirname,'../../..');
 fs.mkdirSync(archive);
 for(const file of source.files){const to=path.join(archive,file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,file),to,fs.constants.COPYFILE_EXCL);}
 source.verify();
 const entries=catalog.entries.filter(e=>e.lv>=17&&e.lv<92).sort((a,b)=>a.lv-b.lv);
 assert.equal(entries.length,75);assert(entries.every(e=>e.lv<92),'Training must precede the evaluation cohort');
 const trainingArchive=out+'.training-catalog.json';
 fs.writeFileSync(trainingArchive,JSON.stringify({observedAt:catalog.observedAt,entries},null,2)+'\n',{flag:'wx'});
 const settings={};
 for(const [name,p] of Object.entries(profiles)){
  const events=[],pictureEvents=[],iceEvents=[];
  for(const e of entries){
   source.verify();
   const result=campaign(e.game,p,20261029,{maxAttempts:1,capture:true});
   for(const event of publicKeyEvents(result))events.push({trainingLevel:e.lv,...event});
   for(const event of publicKeyPictureEvents(result))pictureEvents.push({trainingLevel:e.lv,...event});
   for(const event of publicIceEvents(e.game.tiles,result))iceEvents.push({trainingLevel:e.lv,...event});
  }
  const matching=pictureEvents.filter(e=>e.matching).length;
  const nonblocking=iceEvents.filter(e=>e.nonblocking).length;
  settings[name]={...summarizeEvents(events),events,pictureRelation:{observations:pictureEvents.length,matching,
   empiricalRate:pictureEvents.length?matching/pictureEvents.length:null,beta11Mean:(matching+1)/(pictureEvents.length+2),events:pictureEvents},
   iceRelease:{observations:iceEvents.length,nonblocking,beta11Mean:(nonblocking+1)/(iceEvents.length+2),events:iceEvents}};
 }
 source.verify();
 const result={schema:'public-earlier-board-special-experience-v4',sourceHash:source.hash,sourceFiles:source.files,sourceArchive:archive,
  trainingRange:[17,91],boards:entries.length,trainingCatalogHash:hash(entries.map(e=>e.game)),trainingArchive,profiles,
  note:'Labels use selected public key glyphs, observed removals, later visible lock glyphs, visible pictures and exact public match deductions. No hidden rules, private key counts, unseen pictures or human successful-attempt labels are used. These are beliefs, never guaranteed future unlocking or picture identities.',settings};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(Object.entries(settings).map(([name,s])=>[name,{observations:s.observations,unlocked:s.unlocked,beta11Mean:s.beta11Mean,keyPictures:s.pictureRelation.observations,matching:s.pictureRelation.matching,pictureBelief:s.pictureRelation.beta11Mean,
  iceObservations:s.iceRelease.observations,iceNonblocking:s.iceRelease.nonblocking,iceBelief:s.iceRelease.beta11Mean}]))));
}
if(require.main===module)main();
module.exports={publicKeyEvents,publicKeyPictureEvents,publicIceEvents,summarizeEvents};
