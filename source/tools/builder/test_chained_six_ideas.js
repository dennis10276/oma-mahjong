'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process');
const Specs=require('./chained_six_specs.js'),Facts=require('./chained_six_facts.js');
const bank=path.resolve(__dirname,'fixtures/six-ideas');
const load=file=>JSON.parse(fs.readFileSync(path.join(bank,file)));
test('all six are link kinds with placement, picture constraints, and proof',()=>{
  const {LINK_KINDS}=require('./chained_six_ideas.js');
  assert.deepEqual(Object.keys(LINK_KINDS),['doubleMelt','freeMelt','clockCount','selfLocked','savePair','keysLater']);
  for(const q of Object.values(LINK_KINDS))for(const method of ['place','pictures','prove'])assert.equal(typeof q[method],'function');
});
test('the composition API accepts ordered link lists on an existing dependency graph',()=>{
  const M=require('./trap_mixes.js');
  for(const a of Object.keys(Specs.DEFINITIONS))for(const b of Object.keys(Specs.DEFINITIONS).filter(b=>b!==a)){
    const name='test18_'+a+'_'+b,f=M.registerChain(name,{base:'roofThawKey',links:[a,b]});
    assert.deepEqual(f.sixIdeas,[a,b]);assert.equal(f.mode,'roofKey');assert.ok(f.signature.endsWith('route<'+a+'; route<'+b));
    assert.equal(typeof M.STORIES[name].prove,'function');
  }
  assert.throws(()=>M.registerChain('test18_bad',{links:['savePair','savePair']}),/Invalid/);
});
test('the independent verifier loads no story or TASK 18 constructor',()=>{
  const code="require('./source/tools/builder/verify_chained_v2');process.stdout.write(JSON.stringify(Object.keys(require.cache).filter(f=>['trap_mixes.js','trap_stories.js','chained_six_ideas.js'].includes(require('path').basename(f)))))";
  assert.deepEqual(JSON.parse(cp.execFileSync(process.execPath,['-e',code],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'})),[]);
});
test('the third copy, its visibility, and the authored bait cannot be forged',()=>{
  const r=load('savePair-L28-s81-p1.json'),q=r.roles.bait.six;
  assert.equal(Facts.evidence('savePair',r.design,q).ok,true);
  const d=structuredClone(r.design);d.down.push(q.third);assert.equal(Facts.evidence('savePair',d,q).ok,false);
  const edited=structuredClone(q);edited.take=[q.buried];assert.equal(Facts.evidence('savePair',r.design,edited).why,'baitRecipeChanged');
  const hidden=structuredClone(q);hidden.visible=[];assert.equal(Facts.evidence('savePair',r.design,hidden).ok,false);
});
test('self locking requires the visible twin behind that same ice',()=>{
  const r=load('selfLocked-L19-s85-p1.json'),q=r.roles.bait.six;
  assert.equal(Facts.evidence('selfLocked',r.design,q).ok,true);
  const d=structuredClone(r.design);delete d.obst.ice[q.host];assert.equal(Facts.evidence('selfLocked',d,q).ok,false);
});
test('a keys-later lock must be off the clock route and have an independently proven second act',()=>{
  const r=load('keysLater-L28-s89-p1.json'),q=r.roles.bait.six;
  assert.equal(Facts.audit(r).ok,true);
  const forged=structuredClone(r);forged.card.trap.effects=forged.card.trap.effects.filter(e=>e.tile!==q.lock);
  assert.ok(Facts.audit(forged).errors.includes('postClockLockEffect'));
});
test('removing a composed link from the card or the roles is rejected',()=>{
  const r=load('selfLocked_savePair-L25-s93-p1.json');
  r.roles.bait.sixLinks=r.roles.bait.sixLinks.filter(q=>q.kind!=='savePair');
  assert.ok(Facts.audit(r).errors.includes('missingComposedLink'));
});
test('clock count has a real longer winning approach, not merely a nearby roof',()=>{
  const r=load('clockCount-L0-s113-p1.json'),q=r.roles.bait.sixLinks[0],top=r.card.trap.newLink.top;
  const E=require('./engine.js');
  assert.equal(Facts.evidence('clockCount',r.design,q).ok,true);
  assert.ok(top.clockAt>r.design.clock.n);
  assert.equal(Facts.clockAlternativeWitness(r.design,q,top),true);
  assert.equal(Facts.clockAlternativeWitness(r.design,q,{...top,side:r.design.clock.i}),false);
  assert.equal(E.replay({...r.design,clock:{...r.design.clock,n:99}},top.solution,{strict:true}).ok,true);
  assert.ok(!top.solution.slice(0,top.clockAt).includes(q.parkSide));
  const wrong=structuredClone(q);wrong.parkSide=r.design.clock.i;
  assert.equal(Facts.evidence('clockCount',r.design,wrong).ok,false);
});
test('a tail lock connects through its actual clock-tray twin, not arbitrary matching pictures',()=>{
  const r=load('keys-later-relay.json'),C=require('./verify_chained_mixes.js'),f=require('./chained_shapes.js').SHAPES.keysLater;
  const q=r.roles.bait.six,relays=Facts.postClockRelays(r.design,q.lock);
  assert.equal(relays.length,1);assert.equal(relays[0].twin,q.lock);
  assert.deepEqual(C.chainStructure(r,f),[]);
  const edited=structuredClone(r),E=require('./engine.js'),g=E.game(r.design);let s=E.start(g);
  for(const i of r.design.solution){s=E.step(g,s,i);if(i===r.design.clock.i)break;}
  const waiting=new Set(s.tray.map(i=>r.design.faces[i]));
  edited.design.faces[q.lock]=r.design.faces.find(f=>!waiting.has(f));
  assert.equal(Facts.postClockRelays(edited.design,q.lock).length,0);
  assert.ok(C.chainStructure(edited,f).includes('disconnectedSpecial'));
});
