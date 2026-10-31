// inventory for the new curve: every factory board so far, spare variants that landed in the middle, and
// boards whose ice was idle with that ice taken off (their difficulty is the measured "without ice" value)
const fs=require('fs');const R=process.argv[2];const rd=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const inv=rd(R+'inventory.jsonl');const tune=rd(R+'spare-tune.jsonl');
for(const f of ['m2a','m2b','m2c','m3a','m3b','m4a','m4b','m4c'])for(const r of rd(R+f+'.jsonl'))if(r.ok)inv.push({...r,id:'n'+r.level,builtAs:r.level});
// spare variants (from tune_spare): keep the ones that landed 3-6
for(const t of tune){if(t.exp<3||t.exp>6)continue;const r=inv.find(x=>x.id===t.id);if(!r)continue;const route=r.design.solution.indexOf(r.design.clock.i)+1;
  inv.push({...r,id:t.id+'s'+t.spare,design:{...r.design,clock:{...r.design.clock,n:route+t.spare}},clockSpare:t.spare,clock:route+t.spare,g2:{exp:t.exp,first:t.first,version:'human-g2'},critic:t.critic});}
// specials results
const matter={};for(const f of ['matter1.jsonl','matter2.jsonl','matter3.jsonl'])for(const m of rd(R+f))matter[m.id]=m;
const out=[];
for(const r of inv){const m=matter[r.id];
  if(m&&m.idle&&m.idle.length&&m.idle.every(k=>k==='ice')){   // idle ice: take it off
    out.push({...r,id:r.id+'-noice',design:{...r.design,obst:{...r.design.obst,ice:{}}},g2:{...r.g2,exp:m.kinds.ice.without},idle:[],matter:'ice taken off (idle: '+m.kinds.ice.drop+')'});continue;}
  out.push({...r,idle:m?m.idle:undefined,matter:m?'checked':undefined});}
fs.writeFileSync(R+'inventory2.jsonl',out.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(out.length,'boards;',out.filter(r=>r.g2&&r.g2.exp>=3&&r.g2.exp<=5.5).length,'between 3 and 5.5');
