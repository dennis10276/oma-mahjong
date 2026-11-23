'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./chained_special_readability.js'),P=require('./chained_finish_profiles.js');
test('a visible overlay sliver cannot certify a hidden bottom-right lock badge',()=>{
  // Higher tile leaves the lower tile's left side visible but covers its glyph.
  const d={tiles:[[0,0,0],[1,0,1]],down:[],obst:{locks:[0],keys:[],ice:{}}};
  const m=R.measure(d);assert.equal(m.ok,false);assert.equal(m.rows[0].shown,0);
  d.obst.locks=[1];assert.equal(R.measure(d).ok,true);
  d.down=[1];assert.equal(R.measure(d).ok,false);
});
test('overlapping covers count their union, and the clear badge boundary is enforced',()=>{
  assert.equal(R.exposed({l:0,t:0,r:1,b:1},[{l:0,t:0,r:.5,b:1},{l:.25,t:0,r:.75,b:1}]),.25);
  assert.equal(R.exposed({l:0,t:0,r:1,b:1},[]),1);
});
test('lighter revisions require provenance and both pressure and natural-finish acceptance',()=>{
  const f={parkAt:[1,.8,.2],waiting:[.6,.25,.13,.02],lostGames:0};
  const r={card:{finishProfile:'light-after-verdict'}};
  assert.equal(P.check(r,f,{tailGreedyWin:.8}),false);
  r.reviewRevision={sourceFile:'original.json',reason:'finish too hard'};
  assert.equal(P.check(r,f,{tailGreedyWin:.8}),true);
  assert.equal(P.check(r,f,{tailGreedyWin:.03}),false);
  assert.equal(P.check(r,{...f,parkAt:[1,2,.4]},{tailGreedyWin:.8}),false);
  assert.equal(P.check({card:{}},{...f,parkAt:[1,2,.4]},{}),true);
  assert.equal(P.check({card:{finishProfile:'anything'}},f,{}),false);
});
test('replay imports join chunks by attempt and sequence, and exclude the documented agent QA',()=>{
  const {replaySummary}=require('./chained_six_review.js'),manifest=[{id:123,labLevel:350}];
  const c=(aid,seq,data)=>JSON.stringify({aid,seq,data:JSON.stringify(data)});
  const init={key:'X123',at:2,state:{ck:{i:7},m:0}};
  const raw={'omamj.replayq.b':c('human',1,{events:[[1,'tap',[7]],[2,'state',{a:[[7,0]],m:1}],[3,'end',{r:'restart'}]]}),'omamj.replayq.a':c('human',0,{init,events:[]}),
    'omamj.replayq.qa':c('qa',0,{init,events:[]}), 'omamj.replayq':'metadata, not a chunk'};
  const r=replaySummary(raw,manifest,['qa']);assert.equal(r.attempts.length,1);
  assert.equal(r.attempts[0].continuous,true);assert.equal(r.attempts[0].reachedClock,true);assert.equal(r.attempts[0].end,'restart');
});

test('new ideas target 2 parks and existing ideas accept 3 through 5', () => {
  const feel = parks => ({ parkAt: [0, parks, 0], waiting: [0, 0, 0, 0], lostGames: 0 });
  const newIdea = { card: { finishProfile: 'new-idea' } };
  const existing = { card: { finishProfile: 'existing-idea' } };
  assert.deepEqual(P.targetFor('new'), { parks: 2, parksMax: 2, max3: .1 });
  assert.deepEqual(P.targetFor('existing'), { parks: 3, parksMax: 5, max3: .25 });
  for (const [parks, accepted] of [[1.9, false], [2, true], [2.1, false]]) {
    assert.equal(P.check(newIdea, feel(parks), {}), accepted, 'new at ' + parks);
  }
  for (const [parks, accepted] of [[2.9, false], [3, true], [4, true], [5, true], [5.1, false]]) {
    assert.equal(P.check(existing, feel(parks), {}), accepted, 'existing at ' + parks);
  }
});

test('pressure tuning resolves new and existing defaults and explicit bounds', () => {
  const args = values => (key, other) => values[key] ?? other;
  assert.deepEqual(P.tuningTarget(args({}), 'existing'), { parks: 3, parksMax: 5, max3: .25 });
  assert.deepEqual(P.tuningTarget(args({ idea: 'new' }), 'existing'), { parks: 2, parksMax: 2, max3: .1 });
  assert.deepEqual(P.tuningTarget(args({ parks: '7', 'parks-max': '8', max3: '.2' }), 'existing'),
    { parks: 7, parksMax: 8, max3: .2 });
});
