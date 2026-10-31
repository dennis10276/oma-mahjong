// Batch 175-194 in Dennis's order (2026-10-31): breathers 175-181, middle 182-187, hard 188-194, getting
// harder and harder; within a tier the puzzles alternate. Checks: no base shape twice within 10 levels,
// tile spots shared <= 75% with any played level (70-164), the live 165-174 and any level within 10.
const fs=require('fs'),vm=require('vm');const ROOT='/home/claude/repo-oma/source';
const L=require(ROOT+'/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(ROOT+'/www/levels-hard.js','utf8')+';HARD_LEVELS');
const Hard=require(ROOT+'/www/hard.js');const F=require(ROOT+'/tools/factory/piles_for.js');
const rd=f=>fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const B=Object.fromEntries(rd(ROOT+'/analysis/factory/batch-175-g2.jsonl').map(r=>['b'+r.level,r]));
const [m1,m2]=process.argv.slice(2,4).map(f=>rd(f)[0]);B.m1=m1;B.m2=m2;
// built-as level -> new level (old 179 and 189 left out: two more locked-clock breathers; 176/194 keep the cross and hourglass)
const ORDER=['b192','b184','b187','b186','b176','b181','b194',  'b182','b177','m1','b183','m2','b191',  'b185','b178','b190','b180','b188','b175','b193'];
const tier=k=>k<7?'breather':k<13?'middle':'hard';
const rows=ORDER.map((id,k)=>{const r=B[id];const lv=175+k;return {...r,builtAs:r.level,level:lv,tier:tier(k),design:{...r.design,level:lv}};});
const base=s=>s.split(' · ')[0];let bad=0;
const played=[];for(let lv=70;lv<=164;lv++)played.push(F.spots(Hard.get(lv).tiles)[0]);
const live={};for(let lv=165;lv<=174;lv++)live[lv]=Hard.get(lv).tiles;
rows.forEach((r,k)=>{const t=r.design.tiles.map(x=>Array.isArray(x)?x:[x.x,x.y,x.z]);
  for(const o of rows.slice(Math.max(0,k-10),k)){if(base(o.shape)===base(r.shape)){console.log('shape twice',o.level,r.level,r.shape);bad++;}
    const s=F.share(t,F.spots(o.design.tiles.map(x=>Array.isArray(x)?x:[x.x,x.y,x.z]))[0]);if(s>0.75){console.log('share',o.level,r.level,s.toFixed(2));bad++;}}
  for(const [lv,lt] of Object.entries(live))if(r.level-lv<=10){const s=F.share(t,F.spots(lt)[0]);if(s>0.75){console.log('share live',lv,r.level,s.toFixed(2));bad++;}}
  const w=Math.max(...played.map(q=>F.share(t,q)));if(w>0.75){console.log('share played',r.level,w.toFixed(2));bad++;}});
for(const r of rows)console.log(r.level,r.tier.padEnd(8),String(r.g2.exp).padEnd(5),r.recipe.join('+').padEnd(26),r.shape,'(built as '+r.builtAs+')');
console.log(bad?bad+' problems':'all checks pass');
if(process.argv[4]&&!bad)fs.writeFileSync(process.argv[4],rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
