'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const T=require('./trap_stories.js'),before=Object.fromEntries(Object.entries(T.STORIES));
const M=require('./trap_mixes.js'),V=require('./verify_trap_mixes.js'),B=require('./builder.js');
const toy={tiles:Array.from({length:8},(_,i)=>[i*6,0,0]),faces:[0,1,2,3,0,1,2,3],down:[],obst:{ice:{},locks:[],keys:[]},clock:{i:0,n:2},solution:[0,4,1,5,2,6,3,7]};
test('new stories register without replacing established stories',()=>{
  assert.ok(Object.keys(M.FAMILIES).length>=12);
  for(const [name,s]of Object.entries(before))assert.equal(T.STORIES[name],s);
  const signatures=new Set();
  for(const f of Object.values(M.FAMILIES)){
    assert.equal(B.STORIES[f.name],M.STORIES[f.name]);assert.equal(typeof M.STORIES[f.name].place,'function');assert.equal(typeof M.STORIES[f.name].prove,'function');
    assert.ok(f.see&&f.dials.easier&&f.dials.harder);signatures.add([f.base,f.chain,f.mode].join('/'));
  }
  assert.equal(signatures.size,Object.keys(M.FAMILIES).length,'recipes differ structurally');
});
test('invalid briefs fail without a search',()=>{
  assert.equal(M.build('not-a-story').fail,'unknownMix');assert.equal(M.build('freeClockIce',{layout:999}).fail,'unknownLayout');
  assert.equal(M.build('freeClockIce',{frame:{spare:0}}).fail,'invalidSpare');
});
test('independent oracle checks deadline, capacity, illegality and exact prices',()=>{
  assert.equal(V.oracle(toy,1),'win');assert.equal(V.oracle(toy,1,[1]),'lose');
  assert.equal(V.oracle(toy,99,[0,1,2,3]),'lose');assert.equal(V.oracle(toy,99,[0,0]),'illegal');
  assert.deepEqual(V.reprice(toy,1,[1]),{tiles:[1],result:'win',need:2,cost:1,exact:true});
});
test('independent verifier rejects malformed and fabricated records',()=>{
  assert.equal(V.verify({}).ok,false);
  const d={...toy,tiles:Array.from({length:72},(_,i)=>[i*6,0,0]),faces:Array.from({length:72},(_,i)=>Math.floor(i/2)),solution:Array.from({length:72},(_,i)=>i)};
  assert.equal(V.checkDesign(d),null);
  assert.equal(V.checkDesign({...d,faces:d.faces.map(()=>0)}),'pictures');
  assert.equal(V.checkDesign({...d,solution:d.solution.map(()=>0)}),'solutionPermutation');
  assert.equal(V.checkDesign({...d,obst:{...d.obst,keys:[0,2]}}),'keysNotPair');
  assert.equal(V.structure(toy,{type:'sharedRoofLocks',mechanism:{mode:'addLock',added:3},baits:[]}), 'sharedLocks');
  assert.equal(V.structure(toy,{type:'freeClockIce',mechanism:{mode:'earlyClock',originalClock:0},baits:[]}), 'freeClock');
});
test('independent verifier has no story-proof dependency',()=>{
  const source=fs.readFileSync(path.join(__dirname,'verify_trap_mixes.js'),'utf8');
  assert.ok(!/require\(['"]\.\/trap_(?:mixes|stories)\.js/.test(source));
  assert.ok(!/\.prove\(/.test(source));
});
test('combined key/lock badge needs a clear upper-left corner, not just a visible ice overlay',()=>{
  assert.equal(V.combinedMarkerClear({tiles:[[0,0,0],[1,0,1]]},0),true);
  assert.equal(V.combinedMarkerClear({tiles:[[0,0,0],[-1,0,1]]},0),false);
});
test('retiming replaces a late clock witness and never treats an unresolved minimum as a proof',()=>{
  const d={...toy,clock:{i:0,n:6},solution:[1,5,0,4,2,6,3,7]},r=M.retime(d,1);
  assert.equal(r.ok,true);assert.equal(r.k,1);assert.equal(r.design.clock.n,2);assert.equal(r.design.solution[0],0);
  assert.equal(V.oracle(r.design,0),'lose');assert.equal(d.clock.n,6);assert.equal(d.solution[0],1);
  assert.equal(M.retime(d,1,{nodes:0,totalNodes:0}).ok,false);
});
test('locked picture relief preserves strict play and waits for both real keys',()=>{
  const tiles=[[0,0,1],[6,0,1],[50,10,0],[56,10,0],[0,0,0],[6,0,0],[20,0,1],[60,10,0],[22,0,1],[18,0,1],[20,0,0],[66,10,0],[72,10,0],[78,10,0]];
  const faces=[0,1,2,2,3,3,4,4,5,5,6,6,0,1],W=[0,1,2,3,4,5,8,9,6,7,10,11,12,13];
  const r={clock:11,keys:[4,5],locks:new Set([8,10]),ice:{6:2},holderSpecials:new Set(),bait:{mix:{originalClock:10},tiles:[],keepUp:[]}};
  const plan={faces:faces.slice(),W,pos:Array.from({length:14},(_,i)=>W.indexOf(i)),pairOf:[12,13,3,2,5,4,7,6,9,8,11,10,0,1],dig:{orphans:[0,1]}};
  assert.equal(M.lockedRelay(B.context(tiles),r,plan),true);
  assert.deepEqual(plan.faces.slice().sort(),faces.slice().sort());
  const d={tiles,faces:plan.faces,down:[],obst:{ice:r.ice,locks:[...r.locks],keys:r.keys},clock:{i:11,n:12},solution:W},E=require('./engine.js');
  assert.equal(E.replay(d,W,{strict:true}).ok,true);
  const g=E.game(d);let s=E.start(g);for(const i of [0,1,2,3,4])s=E.step(g,s,i);
  assert.ok(!E.legal(g,s).includes(8));s=E.step(g,s,5);assert.ok(E.legal(g,s).includes(8));s=E.step(g,s,8);
  assert.ok(!s.tray.some(i=>g.faces[i]===g.faces[0]));
  const t={type:'splitThawLocks',mechanism:{mode:'earlyClock',originalClock:10,relay:r.bait.relay},baits:[{tiles:[11]}]};
  assert.equal(V.structure(d,t),null);
  assert.equal(V.structure({...d,faces},t),'lockedPictureRelay');
});
test('independent search rejects an invented losing-clock bait',()=>{
  const design={...toy,tiles:Array.from({length:72},(_,i)=>[i*6,0,0]),faces:Array.from({length:72},(_,i)=>Math.floor(i/2)),solution:Array.from({length:72},(_,i)=>i)};
  const fake={design,card:{clock:{fewestMoves:1,spare:1},trap:{type:'freeClockIce',priceHorizon:4,
    mechanism:{mode:'earlyClock',originalClock:1},baits:[{tiles:[0],result:'lose',cost:null,exact:true}],
    effects:[],control:{moves:35,value:2,dearest:{tiles:[2,3],result:'win',cost:2}}}}};
  const r=V.verify(fake,{finished:false,nodes:10000,callMs:100});
  assert.equal(r.ok,false);assert.ok(r.errors.includes('baitPrice:0'));assert.ok(r.errors.includes('harmlessBait:0'));
});
// The expensive integration check belongs in the reserved, wall-limited runner.
// It is opt-in so a normal node --test does not silently start a sweep.
const dir=path.resolve(__dirname,'../../analysis/builder/bank/variety-v1/examples');
test('finished examples carry successful independent certificates',{skip:!fs.existsSync(dir)},()=>{
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
    assert.equal(r.verification?.ok,true,file);assert.ok(r.card.trap.baits.length);assert.ok(r.card.trap.firstMoves.winning>=2);
    assert.ok(r.card.twins.meets);assert.ok(r.card.tail.tailGreedyWin>=.15&&r.card.tail.tailGreedyWin<=.4);
  }
});
test('hard worker deadline terminates work and yields a failure, never an example',async()=>{
  const {job}=require('./run_trap_mixes.js');
  const r=await job({name:'freeClockIce',layout:0,seed:1,tries:30,wallMs:1});
  assert.equal(r.fail,'hardWall');assert.equal(r.design,undefined);
});
test('delivery has thirty independently certified boards, twelve families and a valid ledger order',{skip:process.env.TRAP_MIXES_DELIVERABLES!=='1'},()=>{
  const root=path.dirname(dir),files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')),selection=JSON.parse(fs.readFileSync(path.join(root,'selection.json'),'utf8'));
  assert.equal(files.length,30);assert.equal(selection.order.length,30);assert.deepEqual(new Set(selection.order),new Set(files));
  let previous=JSON.parse(fs.readFileSync(path.join(root,'ledger-history.json'),'utf8'));const counts={};
  for(const file of selection.order){const r=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));assert.equal(r.verification.ok,true,file);const check=M.Ledger.check(r,previous);assert.equal(check.ok,true,file+': '+check.reasons.join(';'));previous=previous.concat(M.Ledger.signature(r.design,r.card));counts[r.card.trapType]=(counts[r.card.trapType]||0)+1;}
  assert.ok(Object.keys(counts).length>=12);assert.ok(Object.values(counts).every(n=>n>=2));
});
