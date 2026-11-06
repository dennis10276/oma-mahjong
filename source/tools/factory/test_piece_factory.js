'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const F=require('./piece_factory.js'),Confirm=require('./piece_confirm.js'),M=require('./meter.js');
const row=(id,creation,shape,family)=>({id,shape,recipe:['piece:clock'],origin:{creationId:creation},design:{tiles:Array.from({length:96},()=>[0,0,0])},
  predicted:{family:{tries:family,interval:[8,14]},skilled:{tries:3,interval:[1,5]}}});
test('prospective placement does not reuse a creation and respects existing nearby shapes',()=>{
  const plan={levels:[{level:210,target:11,big:true},{level:220,target:12,big:true}],originality:{maxSameRecipe:3}};
  const a=row('a','one','star',11),b=row('b','one','pyramid',12),c=row('c','two','house',12),selected=F.selectPredictions(plan,[a,b,c],[]);
  assert.equal(selected.selected.length,2);assert.equal(new Set(selected.selected.map(r=>r.origin.creationId)).size,2);
  const pin={...row('pin','kept','star',11),keptAt:211,level:211};assert(!F.selectPredictions(plan,[a,b,c],[pin]).selected.some(r=>r.id==='a'));
});
test('uncertainty probes are explicitly labelled and never passed off as point predictions',()=>{
  const plan={levels:[{level:210,target:11,big:true}]},r=row('a','one','pyramid',9);r.predicted.skilled.tries=1.5;
  assert.equal(F.selectPredictions(plan,[r],[]).selected.length,0);
  const result=F.selectPredictions(plan,[r],[],{intervalBudget:1});assert.equal(result.selected.length,1);assert.equal(result.intervalSelected,1);assert.equal(result.selected[0].selectionBasis,'uncertainty-overlap');assert(!F.pointFits(r,plan.levels[0]));
});
test('confirmation keeps pre-bot predictions and measures both full family seeds even outside the queue band',()=>{
  const design=JSON.parse(fs.readFileSync(path.resolve(__dirname,'fixtures/approved-225.json'))),calls=[],r={id:M.boardKey(design).slice(0,16),design,recipe:['trayJuggleFrozen'],useHumanSkilled:true,predicted:{family:{tries:10},skilled:{tries:3}}};
  const meter={fingerprint:'test',measure(b,o){calls.push(o);const exp=o.setting==='planner'?2.08:!b.clock?2:!Object.keys(b.obst.ice).length?3:o.seed===18427?20:18;return {expectedTries:exp,valid:true,firstTryRate:.1,version:'test',results:[]};}};
  const result=Confirm.confirm(r,meter);assert.equal(result.family,19);assert.equal(result.skilledBot,2.08);assert.equal(result.skilledEffective,4);assert.equal(result.predicted.family.tries,10);
  assert(calls.some(o=>o.setting==='family'&&o.seed===18427&&o.runs===20&&o.seeds===2));assert.equal(result.quality.skilled.botExp,2.08);assert(result.valid);
});
test('importing worker-capable libraries does not attach competing message handlers',async()=>{
  const {Worker}=require('worker_threads'),files=['batch_evaluate.js','piece_measure.js','piece_confirm.js','piece_factory.js','construct_original.js','empirical_construct.js','empirical_confirm.js','empirical_steer.js'].map(f=>path.resolve(__dirname,f));
  const result=await new Promise((resolve,reject)=>{const worker=new Worker(`const {parentPort}=require('worker_threads');const modules=${JSON.stringify(files)}.map(f=>require(f));parentPort.postMessage({listeners:parentPort.listenerCount('message'),exports:modules.map(m=>typeof m.run)});`,{eval:true});worker.once('message',resolve);worker.once('error',reject);});
  assert.equal(result.listeners,0);assert(result.exports.every(x=>x==='function'));
});
