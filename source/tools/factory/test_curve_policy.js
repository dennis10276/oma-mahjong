'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const Curve=require('./curve_policy.js'),Final=require('./final_seed.js');
test('five-level average uses consecutive slot targets and marks holes uncertified',()=>{
 const plan={curveWindow:{size:5,tolerance:.5},levels:Array.from({length:6},(_,i)=>({level:200+i,target:10+i*.1}))};
 const scores=new Map(plan.levels.map(s=>[s.level,s.target+.5]));assert(Curve.accepts(plan,scores));assert.equal(Curve.windows(plan,scores).length,2);
 scores.set(204,plan.levels[4].target+.501);assert(!Curve.accepts(plan,scores));
 scores.delete(202);assert(Curve.accepts(plan,scores));assert(Curve.windows(plan,scores).every(w=>!w.complete&&w.eligible===null));
 const gaps={...plan,levels:plan.levels.map((s,i)=>({...s,level:s.level+(i>=3?1:0)}))};assert.equal(Curve.windows(gaps,scores).length,0);
});
test('opposite individual offsets may balance, but a one-sided five-level drift fails',()=>{
 const plan={curveWindow:{size:5,tolerance:.5},levels:Array.from({length:5},(_,i)=>({level:200+i,target:10}))};
 assert(Curve.accepts(plan,new Map([9,11,9,11,11].map((n,i)=>[200+i,n]))));
 assert(!Curve.accepts(plan,new Map([10.6,10.6,10.6,10.6,10.6].map((n,i)=>[200+i,n]))));
 assert(Curve.accepts({...plan,curveWindow:undefined},new Map([[200,99]])));
});
test('approved tolerance applies equally to pooled assignment and reserved seed; gap stays two',t=>{
 const {assign}=require('./batch_assign.js'),{boardKey,atomicJson}=require('./meter.js'),O=require('./originality.js');
 const dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'oma-curve8-'));t.after(()=>fs.rmSync(dir,{recursive:true}));
 const base=path.resolve(__dirname,'../../analysis/factory'),plan=JSON.parse(fs.readFileSync(base+'/batch-200-225-plan.json'));plan.levelTable=path.resolve(base,plan.levelTable);
 const pile=JSON.parse(fs.readFileSync(path.resolve(base,plan.piles))).find(p=>p.level===200);
 Object.assign(plan,{tolerance:1,curveWindow:{size:5,tolerance:.5},placementReportOnly:true,levels:[{level:200,target:10,big:false}],skilledMin:2.5,skilledMax:6});
 const design={tiles:pile.tiles,faces:pile.tiles.map((_,i)=>i>>1),down:[],obst:{ice:{},keys:[],locks:[]},clock:{i:0,n:2},solution:pile.tiles.map((_,i)=>i)};
 const rows=[11,10.1,11.001].map((exp,k)=>{const d={...design,faces:design.faces.map(f=>f+k)},id=boardKey(d).slice(0,16);atomicJson(dir+'/'+id+'.rate.json',{train:{valid:true,exp},validation:{valid:true,exp}});atomicJson(dir+'/'+id+'.quality.json',{eligible:true,skilled:{exp:3},room:{ok:true},atTrap:1,special:{}});return{id,level:200,shape:pile.shape,n:pile.tiles.length,recipe:['chainReaction'],design:d,origin:O.originOf(d,'curve8/'+k,'Original',k)};});
 assert.equal(assign(plan,[rows[0]],dir,1000,false,true).rows.length,1);assert.equal(assign(plan,[rows[2]],dir,1000,false,true).rows.length,0);
 const best=assign(plan,rows,dir,1000,false,true);assert.equal(best.rows[0].id,rows[1].id,'Smallest absolute deviation is primary');
 plan.levels[0].keepId=rows[0].id;assert.equal(assign(plan,rows,dir,1000,false,true).rows[0].id,rows[0].id);
 const rate={train:{exp:10},validation:{exp:10}},fresh=exp=>({fresh:{valid:true,seed:Final.SEED,exp}});
 assert(Final.qualifies({edit:'one piece'},rate,fresh(11),{target:10},plan));assert(!Final.qualifies({edit:'one piece'},rate,fresh(11.001),{target:10},plan));
 assert(!Final.qualifies({edit:'one piece'},{train:{exp:8.9},validation:{exp:10}},fresh(11),{target:10},plan));
});
test('assignment rejects a complete drifting window and accepts a balanced one',t=>{
 const {assign}=require('./batch_assign.js'),{boardKey,atomicJson}=require('./meter.js'),dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'oma-window8-'));t.after(()=>fs.rmSync(dir,{recursive:true}));
 const plan={levels:Array.from({length:5},(_,i)=>({level:200+i,target:10,big:false})),tolerance:1,maxSeedGap:2,skilledMin:2.5,skilledMax:6,minTiles:72,curveWindow:{size:5,tolerance:.5},placementReportOnly:true};
 const rows=plan.levels.map((s,k)=>{const design={tiles:Array.from({length:72},(_,i)=>[i*(13+k*7),i%3*31,0]),faces:Array.from({length:72},(_,i)=>i>>1),down:[],obst:{ice:{},keys:[],locks:[]},clock:{i:0,n:2},solution:Array.from({length:72},(_,i)=>i)},id=boardKey(design).slice(0,16);atomicJson(dir+'/'+id+'.quality.json',{eligible:true,skilled:{exp:3},room:{ok:true},atTrap:1,special:{}});return{id,level:s.level,shape:'test'+k,n:72,recipe:[],design,origin:{intendedLevel:s.level}};});
 const scores=values=>rows.forEach((r,k)=>atomicJson(dir+'/'+r.id+'.rate.json',{train:{valid:true,exp:values[k]},validation:{valid:true,exp:values[k]}}));
 scores([10.6,10.6,10.6,10.6,10.6]);assert.equal(assign(plan,rows,dir,10000).rows,null);assert.equal(assign({...plan,curveWindow:undefined},rows,dir,10000).rows.length,5);
 scores([9,9,10,11,11]);const valid=assign(plan,rows,dir,10000);assert.equal(valid.rows.length,5);assert.equal(valid.curveWindows[0].meanOffset,0);
});
