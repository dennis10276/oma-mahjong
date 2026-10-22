'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const NAMES=['Dennisisdebeste','Mrs. Doubtfire','PUK','Gerda'];
const ROOT=path.resolve(__dirname,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepareRegistration(draft,live,now) {
  assert(/^source-bound-personal-witness-v([9]|[1-9][0-9]+)$/.test(draft.model),'Use a new candidate version; v1-v8 are preserved');
  assert(!Object.hasOwn(draft,'cohortStartsAfter')&&!Object.hasOwn(draft,'frozenAt'),'Draft must not inherit or backdate a registered cohort');
  assert(Number.isFinite(draft.generatedAt)&&draft.generatedAt>0&&draft.generatedAt<=now,'Need real numerical generation time');
  const observed=Date.parse(live.observedAt);
  assert(live.evidence==='separate-live-completed-and-pending-outcomes'&&Array.isArray(live.episodes),'Need separate live evidence');
  assert(Number.isFinite(observed)&&observed>=draft.generatedAt&&observed<=now&&now-observed<=300000,'Need a fresh opening check AFTER generation and before registration');
  assert(live.unresolvedBoards===0,'Resolve board uncertainty before preregistering');
  const seen=new Set(),count=Object.fromEntries(NAMES.map(n=>[n,0]));
  assert(Array.isArray(draft.forecasts),'Need forecasts');
  for(const fc of draft.forecasts){
    assert(NAMES.includes(fc.name)&&Number.isInteger(fc.lv)&&fc.lv>=1,'Invalid target');
    const k=fc.name+'|'+fc.lv;assert(!seen.has(k),'Duplicate target');seen.add(k);count[fc.name]++;
    assert(/^[a-f0-9]{64}$/.test(fc.board),'Need exact board identity');
    assert(Number.isInteger(fc.predictedAttempt)&&fc.predictedAttempt>=1&&fc.predictedAttempt<=8,'Invalid point forecast');
    assert(!live.episodes.some(e=>e.name===fc.name&&e.lv===fc.lv),'Target was already opened; retain its history and select a genuinely new future target');
  }
  assert(NAMES.every(n=>count[n]>=20),'Need at least 20 declared targets per person');
  assert(draft.progressionStartLevels&&NAMES.every(n=>Number.isInteger(draft.progressionStartLevels[n])&&draft.forecasts.filter(f=>f.name===n).every(f=>f.lv>=draft.progressionStartLevels[n])),'Need explicit future progression frontiers');
  return {...draft,frozenAt:now,cohortStartsAfter:now,registrationOpeningCheckAt:observed,targetMet:false,
    cohortRule:'First 20 consecutive newly opened eligible progression games per person after this registration; missing and pending forecasts remain in denominator'};
}
function register(draftFile,liveFile,output){
  assert(!fs.existsSync(output),'Refusing to overwrite existing candidate');
  const draft=JSON.parse(fs.readFileSync(draftFile)),live=JSON.parse(fs.readFileSync(liveFile));
  const {buildReport}=require('./personal_live_outcomes.js');
  const rebuilt=buildReport(path.dirname(path.resolve(liveFile)));
  for(const key of ['episodes','observedAt','liveManifestSha256','playsSha256','previousOutcomeSha256','unresolvedBoards'])
    assert.deepEqual(live[key],rebuilt[key],'Live evidence does not reproduce: '+key);
  assert(draft.quantitativeSourceHashes&&Object.keys(draft.quantitativeSourceHashes).length>0,'Missing source provenance');
  for(const [rel,expected] of Object.entries(draft.quantitativeSourceHashes)){
    const p=path.resolve(ROOT,rel);assert(p.startsWith(ROOT+path.sep),'Unsafe source path');
    assert.equal(hash(fs.readFileSync(p)),expected,'Source changed since simulation: '+rel);
  }
  const anchor=prepareRegistration(draft,live,Date.now());
  anchor.registrationEvidence={draftSha256:hash(fs.readFileSync(draftFile)),liveSha256:hash(fs.readFileSync(liveFile))};
  fs.writeFileSync(output,JSON.stringify(anchor)+'\n',{flag:'wx'});
  return anchor;
}
module.exports={prepareRegistration,register};
if(require.main===module){assert(process.argv.length===5,'Usage: node register_personal_candidate.js DRAFT LIVE_OUTCOMES NEW_LEDGER');register(...process.argv.slice(2));}
