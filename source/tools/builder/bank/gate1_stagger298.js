'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
// Keep the complete lower trap, including 71's two side holds and the buried
// key lookalike. Change its support courses from horizontal to vertical bricks.
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),T=require('./shape_bench_tools'),G=require(D.CF+'narrow_methods'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1'),before=P.original(298),a=before.design,base=P.prepare(before),n=a.tiles.length,order=[];a.solution.forEach((id,k)=>order[id]=k);
const fixed=new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number),...(before.card.trap.baits||[]).flatMap(b=>b.tiles),...a.solution.slice(0,a.solution.indexOf(a.clock.i)+1),54,71,75]);
const origKeep=a.tiles.map((p,i)=>(p[2]>0&&p[1]>0&&![55,42,52].includes(i))||(p[2]===0&&[7,8,9,10,11,12,15,16,19,20].includes(i))?i:null).filter(i=>i!=null);
function validOrder(U){return U.every((p,i)=>!p||!U.some((q,j)=>q&&order[j]>order[i]&&q[2]>p[2]&&Math.abs(q[0]-p[0])<2&&Math.abs(q[1]-p[1])<2)&&!(U.some((q,j)=>q&&order[j]>order[i]&&q[2]===p[2]&&q[0]===p[0]-2&&Math.abs(q[1]-p[1])<2)&&U.some((q,j)=>q&&order[j]>order[i]&&q[2]===p[2]&&q[0]===p[0]+2&&Math.abs(q[1]-p[1])<2)));}
const begin=Date.now(),attempts=[];
for(let variant=0;variant<40;variant++){
 if(Date.now()-begin>240000)break;
 const pos=a.tiles.map((p,i)=>origKeep.includes(i)?p.slice():null);
 pos[25]=[3,9,0];pos[26]=[3,11,0];pos[81]=[6,6,0];pos[28]=[11,9,0];for(const i of[15,16,56])pos[i][0]--;
 if(!variant){for(let i=0;i<n;i++)if(pos[i])for(let j=0;j<n;j++)if(pos[j]&&order[j]>order[i]&&pos[j][2]>pos[i][2]&&Math.abs(pos[j][0]-pos[i][0])<2&&Math.abs(pos[j][1]-pos[i][1])<2)console.log('initial order obstruction',i,j);}
 const loose=pos.map((p,i)=>!p?i:null).filter(i=>i!=null),ground=[];
 for(const y of[9,11,13,15])for(let x=1;x<=11;x+=2){if(y===9&&x===5)continue;if(!pos.some(p=>p&&p[0]===x&&p[1]===y&&p[2]===0))ground.push([x,y,0]);}ground.push([1,7,0]);
 const heldUntil=p=>Math.max(-1,...pos.map((q,i)=>q&&q[2]>0&&Math.abs(q[0]-p[0])<2&&Math.abs(q[1]-p[1])<2?order[i]:-1));
 ground.sort((p,q)=>heldUntil(q)-heldUntil(p)||Math.abs(p[0]-6)-Math.abs(q[0]-6)||((p[0]*3+variant)%7)-((q[0]*3+variant)%7));
 let fail=null;
 for(const p of ground){let best=null;for(const id of loose){pos[id]=p;if(variant<20&&!validOrder(pos)){pos[id]=null;continue;}pos[id]=null;const old=a.tiles[id],sc=variant<10?order[id]+((id*13+variant*7)%17)*.1:Math.abs(p[0]-old[0])+Math.abs(p[1]-old[1])*.5+old[2]*3+((id*13+variant*7)%17)*.1-order[id]*.02;if(!best||sc<best.sc)best={id,sc};}if(!best){fail='ground identity '+p;break;}pos[best.id]=p;loose.splice(loose.indexOf(best.id),1);}
 if(fail){attempts.push({variant,fail});continue;}
 if(!G.valid(pos.filter(Boolean))){attempts.push({variant,fail:'required support'});continue;}
 loose.sort((i,j)=>order[j]-order[i]);
 for(const id of loose){let best=null;const cur=pos.filter(Boolean);for(let z=0;z<=2;z++)for(let y=2;y<=15;y++)for(let x=1;x<=12;x++){
  const p=[x,y,z];if(!D.brickSpot(cur,p,{halfRows:true}))continue;
  if([...fixed].some(i=>{const q=pos[i];return q&&((z>q[2]&&Math.abs(x-q[0])<2&&Math.abs(y-q[1])<2)||(z===q[2]&&Math.abs(x-q[0])===2&&Math.abs(y-q[1])<2));}))continue;
  pos[id]=p;if(variant<20&&!validOrder(pos)){pos[id]=null;continue;}pos[id]=null;
  if(!T.geometry({...a,tiles:cur.concat([p])}).errors.every(e=>e==='tileCount'))continue;
  const mirror=cur.some(q=>q[0]===13-x&&q[1]===y&&q[2]===z),score=z*[2,8,4,1][variant%4]-(mirror?8:0)+Math.abs(y-[6,10,12,8][variant%4])*.4+Math.abs(x-6.5)*.1+((x*7+y*3+id+variant*5)%19)*.1;
  if(!best||score<best.score)best={p,score};
 }if(!best){fail='no filler '+id;if(variant===20)fs.writeFileSync(path.join(OUT,'stagger-298-partial.json'),JSON.stringify({pos,id,geometry:T.geometry({...a,tiles:pos.filter(Boolean)})}));break;}pos[id]=best.p;}
 if(fail){attempts.push({variant,fail});continue;}
 const d={...structuredClone(a),tiles:pos},geo=T.geometry(d);if(!geo.ok){attempts.push({variant,fail:geo.errors});continue;}
 const route=D.route(d);if(!route){attempts.push({variant,fail:'full win'});continue;}d.solution=route;
 const certificate=Q.certify(before,d,a.tiles.map((_,i)=>i),base),r={level:298,source:298,ok:certificate.ok,method:'same trap; vertical brick support courses under unchanged lower trap',design:d,keep:a.tiles.map((_,i)=>i),fixed:[54,71,75],certificate,shape:geo,variant};
 console.log(298,variant,r.ok,certificate.errors);attempts.push({variant,ok:r.ok,errors:certificate.errors});
 fs.writeFileSync(path.join(OUT,`stagger-298-${variant}.json`),JSON.stringify(r));if(r.ok){fs.writeFileSync(path.join(OUT,'level-298.json'),JSON.stringify(r,null,1));break;}
}
fs.writeFileSync(path.join(OUT,'stagger-298-attempts.json'),JSON.stringify(attempts,null,2));
