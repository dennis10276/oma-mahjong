#!/usr/bin/env node
'use strict';
// Read-only audit. Historical annotations are derived from saved bait evidence
// and explicitly labelled; placed boards are never rewritten.
const fs=require('fs'),path=require('path'),B=require('./builder.js');
const BANK=path.resolve(__dirname,'../../analysis/builder/bank');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function legacyCard(j){
  if(j.card?.trap)return {card:j.card,roles:j.roles};
  if(j.pressureCard?.trap)return {card:j.pressureCard};
  const s=j.source||'',mix=/^chained (.+)$/.exec(s);
  if(mix){const f=path.join(BANK,'chained-v1/examples',mix[1]+'.json');if(fs.existsSync(f))return read(f);}
  const m=/^(batch2|batch) (\d+)/.exec(s);
  if(m)for(const dir of m[1]==='batch2'?['batch-303-342']:['batch-250-289'])for(const sub of ['','rejected']){
    const f=path.join(BANK,dir,sub,`level-${m[2]}.json`);if(fs.existsSync(f))return read(f);
  }
  return {};
}
function annotation(j,file){
  const meta=legacyCard(j),card=j.card||meta.card||{},t=card.trap||{},d=j.design;
  let kinds=card.wrongIdea,derived=!kinds;const annotationErrors=[];
  if(kinds&&(!Array.isArray(kinds)||kinds.some(k=>typeof k!=='string'||!k)))annotationErrors.push('wrongIdea must be an array of names');
  if(kinds&&!annotationErrors.length&&JSON.stringify(kinds)!==JSON.stringify([...new Set(kinds)].sort()))annotationErrors.push('wrongIdea must be sorted and unique');
  if(annotationErrors.length)kinds=[];
  if(!kinds){
    kinds=[];const mode=t.mechanism?.mode;
    if(mode==='earlyClock')kinds.push('waitForTwin');if(mode==='roofKey')kinds.push('clockRoof');
    if(mode==='repeatKeys'||t.mechanism?.repeat)kinds.push('lookalikeChoice');if(mode==='freezeRight')kinds.push('innerIce');
    for(const bait of t.baits||[]){
      if(/keyEarly|keyNear|keyB/.test(bait.name||'')||(bait.tiles?.length===1&&d.obst.keys.includes(bait.tiles[0])))kinds.push('earlyKey');
      if(/wrong|lonely/i.test(bait.name||'')||meta.roles?.bait?.wrong?.some(i=>bait.tiles?.includes(i)))kinds.push('lonelyMelt');
    }
  }
  const layout=card.layout??B.LAYOUTS.findIndex(l=>JSON.stringify(l.tiles)===JSON.stringify(d.tiles));
  return {level:j.level??+path.basename(file).match(/level-(\d+)/)?.[1],file,layout,shape:t.signature||t.shape||card.shape||null,wrongIdea:[...new Set(kinds)].sort(),derived,annotationErrors};
}
function check(rows){
  rows=rows.slice().sort((a,b)=>a.level-b.level);const violations=[],missing=[];
  for(let i=0;i<rows.length;i++){
    const r=rows[i];if(!r.wrongIdea.length||!r.shape||r.layout<0)missing.push({level:r.level,wrongIdea:!r.wrongIdea.length,shape:!r.shape,layout:r.layout});
    for(const error of r.annotationErrors||[])violations.push({rule:'wrongIdeaMetadata',level:r.level,error});
    for(let k=0;k<i;k++){
      const p=rows[k],distance=r.level-p.level;if(distance<=0){violations.push({rule:'duplicateLevel',levels:[p.level,r.level]});continue;}
      if(distance<=12&&p.layout===r.layout&&r.layout>=0)violations.push({rule:'layout12',levels:[p.level,r.level],layout:r.layout,distance});
      for(const kind of r.wrongIdea.filter(x=>p.wrongIdea.includes(x))){
        if(distance<=6)violations.push({rule:'wrongIdea6',levels:[p.level,r.level],wrongIdea:kind,distance});
        if(distance<=20&&p.shape&&p.shape===r.shape)violations.push({rule:'wrongIdeaShape20',levels:[p.level,r.level],wrongIdea:kind,shape:r.shape,distance});
      }
    }
  }
  return {ok:!violations.length&&!missing.length,boards:rows.length,counts:Object.fromEntries(['wrongIdea6','wrongIdeaShape20','layout12','duplicateLevel'].map(rule=>[rule,violations.filter(v=>v.rule===rule).length])),missing,rows,violations};
}
function folders(dirs){return dirs.flatMap(dir=>fs.readdirSync(dir).filter(f=>/^level-\d+\.json$/.test(f)).map(f=>{const file=path.join(dir,f);return annotation(read(file),file);}));}
if(require.main===module){const args=process.argv.slice(2),i=args.indexOf('--out'),out=i<0?null:args.splice(i,2)[1],r=check(folders(args));if(out)fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));if(!r.ok)process.exitCode=1;}
module.exports={check,folders,annotation};
