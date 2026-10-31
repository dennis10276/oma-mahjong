const fs=require('fs');const R=process.argv[2];const rd=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const O=rd('source/analysis/factory/batch-175-ordered.jsonl'),G=rd('source/analysis/factory/batch-175-g2.jsonl'),C=rd(R+'critic163.jsonl');
const crit=Object.fromEntries(C.map(c=>[c.level,{late:c.late,reach:c.reach,flags:[c.late>0.3&&'late squeeze',c.reach<0.05&&'clock out of reach'].filter(Boolean)}]));
const inv=[];const seen=new Set();
for(const r of O)inv.push({...r,id:'o'+r.level,critic:r.critic||undefined});
for(const l of [179,189,186]){const r=G.find(x=>x.level===l);inv.push({...r,id:'g'+l,builtAs:l,critic:l===186?{late:0.72,flags:['late squeeze']}:r.critic});}
const ot=rd(R+'big1.jsonl')[0];inv.push({...ot,id:'oldtwins',builtAs:180,critic:{late:0.94,flags:['late squeeze']}});
for(const f of ['e1','e2','e3','e4','t1','f1','f2'])for(const r of rd(R+f+'.jsonl')){if(!r.ok||seen.has(r.level))continue;seen.add(r.level);inv.push({...r,id:'n'+r.level,builtAs:r.level});}
fs.writeFileSync(R+'inventory.jsonl',inv.map(r=>JSON.stringify(r)).join('\n')+'\n');console.log(inv.length,'boards;',inv.filter(r=>r.g2&&r.g2.exp<=6).length,'usable (<=6)');
