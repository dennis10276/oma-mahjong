'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),T=require('./shape_bench_tools');
const board=tiles=>({tiles,faces:tiles.map((_,i)=>i%2),down:[],obst:{ice:{},keys:[],locks:[]},clock:{i:0,n:10},solution:[]});
test('straight support on any layer is rejected; half-offset brick is supported',()=>{
 const a=T.geometry(board([[0,0,0],[2,0,0],[0,0,1]]));assert(a.errors.includes('towers'));
 const b=T.geometry(board([[0,0,0],[2,0,0],[1,0,1]]));assert(!b.errors.includes('towers'));assert(!b.errors.includes('supportOrOverlap'));
 const c=T.geometry(board([[0,0,0],[1,0,1]]));assert(c.errors.includes('supportOrOverlap'));
});
test('initial free invariant ignores peek-pair actions and keeps original IDs',()=>{
 const d=board([[0,0,0],[2,0,0],[4,0,0]]);d.faces=[1,2,1];d.down=[0,2];
 const r=T.relations(d,[10,20,30]);assert.deepEqual(r.free,[10,30]);assert.deepEqual(r.holds[20].left,[10]);assert.deepEqual(r.holds[20].right,[30]);
 const moved=structuredClone(d);moved.tiles[1]=[2,4,0];const B={a:d,design:()=>({d:moved,keep:[0,1,2]})};
 assert(T.invariants(B).freed.includes(1));assert(!T.invariants(B).ok);
});
test('saving after a further edit cannot reuse a stale passing proof',()=>{
 const B=require('./shape_bench').bench(252);
 B.last={r:{ok:true},input:JSON.stringify(B.design())};B.move(0,1);
 assert.throws(()=>B.save('stale'),/board changed after proof/);
});
test('the Task 23 certificate rejects straight towers before mechanics can pass',()=>{
 const d=board([[0,0,0],[2,0,0],[0,0,1]]),r=require('./towers_proof').certify({design:d},d,[0,1,2]);
 assert.equal(r.ok,false);assert(r.errors.includes('shape:towers'));
});
