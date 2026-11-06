'use strict';const {test}=require('node:test'),assert=require('assert/strict');
test('an explicit empirical recipe cannot be replaced by a legacy fallback brief',()=>{
 const {explicitBrief}=require('./empirical_construct.js'),spec={level:210,target:10.83,recipe:['deepKeys','frozenGuards'],alternatives:[{recipe:['dontGrab']}]},brief=explicitBrief(spec);
 assert.deepEqual(brief.recipe,['deepKeys','frozenGuards']);assert(!Object.hasOwn(brief,'alternatives'));assert.equal(spec.alternatives.length,1);
});
