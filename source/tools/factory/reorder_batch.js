// Batch 175-194 in Dennis's order (2026-10-31): breathers 175-181, middle 182-187, hard 188-194, getting
// harder and harder; within a tier the puzzles alternate. Checks: no base shape twice within 10 levels,
// tile spots shared <= 75% with any played level (70-164), the live 165-174 and any level within 10.
const fs=require('fs'),vm=require('vm');const ROOT='/home/claude/repo-oma/source';
const L=require(ROOT+'/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(ROOT+'/www/levels-hard.js','utf8')+';HARD_LEVELS');
const Hard=require(ROOT+'/www/hard.js');const F=require(ROOT+'/tools/factory/piles_for.js');
const rd=f=>fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const B=Object.fromEntries(rd(ROOT+'/analysis/factory/batch-175-g2.jsonl').map(r=>['b'+r.level,r]));
// extra boards as id=file.jsonl (first row), and --out=file to write the batch when every check passes
const args=process.argv.slice(2),outArg=(args.find(a=>a.startsWith('--out='))||'').slice(6);
for(const a of args.filter(a=>a.includes('=')&&!a.startsWith('--'))){const [id,f]=a.split('=');B[id]=rd(f)[0];}
// built-as level -> new level (Dennis 2026-10-31 on the 1.63 picks: 185 "replace" (late squeeze) -> a new
// butterfly middle level (but2); 194 "+2 spare" -> u194, now an easy one; "I liked the old one" -> old194,
// the blind-test 194, as a hard level). The critic's late-squeeze levels 178 (moon) and the first big 180
// are out of the release (big2 is the new big breather). 8 easier, 5 middle, 7 hard; big boards on 180/190.
const ORDER=['m1','b192','b184','b187','b176','big2','u194','b181',  'b177','b182','but2','b191','b185',  'b178','old194','b180','m2','b190','b175','b188'];
const tier=k=>k<8?'breather':k<13?'middle':'hard';
const rows=ORDER.map((id,k)=>{const r=B[id];const lv=175+k;return {...r,builtAs:r.level,level:lv,tier:tier(k),design:{...r.design,level:lv}};});
const base=s=>s.split(' · ')[0];let bad=0;
const played=[];for(let lv=70;lv<=164;lv++)played.push(F.spots(Hard.get(lv).tiles)[0]);
const live={};for(let lv=165;lv<=174;lv++)live[lv]=Hard.get(lv).tiles;
rows.forEach((r,k)=>{const t=r.design.tiles.map(x=>Array.isArray(x)?x:[x.x,x.y,x.z]);
  for(const o of rows.slice(Math.max(0,k-10),k)){if(base(o.shape)===base(r.shape)){console.log('shape twice',o.level,r.level,r.shape);bad++;}
    const s=F.share(t,F.spots(o.design.tiles.map(x=>Array.isArray(x)?x:[x.x,x.y,x.z]))[0]);if(s>0.75){console.log('share',o.level,r.level,s.toFixed(2));bad++;}}
  for(const [lv,lt] of Object.entries(live))if(r.level-lv<=10){const s=F.share(t,F.spots(lt)[0]);if(s>0.75){console.log('share live',lv,r.level,s.toFixed(2));bad++;}}
  if((t.length>88)!==(r.level%10===0)){console.log('big board rule (only every 10th level, and there always)',r.level,t.length);bad++;}
  const w=Math.max(...played.map(q=>F.share(t,q)));if(w>0.75){console.log('share played',r.level,w.toFixed(2));bad++;}});
for(const r of rows)console.log(r.level,r.tier.padEnd(8),String(r.g2.exp).padEnd(5),r.recipe.join('+').padEnd(26),r.shape,'(built as '+r.builtAs+')');
console.log(bad?bad+' problems':'all checks pass');
if(outArg&&!bad)fs.writeFileSync(outArg,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
