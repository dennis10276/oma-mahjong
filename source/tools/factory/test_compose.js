'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const C=require('./compose.js'),P=require('./pieces.js'),I=require('../lab/ideas.js');
test('the log model learns easier pieces, nonlinear interactions and actual held-out numeric cases',()=>{
  const rows=[];for(const a of[0,.2,.5,.8,1])for(const b of[0,.3,.6,1])rows.push({x:{a,b,ab:a*b},y:Math.exp(.5+.7*a-.3*b+.4*a*b)});
  const model=C.fitRegression(rows,1e-8),x={a:.4,b:.7,ab:.28},expected=Math.exp(.5+.7*.4-.3*.7+.4*.28);
  assert(Math.abs(C.predictRegression(model,x).tries-expected)<1e-5);assert(model.beta[model.keys.indexOf('b')]<0);
});
test('an entire layout group stays on one side and held-out labels never affect the evaluation model',()=>{
  const bases=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/factory/piece-bases.json'))),rows=[];
  for(const b of bases)for(let k=0;k<2;k++){
    const d=k?P.place('clock',b.design,P.wayFor(b.design),{depth:2,spare:1},I.rngOf(81)):b.design;assert(d);
    rows.push({id:b.id+'-'+k,group:b.layout,design:d,family:{exp:Math.exp(.5+.4*k),seedCount:2},skilled:{exp:Math.exp(.2+.25*k)}});
  }
  const first=C.trainAndValidate(rows),split=C.partition(rows);assert(split.trainGroups.every(g=>!split.testGroups.includes(g)));
  const changed=rows.map(r=>split.testGroups.includes(r.group)?{...r,family:{exp:19,seedCount:2},skilled:{exp:17}}:r),second=C.trainAndValidate(changed);
  assert.deepEqual(first.heldoutModel,second.heldoutModel);assert.notDeepEqual(first.report.settings,second.report.settings);
  const prediction=C.predict(first.model,rows[0]);assert(Number.isFinite(prediction.family.tries));assert(prediction.family.interval[0]>=1&&prediction.family.interval[1]<=20);
});
test('metrics handle tied capped outcomes and report the requested error bands',()=>{
  const m=C.metrics([{predicted:1,measured:1},{predicted:3.5,measured:2},{predicted:20,measured:20}]);
  assert.equal(m.within1,2/3);assert.equal(m.within2,1);assert.equal(m.mae,.5);assert.equal(m.atCap,1);assert(m.spearman>.9);
});
test('log-to-tries conversion estimates the arithmetic mean from training residuals',()=>{
  const model=C.fitRegression([1,1,9].map(y=>({x:{},y}))),p=C.predictRegression(model,{});
  assert(Math.abs(p.tries-11/3)<1e-7);assert(p.median<p.tries);assert(model.smearing>1);
});
test('historical collection preserves pooled labels and trains on the actual bot beside human evidence',t=>{
  const os=require('os'),M=require('./meter.js'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'piece-history-'));
  t.after(()=>{assert(dir.startsWith(path.join(os.tmpdir(),'piece-history-')));fs.rmSync(dir,{recursive:true,force:true});});
  const base=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/factory/piece-bases.json')))[0],id=M.boardKey(base.design),row={id:id.slice(0,16),design:base.design,shape:base.shape};
  for(const [name,stamp,rate,skilled]of[
    ['batch-200-225-a',10,{train:{valid:true,exp:10},validation:{valid:true,exp:12}},{exp:3,valid:true}],
    ['batch-200-225-b',20,{train:{valid:true,exp:20}},{exp:4,botExp:2.08,botValid:true,valid:true}]]){
    const d=path.join(dir,name);fs.mkdirSync(d);fs.writeFileSync(path.join(d,'pool.json'),JSON.stringify([row]));fs.utimesSync(path.join(d,'pool.json'),stamp,stamp);
    fs.writeFileSync(path.join(d,row.id+'.rate.json'),JSON.stringify({...rate,key:id,bot:'current'}));
    fs.writeFileSync(path.join(d,row.id+'.quality.json'),JSON.stringify({key:id,bot:'current',skilled}));
  }
  const result=require('./learn_pieces.js').loadHistorical(dir,'current');assert.equal(result.rows.length,1);assert.equal(result.rows[0].family.exp,11);assert.equal(result.rows[0].family.seedCount,2);assert.equal(result.rows[0].skilled.exp,2.08);
});
