'use strict';
// Frozen, engine-only quality audit of the final construction controls.
const fs=require('fs'),path=require('path');
const B=require(path.resolve('source/tools/builder/builder.js'));
const SG=require(path.resolve('source/tools/builder/loop/static_gates.js'));
const GP=require(path.resolve('source/tools/builder/loop/gate_profile.js'));
const P=require(path.resolve('source/tools/builder/loop/run_pipeline.js'));
const owner=JSON.parse(fs.readFileSync('source/build/heavy.lock/owner.json'));
if(owner.pid!==process.ppid)throw Error('Use heavy.js');
const out=path.join(__dirname,'final-controls.json');if(fs.existsSync(out))throw Error('Preserve prior results');
const profile=GP.loadProfile('e5-v1'),rows=[];
for(const [bridges,relief] of [[1,'none'],[2,'none'],[2,'covered2']]){
 const brief={mode:'reserveNote',shape:'musicNote',story:'reserveMatchingCopies',frame:{spare:2},targets:{bridges,relief},seed:1};
 const b=B.build(brief);if(!b.design)throw Error(b.fail);
 const cpu=process.cpuUsage(),result=GP.applyStatic(SG.staticGates(b.design,{shape:b.card.shape,story:brief.story,stopEarly:false}),profile),used=process.cpuUsage(cpu);
 const summary={bridges,relief,pass:result.pass,unresolved:GP.unresolvedStatic(result,profile,{spare:2}),failed:profile.static.required.filter(g=>result.gates[g].pass===false),cpuS:(used.user+used.system)/1e6};
 rows.push({brief,design:b.design,card:b.card,summary,result});console.log(JSON.stringify(summary));
 fs.writeFileSync(out,JSON.stringify({profile,code:P.codeFingerprints(),rows,note:'Final source, calibrated static checks only; no bot ratings or ACCEPT blocks.'},null,2)+'\n');
}
