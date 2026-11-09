'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { clockSpare, clockTile, clockKeys, clockKeyIce, framePictures } = require('./knobs.js'), { summarize } = require('./knob_study.js');
const E = require('./engine.js');

test('clock spare preserves the physical puzzle and witness and refuses a witness that would change', () => {
  const d = { tiles: [[0, 0, 0], [0, 0, 1], [4, 0, 0], [8, 0, 0]], faces: [0, 1, 1, 0],
    down: [], gold: [], obst: { ice: {}, locks: [], keys: [] }, clock: { i: 0, n: 4 }, solution: [2, 1, 0, 3] };
  const saved = structuredClone(d), r = clockSpare(d, 3);
  assert.ok(!r.fail);
  assert.deepEqual(d, saved);
  assert.equal(r.proof.minimum, 2);
  const changed = structuredClone(saved); changed.clock.n = 5;
  assert.deepEqual(r.design, changed);
  assert.equal(clockSpare(d, 0).fail, 'witnessWouldChange');
  assert.equal(clockSpare(d, -1).fail, 'invalidSpare');
});

test('knob evidence requires complete valid pairs and a strict improvement on 80 percent', () => {
  const plan = { fingerprint: 'plan', bot: 'bot', profiles: ['family'], boards: Array.from({ length: 20 }, (_, i) => ({ id: String(i), story: 'story' })) };
  const records = plan.boards.flatMap((b, i) => ['tight', 'loose'].map(variant => ({ id: b.id, profile: 'family', variant, valid: true,
    expectedTries: variant === 'tight' || i >= 16 ? 8 : 7 })));
  assert.equal(summarize(plan, records).profiles.family.pass, true);
  records[1].valid = false;
  assert.equal(summarize(plan, records).profiles.family.pass, false);
  records[1].valid = true; records[1].expectedTries = 8;
  assert.equal(summarize(plan, records).profiles.family.pass, false);
  assert.equal(summarize(plan, []).profiles.family.valid, 0);
});

test('moving the clock preserves the matching puzzle and proves a new complete witness', () => {
  const d={tiles:[[0,0,0],[0,0,1],[4,0,0],[8,0,0]],faces:[0,1,1,0],down:[],gold:[],obst:{},clock:{i:0,n:4},solution:[2,1,0,3]};
  const saved=structuredClone(d);Object.freeze(d);
  const r=clockTile(d,3,2);
  assert.ok(r.design);
  assert.deepEqual(d,saved);
  for(const field of r.proof.preserved) assert.deepEqual(r.design[field],d[field]);
  assert.equal(r.design.clock.i,3);
  assert.equal(r.design.clock.n,r.proof.minimum+2);
  assert.equal(r.design.solution.indexOf(3)+1,r.proof.minimum);
  assert.equal(E.replay(r.design,r.design.solution).ok,true);
  assert.equal(E.replay(r.design,r.design.solution,{strict:true}).ok,true);
  assert.deepEqual(clockTile(d,3,2).design,r.design);
  assert.equal(clockTile(d,-1,2).fail,'invalidClockTile');
  assert.equal(clockTile(d,3,0).fail,'invalidSpare');
  assert.equal(clockTile({...d,down:[3]},3,2).fail,'clockWouldBeHidden');
  assert.equal(clockTile(d,3,2,{nodes:0}).fail,'minimumUnproven');
});

test('a visible key prelude preserves every picture and adds a meaningful clock dependency',()=>{
 const d={tiles:[[0,0,0],[4,0,0],[8,0,0],[12,0,0]],faces:[0,0,1,1],down:[],gold:[],obst:{ice:{},locks:[],keys:[]},clock:{i:0,n:3},solution:[0,1,2,3]},saved=structuredClone(d);
 const r=clockKeys(d,[2,3],2);assert.ok(r.design);assert.deepEqual(d,saved);
 for(const f of ['tiles','faces','down','gold'])assert.deepEqual(r.design[f],d[f]);
 assert.deepEqual(r.design.obst,{ice:{},locks:[0],keys:[2,3]});
 assert.equal(r.proof.originalMinimum,1);assert.equal(r.proof.minimum,3);assert.equal(r.design.clock.n,5);
 assert.equal(E.replay(r.design,r.design.solution,{strict:true}).ok,true);
 assert.equal(clockKeys(d,[0,1],2).fail,'invalidKeys');
 assert.equal(clockKeys(d,[1,2],2).fail,'keysNotUniquePair');
 assert.equal(clockKeys({...d,obst:{ice:{0:1}}},[2,3],2).fail,'conflictingRoles');
 assert.equal(clockKeys({...d,obst:{ice:{2:1}}},[2,3],2).fail,'conflictingRoles');
 assert.equal(clockKeys(d,[2,3],2,{totalNodes:0}).fail,'sourceMinimumUnproven');
 const reach=require('./loop/research/probe_clock_prelude.js').reachContinuation(r.design,{alive:[0,1,0,0],tray:[0],moves:3});
 assert.equal(reach.status,'win');assert.equal(reach.path.length,3);
});

test('a visible cover lock and a separate thawing prerequisite provide a genuine one-move frame step',()=>{
 const d={tiles:[[0,0,0],[-1,0,1],[4,4,0],[8,0,0],[8,4,0],[12,4,0],[1,0,1],[-1,2,1]],faces:[0,1,1,0,2,2,3,3],down:[],gold:[],obst:{ice:{},locks:[],keys:[]},clock:{i:0,n:5},solution:[1,6,0,2,3,7,4,5]};
 const saved=structuredClone(d),key=clockKeys(d,[4,5],1,{lockTile:6}),ice=clockKeyIce(d,[4,5],{tile:1,h:2},1,{lockTile:6});
 assert.ok(key.design&&ice.design);assert.deepEqual(d,saved);
 assert.deepEqual(key.design.obst.locks,[6]);assert.equal(key.proof.minimum,5);assert.equal(ice.proof.minimum,6);
 assert.equal(ice.proof.keyMinimum,5);assert.deepEqual(ice.design.faces,d.faces);assert.deepEqual(ice.design.tiles,d.tiles);
 assert.equal(E.replay(ice.design,ice.design.solution,{strict:true}).ok,true);
 assert.equal(clockKeyIce(d,[4,5],{tile:6,h:1},1,{lockTile:6}).fail,'conflictingRoles');
});

test('prelude picture repair preserves the entire declared continuation and refuses body/key edits',()=>{
 const d={tiles:Array.from({length:8},(_,i)=>[i*4,0,0]),faces:[0,0,1,1,2,2,3,3],down:[],gold:[],obst:{ice:{},locks:[0],keys:[2,3]},clock:{i:0,n:5},solution:[2,3,0,1,4,5,6,7]};
 const state={alive:[0,0,0,0,0,0,1,1],tray:[],moves:6},saved=structuredClone(d),r=framePictures(d,[[0,4]],state,2);
 assert.ok(r.design);assert.deepEqual(d,saved);assert.deepEqual(r.design.faces.slice(6),d.faces.slice(6));
 assert.deepEqual(r.design.faces.slice(0,6).sort(),d.faces.slice(0,6).sort());assert.deepEqual(r.design.obst,d.obst);
 assert.equal(E.replay(r.design,r.design.solution,{strict:true}).ok,true);
 assert.equal(framePictures(d,[[0,6]],state,2).fail,'frameOutsideContract');
 assert.equal(framePictures(d,[[0,2]],state,2).fail,'frameOutsideContract');
 assert.equal(framePictures(d,[[0,4]],{...state,alive:[1,0,0,0,0,0,1,1]},2).fail,'invalidContinuation');
 assert.equal(framePictures(d,[[0,4]],state,2,{totalNodes:0}).fail,'minimumUnproven');
});
