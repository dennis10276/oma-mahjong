'use strict';
// Rebuild each supplied level's supports. Identities, faces and down flags stay
// attached; the geometry and assignment optimizers do not deal a new board.
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),cp=require('child_process'),D=require('./detower'),P=require('./finish_all_sources'),T=require('./shape_bench_tools'),Q=require('./towers_proof'),E=require(D.CF+'../engine'),L=require('../../../www/layouts'),SEP=require(D.CF+'separate');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/'+(process.env.FINISH_GATE==='2'?'gate2':'gate1'));
const clone=x=>structuredClone(x),key=p=>p.join(',');
function optimize(kind,job,stem){const input=path.join(OUT,stem+'-'+kind+'-input.json'),output=path.join(OUT,stem+'-'+kind+'-output.json');fs.writeFileSync(input,JSON.stringify(job));const r=cp.spawnSync('python',[path.join(__dirname,'gate1_'+kind+'_milp.py'),input,output],{encoding:'utf8',timeout:(job.seconds+15)*1000,windowsHide:true});if(r.error||r.status!==0)return{ok:false,error:r.error?.message||r.stderr};return JSON.parse(fs.readFileSync(output));}
function ranks(a,actions){const q=new Array(a.tiles.length).fill(-1);let k=0;for(const act of actions){const ids=Number.isInteger(act)?[act]:act.pair;for(const id of ids)q[id]=k;k+=ids.length;}return q;}
function witnesses(a,opts){const out=[ranks(a,a.solution)];if(opts.witnessFile){out.push(ranks(a,JSON.parse(fs.readFileSync(path.resolve(opts.witnessFile))).path));return out;}for(const id of opts.onlyLock==null?Object.keys(a.obst.ice).map(Number):[]){const b=clone(a);delete b.obst.ice[id];const cs=E.clockShortest(E.game(b),{nodes:1000000,ms:8000});if(cs&&!cs.unsure&&E.flatten(cs.path).length===a.tiles.length)out.push(ranks(a,cs.path));}for(const id of opts.onlyLock!=null?[opts.onlyLock]:[]){const b=clone(a);b.obst.locks=b.obst.locks.filter(i=>i!==id);const cs=E.clockShortest(E.game(b),{nodes:1000000,ms:8000});if(cs&&!cs.unsure&&E.flatten(cs.path).length===a.tiles.length)out.push(ranks(a,cs.path));}return out;}
function rebuild(level,opts={}){
 const source=({262:260,277:280})[level]||level,before=P.original(source),a=before.design;
 const seed=opts.seedFile?JSON.parse(fs.readFileSync(path.resolve(opts.seedFile))):null,c=seed?{d:clone(seed.design),keep:seed.keep}:source===level?{d:clone(a),keep:a.tiles.map((_,i)=>i)}:D.candidate(level),d=c.d,keep=c.keep,g=E.game(d),n=d.tiles.length,witness=witnesses(d,opts);
 const sp=[d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)],baits=(before.card?.trap?.baits||[]).flatMap(b=>b.tiles).map(i=>keep.indexOf(i)).filter(i=>i>=0),route=d.solution.slice(0,d.solution.indexOf(d.clock.i)+1+(opts.prefixExtra||0));
 const core=new Set([...sp,...baits,...route]);const baitFaces=new Set((opts.protectPhotos?[...baits,...sp]:baits).map(i=>d.faces[i]));d.faces.forEach((f,i)=>{if(baitFaces.has(f))core.add(i);});
 if(opts.ice!==false)for(const i of Object.keys(d.obst.ice).map(Number))for(const j of g.iceNb[i])core.add(j);
 // Preserve both sides of closed trap tiles; leave open sides open.
 for(let pass=0;pass<3;pass++)for(const i of [...core]){for(const j of g.nb.above[i])core.add(j);if(pass===0&&g.nb.left[i].length&&g.nb.right[i].length)for(const j of [...g.nb.left[i],...g.nb.right[i]])core.add(j);}
 for(const move of opts.moves||[]){let ids=move.ids;if(move.ice!=null){ids=[move.ice,...g.iceNb[move.ice]];for(let pass=0;pass<3;pass++)for(const i of [...ids])for(const j of g.nb.above[i])if(!ids.includes(j))ids.push(j);}for(const i of ids){const p=d.tiles[i];d.tiles[i]=[p[0]+(move.dx||0),p[1]+(move.dy||0),p[2]+(move.dz||0)];core.add(i);}}
 if(opts.fold)for(const i of core){const p=d.tiles[i],f=opts.fold;if(p[0]>=f.x&&p[1]>=(f.y0||0)&&p[1]<=(f.y1??100))d.tiles[i]=[p[0]+(f.dx||0),p[1]+(f.dy||0),p[2]+(f.dz||0)];}
 if(opts.upperShift)d.tiles=d.tiles.map(p=>p[2]?[p[0]+(opts.upperShift.dx||0),p[1]+(opts.upperShift.dy||0),p[2]]:p);
 if(opts.topShift)d.tiles=d.tiles.map(p=>p[2]&&p[1]<=2?[p[0],p[1]+opts.topShift,p[2]]:p);
 if(opts.bottomShift)d.tiles=d.tiles.map(p=>p[2]&&p[1]>=12?[p[0],p[1]+opts.bottomShift,p[2]]:p);
 for(const shift of opts.rowsShift||[])d.tiles=d.tiles.map(p=>p[2]>=(shift.minZ||1)&&shift.ys.includes(p[1])?[p[0],p[1]+shift.dy,p[2]]:p);
 if(opts.bottomX)d.tiles=d.tiles.map(p=>p[2]&&p[1]>=8?[p[0]+opts.bottomX,p[1],p[2]]:p);
 for(const [id,pos]of Object.entries(opts.relocate||{})){d.tiles[+id]=pos;core.add(+id);}
 if(opts.lower){const f=opts.lower;d.tiles=d.tiles.map((p,i)=>!(opts.noLower||[]).includes(i)&&p[2]>=(f.cut||1)&&p[0]>=(f.x0||0)&&p[0]<=(f.x1??100)&&p[1]>=(f.y0||0)&&p[1]<=(f.y1??100)?[p[0],p[1],p[2]-(f.cut||1)]:p);}
 for(const i of opts.unlock||[])core.delete(i);
 for(const i of opts.fix||[])core.add(i);
 if(opts.preview)return{level,source,design:d,keep,fixed:[...core]};
 const extraFixed=[...(opts.hardIds||[]),...(opts.extraPrefixes||[]).flat()],hard=new Set(opts.hard||opts.hardSpecialsOnly?sp:[]);for(const i of extraFixed){hard.add(i);core.add(i);}if(opts.hardBaits)for(const i of baits)hard.add(i);if(opts.hard){for(const i of baits)for(let j=0;j<n;j++)if(d.faces[j]===d.faces[i])hard.add(j);for(let pass=0;pass<3;pass++)for(const i of [...hard].filter(i=>!sp.includes(i)))for(const j of g.nb.above[i])hard.add(j);}
 const corePos=[...core].map(i=>d.tiles[i]),watch=[...core],oldPos=new Set(d.tiles.map(key)),started=Date.now(),attempts=[];
 console.log(level,'core',core.size,'of',n,'witnesses',witness.length);
 for(const y0 of opts.y0!=null?[opts.y0]:[0,1,2])for(const x0 of opts.x0!=null?[opts.x0]:[0,1,2]){
  if(Date.now()-started>(opts.ms||300000))break;
  if(!opts.softFixed&&corePos.some(p=>p[0]<x0||p[0]>x0+11||p[1]<y0||p[1]>y0+14))continue;
  const left=opts.left??Math.min(x0/2,...corePos.map(p=>p[0]/2-p[2]*.14)),top=Math.min(y0*.62-.14,...corePos.map(p=>p[1]*.62-p[2]*.14)),right=left+6.55,bottom=top+10.11;
  const badgeSite=opts.badgeGuard?require('./gate2_badge_sites').guard(before,d,keep):()=>true;
  const sites=[];for(let z=0;z<=Math.max(...d.tiles.map(p=>p[2]));z++)for(let y=y0;y<=y0+14;y++)for(let x=x0;x<=x0+11;x++){
   const p=[x,y,z];if(x/2-z*.14<left-1e-8||x/2-z*.14+1>right+1e-8||y*.62-z*.14<top-1e-8||y*.62-z*.14+1.24>bottom+1e-8)continue;
   if(!badgeSite(p))continue;
   if(opts.iceGuard&&Object.keys(d.obst.ice).map(Number).some(i=>{const q=d.tiles[i],dx=Math.abs(x-q[0]),dy=Math.abs(y-q[1]),dz=Math.abs(z-q[2]);if(key(p)===key(q)||z<q[2]&&dx<2&&dy<2)return false;const near=dz===0?dx<=2&&dy<=2&&(dx<2||dy<2):dz===1&&dx<2&&dy<2;return near&&!g.iceNb[i].some(j=>key(p)===key(d.tiles[j]));}))continue;
   if(opts.guard!==false&&!oldPos.has(key(p))&&watch.some(i=>{const q=d.tiles[i];return(z>q[2]&&Math.abs(x-q[0])<2&&Math.abs(y-q[1])<2)||(z===q[2]&&Math.abs(x-q[0])===2&&Math.abs(y-q[1])<2);}))continue;
   sites.push(p);
  }
  const highLimits=Array.from({length:Math.max(...d.tiles.map(p=>p[2]))-2},(_,i)=>[i+3,keep.filter((id,k)=>a.tiles[id][2]>=i+3&&(!core.has(k)||d.tiles[k][2]>=i+3)).length]);
  const freeIds=[...new Set([...(opts.baitFree?baits.filter(i=>E.legal(g,E.start(g)).includes(i)):[]),...(opts.freeIds||[])])];
  const stem=`rebuild-${level}-${x0}-${y0}`,geom=optimize('geometry',{sites,count:n,fixed:corePos,hardFixed:[...hard].map(i=>d.tiles[i]),prefix:opts.prefix?route.filter(i=>!(opts.prefixExclude||[]).includes(i)).map(i=>d.tiles[i]):[],prefixes:(opts.extraPrefixes||[]).map(q=>q.map(i=>d.tiles[i])),free:freeIds.map(i=>d.tiles[i]),softFixed:opts.softFixed,original:d.tiles,highLimits,seconds:opts.seconds||35,seed:opts.solverSeed||0},stem);
  console.log(stem,'geometry',geom.ok,geom.message);if(!geom.ok){attempts.push({x0,y0,stage:'geometry',...geom});continue;}
  const tiles=geom.tiles,shape=T.geometry({...d,tiles});if(!shape.ok){attempts.push({x0,y0,stage:'shape',shape});console.log('shape',shape.errors,shape.px);continue;}
  const ix=new Map(tiles.map((p,i)=>[key(p),i])),nb=L.neighbors(tiles.map(p=>({x:p[0],y:p[1],z:p[2]}))),all=new Uint8Array(n).fill(1),geo=SEP.geometry({...d,tiles,down:[]}),closeVisible=[];
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(geo.vis[i]&&geo.vis[j]&&geo.close[i][j])closeVisible.push([i,j]);
  const assignmentIds=[...new Set([...(opts.assignmentFixed==='specials-and-baits'?[...sp,...baits]:opts.assignmentFixed==='prefix-specials-baits'?[...sp,...baits,...route]:core),...extraFixed])],fixed=assignmentIds.filter(i=>ix.has(key(d.tiles[i]))),missing=[...core].filter(i=>!ix.has(key(d.tiles[i])));console.log('moved core',missing);
  const activeWitness=opts.orderIndexes?opts.orderIndexes.map(i=>witness[i]):witness.slice(0,opts.orders??witness.length);
  const probe=opts.assignmentIceOrders||opts.assignmentGates?E.game({...clone(d),tiles,faces:new Array(n).fill(0),down:[],clock:{...d.clock,i:ix.get(key(d.tiles[d.clock.i]))},obst:{ice:Object.fromEntries(Object.entries(d.obst.ice).map(([i,h])=>[ix.get(key(d.tiles[+i])),h])),keys:d.obst.keys.map(i=>ix.get(key(d.tiles[i]))),locks:d.obst.locks.map(i=>ix.get(key(d.tiles[i])))}}):null,iceOrders=probe?Object.entries(d.obst.ice).map(([i,h])=>[keep[+i],h,probe.iceNb[ix.get(key(d.tiles[+i]))]]):[];
  const assignmentGates=opts.assignmentGates?require('./gate2_assignment_gates').constraints(before,d,keep,probe):null;
  const ass=optimize('assignment',{ids:keep,tiles,fixed:fixed.map(i=>[keep[i],ix.get(key(d.tiles[i]))]),original:d.tiles,faces:d.faces,iceOrders,allowedSites:assignmentGates?.allowedSites,down:d.down.map(i=>keep[i]),free:tiles.map((_,i)=>i).filter(i=>L.isFree(i,all,nb)),oldFree:E.legal(g,E.start(g)).filter(Number.isInteger).map(i=>keep[i]),oldDepth:g.nb.above.map(x=>x.length),ranks:activeWitness.map(q=>{const r=new Array(a.tiles.length).fill(-1);keep.forEach((id,i)=>r[id]=q[i]);return r;}),prefixLimits:opts.rankPrefix!=null?activeWitness.map(()=>opts.rankPrefix):undefined,...nb,closeVisible:opts.twins===false?[]:closeVisible,seconds:opts.assignSeconds||45,seed:0},stem);
  console.log(stem,'assignment',ass.ok,ass.message);if(!ass.ok){attempts.push({x0,y0,stage:'assignment',...ass});continue;}
  const idPos=new Map(ass.assignment),out=clone(d);out.tiles=keep.map(id=>tiles[idPos.get(id)]);
  fs.writeFileSync(path.join(OUT,stem+'-assembled.json'),JSON.stringify({level,source,design:out,keep,fixed:[...core].map(i=>keep[i])}));
  if(!E.replay(out,out.solution,{strict:true}).ok){const route=D.route(out);if(!route){attempts.push({x0,y0,stage:'replay'});continue;}out.solution=route;}
  const certificate=Q.certify(before,out,keep),controlGates=process.env.FINISH_GATE==='2'?require('./gate2_gates').compare(before,out,keep):null,r={level,source,ok:certificate.ok&&(!controlGates||controlGates.ok),design:out,keep,shape:T.geometry(out),certificate,controlGates,method:'Rebuilt this level support courses around its retained trap roles; original pictures and face-down identities retained',recipe:opts,sourceHash:P.hash(a),fixed:[...core].map(i=>keep[i]),attempts,x0,y0};
  fs.writeFileSync(path.join(OUT,stem+'-candidate.json'),JSON.stringify(r));console.log(level,r.ok,certificate.errors,controlGates?.changed.map(r=>r.tile));attempts.push({x0,y0,stage:'certificate',ok:r.ok,errors:certificate.errors,changedGates:controlGates?.changed.map(r=>r.tile)});
  if(r.ok){fs.writeFileSync(path.join(OUT,`level-${level}.json`),JSON.stringify(r,null,1));return r;}
 }
 const result={level,source,ok:false,core:[...core],attempts,ms:Date.now()-started};fs.writeFileSync(path.join(OUT,`rebuild-${level}.json`),JSON.stringify(result,null,2));return result;
}
if(require.main===module)for(const n of process.argv.slice(2).filter(x=>!x.startsWith('{')).map(Number))rebuild(n,JSON.parse(process.argv.find(x=>x.startsWith('{'))||'{}'));
module.exports={rebuild,OUT};
