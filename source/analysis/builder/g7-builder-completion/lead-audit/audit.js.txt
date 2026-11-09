'use strict';
// Fixed lead checks of G7's useful recipes and unsupported completion claims.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=require('../../../tools/builder/engine.js'),VC=require('../../../tools/builder/visible_choice.js'),K=require('../../../tools/builder/knobs.js');
const SG=require('../../../tools/builder/loop/static_gates.js'),GP=require('../../../tools/builder/loop/gate_profile.js'),T=require('../../../tools/builder/loop/traces.js');
const Y=require('../../../tools/builder/loop/yardstick.js'),P=require('../../../tools/builder/loop/run_pipeline.js'),L=require('../../../tools/builder/loop/library.js');
const {loadOriginal}=require('./load_original.js');
const at=process.argv.indexOf('--out');if(at===process.argv.length-1)throw Error('--out needs a directory');
const out=at<0?path.join(__dirname,'lead-audit'):path.resolve(process.argv[at+1]);
const owner=JSON.parse(fs.readFileSync('source/build/heavy.lock/owner.json'));if(owner.pid!==process.ppid)throw Error('Use heavy.js');if(fs.existsSync(out))throw Error('Preserve earlier audit');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'source-manifest.json')));
for(const f of manifest.files)if(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f.archive))).digest('hex')!==f.sha256)throw Error('Changed source '+f.archive);
const profile=GP.loadProfile('e5-v1'),ys=Y.createYardstick(),limits={nodes:400000,totalNodes:700000,ms:Infinity,finishNodes:200000,finishMs:Infinity};
const schedule=[
 {id:'u-base',layout:22,seed:1}, {id:'arch-base',layout:0,seed:1}, {id:'castle-base',layout:20,seed:2}, {id:'hourglass-base',layout:14,seed:2},
 ...[1,2,3].map(spare=>({id:'u-keys-s'+spare,layout:22,seed:1,keys:[0,40],spare})),
 ...[61,72].map(tile=>({id:'u-ice'+tile,layout:22,seed:1,keys:[0,40],ice:{tile,h:1},spare:1,traces:true})),
 {id:'arch-keys7-59',layout:0,seed:1,keys:[7,59],lockTile:0,spare:2,traces:true},
 ...[1,2].map(spare=>({id:'castle-keys-s'+spare,layout:20,seed:2,keys:[47,62],lockTile:77,spare}))
];
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({source:manifest.commit,code:P.codeFingerprints(),pins:ys.pins,profile,limits,schedule,note:'Fixed recipe audit; matched clock settings, 80-campaign traces for three declared cases. No ACCEPT or target fitting.'},null,2)+'\n');
const bases=new Map(),rows=[];
for(const c of schedule){
 const start=process.cpuUsage(),B=require('../../../tools/builder/builder.js'),brief={layout:c.layout,shape:B.LAYOUTS[c.layout].shape,story:'deepClock',stage:c.layout===20?'top':'edge',frame:{spare:2},targets:{trayRoom:2,hiddenOnWay:0,maxDown:0,tailPairWidth:2},seed:c.seed};
 const baseKey=c.layout+'/'+c.seed;if(!bases.has(baseKey))bases.set(baseKey,VC.build(brief));
 const base=bases.get(baseKey),spare=c.spare??2;
 const built=!base.design?base:c.ice?K.clockKeyIce(base.design,c.keys,c.ice,spare):c.keys?K.clockKeys(base.design,c.keys,spare,c.lockTile==null?{}:{lockTile:c.lockTile}):base;
 const r={id:c.id,brief,recipe:c,fail:built.fail??null};
 if(built.design){const d=built.design;r.design=d;r.key=L.contentKey(d);r.game=E.clockShortest(E.game(d),limits);r.strict=E.clockShortest(E.game(d,{strict:true}),limits);r.witness=E.replay(d,d.solution,{strict:true}).ok;
  r.static=GP.applyStatic(SG.staticGates(d,{shape:brief.shape,stopEarly:false}),profile);r.unresolved=GP.unresolvedStatic(r.static,profile,{spare});r.skilled=ys.planner(d);r.family=ys.rate(d,{block:'CURVE',allResults:true});
  if(c.traces)r.traces=T.traceGates(d,GP.traceOptions({ys,spare:null,campaigns:80},profile));
 }
 const used=process.cpuUsage(start);r.cpuS=(used.user+used.system)/1e6;rows.push(r);fs.appendFileSync(path.join(out,'rows.jsonl'),JSON.stringify(r)+'\n');
 console.log(JSON.stringify({id:r.id,fail:r.fail,k:r.game?.k,S:r.skilled?.S,D:r.family?.D,static:r.static?.pass,trace:r.traces?.pass,B7:r.traces?.B7?.value}));
}
const BC=loadOriginal('builder_completion.js'),targets=[];
for(const target of [10,13]){
 const b=BC.build({layout:22,shape:'ushape',seed:1,spare:2,target}),r={target,fail:b.fail??null,design:b.design,card:b.card,proof:b.proof};
 if(b.design){r.key=L.contentKey(b.design);r.family=ys.rate(b.design,{block:'CURVE',allResults:true});r.skilled=ys.planner(b.design);}targets.push(r);
 console.log(JSON.stringify({originalTarget:target,fail:r.fail,key:r.key,D:r.family?.D,S:r.skilled?.S}));
}
const summary={built:rows.filter(r=>r.design).length,normalSkilled:rows.filter(r=>r.skilled?.valid&&r.skilled.S>=2.5&&r.skilled.S<=6).map(r=>r.id),
 matchingTarget10:rows.filter(r=>r.family?.valid&&Math.abs(r.family.D-10)<=1).map(r=>r.id),
 sameBoardForTargets10And13:targets.every(r=>r.design)&&targets[0].key===targets[1].key&&targets[0].design.clock.n===targets[1].design.clock.n,
 note:'Exploratory catalogue recipes are not held-out plan validation. Required static/trace failures and off-band results remain failures. No final qualified levels or ACCEPT calls.'};
fs.writeFileSync(path.join(out,'original-targets.json'),JSON.stringify(targets,null,2)+'\n');fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
