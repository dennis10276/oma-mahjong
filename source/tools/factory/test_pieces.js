'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const I=require('../lab/ideas.js'),P=require('./pieces.js'),{boardKey}=require('./meter.js');
const bases=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/factory/piece-bases.json')));
test('each small piece has at most two parameters and places reversibly on real calm geometry',()=>{
  for(const [name,spec]of Object.entries(P.CATALOGUE)){
    assert(spec.params.length<=2,name);let example=null;
    for(const base of bases){const before=JSON.stringify(base.design),b=spec.place(base.design,P.wayFor(base.design),spec.grid[0],I.rngOf(761));
      assert.equal(JSON.stringify(base.design),before,'Input mutated by '+name);if(!b)continue;
      assert(I.valid(b),name);assert.deepEqual(b.tiles,base.design.tiles);const record=b.pieceInstances.at(-1);
      assert(record.owned.length,name+' must own real tiles');assert.deepEqual(record.patch,P.diff(base.design,b));
      const restored=P.remove(b,record.id);assert(restored,name+' can be switched off');assert.equal(boardKey(restored),boardKey(base.design));example=b;break;
    }assert(example,'No real placement for '+name);
  }
});
test('piece removal refuses an intervening write instead of erasing someone else’s change',()=>{
  const base=bases[0].design,b=P.place('clock',base,P.wayFor(base),{depth:2,spare:1},I.rngOf(21));assert(b);
  const changed=I.clone(b);changed.clock.n++;assert.equal(P.remove(changed,b.pieceInstances[0].id),null);
});
test('decomposition reads physical mechanisms and ignores recipe names and alleged ratings',()=>{
  const b=bases[0].design,a=P.decompose(b),other={...I.clone(b),recipe:['invented'],family:{exp:20},skilled:20};
  assert.deepEqual(P.decompose(other),a);const clock=P.place('clock',b,P.wayFor(b),{depth:2,spare:1},I.rngOf(21));assert(clock);
  const d=P.decompose(clock);assert(d.pieces.some(p=>p.name==='clock'&&p.params.spare===1));assert.equal(d.layout.n,b.tiles.length);
});
test('parameter validation prevents invalid clocks, unbounded chains and invented knobs',()=>{
  const b=bases[0].design,w=P.wayFor(b);assert.throws(()=>P.place('clock',b,w,{spare:0}),/spare/);
  assert.throws(()=>P.place('iceChain',b,w,{length:99}),/length/);assert.throws(()=>P.place('keys',b,w,{difficulty:12}),/Unknown/);
});
