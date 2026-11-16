'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),T=require('./shape_bench_tools'),S=require('./shape_bench'),G=require(D.CF+'narrow_methods'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1');fs.mkdirSync(OUT,{recursive:true});
function build(before,config,variant){
 const a=before.design,n=a.tiles.length,positions=(config.seedTiles||a.tiles).map(t=>t.slice()),loose=[],sp=new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number)]),pre=a.solution.slice(0,a.solution.indexOf(a.clock.i)+1),bait=(before.card?.trap?.baits||[]).flatMap(b=>b.tiles),fixed=new Set([...sp,...pre,...bait]);
 for(const [id,p]of Object.entries(config.relocate||{}))positions[+id]=p.slice();
 for(const i of config.extras||[]){if(fixed.has(i))continue;positions[i]=null;loose.push(i);}
 for(let i=0;i<n;i++){const p=positions[i];if(!p)continue;if(p[1]>=config.y0&&p[1]<=config.y1){if(p[2]<config.cut){if(fixed.has(i)){if(config.keepLow)continue;return{why:'fixed tile in removed support layer '+i};}positions[i]=null;loose.push(i);}else p[2]-=config.cut;}else if(config.wings){p[0]+=p[0]<6?1:p[0]>6?-1:0;}}
 if(!positions.filter(Boolean).length)return{why:'empty'};
 // New support layers must be sound before fillers are added.
 if(!G.valid(positions.filter(Boolean)))return{why:'lowered piece unsupported'};
 const cur=()=>positions.filter(Boolean),core=()=>[...fixed].map(i=>positions[i]).filter(Boolean);
 const near=p=>[...fixed].some(i=>{const q=positions[i];if(!q)return false;if(p[2]>q[2]&&Math.abs(p[0]-q[0])<2&&Math.abs(p[1]-q[1])<2)return true;if(p[2]===q[2]&&Math.abs(p[0]-q[0])===2&&Math.abs(p[1]-q[1])<2)return true;return false;});
 const oldG=E.game(a),buried=i=>(oldG.nb.above[i]||[]).length;
 const order=new Array(n);let witness=a.solution,actions=a.solution;
 if(config.abl!=null){const counter=structuredClone(a);delete counter.obst.ice[config.abl];const q=E.clockShortest(E.game(counter),{nodes:1000000,ms:10000});if(!q||q.unsure)return{why:'source ablation unresolved'};actions=q.path;witness=E.flatten(q.path);if(witness.length!==n)return{why:'source ablation witness incomplete'};}
 let step=0;for(const act of actions){const ids=typeof act==='number'?[act]:act.pair;for(const id of ids)order[id]=step;step+=ids.length;}
 const ordered=U=>U.every((p,i)=>!p||!U.some((q,j)=>q&&j!==i&&order[j]>=order[i]&&q[2]>p[2]&&Math.abs(q[0]-p[0])<2&&Math.abs(q[1]-p[1])<2)&&!(U.some((q,j)=>q&&j!==i&&order[j]>=order[i]&&q[2]===p[2]&&q[0]===p[0]-2&&Math.abs(q[1]-p[1])<2)&&U.some((q,j)=>q&&j!==i&&order[j]>=order[i]&&q[2]===p[2]&&q[0]===p[0]+2&&Math.abs(q[1]-p[1])<2)));
 loose.sort((i,j)=>config.order?order[j]-order[i]:buried(j)-buried(i)||i-j);
 // Preserve the lonely bait's buried twin as a little two-layer brick module.
 if(config.bury!=null){const id=config.bury;if(!loose.includes(id))return{why:'burial tile not loose'};
  const module=[[6,12,0],[4,12,0],[8,12,0],[5,12,1],[7,12,1],[6,12,2]],use=[id,...loose.filter(i=>i!==id).slice(0,5)];
  for(let k=0;k<use.length;k++)positions[use[k]]=module[k];for(const i of use)loose.splice(loose.indexOf(i),1);
  if(!G.valid(cur()))return{why:'burial module overlap'};
 }
 const initial=cur(),minX=Math.min(...initial.map(p=>p[0])),maxX=Math.max(...initial.map(p=>p[0]));
 const x0=Math.min(minX,config.x0??1),x1=Math.max(maxX+2,config.x1??13);if(x1-x0>13)return{why:'piece width '+(x1-x0)};
 for(const id of loose){const C=cur();let best=null;
  for(let z=0;z<=2;z++)for(let y=0;y<=14;y++)for(let x=x0;x+2<=x1;x++){
   const p=[x,y,z];if(!D.brickSpot(C,p)||near(p))continue;
   const U=C.concat([p]);if(!T.geometry({...a,tiles:U}).errors.every(e=>e==='tileCount'))continue;
   if(config.order){positions[id]=p;const plays=ordered(positions);positions[id]=null;if(!plays)continue;}
   const m=x0+x1-2,mirror=C.some(t=>t[0]===m-x&&t[1]===y&&t[2]===z),covers=positions.reduce((sum,t,j)=>sum+(!!t&&t[2]<z&&Math.abs(t[0]-x)<2&&Math.abs(t[1]-y)<2?Math.min(5,buried(j)):0),0);
   const random=((x*17+y*7+id*3+variant*13)%19)/19;
   const score=z*[8,1,4,12][variant%4]-(mirror?12:0)+Math.abs(x+1-(x0+x1)/2)*.4+Math.abs(y-[10,12,8,6][variant%4])*.3-covers*[.2,3,1,0][variant%4]+random*2;
   if(!best||score<best.score)best={p,score};
  }if(!best)return{why:'no spot '+id};positions[id]=best.p;
 }
 const d={...structuredClone(a),tiles:positions},geo=T.geometry(d);if(!geo.ok)return{why:geo.errors.join(','),geo};
 // Separate visible ordinary twins by moving whole tiles, keeping every picture
 // and face-down flag attached to its original identity.
 const SEP=require(D.CF+'separate'),limit=SEP.closeTwins(a).visible,positionSwaps=[];
 const fixedFaces=new Set([...fixed].map(i=>a.faces[i])),movable=loose.filter(i=>!fixedFaces.has(a.faces[i]));
 for(let it=0;it<(config.noUntwin?0:16);it++){const count=SEP.closeTwins(d).visible;if(count<=limit)break;let best=null;
  const pair=SEP.closeTwins(d).closeVisible.find(p=>p.some(i=>movable.includes(i)));if(!pair)break;
  for(const i of pair.filter(i=>movable.includes(i)))for(const j of movable){if(i===j||d.faces[i]===d.faces[j])continue;[d.tiles[i],d.tiles[j]]=[d.tiles[j],d.tiles[i]];const v=SEP.closeTwins(d).visible;[d.tiles[i],d.tiles[j]]=[d.tiles[j],d.tiles[i]];if(v<count&&(!best||v<best.v))best={i,j,v};}
  if(!best)break;[d.tiles[best.i],d.tiles[best.j]]=[d.tiles[best.j],d.tiles[best.i]];positionSwaps.push([best.i,best.j]);
 }
 const route=D.route(d);if(!route)return{why:'no full winning route',d};d.solution=route;
 const certificate=Q.certify(before,d,a.tiles.map((_,i)=>i));return{ok:certificate.ok,design:d,keep:a.tiles.map((_,i)=>i),certificate,shape:geo,config,variant,positionSwaps};
}
function run(lv){const before=P.original(lv),begin=Date.now(),attempts=[],configs=lv===259?[{y0:2,y1:6,cut:1,order:true,noUntwin:true},{y0:2,y1:6,cut:1,noUntwin:true}]:lv===265?[{y0:0,y1:4,cut:1,wings:true,order:true,noUntwin:true,abl:72},{y0:0,y1:4,cut:1,wings:true,order:true,noUntwin:true}]:[{y0:0,y1:0,cut:2},{y0:0,y1:0,cut:1}];
 for(const c of configs)for(let v=0;v<20;v++){if(Date.now()-begin>240000)break;const r=build(before,c,v);attempts.push({config:c,variant:v,ok:!!r.ok,why:r.why,errors:r.certificate?.errors});console.log(lv,v,r.ok,r.why||r.certificate?.errors);if(r.design&&r.certificate?.errors?.length===1)fs.writeFileSync(path.join(OUT,`candidate-${lv}-${c.abl??'normal'}-${v}.json`),JSON.stringify(r));if(r.ok){const out={level:lv,source:lv,method:'same trap; lower its own pyramid and return support tiles as bricks',...r,attempts,ms:Date.now()-begin};fs.writeFileSync(path.join(OUT,`level-${lv}.json`),JSON.stringify(out,null,1));return out;}}
 const out={level:lv,ok:false,attempts,ms:Date.now()-begin};fs.writeFileSync(path.join(OUT,`layers-${lv}.json`),JSON.stringify(out,null,2));return out;}
if(require.main===module)for(const n of process.argv.slice(2).map(Number))run(n);module.exports={build,run,OUT};
