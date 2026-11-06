'use strict';
const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{pool}=require('./empirical_workers.js');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oma-workers-'));t.after(()=>{const relative=path.relative(os.tmpdir(),path.resolve(dir));assert(!relative.startsWith('..')&&!path.isAbsolute(relative));fs.rmSync(dir,{recursive:true,force:true});});return dir;}
test('independent boards fill idle worker capacity behind a slow board',async t=>{
 const dir=fixture(t),file=path.join(dir,'worker.cjs');fs.writeFileSync(file,"const{parentPort}=require('worker_threads');parentPort.on('message',j=>setTimeout(()=>parentPort.postMessage({id:j.id}),j.delay));");const done=[];
 await pool([{id:0,delay:500},{id:1,delay:0},{id:2,delay:0},{id:3,delay:0}],file,r=>done.push(r.id),2);
 assert.deepEqual(done.slice().sort(),[0,1,2,3]);assert(done.indexOf(3)<done.indexOf(0),'Fast work must finish while the slow board is still running');
});
test('a failed board rejects the pool and terminates its other workers',async t=>{
 const dir=fixture(t),file=path.join(dir,'worker.cjs');fs.writeFileSync(file,"const{parentPort}=require('worker_threads');parentPort.on('message',j=>{if(j.fail)throw Error('failed fixture');setTimeout(()=>parentPort.postMessage({id:j.id}),10000);});");
 await assert.rejects(pool([{fail:true},{id:2}],file,()=>{},2),/failed fixture/);
});
test('a prepared parent is resumable and a changed search configuration cannot overwrite it',async t=>{
 const dir=fixture(t),M=require('./meter.js'),E=require('./empirical_steer.js'),d={tiles:[[0,0,0],[4,0,0],[8,0,0],[12,0,0]],faces:[0,0,1,1],down:[],obst:{ice:{},locks:[],keys:[]},clock:{i:1,n:3},solution:[0,1,2,3]},id=M.boardKey(d).slice(0,16),job={row:{id,design:d,shape:'cross',recipe:['clockRoute'],origin:{creationId:'protected'}},slot:{level:204,target:10.33},dir,protectedCreations:['protected'],protectedIds:[],seen:[]},round=path.join(dir,'round');
 const first=await E.run([job],round,2),progress=path.join(round,id+'.progress.json'),stamp=fs.statSync(progress).mtimeMs;assert.deepEqual(first[0].results,[]);assert(Number.isFinite(first[0].before.family));assert.equal(first[0].before.skilled,null);
 assert.deepEqual(await E.run([job],round,2),first);assert.equal(fs.statSync(progress).mtimeMs,stamp);await assert.rejects(E.run([{...job,slot:{...job.slot,target:12}}],round,2),/changed/);
});
