'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const P=require('./bank/narrow_proof'),G=require('./bank/narrow_methods');
const read=f=>JSON.parse(fs.readFileSync(path.join(P.DIR,f),'utf8'));
test('certifies a matched historical chain after tidy narrowing',()=>{
  const before=P.original(252),base=P.prepare(before),draft=read('level-252.json'),proof=P.certify(before,draft,base);
  assert.equal(proof.ok,true,JSON.stringify(proof.errors));
  assert.ok(proof.checks.includes('ownAuthoredTrapProofAndGates'));
  assert.equal(proof.k,8);assert.equal(proof.spare,2);
});
for(const [level,error]of [[253,'badge:39:lock'],[258,'badge:6:key'],[293,'baitPrice:73']])test(`holds draft ${level} when its original trap presentation/effect changes`,()=>{
  const before=P.original(level),base=P.prepare(before),draft=read(`held/level-${level}.json`);
  // Historical squeeze drafts could use a negative global origin. Translate
  // the entire pile before checking the substantive regression, so a format
  // error cannot mask a changed authored bait.
  const x=Math.min(...draft.design.tiles.map(t=>t[0])),y=Math.min(...draft.design.tiles.map(t=>t[1]));
  draft.design.tiles=draft.design.tiles.map(t=>[t[0]-x,t[1]-y,t[2]]);
  const proof=P.certify(before,draft,base);
  assert.equal(proof.ok,false);assert.ok(proof.errors.includes(error),JSON.stringify(proof.errors));
});
test('refuses a larger clock allowance even on an otherwise certified draft',()=>{
  const before=P.original(252),base=P.prepare(before),draft=read('level-252.json');draft.design.clock.n++;
  assert.ok(P.certify(before,draft,base).errors.includes('changed:clock'));
});
test('whole-stack hop retains its order and must be fully supported',()=>{
  const a={tiles:[[0,0,0],[2,0,0],[2,0,1],[4,0,0],[4,0,1]]};
  const q=G.edge(a,0,-1,2,2);assert.ok(q.tiles);assert.equal(q.tiles[0][2],2);assert.ok(G.valid(q.tiles));
  assert.equal(G.edge(a,0,-1,1,1).tiles,undefined);
});
test('the task runner refuses every tenth level before reading or writing a board',()=>{
  assert.throws(()=>require('./bank/narrow_search').one(260),/Tenth levels are frozen/);
});
