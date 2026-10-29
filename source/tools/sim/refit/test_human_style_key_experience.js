'use strict';
const assert=require('assert/strict');
const {publicKeyEvents,publicKeyPictureEvents,publicIceEvents,summarizeEvents}=require('./human_style_key_experience.js');
function test(){
 function sample(afterRole='none',removed=true){
  const before={index:0,state:{alive:[1,1,1]},observed:{roles:['key','lock','none']}};
  const after={index:2,state:{alive:[removed?0:1,1,1]},observed:{roles:[removed?null:'key',afterRole,'none']}};
  const result={attempts:[{decisions:[before,after]}]};
  Object.defineProperty(result,'wonOn',{get(){throw Error('Successful-attempt label read');}});
  Object.defineProperty(before,'hiddenRules',{get(){throw Error('Private key count read');}});
  return result;
 }
 const yes=publicKeyEvents(sample());assert.equal(yes.length,1);assert(yes[0].unlocked);
 assert.equal(yes[0].knownKeysBefore,1);assert.match(yes[0].evidenceSha256,/^[a-f0-9]{64}$/);
 const no=publicKeyEvents(sample('lock'));assert.equal(no.length,1);assert(!no[0].unlocked);
 assert.equal(publicKeyEvents(sample(null)).length,0,'Absent/occluded glyph is not evidence that the lock opened');
 assert.equal(publicKeyEvents(sample('none',false)).length,0,'Peeking at a key is not collecting it');
 const remaining=sample();remaining.attempts[0].decisions[0].observed.roles[2]='key';
 assert.equal(publicKeyEvents(remaining).length,0,'A still-alive known key invalidates the last-known-key condition');
 const mixed=sample();mixed.attempts[0].decisions[0].observed.roles[2]='lock';mixed.attempts[0].decisions[1].observed.roles[2]='lock';
 assert.throws(()=>publicKeyEvents(mixed),'Conflicting visible lock transitions must not be silently accepted');
 assert.deepEqual(summarizeEvents(yes.concat(no)),{observations:2,unlocked:1,remainedLocked:1,empiricalRate:.5,beta11Mean:.5});
 assert.equal(summarizeEvents([]).empiricalRate,null);assert.equal(summarizeEvents([]).beta11Mean,.5);
 const before={index:1,state:{alive:[1,1],tray:[],moves:0,openPeek:0,physicalTaps:0},
  observed:{roles:['key','key'],pictures:[4,null],down:[1,1]}};
 const terminal={state:{alive:[0,0],tray:[],moves:2,openPeek:-1,physicalTaps:1},
  observed:{roles:[null,null],pictures:[null,null],down:[null,null]}};
 const inferred={attempts:[{decisions:[before],terminal}]};
 Object.defineProperty(inferred,'faces',{get(){throw Error('Hidden deck accessed');}});
 const pair=publicKeyPictureEvents(inferred);assert.equal(pair.length,1);assert(pair[0].matching,'The observed open-pile match proves the removed hidden key picture');
 assert.match(pair[0].evidenceSha256,/^[a-f0-9]{64}$/);
 const unknown={attempts:[{decisions:[{...before,index:0,observed:{...before.observed,pictures:[null,null]}}]}]};
 assert.equal(publicKeyPictureEvents(unknown).length,0,'Two unknown key pictures cannot acquire a fabricated matching label');
 const different={attempts:[{decisions:[{...before,observed:{...before.observed,pictures:[4,5]}}]}]};
 assert.equal(publicKeyPictureEvents(different)[0].matching,false,'Observed mismatching key pictures must be retained as negative examples');
 const tiles=[{x:0,y:0,z:0},{x:2,y:0,z:0},{x:8,y:0,z:0}];
 function iceSample(role='none',start='ice'){
  const before={index:1,state:{alive:[1,1,1],physicalTaps:0},observed:{roles:[start,'none','key']}};
  const after={state:{alive:[1,0,1],physicalTaps:1},observed:{roles:[role,null,'key']}};
  const result={attempts:[{decisions:[before],terminal:after}]};
  Object.defineProperty(result,'rules',{get(){throw Error('Private initial ice counts read');}});return result;
 }
 assert(publicIceEvents(tiles,iceSample())[0].nonblocking);
 assert(!publicIceEvents(tiles,iceSample('lock'))[0].nonblocking,'A revealed underlying lock is a negative, not an assumed successful release');
 assert.equal(publicIceEvents(tiles,iceSample(null)).length,0,'An unobserved next glyph cannot label ice release');
 assert.equal(publicIceEvents(tiles,iceSample('none','ice2')).length,0,'One observed neighbor removal is insufficient to test a two-hit glyph');
 console.log('PASS key experience learns only from observed key removals/lock transitions; unknown glyphs, peeks and private labels cannot become completion evidence');
}
if(require.main===module)test();module.exports=test;
