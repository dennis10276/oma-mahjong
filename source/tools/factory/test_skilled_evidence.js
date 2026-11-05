'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const E=require('./skilled_evidence.js'),S=require('./trap_supports.js'),I=require('../lab/ideas.js');
const board=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/approved-225.json')));
test('a recorded won/right board uses Dennis’s tries while preserving the measured bot number',()=>{
  const row={useHumanSkilled:true,design:board},r=E.rating(row,2.08,true);assert.equal(r.exp,4);assert.equal(r.botExp,2.08);assert(r.valid);assert.equal(r.evidence.verdict,'right');
  assert.equal(E.rating({design:board},2.08).exp,2.08,'Historical plans keep their original rating rule');
  const edited=I.clone(board);edited.clock.n++;assert.equal(E.get({...row,design:edited}),null);
  assert.equal(E.get({...row,design:{...board,gold:[1]}}),null);
  assert.equal(E.get({useHumanSkilled:true,design:edited,human:{tries:4,won:true,verdict:'right'}}),null,'Self-reported evidence is ignored');
});
test('quality records cannot cross the human-evidence rule in either direction',()=>{
  const row={useHumanSkilled:true,design:board},q={eligible:true,skilledEvidenceFingerprint:E.fingerprint(row)};
  assert(S.compatible(row,q));assert(!S.compatible(row,{eligible:true}));assert(!S.compatible({...row,useHumanSkilled:false},q));assert(S.compatible({...row,useHumanSkilled:false},{eligible:true}));
});
test('the evidence rule changes only the skilled gate, leaving meaningful specials and relief mandatory',()=>{
  process.env.FACTORY_SKILLED='2.5,6';const {evaluate}=require('./batch_evaluate.js');
  const row={design:board,recipe:['trayJuggleFrozen'],forcePlanner:true,useHumanSkilled:true};
  const meter={measure(b,o){return {valid:true,expectedTries:o.setting==='planner'?2.08:!b.clock?1.55:!Object.keys(b.obst.ice).length?1.82:12.8,firstTryRate:.1,version:'test',results:[]};}};
  const q=evaluate(row,'quality',meter);assert(q.eligible);assert.equal(q.skilled.exp,4);assert.equal(q.skilled.botExp,2.08);
  assert(!evaluate({...row,useHumanSkilled:false},'quality',meter).eligible);
  const idle={measure(b,o){return {valid:true,expectedTries:o.setting==='planner'?2.08:12.8,firstTryRate:.1,version:'test',results:[]};}};
  assert(!evaluate(row,'quality',idle).eligible,'Human approval never excuses idle specials');
});
