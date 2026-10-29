'use strict';
const assert=require('assert/strict'),Layouts=require('../../../www/layouts.js');
const {createHumanController}=require('./human_reference_campaign.js');
const frozen=require('./human_level_measure_profile.json');
const {createStyleController}=require('./human_style_controller.js');
const defaults=require('./human_style_profiles.json');
const {inferMatchedPicture}=require('./public_matched_picture.js');
// Derive from the frozen reference, disabling every complete/recovery search.
// Geometry may see a whole sideways row; action lookahead remains four taps.
function limitedOptions(salt,depth=4){
 const p={...frozen,publicActionSalt:salt,taps:depth,nodes:96,beam:6,progress:4,decisionMs:100,
  openingConditionalPlanning:false,goalRecovery:true,riskFirstRecovery:true,safeInformationEscape:false,
  retryInformationWitness:false,clockRecovery:false,tightClockRecovery:false,safeClockInspection:false,
  clockSlackRanking:false,keyAccessMacros:false,keyRecoveryMacros:false,passiveInformation:false,
  clockInformationBeforeRisk:false,drawnRoleInformation:false,observedSafetyTransfer:false,
  deadEndInformation:false,finishKnown:false,trayRecovery:true,continuationPruning:false,pruneDead:false,
  proofNodes:1,progressiveReopens:false};
 for(const k of ['retryInformationMs','retryInformationNodes','clockRecoveryMinSlack','tightClockRecoveryMaxSlack',
  'safeClockInspectionBudgetRange','clockSlackRankingBudgetRange','drawnRoleClockSlackRange',
  'observedSafetyClockOnly','observedSafetyMaxClockSlack'])delete p[k];
 return p;
}
function createLimitedReference(tiles,profile,seed){
 const {referenceDepth=4,referenceTrayDepth=6,...behavior}=profile;
 const fallback=createStyleController(tiles,{...defaults.Dennis,...behavior},seed);let visits=new Map();
 const random=Layouts.rng(seed);let pictures=tiles.map(()=>null),down=tiles.map(()=>null),attempt=0,state,seen,last=null,core=null;
 function beginAttempt(){fallback.beginAttempt();visits=new Map();if(attempt++)pictures=pictures.map(x=>random()<(profile.retryRetention??.85)?x:null);last=null;core=null;}
 function observe(s,o){
  fallback.observe(s,o);
  if(last){const proof=inferMatchedPicture(last,last.index,{alive:s.alive,tray:s.tray,moves:s.moves,openPeek:s.openPeek,physicalTaps:s.physicalTaps});if(proof)pictures[proof.index]=proof.picture;last=null;}
  state={alive:Array.from(s.alive),tray:Array.from(s.tray),moves:s.moves,physicalTaps:s.physicalTaps,
   openPeek:s.openPeek,relieved:!!s.relieved,arriving:Array.from(s.arriving??[])};
  seen={pictures:Array.from(o.pictures),down:Array.from(o.down),roles:Array.from(o.roles),takeable:Array.from(o.takeable),clock:o.clock?{i:o.clock.i,n:o.clock.n,remaining:o.clock.remaining}:null};
  const before=pictures;
  pictures=pictures.map((v,i)=>seen.pictures[i]!==null?seen.pictures[i]:state.alive[i]&&random()<(profile.memoryDecay??.0005)?null:v);
  if(pictures.some((v,i)=>v===null&&before[i]!==null&&state.alive[i]))core=null;
  else if(core)core.observe(state,seen);
  down=down.map((v,i)=>seen.down[i]??v);
 }
 function decide(){
  if(seen.clock){core=null;return fallback.decide();}
  if(!core){core=createHumanController(tiles,limitedOptions(1+Math.floor(random()*0x7ffffffe),seen.clock?referenceDepth:referenceTrayDepth));
   core.rememberPublic({pictures:pictures.slice(),down:down.slice(),initialRoles:tiles.map(()=>null)});core.beginAttempt();core.observe(state,seen);}
  let selected=core.decide();if(!selected)return fallback.decide();
  const i=selected.plan.index,face=pictures[i],open=state.openPeek;
  const matching=face!==null&&(state.tray.includes(face)||open>=0&&open!==i&&pictures[open]===face);
  const safeAlternative=seen.takeable.some((ok,j)=>ok&&(seen.down[j]===1&&pictures[j]===null||pictures[j]!==null&&
   (state.tray.includes(pictures[j])||open>=0&&j!==open&&pictures[j]===pictures[open])));
  // Do not prepare a third unmatched take while a free reveal or immediate out
  // is available. A constructive known win keeps its justified continuation.
  if(!selected.plan.knownWin&&state.tray.length>=2&&!matching&&face!==101&&safeAlternative){core=null;return fallback.decide();}
  const key=JSON.stringify([state.alive,state.tray,pictures,selected.plan.index]);
  if(visits.has(key)){core=null;const other=fallback.decide();visits.set(key,visits.get(key)+1);return other;}
  visits.set(key,1);
  assert(seen.takeable[selected.plan.index]===true,'A human policy must choose a currently public legal tap');
  core.acknowledge(selected.plan.index,true);
  last={...state,pictures:pictures.slice(),down:down.slice(),index:selected.plan.index};
  return {index:selected.plan.index,score:0};
 }
 return {beginAttempt,observe,decide,remembered:()=>pictures.slice()};
}
module.exports={createLimitedReference,limitedOptions};
