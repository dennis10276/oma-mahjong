'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const D=require('./piece_designer.js'),P=require('./pieces.js'),C=require('./compose.js'),I=require('../lab/ideas.js'),{boardKey}=require('./meter.js');
const bases=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/factory/piece-bases.json')));
test('piece proposals are reproducible distinct lists with one clock and small mechanisms',()=>{
  const a=D.proposals(71,40);assert.deepEqual(a,D.proposals(71,40));assert.notDeepEqual(a,D.proposals(72,40));
  for(const list of a){assert.equal(list.filter(p=>['clock','clockWay','wrongClock'].includes(p.name)).length,1);for(const p of list){assert(Object.keys(p.params).length<=2);assert(list.filter(q=>q.name===p.name).length<=3);
    const measured=[...P.CATALOGUE[p.name].grid,P.CATALOGUE[p.name].defaults].map(params=>C.settingKey({name:p.name,params}));assert(measured.includes(C.settingKey(p)),'Only calibrated parameter settings are proposed');}}
});
test('measured easier effects and negative pair interactions are retained in list estimates',()=>{
  const a={name:'clock',params:{depth:2,spare:1}},b={name:'keys',params:{depth:2,across:false}},s=x=>({medianLog:Math.log(x)}),effects=[
    {key:C.settingKey(a),family:s(2),skilled:s(1.2)},{key:C.settingKey(b),family:s(.5),skilled:s(1.1)},
    {key:C.settingKey(a)+' + '+C.settingKey(b),family:s(.9),skilled:s(1)}];
  const p=D.prior([a,b],effects);assert(Math.abs(p.family.tries-1.08)<1e-8);assert.equal(p.unknown,0);
});
test('assembling linked pieces retains a legal readable board and records the owned lock',()=>{
  let made=null;for(const b of bases){made=D.assemble(b.design,[{name:'clock',params:{depth:2,spare:2}},{name:'keys',params:{depth:2,across:false}},{name:'clockLock',params:{keyDepth:2}}],71);if(made)break;}
  assert(made);assert(I.valid(made.design));assert.equal(made.design.pieceInstances.length,3);assert(D.components(made.design).some(c=>c.kind==='locks'&&c.indices.includes(made.design.clock.i)));
});
test('a guided repair changes one piece list item and preserves the creation identity',()=>{
  const training=[];for(const b of bases)for(const spare of[1,3]){const made=D.assemble(b.design,[{name:'clock',params:{depth:2,spare}}],81);assert(made);training.push({id:b.id+'-'+spare,design:made.design,family:{exp:spare===1?8:2,seedCount:2},skilled:{exp:2.8}});}
  const model=C.fit(training),base=bases[0],list=[{name:'clock',params:{depth:2,spare:1}}],made=D.assemble(base.design,list,81),row={id:boardKey(made.design).slice(0,16),design:made.design,pieces:list,shape:base.shape,origin:{creationId:'test/71',creationSlot:771},pieceDesigner:{seed:81,baseDesign:base.design}};
  const a={key:C.settingKey(list[0]),family:{medianLog:Math.log(8/1.2)},skilled:{medianLog:Math.log(2.8)}},b={key:C.settingKey({name:'clock',params:{depth:2,spare:3}}),family:{medianLog:Math.log(2/1.2)},skilled:{medianLog:Math.log(2.8)}};
  const next=D.tuneOne(row,{family:8,skilled:2.8},{level:210,target:3},model,[a,b]);assert(next);assert.equal(next.pieces.length,1);assert.equal(next.pieceChange.index,0);assert.equal(next.origin.creationId,row.origin.creationId);assert.equal(next.origin.creationSlot,771);assert(I.valid(next.design));
});
