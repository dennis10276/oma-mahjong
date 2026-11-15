'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const B=require('./bank/narrow_placement_build'),M=require('./bank/narrow_placement_model'),F=require('./footprint');
const publishedRows=JSON.parse(fs.readFileSync(path.join(B.OUT,'placement-data.json'))).levels,rows=publishedRows.map(({proposal,...row})=>row);
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
test('screen drops reach the half-offset bridges 56/48 and 48/49',()=>{
  const row=rows.find(r=>r.level===251),s=M.initial(row),id=57;
  for(const [a,b]of [[56,48],[48,49]]){const p=s.positions[a],q=s.positions[b],bridge=[(p[0]+q[0])/2,(p[1]+q[1])/2,p[2]+1];assert.equal(p[2],q[2]);assert.deepEqual(M.dropAt(s.positions,id,bridge[0]/2-bridge[2]*.14+.5,bridge[1]*.62-bridge[2]*.14+.62,'auto'),bridge);}
});
test('a selected tile can move half a tile between vertical neighbours without snapping back to itself',()=>{
  const positions=[[5,5,0],[5,7,0],[5,9,0],[5,5,1]];
  for(const y of [6,8])assert.deepEqual(M.dropAt(positions,3,5/2-.14+.5,y*.62-.14+.62,'auto'),[5,y,1]);
});
test('snapshots cannot change the board version, tile count or tile coordinate types',()=>{
  const row=rows[0],s=M.initial(row);assert.throws(()=>M.validate(row,{...s,baseHash:'wrong'}));assert.throws(()=>M.validate(row,{...s,positions:s.positions.slice(1)}));s.positions[0]=[.5,0,0];assert.throws(()=>M.validate(row,s));
});

test('released edits use the released pictures and retain both workspaces through validation',()=>{
  const row=rows.find(r=>r.level===252),draft=M.initial(row),s={...draft,designSource:'released',positions:M.copy(row.original.tiles),savedLayouts:{base:draft.positions,released:row.original.tiles},note:'Keep this outline'};
  const stored=M.validate(row,s);assert.deepEqual(stored.savedLayouts,s.savedLayouts);assert.equal(stored.designSource,'released');assert.equal(M.designFor(row,stored),row.original);assert.notEqual(M.key(s),M.key({...s,designSource:'base'}));assert.equal(M.key(draft),JSON.stringify([draft.baseHash,draft.positions]));
});

test('revised workspaces keep special tiles on the board and do not add filler towers',()=>{
  for(const row of publishedRows){assert.ok(row.proposal);const s=M.initial(row),special=new Set([row.original.clock.i,...row.original.obst.keys,...row.original.obst.locks,...Object.keys(row.original.obst.ice).map(Number)]);assert.deepEqual(s.positions,row.proposal.positions);for(const id of special)assert.ok(s.positions[id],`${row.level}: special ${id} parked`);for(let i=0;i<s.positions.length;i++){const p=s.positions[i];if(p&&!special.has(i))assert.ok(p[2]<=2||p[2]<=row.original.tiles[i][2],`${row.level}: new tower ${i}`);}}
});

test('252 side-access changes are reviewed by behaviour without weakening default export certification',()=>{
  const row=publishedRows.find(r=>r.level===252),C=require('./bank/narrow_placement_check'),P=require('./bank/narrow_proof'),s={...M.initial(row),positions:M.copy(row.proposal.positions)},result=C.check(row,s);assert.equal(result.ok,true,JSON.stringify(result));assert.ok(result.certificate.notices.length);assert.ok(result.certificate.checks.includes('sameProvenClockMinimumAndSpare'));assert.ok(result.certificate.checks.includes('sameFreshlyMeasuredAuthoredBaitPrices'));assert.ok(P.certify(P.original(252),{design:result.design},P.prepare(P.original(252))).errors.includes('trapSideRelations'));
});

test('a clock route that misses its deadline gives a specific failure instead of crashing the tail checker',()=>{
  const row=rows.find(r=>r.level===253),fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/builder/footprint60/narrow/placement-lab/improvements/deadline-regression-253.json'))),result=require('./bank/narrow_placement_check').check(row,{...M.initial(row),positions:fixture.positions});assert.equal(result.status,'failed');assert.deepEqual(result.errors,['clockDeadline']);assert.match(result.message,/14 moves.*12/);
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
