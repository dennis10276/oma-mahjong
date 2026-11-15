'use strict';
// Shape-aware revisions from Dennis's notes. Keep trap tiles together, remove
// ordinary collisions at seams, and fill low central space in balanced rows.
// No pictures are changed. Unknown proofs remain explicitly unverified.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const B=require('./narrow_placement_build'),P=require('./narrow_proof'),G=require('./narrow_methods'),E=require('../engine'),F=require('../footprint'),C=require('./narrow_placement_check'),M=require('./narrow_placement_model');
const OUT=path.join(P.DIR,'placement-lab/improvements'),copy=M.copy,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function coreOf(before){const d=before.design,g=E.game(d),roles=[d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)],core=new Set(roles);for(const id of roles){for(const j of g.nb.above[id])core.add(j);if(g.iceH[id])for(const j of g.iceNb[id])core.add(j);}return core;}
function symmetry(tiles){const t=tiles.filter(Boolean),l=Math.min(...t.map(p=>p[0])),r=Math.max(...t.map(p=>p[0]));return t.filter(p=>!t.some(q=>q[0]===l+r-p[0]&&q[1]===p[1]&&q[2]===p[2])).length;}
function linksSame(before,tiles,core){const a=E.game(before.design),b=E.game({...before.design,tiles}),ids=[...core].sort((a,b)=>a-b);return same(P.relations(a,ids),P.relations(b,ids));}
function foundation(before,tiles,core){
  const T=copy(tiles),parked=new Set();
  for(let i=0;i<T.length;i++)if(!T[i]){if(core.has(i))return null;parked.add(i);T[i]=before.design.tiles[i].slice();}
  for(let i=0;i<T.length;i++)for(let j=0;j<i;j++)if(!parked.has(i)&&!parked.has(j)&&T[i][2]===T[j][2]&&M.overlap(T[i],T[j])){
    if(core.has(i)&&core.has(j))return null;
    const drop=core.has(i)?j:core.has(j)?i:Math.abs(T[i][0]-6)>Math.abs(T[j][0]-6)?i:j;parked.add(drop);
  }
  for(let changed=true;changed;){changed=false;for(let i=0;i<T.length;i++)if(!parked.has(i)&&!M.supported(T.filter((_,j)=>!parked.has(j)&&j!==i),T[i])){if(core.has(i))return null;parked.add(i);changed=true;}}
  const live=T.filter((_,i)=>!parked.has(i));if(!live.length)return null;const dx=Math.min(0,...live.map(t=>t[0])),dy=Math.min(0,...live.map(t=>t[1]));T.forEach(t=>{t[0]-=dx;t[1]-=dy;});
  if(!F.measure(T.filter((_,i)=>!parked.has(i)),{minimum:58}).ok||!linksSame(before,T,core))return null;
  return {tiles:T,parked:[...parked],score:parked.size*4+symmetry(live)*.3};
}
function pack(before,f,core,seed){
  const T=copy(f.tiles),parked=new Set(f.parked),placed=T.map((_,i)=>i).filter(i=>!parked.has(i)),live=placed.map(i=>T[i]),l=Math.min(...live.map(t=>t[0])),r=Math.max(...live.map(t=>t[0])),top=Math.min(...live.map(t=>t[1])),bottom=Math.max(...live.map(t=>t[1])),mx=(l+r)/2,my=(top+bottom)/2;
  const order=new Map(before.design.solution.map((id,i)=>[id,i])),ids=f.parked.slice().sort((a,b)=>seed%2?order.get(a)-order.get(b):order.get(b)-order.get(a)),baseRows=[...new Set(placed.filter(i=>!T[i][2]).map(i=>T[i][1]))],ice=new Set(Object.keys(before.design.obst.ice).map(Number));
  for(const id of ids){let best=null;
    for(let z=0;z<=2;z++)for(let y=top;y<=bottom;y++)for(let x=l;x<=r;x++){
      const p=[x,y,z];if(z===0&&(!baseRows.includes(y)||!placed.some(i=>T[i][2]===0&&T[i][1]===y&&T[i][0]%2===x%2)))continue;
      if(placed.some(i=>T[i][2]===z&&M.overlap(T[i],p))||!M.supported(placed.map(i=>T[i]),p))continue;
      if([...core].some(i=>(z>T[i][2]&&M.overlap(T[i],p))||(ice.has(i)&&T[i][2]===z&&Math.abs(T[i][0]-x)<=2&&Math.abs(T[i][1]-y)<=2)))continue;
      const mirror=placed.some(i=>T[i][0]===l+r-x&&T[i][1]===y&&T[i][2]===z),noise=((x*37+y*19+seed*13)%23)/23;
      const score=z*300+Math.abs(x-mx)*2+Math.abs(y-my)*(seed%3===0?2:.8)-(mirror?12:0)+noise*(seed%4);
      if(!best||score<best.score)best={p,score};
    }
    if(!best)return null;T[id]=best.p;placed.push(id);
  }
  if(!G.valid(T)||!F.measure(T,{minimum:58}).ok||!linksSame(before,T,core))return null;
  return T;
}
function improve(row,user,ms=45000){
  const start=Date.now(),before=P.original(row.level),core=coreOf(before),raw=[],seen=new Set();
  const add=(positions,method,problem=[])=>{if(!positions||positions.some(p=>!p))return;const key=JSON.stringify(positions);if(seen.has(key))return;seen.add(key);
    const towers=positions.filter((p,i)=>!core.has(i)&&p[2]>2&&p[2]>before.design.tiles[i][2]).length,score=towers*1000+symmetry(positions)*2+positions.reduce((n,p,i)=>n+Math.max(0,p[2]-before.design.tiles[i][2]),0)*5;
    if(towers)return;raw.push({positions,method,problem,score});};
  // This search revises base-board proposals. Released-board edits may use
  // different pictures; their own source is handled by the interactive checker.
  if(user?.designSource!=='released'&&user?.positions.every(Boolean))add(user.positions,'Your layout, checked again',row.problem);
  const seeds=[];
  const addFoundation=(tiles,method)=>{const f=foundation(before,tiles,core);if(f)seeds.push({...f,method});};
  if(user){const repair=copy(user.positions);for(const i of core)repair[i]=before.design.tiles[i].slice();addFoundation(repair,'Keep your outline; restore the trap as one unit');}
  const current=copy(row.base.tiles);for(const i of row.problem)current[i]=null;addFoundation(current,'Fill the middle with ordinary displaced tiles');
  const orig=before.design.tiles,xs=[...new Set(orig.map(t=>t[0]))],ys=[...new Set(orig.map(t=>t[1]))];
  for(const width of [10,11])for(let left=0;left<=2;left++)for(const upper of Math.max(...ys)>14?[0,1,2]:[0]){const tiles=orig.map(t=>t[0]<left||t[0]>left+width||t[1]<upper||t[1]>upper+14?null:t.slice());addFoundation(tiles,'Keep the trap; move ordinary outer tiles into the middle');}
  for(const axis of [0,1])for(const cut of axis?ys:xs)for(const amount of [1,2])addFoundation(orig.map(t=>t.map((v,k)=>k===axis&&v>=cut?v-amount:v)),'Narrow a seam without removing trap tiles');
  for(const left of [1,3,5])for(const right of [7,9,11])if(left<right)for(const amount of [1,2])addFoundation(orig.map(([x,y,z])=>[x<=left?x+amount:x>=right?x-amount:x,y,z]),'Bring both outer arms inward; fill the middle evenly');
  seeds.sort((a,b)=>a.score-b.score);
  for(const f of seeds.slice(0,14))for(let seed=0;seed<12;seed++){if(Date.now()-start>ms*.55)break;add(pack(before,f,core,seed),f.method,f.parked);}
  raw.sort((a,b)=>a.score-b.score);
  // The two layouts Dennis already checked and liked retain priority.
  if([254,257].includes(row.level)&&user?.positions.every(Boolean)){const i=raw.findIndex(r=>same(r.positions,user.positions));if(i>=0)raw.unshift(raw.splice(i,1)[0]);}
  const failures={};let tried=0;
  for(const q of raw){if(Date.now()-start>ms)break;if(tried>=10)break;const d={...copy(row.base),tiles:q.positions};if(!E.replay(d,d.solution,{strict:true}).ok&&tried>=4)continue;tried++;
    let result;try{result=C.check(row,{...M.initial(row),positions:q.positions});}catch(e){result={status:'unknown',errors:[e.message]};}if(result.ok)return {level:row.level,positions:q.positions,problem:q.problem,status:'passed',method:q.method,message:'Improved from your notes: no added towers, with the trap and complete finish checked.',check:result,note:user?.note||'',tried,ms:Date.now()-start};
    const error=result.errors?.join(',')||result.status;failures[error]=(failures[error]||0)+1;
  }
  // Do not hand Dennis an already-broken obstacle cluster to repair.
  const fallback=seeds.find(f=>f.parked.length),positions=fallback?fallback.tiles.map((p,i)=>fallback.parked.includes(i)?null:p):copy(before.design.tiles);
  return {level:row.level,positions,problem:fallback?.parked||[],status:'needs placement',method:fallback?.method||'Released layout retained',message:fallback?'Kept the trap tiles together. Only ordinary tiles remain at the side; a complete compact finish is not yet proved.':'Kept the released trap intact. A tidy compact version is not proved; the released layout is now editable.',note:user?.note||'',tried,failures,ms:Date.now()-start};
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(improve(workerData.row,workerData.user,workerData.ms));}catch(e){parentPort.postMessage({level:workerData.row.level,error:e.stack});}}
async function run(){
  fs.mkdirSync(OUT,{recursive:true});const dataset=JSON.parse(fs.readFileSync(path.join(B.OUT,'placement-data.json'))),input={at:new Date().toISOString(),users:{}};
  for(const row of dataset.levels){const f=path.join(B.DATA,'level-'+row.level+'.json');if(fs.existsSync(f))input.users[row.level]=JSON.parse(fs.readFileSync(f));}
  fs.writeFileSync(path.join(OUT,'input-notes.json'),JSON.stringify(input,null,2));const levels=process.argv.includes('--noted')?dataset.levels.filter(r=>input.users[r.level]?.note):dataset.levels;let next=0;
  await Promise.all(Array.from({length:4},async()=>{while(next<levels.length){const row=levels[next++],result=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:{row,user:input.users[row.level],ms:45000}});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>end({level:row.level,error:'Bounded search stopped; existing drafts unchanged'}),75000);w.on('message',end);w.on('error',e=>end({level:row.level,error:e.message}));});result.baseHash=row.baseHash;fs.writeFileSync(path.join(OUT,'level-'+row.level+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({level:row.level,status:result.status,remaining:result.positions?.filter(p=>!p).length,method:result.method,ms:result.ms,error:result.error}));}}));
}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={improve,foundation,pack,OUT};
