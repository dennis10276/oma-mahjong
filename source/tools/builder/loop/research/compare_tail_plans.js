#!/usr/bin/env node
'use strict';
// Paired construction experiment, not selection/acceptance. Every scheduled board
// is rated, including easy boards. Never consumes ACCEPT seeds or changes levels.
const fs=require('fs'), path=require('path');
const B=require('../../builder.js'), GP=require('../gate_profile.js'), SG=require('../static_gates.js');
const T=require('../traces.js'), CF=require('../counterfactual.js'), Pipeline=require('../run_pipeline.js');
const ROOT=path.resolve(__dirname,'../../../../..');
const args={}; for(let i=2;i<process.argv.length;i+=2) args[process.argv[i].slice(2)]=process.argv[i+1];
function main() {
  if(!args.out) throw Error('Use heavy.js --label tail-plans -- node compare_tail_plans.js --out directory');
  const owner=JSON.parse(fs.readFileSync(path.join(ROOT,'source/build/heavy.lock/owner.json'),'utf8'));
  if(owner.pid!==process.ppid) throw Error('Run through heavy.js');
  const out=path.resolve(args.out), file=path.join(out,'rows.jsonl'), mf=path.join(out,'manifest.json');
  const all=args['recipe-file']?JSON.parse(fs.readFileSync(path.resolve(args['recipe-file']),'utf8')):require('../../briefs-v1.json');
  const ids=(args.briefs||(args['recipe-file']?all.map((_,i)=>i).join(','):'0,5,10,15,20,35,40,45')).split(',').map(Number);
  const widths=(args.widths||'1,2,3').split(',').map(Number), spares=(args.spares||'1,2,3').split(',').map(Number);
  if(ids.some(i=>!all[i])||widths.some(w=>![1,2,3].includes(w))||spares.some(s=>![1,2,3].includes(s))) throw Error('Invalid schedule');
  const profile=GP.loadProfile('e5-v1'), ys=CF.rulerYardstick();
  const schedule=ids.flatMap(index=>widths.map(width=>({id:`${index}-w${width}`, index, width,
    brief:{...all[index],seed:Number(args.seed??all[index].seed??1),mode:'visibleChoice',targets:{...all[index].targets,hiddenOnWay:0,maxDown:0,tailPairWidth:width}}})));
  const manifest={schema:'tail-plans-v2',schedule,spares,campaigns:80,profile,code:Pipeline.codeFingerprints(),
    runner:GP.digest(fs.readFileSync(__filename,'utf8')),pins:ys.pins,
    note:'Fixed paired construction schedule. No hidden tiles in any arm. CURVE 4711/18427 only; no ACCEPT. Width 1 is G5 adjacent pairing. Results are diagnostics, not finished levels.'};
  fs.mkdirSync(out,{recursive:true});
  if(fs.existsSync(mf)) {if(GP.digest(JSON.parse(fs.readFileSync(mf,'utf8')))!==GP.digest(manifest)) throw Error('Resume identity changed; preserve old output and use a new directory');}
  else fs.writeFileSync(mf,JSON.stringify(manifest,null,2)+'\n');
  const rows=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)):[];
  const done=new Set(rows.map(r=>r.id)), start=Date.now();
  for(const cand of schedule) {
    if(done.has(cand.id)) continue;
    if(Date.now()-start>Number(args.minutes||18)*60000) break;
    const cpu0=process.cpuUsage(), t0=Date.now(), b=B.build(cand.brief);
    const row={...cand,fail:b.fail??null,buildFails:b.fails,card:b.card,design:b.design,ratings:[]};
    if(b.design) {
      row.static=GP.applyStatic(SG.staticGates(b.design,{story:cand.brief.story}),profile);
      for(const spare of spares) {
        const at=T.atSpare(b.design,spare);
        if(at.fail) {row.ratings.push({spare,fail:at.fail});continue;}
        const family=ys.rate(at.design,{block:'CURVE',allResults:true}), skilled=ys.planner(at.design);
        row.ratings.push({spare,clockN:at.design.clock.n,D:family.D,se:family.se,n:family.n,S:skilled.S,
          valid:family.valid&&skilled.valid,staticEligible:row.static.shipSpares.includes(spare),
          familyNormalBand:family.valid&&family.D>=9&&family.D<=14,skilledNormalBand:skilled.valid&&skilled.S>=2.5&&skilled.S<=6,
          family,skilled});
      }
    }
    const cpu=process.cpuUsage(cpu0);row.cpuS=(cpu.user+cpu.system)/1e6;row.wallS=(Date.now()-t0)/1000;
    fs.appendFileSync(file,JSON.stringify(row)+'\n');rows.push(row);
    console.log(JSON.stringify({id:row.id,fail:row.fail,attempt:row.card?.attempt,tail:row.card?.tailPlan,ratings:row.ratings.map(r=>({spare:r.spare,D:r.D,S:r.S})),cpuS:row.cpuS}));
  }
  const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const arms=widths.map(width=>{const rr=rows.filter(r=>r.width===width),rated=rr.flatMap(r=>r.ratings).filter(r=>r.valid);return {width,attempted:rr.length,built:rr.filter(r=>r.design).length,staticPass:rr.filter(r=>r.static?.pass).length,
    settings:rated.length,meanD:mean(rated.map(r=>r.D)),meanS:mean(rated.map(r=>r.S)),
    normalBandSettings:rated.filter(r=>r.staticEligible&&r.familyNormalBand&&r.skilledNormalBand).length,cpuS:rr.reduce((s,r)=>s+r.cpuS,0)};});
  const paired=widths.filter(w=>w!==1).map(width=>{const deltas=[];for(const base of rows.filter(r=>r.width===1)) {const alt=rows.find(r=>r.index===base.index&&r.width===width);if(!alt)continue;const sameRoles=GP.digest(base.design?.obst)===GP.digest(alt.design?.obst)&&base.design?.clock.i===alt.design?.clock.i;for(const b of base.ratings) {const a=alt.ratings.find(a=>a.spare===b.spare);if(b.valid&&a?.valid)deltas.push({index:base.index,spare:b.spare,D:a.D-b.D,S:a.S-b.S,sameRoles,sameAttempt:base.card.attempt===alt.card.attempt});}}return {width,n:deltas.length,meanDeltaD:mean(deltas.map(r=>r.D)),meanDeltaS:mean(deltas.map(r=>r.S)),deltas};});
  const summary={complete:rows.length===schedule.length,planned:schedule.length,arms,paired,note:manifest.note};
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary.arms));
}
if(require.main===module)main();
