// new piles to fill 175-200 on the live curve: 10 normal-size (for easy levels) + 2 big (96, for 190/200),
// shapes the inventory uses least; overlap <= 75% with played 70-174, the inventory and each other
const fs=require('fs'),vm=require('vm');const ROOT='/home/claude/repo-oma/source';
const L=require(ROOT+'/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(ROOT+'/www/levels-hard.js','utf8')+';HARD_LEVELS');
const Hard=require(ROOT+'/www/hard.js');const F=require(ROOT+'/tools/factory/piles_for.js');
const inv=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));   // [{id,shape,tiles}]
const others=[];for(let lv=70;lv<=174;lv++)others.push(F.spots(Hard.get(lv).tiles)[0]);for(const r of inv)others.push(F.spots(r.tiles)[0]);
const used={};for(const r of inv){const b=r.shape.split(' · ')[0];used[b]=(used[b]||0)+1;}
const bases=[...new Set(F.SHAPES.map(s=>s.shape))].sort((a,b)=>(used[a]||0)-(used[b]||0)||a.localeCompare(b));
const out=[],made=[];const want=[...Array(10).fill(84),96,96];let bi=0;
for(const [k,N] of want.entries()){let got=null;
  for(let tries=0;tries<bases.length*2&&!got;tries++){const base=bases[(bi++)%bases.length];const shs=F.SHAPES.filter(s=>s.shape===base);
    for(const sh of shs){const sizes=N===96?[96]:[84,80,76,88,72];for(const n of sizes){for(let s=0;s<3&&!got;s++){
      const worst=t=>Math.max(...others.map(q=>F.share(t,q)),...made.map(q=>F.share(t,q)));
      const t=F.candidate(sh,n,9000+k*101+s*9973,t=>worst(t)<=0.75&&(N!==96||t.length>88)&&(N===96||t.length<=88));
      if(t){got={level:900+k,shape:sh.name,base,tiles:t,n:t.length,px:+F.tilePx(t.map(([x,y,z])=>({x,y,z}))).toFixed(1),shared:+worst(t).toFixed(2)};made.push(F.spots(t)[0]);}}if(got)break;}if(got)break;}}
  if(got){out.push(got);console.log(got.level,got.shape,got.n,'tiles',got.px,'px shared',got.shared);}else console.log('slot',k,'no pile');}
fs.writeFileSync(process.argv[3],JSON.stringify(out));
