'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const O=require('./chained_obviousness.js'),{SHAPES}=require('./chained_shapes.js'),V=require('./verify_chained_mixes.js');
const toy={tiles:Array.from({length:6},(_,i)=>[i*6,0,0]),faces:[0,0,1,1,2,2],down:[],obst:{ice:{},locks:[],keys:[]},clock:{i:5,n:6},solution:[0,1,2,3,4,5]};
test('obviousness rejects a ready route pair and uses all greedy ties',()=>{
  const a=O.measure(toy);assert.equal(a.ok,false);assert.equal(a.rightFreePairs,true);assert.equal(a.greedyPrefix,true);
  assert.deepEqual(new Set(a.greedyFirst.tiles),new Set([0,1,2,3,4,5]));
  const b=O.measure({...toy,solution:[2,3,0,1,4,5]});assert.equal(b.ok,false);
  const c=O.measure({...toy,solution:[0,2,1,3,4,5]});assert.equal(c.rightFreePairs,true);assert.ok(c.routeFreePairs.some(p=>p.includes(2)&&p.includes(3)));
});
test('obviousness separates a deliberate unmatched start from greedy and checks the optional bait dial',()=>{
  const d={...toy,clock:{i:2,n:3},solution:[0,2,1,3,4,5]},a=O.measure(d);assert.equal(a.ok,true);assert.equal(a.greedyPrefix,false);
  assert.equal(O.measure(d,{dial:2}).ok,false);assert.equal(O.measure(d,{dial:2,baits:[{tiles:[4,5]}]}).ok,true);
});
test('recipes have distinct extended signatures and at least three linked requirements',()=>{
  const T=require('./trap_stories.js');assert.ok(Object.keys(SHAPES).length>=10);
  assert.equal(new Set(Object.values(SHAPES).map(f=>f.signature)).size,Object.keys(SHAPES).length);
  for(const f of Object.values(SHAPES)){assert.equal(f.baseSignature,T.CHAIN_SHAPES[f.chain]);assert.ok(f.links>=3);assert.equal(f.links,f.signature.split('; ').length);}
});
test('ribbon runtime is removed and the Task 13 special tap priority is retained',()=>{
  const root=path.resolve(__dirname,'../..');
  for(const f of ['www/hard.js','www/layouts.js','www/js/board.js','www/js/specials.js','www/js/lang.js','www/style.css','tools/builder/engine.js']){
    const s=fs.readFileSync(path.join(root,f),'utf8');assert.ok(!/ribbon|afterLinks|prerequisites/.test(s),f);
  }
  const board=fs.readFileSync(path.join(root,'www/js/board.js'),'utf8');assert.ok(board.includes('if (frozen(i)) showThaw(i); else if (lockedT(i)) showKeys(); else showBlockers(i);'));
});
test('worker wall terminates a search without inventing a certificate',async()=>{
  const {job}=require('./run_chained_mixes.js'),r=await job({mode:'build',name:'waitThawKey',layout:25,seed:1,wallMs:1});assert.equal(r.fail,'hardWall');assert.equal(r.design,undefined);
});
test('twenty-board delivery has ten shapes with two hosts, independently checked facts and limited needles',{skip:process.env.CHAINED_DELIVERABLES!=='1'},()=>{
  const selection=JSON.parse(fs.readFileSync(path.join(V.OUT,'selection.json'),'utf8'));assert.equal(selection.order.length,20);
  const counts={},hosts={},seen=new Set(),fingerprints=new Set();let needles=0;
  for(const file of selection.order){const r=JSON.parse(fs.readFileSync(path.join(V.OUT,'examples',file),'utf8')),c=r.card;
    assert.equal(r.verification.ok,true,file);assert.ok(c.trap.firstMoves.winning>=2);needles+=c.trap.firstMoves.winning<3?1:0;
    assert.ok(c.tail.tailGreedyWin>=.10&&c.tail.tailGreedyWin<=.28);assert.ok(c.faceDownShare>=.23&&c.faceDownShare<=.30);
    assert.equal(O.measure(r.design,{baits:c.trap.baits,dial:r.brief.obviousnessDial??0}).ok,true);
    const fp=V.fingerprint(r.design);assert.ok(!fingerprints.has(fp),'duplicate special placement');fingerprints.add(fp);
    const pair=c.layout+'/'+c.trap.signature;assert.ok(!seen.has(pair));seen.add(pair);counts[c.trap.type]=(counts[c.trap.type]||0)+1;(hosts[c.trap.type]??=new Set()).add(c.layout);
  }
  assert.equal(Object.keys(counts).length,10);assert.ok(Object.values(counts).every(n=>n===2));assert.ok(Object.values(hosts).every(s=>s.size===2));assert.ok(needles<=4);
});
