'use strict';
// Run from the repository root under heavy.js. This checks frozen observations;
// it neither re-rates boards nor consumes acceptance seeds.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=require(path.resolve('source/tools/builder/engine.js'));
const root=__dirname,output=path.join(root,'evidence-audit.json');
const owner=JSON.parse(fs.readFileSync('source/build/heavy.lock/owner.json'));
if(owner.pid!==process.ppid)throw Error('Use heavy.js');
if(fs.existsSync(output))throw Error('Preserve prior evidence audit');
const stages=[];
for(const name of fs.readdirSync(root)){
 const dir=path.join(root,name),file=path.join(dir,'rows.jsonl');
 if(!fs.existsSync(file))continue;
 const rows=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
 if(rows.length!==manifest.schedule.length)throw Error('Incomplete schedule '+name);
 const designs=rows.filter(r=>r.design),scores=rows.flatMap(r=>r.skilled?.valid?[r.skilled.S]:[]);
 for(const r of designs){
  if(!E.replay(r.design,r.design.solution,{strict:true}).ok)throw Error('Invalid witness '+name+'/'+r.id);
  if(r.proof?.atPair){
   const g=E.game(r.design),p=r.proof;let s=E.start(g);
   for(const i of p.prefix.concat([p.setup,p.anchor]))s=E.step(g,s,i);
   for(const [move,expected] of [[p.correctMate,'win'],[p.wrongMate,'lose']]){
    const next=E.step(g,s,move),actual=next?E.winnable(g,next,{nodes:200000,ms:Infinity}).result:'lose';
    if(actual!==expected)throw Error('Changed matching choice '+name+'/'+r.id);
   }
  }
 }
 const snapshots=[];
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js.txt')&&f!=='runner.js.txt')){
  const key=f.slice(0,-4),actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex').slice(0,16),expected=manifest.code[key];
  if(expected&&actual!==expected)throw Error('Snapshot mismatch '+name+'/'+f);
  snapshots.push({file:f,hash:actual,recordedHash:expected??null,verified:!!expected});
 }
 stages.push({stage:name,scheduled:rows.length,built:designs.length,failed:rows.length-designs.length,
  skilled:scores.length?{n:scores.length,min:Math.min(...scores),max:Math.max(...scores)}:null,
  cpuS:rows.every(r=>Number.isFinite(r.cpuS))?rows.reduce((sum,r)=>sum+r.cpuS,0):null,
  strictWitnesses:designs.length,snapshots,
  limitation:name==='reserve-note-fit'?'Second spare picture was hidden: high skilled score is not fair-challenge evidence.':null});
}
fs.writeFileSync(output,JSON.stringify({stages,note:'Snapshot hashes checked where recorded; missing historical keys remain null. Timings include cache hits and are not clean CPU benchmarks. No qualified or accepted new levels.'},null,2)+'\n');
console.log(JSON.stringify(stages.map(({snapshots,...s})=>s)));
