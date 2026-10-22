'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {prepareRegistration,register}=require('./register_personal_candidate.js');
const now=2000000000000,names=['Dennisisdebeste','Mrs. Doubtfire','PUK','Gerda'];
function fixture(){return {model:'source-bound-personal-witness-v9',generatedAt:now-10000,
  progressionStartLevels:Object.fromEntries(names.map(n=>[n,1000])),
  forecasts:names.flatMap(name=>Array.from({length:20},(_,i)=>({name,lv:1000+i,board:'a'.repeat(64),predictedAttempt:1}))) };}
const live={evidence:'separate-live-completed-and-pending-outcomes',observedAt:new Date(now-1000).toISOString(),episodes:[],unresolvedBoards:0};
const result=prepareRegistration(fixture(),live,now);
assert.equal(result.cohortStartsAfter,now);assert.equal(result.frozenAt,now);assert.equal(result.targetMet,false);
for(const edit of [d=>d.model='source-bound-personal-witness-v8',d=>d.cohortStartsAfter=1,d=>d.frozenAt=1,d=>d.forecasts.pop(),d=>d.forecasts.push({...d.forecasts[0]})]){
 const d=fixture();edit(d);assert.throws(()=>prepareRegistration(d,live,now));
}
assert.throws(()=>prepareRegistration(fixture(),{...live,observedAt:new Date(now-20000).toISOString()},now),/AFTER/);
assert.throws(()=>prepareRegistration(fixture(),{...live,episodes:[{name:names[0],lv:1000,start:now-100000}]},now),/already opened/);
assert.throws(()=>prepareRegistration(fixture(),{...live,unresolvedBoards:1},now),/uncertainty/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'registration-regression-')),target=path.join(dir,'synthetic.jsonl');
try{fs.writeFileSync(target,'synthetic-test-original');assert.throws(()=>register('missing','missing',target),/overwrite/);assert.equal(fs.readFileSync(target,'utf8'),'synthetic-test-original');}
finally{fs.unlinkSync(target);fs.rmdirSync(dir);}
console.log('PASS new cohort, post-generation live check, opened-level rejection, malformed-target rejection, and immutable registration. Fixtures are not human evidence.');
