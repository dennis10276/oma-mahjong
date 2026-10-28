'use strict';
const assert=require('assert/strict');
const {publicKeyEvents,summarizeEvents}=require('./human_style_key_experience.js');
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
 console.log('PASS key experience learns only from observed key removals/lock transitions; unknown glyphs, peeks and private labels cannot become completion evidence');
}
if(require.main===module)test();module.exports=test;
