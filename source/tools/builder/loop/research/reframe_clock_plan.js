#!/usr/bin/env node
'use strict';
// Freeze the matching puzzle; vary clock placement, then measure each setting.
const fs=require('fs'),path=require('path');
const B=require('../../builder.js'),K=require('../../knobs.js'),GP=require('../gate_profile.js'),SG=require('../static_gates.js');
const CF=require('../counterfactual.js'),T=require('../traces.js'),P=require('../run_pipeline.js');
function main() {
  const a={};for(let i=2;i<process.argv.length;i+=2)a[process.argv[i].slice(2)]=process.argv[i+1];
  if(!a.input||!a.id||!a.out)throw Error('Use heavy.js -- node reframe_clock_plan.js --input rows.jsonl --id 45-w2 --out directory');
  const root=path.resolve(__dirname,'../../../../..'),owner=JSON.parse(fs.readFileSync(path.join(root,'source/build/heavy.lock/owner.json'),'utf8'));
  if(owner.pid!==process.ppid)throw Error('Run through heavy.js');
  const source=fs.readFileSync(a.input,'utf8').trim().split(/\r?\n/).map(JSON.parse).find(r=>r.id===a.id);
  if(!source?.design)throw Error('Frozen source not found');
  const d=source.design,c=B.context(d.tiles),excluded=new Set([d.clock.i,...d.down]),choices=[{tile:d.clock.i,role:'unchanged control'}];
  for(const depth of [8,11,14]) {
    const ranked=Array.from({length:c.n},(_,i)=>i).filter(i=>!excluded.has(i)).sort((a,b)=>Math.abs(c.above[a].size+1-depth)-Math.abs(c.above[b].size+1-depth)||a-b);
    for(const tile of ranked.slice(0,2)){choices.push({tile,role:`geometry depth ${depth}`,covers:c.above[tile].size});excluded.add(tile);}
  }
  const profile=GP.loadProfile('e5-v1'),ys=CF.rulerYardstick(),out=path.resolve(a.out),file=path.join(out,'rows.jsonl'),mf=path.join(out,'manifest.json');
  const manifest={schema:'reframe-clock-v1',source,sourceDigest:GP.digest(source),choices,spares:[1,2,3],profile,code:P.codeFingerprints(),
    runner:GP.digest(fs.readFileSync(__filename,'utf8')),pins:ys.pins,note:'Clock tile and witness only. Fixed geometry-based schedule before ratings; full CURVE measurements. No ACCEPT, assignment or quality acceptance.'};
  fs.mkdirSync(out,{recursive:true});
  if(fs.existsSync(mf)){if(GP.digest(JSON.parse(fs.readFileSync(mf,'utf8')))!==GP.digest(manifest))throw Error('Changed resume identity');}
  else fs.writeFileSync(mf,JSON.stringify(manifest,null,2)+'\n');
  const rows=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse):[];
  for(const choice of choices) {
    if(rows.some(r=>r.tile===choice.tile))continue;
    const cpu0=process.cpuUsage(),t0=Date.now(),r={...choice,ratings:[]},v=K.clockTile(d,choice.tile,1);
    r.fail=v.fail??null;r.proof=v.proof;r.design=v.design;
    if(v.design) {
      for(const field of v.proof.preserved)if(GP.digest(d[field])!==GP.digest(v.design[field]))throw Error('Matching puzzle mutated');
      r.static=GP.applyStatic(SG.staticGates(v.design,{story:source.brief.story}),profile);
      for(const spare of manifest.spares) {
        const at=T.atSpare(v.design,spare);if(at.fail){r.ratings.push({spare,fail:at.fail});continue;}
        const family=ys.rate(at.design,{block:'CURVE',allResults:true}),skilled=ys.planner(at.design);
        r.ratings.push({spare,D:family.D,S:skilled.S,valid:family.valid&&skilled.valid,staticEligible:r.static.shipSpares.includes(spare),family,skilled});
      }
    }
    const cpu=process.cpuUsage(cpu0);r.cpuS=(cpu.user+cpu.system)/1e6;r.wallS=(Date.now()-t0)/1000;
    fs.appendFileSync(file,JSON.stringify(r)+'\n');rows.push(r);
    console.log(JSON.stringify({tile:r.tile,fail:r.fail,k:r.proof?.minimum,static:r.static?.pass,ratings:r.ratings.map(x=>({spare:x.spare,D:x.D,S:x.S})),cpuS:r.cpuS}));
  }
  const settings=rows.flatMap(r=>r.ratings.map(s=>({tile:r.tile,...s}))),hits=settings.filter(s=>s.valid&&s.staticEligible&&s.D>=9&&s.D<=14&&s.S>=2.5&&s.S<=6);
  const summary={complete:rows.length===choices.length,attempted:rows.length,built:rows.filter(r=>r.design).length,normalBandSettings:hits.map(s=>({tile:s.tile,spare:s.spare,D:s.D,S:s.S})),
    cpuS:rows.reduce((s,r)=>s+r.cpuS,0),note:manifest.note};
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}
if(require.main===module)main();
