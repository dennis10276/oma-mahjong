'use strict';
// Lead reproduction of incoming G6 evidence. No ACCEPT calls or builder edits.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {loadOriginal}=require('./load_original.js'),PB=loadOriginal();
const E=require('../../../tools/builder/engine.js'),L=require('../../../tools/builder/loop/library.js');
const SG=require('../../../tools/builder/loop/static_gates.js'),GP=require('../../../tools/builder/loop/gate_profile.js');
const Y=require('../../../tools/builder/loop/yardstick.js'),P=require('../../../tools/builder/loop/run_pipeline.js');
const root=__dirname,outArg=process.argv.indexOf('--out');
if(outArg===process.argv.length-1)throw Error('--out needs a directory');
const out=outArg<0?path.join(root,'lead-audit'):path.resolve(process.argv[outArg+1]);
const owner=JSON.parse(fs.readFileSync('source/build/heavy.lock/owner.json'));
if(owner.pid!==process.ppid)throw Error('Use heavy.js');
if(fs.existsSync(out))throw Error('Preserve prior lead audit');fs.mkdirSync(out);
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:L.canonical(x)).digest('hex');
const incoming=JSON.parse(fs.readFileSync(path.join(root,'source-manifest.json')));
for(const f of incoming.files)if(digest(fs.readFileSync(path.join(root,f.archive)))!==f.sha256)throw Error('Changed source blob '+f.archive);
const profile=GP.loadProfile('e5-v1'),ys=Y.createYardstick(),original=JSON.parse(fs.readFileSync(path.join(root,'discovery_results.json')));
const normalization=d=>{const labels=new Map();return {...d,faces:d.faces.map(f=>{if(!labels.has(f))labels.set(f,labels.size);return labels.get(f);})};};
const resultCache=new Map(),rows=[];
for(const old of original.rows){
 const brief={family:old.family,layout:old.layout,targets:old.targets,frame:{spare:old.spare},seed:old.seed};
 const b=PB.build(brief);if(!b.design)throw Error('Build failed '+old.index+':'+b.fail);
 const d=b.design,key=L.contentKey(d),structure=L.contentKey(normalization(d));
 let measured=resultCache.get(key);
 if(!measured){
  const start=process.cpuUsage(),rawStatic=SG.staticGates(d,{shape:b.card.shape,stopEarly:false}),statics=GP.applyStatic(rawStatic,profile);
  const game=E.clockShortest(E.game(d),{nodes:200000,totalNodes:700000,ms:Infinity}),strict=E.clockShortest(E.game(d,{strict:true}),{nodes:200000,totalNodes:700000,ms:Infinity});
  const skilled=ys.planner(d),family=ys.rate(d,{block:'CURVE',allResults:true}),used=process.cpuUsage(start);
  measured={key,gameK:game&&!game.unsure?game.k:null,strictK:strict&&!strict.unsure?strict.k:null,witness:E.replay(d,d.solution,{strict:true}).ok,
   skilled,family,static:statics,cpuS:(used.user+used.system)/1e6};resultCache.set(key,measured);
  fs.appendFileSync(path.join(out,'measurements.jsonl'),JSON.stringify(measured)+'\n');
 }
 const counts=d.faces.reduce((m,f)=>(m[f]=(m[f]||0)+1,m),{});
 const row={index:old.index,brief,key,structure,design:d,card:b.card,legalPictureCounts:Object.values(counts).every(n=>n===2||n===4),
  witness:measured.witness,gameK:measured.gameK,strictK:measured.strictK,clockN:d.clock.n,spare:d.clock.n-measured.gameK,
  S:measured.skilled.S,D:measured.family.D,valid:measured.skilled.valid&&measured.family.valid,
  oldS:old.S,oldD:old.D,staticPass:measured.static.pass,loseForks:measured.static.gates.A6.detail.loseForks,
  changed:Math.abs(measured.skilled.S-old.S)>1e-9||Math.abs(measured.family.D-old.D)>1e-9};
 rows.push(row);fs.appendFileSync(path.join(out,'rebuilt-designs.jsonl'),JSON.stringify(row)+'\n');
}
const groupBy=(list,key)=>{const groups=new Map();for(const r of list){const k=key(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}return [...groups].map(([key,rs])=>({key,indices:rs.map(r=>r.index)}));};
const inertDelay=groupBy(rows.filter(r=>r.brief.family==='promptChokeDistance'),r=>r.brief.layout+'/'+r.brief.seed).map(g=>({...g,uniqueContent:new Set(g.indices.map(i=>rows[i-1].key)).size}));
const diagnosticRows=JSON.parse(fs.readFileSync(path.join(root,'diagnostics.json'))).results;
const readRows=file=>fs.readFileSync(path.resolve(file),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const controlSources=[
 ...[['note-b1-none',1,'none'],['note-b2-none',2,'none'],['note-b2-open',2,'open'],['note-b2-covered',2,'covered'],['note-b2-covered2',2,'covered2']].map(([id,bridges,relief])=>({id,design:require('../../../tools/builder/reserve_note.js').build({targets:{bridges,relief}}).design})),
 {id:'u-45-w2',design:readRows('source/analysis/builder/tail-plans-v1/rows.jsonl').find(r=>r.index===45&&r.width===2).design},
 {id:'u-k5-9-lock42',design:readRows('source/analysis/builder/dependency-choices-v1/prelude-order/rows.jsonl').find(r=>r.id==='k5-9-lock42').design},
 {id:'u-repair-0',design:readRows('source/analysis/builder/dependency-choices-v1/prelude-repaired/rows.jsonl')[0].design}
];
const controls=[];
for(const c of controlSources){
 const old=diagnosticRows.find(r=>r.id===c.id),d=c.design,k=E.clockShortest(E.game(d),{nodes:400000,totalNodes:700000,ms:Infinity});
 const sourceSkilled=ys.planner(d),sourceFamily=ys.rate(d,{block:'CURVE',allResults:true}),framed=require('../../../tools/builder/knobs.js').clockSpare(d,2);
 if(framed.fail)throw Error(framed.fail);
 const matchedSkilled=ys.planner(framed.design),matchedFamily=ys.rate(framed.design,{block:'CURVE',allResults:true});
 controls.push({id:c.id,key:L.contentKey(d),clockN:d.clock.n,k:k&&!k.unsure?k.k:null,sourceSpare:d.clock.n-k.k,
  originalD:old.D,originalS:old.S,sourceSkilled,sourceFamily,matchedClockN:framed.design.clock.n,matchedSkilled,matchedFamily,
  originalA6:old.a6,sourceDesign:d});
}
fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(controls,null,2)+'\n');
const unsupported=PB.build({family:'stagedTrayCommitment',layout:33,targets:{commitment:1,notAControl:99}},{wallMs:0});
const summary={sourceCommit:incoming.commit,code:P.codeFingerprints(),pins:ys.pins,profile,
 scheduled:rows.length,built:rows.length,exactDesigns:resultCache.size,matchingStructures:new Set(rows.map(r=>r.structure)).size,
 groups:groupBy(rows,r=>r.structure),inertDelay,changedRatings:rows.filter(r=>r.changed).length,invalid:rows.filter(r=>!r.valid||!r.witness||!r.legalPictureCounts||r.gameK==null||r.strictK!==r.gameK).map(r=>r.index),
 D:{min:Math.min(...rows.map(r=>r.D)),max:Math.max(...rows.map(r=>r.D))},S:{min:Math.min(...rows.map(r=>r.S)),max:Math.max(...rows.map(r=>r.S))},
 a6NonzeroRows:rows.filter(r=>r.loseForks>0).map(r=>({index:r.index,loseForks:r.loseForks})),
 acceptedUnsupportedTarget:!!unsupported.design,ignoredZeroWallBudget:!!unsupported.design,
 note:'Original raw artifacts preserved. No integrated constructor, thresholds, pins or ACCEPT changes. Times include cache hits. A6 scans tempting choices before the clock, not all possible choices on a board.'};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({scheduled:summary.scheduled,exactDesigns:summary.exactDesigns,matchingStructures:summary.matchingStructures,inertDelay,changedRatings:summary.changedRatings,invalid:summary.invalid,D:summary.D,S:summary.S,a6NonzeroRows:summary.a6NonzeroRows.length}));
