'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const B=require('./bank/narrow_placement_build'),M=require('./bank/narrow_placement_model'),F=require('./footprint');
const rows=JSON.parse(fs.readFileSync(path.join(B.OUT,'placement-data.json'))).levels;
test('includes all eight remade boards and all 32 unresolved ordinary boards with tiles at the side',()=>{
  assert.equal(rows.length,40);assert.equal(rows.filter(r=>r.status==='remade').length,8);assert.equal(rows.filter(r=>r.status==='needs placement').length,32);
  for(const row of rows){assert.notEqual(row.level%10,0);assert.equal(new Set(row.problem).size,row.problem.length);assert.ok(row.problem.length>0);const initial=M.initial(row);assert.equal(initial.positions.filter(p=>!p).length,row.problem.length);assert.ok(initial.positions.filter(Boolean).length>0);}
});
test('the editable footprint matches the reference-phone measurement including partially placed boards',()=>{
  for(const row of rows)for(const positions of [row.base.tiles,M.initial(row).positions]){const actual=M.footprint(positions),expected=F.measure(positions.filter(Boolean),{minimum:58});assert.ok(Math.abs(actual.tilePx-expected.tilePx)<1e-8);assert.equal(actual.rows,expected.rows);}
});
test('auto placement uses a supported free layer and rejects floating manual placement',()=>{
  const ts=[[0,0,0],[0,0,1],null];assert.deepEqual(M.propose(ts,2,0,0,'auto'),[0,0,2]);assert.equal(M.propose(ts,2,4,0,'1'),null);assert.deepEqual(M.propose(ts,2,4,0,'auto'),[4,0,0]);
});
test('snapshots cannot change the board version, tile count or tile coordinate types',()=>{
  const row=rows[0],s=M.initial(row);assert.throws(()=>M.validate(row,{...s,baseHash:'wrong'}));assert.throws(()=>M.validate(row,{...s,positions:s.positions.slice(1)}));s.positions[0]=[.5,0,0];assert.throws(()=>M.validate(row,s));
});
test('checker proves a known draft with exactly its pictures and rejects overlap and unfinished arrangements',()=>{
  const row=rows.find(r=>r.level===252),C=require('./bank/narrow_placement_check'),s=M.initial(row);assert.equal(C.check(row,s).status,'incomplete');
  s.positions=M.copy(row.base.tiles);const result=C.check(row,s);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.design.faces,row.base.faces);assert.deepEqual(result.design.clock,row.base.clock);
  s.positions[0]=s.positions[1].slice();const bad=C.check(row,s);assert.equal(bad.ok,false);assert.equal(bad.status,'failed');assert.ok(bad.tiles.includes(0));
});
test('a lower placement can receive a newly proven finish without changing its pictures',()=>{
  const row=rows.find(r=>r.level===252),s=M.initial(row),E=require('./engine');s.positions=M.copy(row.base.tiles);s.positions[18]=[0,10,0];
  assert.equal(E.replay({...M.copy(row.base),tiles:s.positions},row.base.solution,{strict:true}).ok,false);
  const result=require('./bank/narrow_placement_check').check(row,s);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.design.faces,row.base.faces);assert.equal(E.replay(result.design,result.design.solution,{strict:true}).ok,true);assert.notDeepEqual(result.design.solution,row.base.solution);
});
test('the local server preserves unfinished arrangements on disk and refuses a stale board version',async()=>{
  const S=require('./bank/narrow_placement_server'),dir=fs.mkdtempSync(path.resolve(require('./bank/narrow_lab').TMP,'placement-test-')),a=S.createServer({port:0,dataDir:dir});let address=await a.listen();
  const row=rows[0],s=M.initial(row);s.note='A lower place for these tiles';const url='http://127.0.0.1:'+address.port;
  try{let r=await fetch(url+'/api/save',{method:'POST',body:JSON.stringify(s)});assert.equal(r.status,200);r=await fetch(url+'/api/save',{method:'POST',body:JSON.stringify({...s,baseHash:'stale'})});assert.equal(r.status,400);}finally{await new Promise(resolve=>a.server.close(resolve));}
  const b=S.createServer({port:0,dataDir:dir});address=await b.listen();try{const restored=await fetch('http://127.0.0.1:'+address.port+'/api/state').then(r=>r.json());assert.deepEqual(restored.levels[row.level].positions,s.positions);assert.equal(restored.levels[row.level].note,s.note);assert.ok(fs.existsSync(path.join(dir,'catalogues',restored.levels[row.level].catalogueId+'.json')));}finally{await new Promise(resolve=>b.server.close(resolve));}
});
