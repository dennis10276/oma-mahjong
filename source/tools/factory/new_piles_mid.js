// two new piles for middle levels, on shapes the batch does not use; overlap <= 75% with played levels
// 70-164, live 165-174 and every board of batch 175-194
const fs=require('fs'),vm=require('vm');const ROOT='/home/claude/repo-oma/source';
const L=require(ROOT+'/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(ROOT+'/www/levels-hard.js','utf8')+';HARD_LEVELS');
const Hard=require(ROOT+'/www/hard.js');const F=require(ROOT+'/tools/factory/piles_for.js');
const batch=fs.readFileSync(ROOT+'/analysis/factory/batch-175-g2.jsonl','utf8').trim().split('\n').map(JSON.parse);
const others=[];for(let lv=70;lv<=174;lv++)others.push(F.spots(Hard.get(lv).tiles)[0]);for(const r of batch)others.push(F.spots(r.design.tiles)[0]);
const out=[];const made=[];
for(const [slot,name,N] of [[176,'diamond',80],[194,'oval',84],[176,'crown',84],[194,'block',80],[176,'twins',84]]){
  if(out.filter(o=>o.level===slot).length) continue;
  const sh=F.SHAPES.find(s=>s.name===name);const worst=t=>Math.max(...others.map(q=>F.share(t,q)),...made.map(q=>F.share(t,q)));
  const t=F.candidate(sh,N,slot*101+7,t=>worst(t)<=0.75);
  if(!t){console.log(slot,name,'none');continue;}
  const w=worst(t);made.push(F.spots(t)[0]);out.push({level:slot,shape:name,base:sh.shape,tiles:t,n:t.length,px:+F.tilePx(t.map(([x,y,z])=>({x,y,z}))).toFixed(1),shared:+w.toFixed(2)});
  console.log(slot,name,t.length,"tiles shared",w.toFixed(2),"px",out[out.length-1].px);}
fs.writeFileSync(process.argv[2],JSON.stringify(out));
