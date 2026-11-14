'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{check}=require('./check_sequence.js');
const row=(level,layout=1,shape='s',wrongIdea=['a'])=>({level,layout,shape,wrongIdea});
test('sequence spacing uses actual level distances, including each boundary',()=>{
  assert.equal(check([row(332),row(338,2,'t')]).counts.wrongIdea6,1);
  assert.equal(check([row(332),row(339,2,'t')]).counts.wrongIdea6,0);
  assert.equal(check([row(332),row(344,1,'t',['b'])]).counts.layout12,1);
  assert.equal(check([row(332),row(345,1,'t',['b'])]).counts.layout12,0);
  assert.equal(check([row(332),row(352,2)]).counts.wrongIdeaShape20,1);
  assert.equal(check([row(332),row(353,2)]).counts.wrongIdeaShape20,0);
});
test('every shared wrong idea counts and shapes alone do not trigger the idea rule',()=>{
  const r=check([row(332,1,'s',['a','b']),row(335,2,'s',['b','c'])]);
  assert.deepEqual(r.violations.filter(v=>v.wrongIdea).map(v=>v.wrongIdea),['b','b']);
  assert.equal(check([row(332),row(335,2,'s',['c'])]).ok,true);
});
test('duplicate levels and missing annotations cannot pass',()=>{
  assert.equal(check([row(332),row(332)]).counts.duplicateLevel,1);
  assert.equal(check([row(332,1,'s',[])]).ok,false);
});
test('unsorted supplied ledgers are reported rather than silently repaired',()=>{
  const {annotation}=require('./check_sequence.js');
  const r=annotation({level:332,card:{layout:1,wrongIdea:['b','a','a'],trap:{signature:'s'}},design:{tiles:[],obst:{keys:[]}}},'level-332.json');
  assert.ok(check([r]).violations.some(v=>v.rule==='wrongIdeaMetadata'));
});
test('six new kinds have distinct statements and three or four link recipes',()=>{
  const {DEFINITIONS}=require('./chained_new_ideas.js'),{SHAPES}=require('./chained_shapes.js'),T=require('./trap_stories.js');
  assert.ok(Object.keys(DEFINITIONS).length>=6);
  for(const name of Object.keys(DEFINITIONS)){const f=SHAPES[name];assert.equal(f.baseSignature,T.CHAIN_SHAPES[f.chain]);assert.ok(f.links>=3&&f.links<=4);assert.ok(f.see.startsWith('The wrong idea is '));}
});
