'use strict';const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
test('frame experiment crosses all settings and all common pairs',()=>{
 const E=require('./frame_experiment.js'),common=['clock','luckDig','relief','blindTwins','keys','blindWay'],settings=E.settings(common);
 assert.equal(E.grid().length,9);assert.equal(settings.filter(s=>s.kind==='conditional-single').length,33);assert.equal(settings.filter(s=>s.kind==='conditional-pair').length,15);
 const R=require('./frame_calibrate.js'),records=[5,6.2,7.4,8.6,9.5].map((exp,k)=>({id:String(k),valid:true,family:{exp},sample:{layout:'layout'+k}}));
 const chosen=R.selectFrames(records);assert.equal(chosen.length,3);assert(chosen.every(r=>r.family.exp>=6&&r.family.exp<=9));assert.equal(new Set(chosen.map(r=>r.sample.layout)).size,3);assert.throws(()=>R.selectFrames(records.slice(0,3)),/fewer than three/);
 const D=require('./frame_designer.js'),lists=D.lists(811000);assert(lists.some(list=>list.some(p=>p.name==='clock')));assert(lists.some(list=>list.some(p=>p.name==='clockWay')));assert(lists.some(list=>list.some(p=>p.name==='wrongClock')));
 const clocks=new Set(lists.flatMap(list=>list.filter(p=>p.name==='clock').map(p=>JSON.stringify(p.params))));for(const p of require('./pieces.js').CATALOGUE.clock.grid)assert(clocks.has(JSON.stringify(p)),'The bounded proposals cover each measured clock grade');
 assert(D.recipeOf({share:.1,depth:2,spare:1},[{name:'wrongClock'}]).includes('dontGrab'),'Authored wrong-clock mechanisms request the existing grab-first counterfactual gate');
});
test('a frozen model cannot be overwritten after prospective outcomes become available',t=>{
 const {assertFrozen}=require('./frame_calibrate.js'),dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'oma-frozen-fit8-'));t.after(()=>{assert(dir.startsWith(path.join(require('os').tmpdir(),'oma-frozen-fit8-')));fs.rmSync(dir,{recursive:true});});
 const model={input:'original-labels',featureSource:'original-features',settings:{family:{intercept:1}}};fs.writeFileSync(dir+'/model.json',JSON.stringify(model));assert.doesNotThrow(()=>assertFrozen(dir,model));
 assert.throws(()=>assertFrozen(dir,{...model,input:'test-labels-added'}),/Frozen frame model/);assert.throws(()=>assertFrozen(dir,{...model,settings:{family:{intercept:2}}}),/Frozen frame model/);assert.deepEqual(JSON.parse(fs.readFileSync(dir+'/model.json')),model);
});
test('prospective protocol fixes the denominator and success rule before confirmation',t=>{
 const {preregister}=require('./frame_prospective.js'),dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'oma-prereg8-'));t.after(()=>fs.rmSync(dir,{recursive:true}));
 const plan={levels:[{level:200,target:10,keepId:'old'},{level:203,target:10.25,big:false}]},model={input:'locked-model',featureSource:'features',bot:'current'};fs.writeFileSync(dir+'/plan.json',JSON.stringify(plan));fs.writeFileSync(dir+'/model.json',JSON.stringify(model));
 const first=preregister(dir+'/plan.json',dir+'/model.json',dir+'/test');assert.equal(first.expected,12);assert.equal(first.minimumSuccesses,8);assert.deepEqual(first.targets,[{level:203,target:10.25,big:false}]);assert.deepEqual(preregister(dir+'/plan.json',dir+'/model.json',dir+'/test'),first);
 assert(!fs.existsSync(dir+'/test/confirmations.json'));assert(first.rules.some(r=>r.includes('No replacement')));
});
