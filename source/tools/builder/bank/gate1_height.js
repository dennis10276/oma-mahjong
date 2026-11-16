'use strict';
process.env.FINISH_ALL='1';process.env.DEBUG='1';process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),R=require('./gate1_layers'),T=require('./shape_bench_tools');
const OUT=R.OUT;
for(const lv of process.argv.slice(2).map(Number)){
 const file=path.join(OUT,`seed-${lv}.json`);let seed;
 if(fs.existsSync(file))seed=JSON.parse(fs.readFileSync(file));else{const b=D.bandRun(lv,{relaxed:true,widths:[13,12],tries:2});seed=b.ok?b:(b.tried||[]).filter(r=>r.design&&T.geometry(r.design).straight===0).sort((a,b)=>(a.errors?.length??99)-(b.errors?.length??99))[0];if(!seed){console.log(lv,'no seed');continue;}fs.writeFileSync(file,JSON.stringify(seed));}
 const before=P.original(lv),attempts=[],begin=Date.now(),y0=Math.min(...seed.design.tiles.map(p=>p[1]));
 outer:for(const cut of[2,1])for(const order of[true,false])for(let v=0;v<24;v++){
  if(Date.now()-begin>240000)break outer;
  const config={seedTiles:seed.design.tiles,extras:(seed.moved||[]).map(m=>m.tile),y0,y1:y0,cut,keepLow:true,order,noUntwin:true,...(lv===288?{relocate:{6:[6,6,0]}}:{})};
  const r=R.build(before,config,v);attempts.push({cut,order,variant:v,ok:!!r.ok,why:r.why,errors:r.certificate?.errors});console.log(lv,cut,order,v,r.ok,r.why||r.certificate?.errors);
  if(r.design&&r.certificate?.errors?.length<=2)fs.writeFileSync(path.join(OUT,`height-candidate-${lv}-${cut}-${order}-${v}.json`),JSON.stringify(r));
  if(r.ok){fs.writeFileSync(path.join(OUT,`level-${lv}.json`),JSON.stringify({level:lv,source:lv,method:'same trap; lower its own top-row pile and place its original tiles inside',...r,attempts},null,1));break outer;}
 }
 fs.writeFileSync(path.join(OUT,`height-${lv}.json`),JSON.stringify({level:lv,attempts,ms:Date.now()-begin},null,2));
}
