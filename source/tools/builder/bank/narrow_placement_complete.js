'use strict';
// Complete Dennis's suggested silhouettes. Rebuild broad supporting rows before
// moving upper clock machinery; choose ordinary filler and place it low. Every
// finished board gets a fresh full behavioural certificate with unchanged faces.
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const B=require('./narrow_placement_build'),P=require('./narrow_proof'),M=require('./narrow_placement_model'),C=require('./narrow_placement_check'),E=require('../engine'),G=require('./narrow_methods'),F=require('../footprint'),SEP=require('./separate'),SR=require('../chained_special_readability');
const OUT=path.join(P.DIR,'placement-lab/completed'),copy=M.copy,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function complete(row,user,ms=240000){
  const start=Date.now(),before=P.original(row.level),base=P.prepare(before),a=before.design,prepared={before,base},core=[...base.M].sort((a,b)=>a-b),oldGame=E.game(a),oldLinks=P.relations(oldGame,core),prefix=a.solution.slice(0,a.solution.indexOf(a.clock.i)+1),rank=new Map(prefix.map((id,i)=>[id,i])),special=new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number)]),seeds=[],seen=new Set(),failures={};let tested=0,constructed=0;
  const full=(T,method)=>{const key=JSON.stringify(T);if(seen.has(key))return null;seen.add(key);if(!G.valid(T)||!F.measure(T,{minimum:58}).ok)return null;tested++;let result;try{result=C.check(row,{...M.initial(row),positions:T},{prepared,tailMs:2500});}catch(e){result={status:'unknown',errors:[e.message]};}if(result.ok)return {level:row.level,baseHash:row.baseHash,status:'passed',positions:T,problem:[],method,message:'Completed from your notes: low filler placement, unchanged pictures and a proved trap and full finish.',note:user?.note||'',check:result,tested,constructed,ms:Date.now()-start};const reason=result.errors?.join(',')||result.status;failures[reason]=(failures[reason]||0)+1;return null;};
  if(user?.positions.every(Boolean)&&user.designSource!=='released'){const result=full(copy(user.positions),'Your complete layout, independently checked');if(result)return result;}
  if(row.proposal?.status==='passed'){const result=full(copy(row.proposal.positions),'Previously checked low proposal');if(result)return result;}
  function add(T,ids,method){const tiles=copy(T),moving=[...new Set(ids)].filter(i=>!special.has(i));for(const id of moving)tiles[id]=null;
    // Only non-special tiles which lose support join the move. Never hand a
    // floating special to the packer and hope later filler happens to repair it.
    for(let changed=true;changed;){changed=false;for(let i=0;i<tiles.length;i++)if(tiles[i]&&!M.supported(tiles.filter((_,j)=>j!==i),tiles[i])){if(special.has(i))return;tiles[i]=null;moving.push(i);changed=true;}}
    const live=tiles.filter(Boolean);if(!live.length||!F.measure(live,{minimum:58}).ok)return;
    for(let i=0;i<tiles.length;i++)if(tiles[i])for(let j=0;j<i;j++)if(tiles[j]&&tiles[i][2]===tiles[j][2]&&M.overlap(tiles[i],tiles[j]))return;
    const key=JSON.stringify(tiles);if(seeds.some(s=>s.key===key))return;seeds.push({tiles,moving:[...new Set(moving)],method,key});
  }
  if(user){const ids=row.proposal?.problem||row.problem;add(user.positions,ids,'Keep your silhouette; choose low spaces away from the clock route');
    const restored=copy(user.positions);for(const id of core)restored[id]=a.tiles[id].slice();add(restored,ids,'Keep the ordinary outline; restore the clock machinery');
    const ordinaryMoves=a.tiles.flatMap((p,i)=>!special.has(i)&&!same(p,user.positions[i])?[i]:[]);
    if(ordinaryMoves.length<18){const fixed=copy(a.tiles);for(const i of special)fixed[i]=user.positions[i].slice();add(fixed,ordinaryMoves,'Keep original trap positions; relocate different ordinary finish tiles');}
  }
  for(const f of [path.join(P.DIR,'level-'+row.level+'.json'),path.join(P.DIR,'held','level-'+row.level+'.json')])if(fs.existsSync(f)){const q=JSON.parse(fs.readFileSync(f));add(q.design.tiles,q.relocated||q.moved||[],'Keep the narrow shape; spread the old caps into low gaps');}
  add(row.base.tiles,row.problem,'Complete the narrow skeleton with low filler');
  // Seven base tiles occupy fourteen half-grid units. Six symmetrically placed
  // bases support the same upper wing over twelve units. This avoids pulling
  // clock covers, keys or thaw neighbours out of an upper edge stack.
  const broad=[...new Set(a.tiles.filter(t=>t[2]===0).map(t=>t[1]))].map(y=>a.tiles.flatMap((p,i)=>p[2]===0&&p[1]===y?[i]:[]).sort((i,j)=>a.tiles[i][0]-a.tiles[j][0])).filter(ids=>ids.length===7&&a.tiles[ids[6]][0]-a.tiles[ids[0]][0]===12);
  if(broad.length&&broad.length<=3){const visit=(r,T,removed)=>{if(r===broad.length){add(T,removed,'Shorten the widest supporting rows; keep the upper trap intact');return;}const ids=broad[r];for(const omit of ids.filter(i=>!base.M.has(i))){const ts=copy(T),kept=ids.filter(i=>i!==omit),left=a.tiles[ids[0]][0]+1;kept.forEach((id,k)=>ts[id][0]=left+2*k);visit(r+1,ts,removed.concat(omit));}};visit(0,copy(a.tiles),[]);}
  seeds.sort((u,v)=>u.moving.length-v.moving.length);
  const oldBadges=SR.measure(a).rows.filter(q=>q.clear),oldTwins=SEP.closeTwins(a),oldVisible=new Set(oldTwins.closeVisible.map(q=>q.slice(0,2).join(',')));
  function partialOK(T){const d={...a,tiles:T.map((p,i)=>p||[50+i*3,50,0])},g=E.game(d,{strict:true,reserveCuts:false}),links=P.relations(g,core);
    for(let i=0;i<oldLinks.length;i++)if(T[oldLinks[i][0]]&&T[oldLinks[i][1]]&&!same(oldLinks[i],links[i]))return false;
    let s=E.start(g);for(const id of prefix){try{s=E.step(g,s,id);}catch{return false;}if(!s)return false;}return true;
  }
  function pack(seed,attempt){const T=copy(seed.tiles),random=rng(row.level*7919+attempt*104729),live=T.filter(Boolean),left=Math.min(...live.map(t=>t[0])),right=Math.max(...live.map(t=>t[0])),top=Math.min(...live.map(t=>t[1])),bottom=Math.max(...live.map(t=>t[1])),cx=(left+right)/2,cy=(top+bottom)/2;
    if(!partialOK(T))return null;
    const order=seed.moving.slice().sort((i,j)=>(rank.get(i)??1e3)-(rank.get(j)??1e3)||((i*37+attempt*13)%97)-((j*37+attempt*13)%97));
    for(const id of order){const options=[];for(let z=0;z<=2;z++)for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const p=[x,y,z],others=T.filter(Boolean);if(others.some(q=>q[2]===z&&M.overlap(q,p))||!M.supported(others,p))continue;
      const mirror=others.some(q=>q[0]===left+right-x&&q[1]===y&&q[2]===z),sameRow=others.some(q=>q[2]===z&&q[1]===y&&Math.abs(q[0]-x)===2),score=z*120+(mirror?-20:0)+(sameRow?-5:0)+Math.abs(y-cy)*.8+Math.abs(x-cx)+random()*(attempt%4===0?80:35);
      options.push({p,score});}
      options.sort((u,v)=>u.score-v.score);let found=false;for(const q of options.slice(0,50)){T[id]=q.p;if(partialOK(T)){found=true;break;}}if(!found)return null;
    }
    if(!G.valid(T)||!F.measure(T,{minimum:58}).ok)return null;const d={...a,tiles:T},twins=SEP.closeTwins(d);if(twins.visible>oldTwins.visible||twins.closeVisible.some(q=>!oldVisible.has(q.slice(0,2).join(','))))return null;
    const badges=SR.measure(d);if(oldBadges.some(r=>!badges.rows.some(q=>q.tile===r.tile&&q.kind===r.kind&&q.clear)))return null;
    return T;
  }
  for(let attempt=0;attempt<150&&Date.now()-start<ms;attempt++)for(const seed of seeds){if(Date.now()-start>=ms)break;const T=pack(seed,attempt);constructed++;if(T){const result=full(T,seed.method);if(result)return result;}}
  return {level:row.level,baseHash:row.baseHash,status:'open',note:user?.note||'',seeds:seeds.length,tested,constructed,failures,ms:Date.now()-start};
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(complete(workerData.row,workerData.user,workerData.ms));}catch(e){parentPort.postMessage({level:workerData.row.level,status:'error',error:e.stack});}}
async function run(){const dataset=JSON.parse(fs.readFileSync(path.join(B.OUT,'placement-data.json'))),input=JSON.parse(fs.readFileSync(path.join(OUT,'input-notes.json'))),arg=process.argv.indexOf('--levels'),selected=arg>=0?process.argv[arg+1].split(',').map(Number):Object.keys(input.users).map(Number),levels=dataset.levels.filter(r=>selected.includes(r.level));let next=0;const W=+(process.argv[process.argv.indexOf('--workers')+1]||4),MS=+(process.argv.indexOf('--ms')>=0?process.argv[process.argv.indexOf('--ms')+1]:240000);await Promise.all(Array.from({length:process.argv.includes('--workers')?W:4},async()=>{while(next<levels.length){const row=levels[next++],r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:{row,user:input.users[row.level],ms:process.argv.includes('--ms')?MS:240000}});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>end({level:row.level,status:'timeout'}),(process.argv.includes('--ms')?MS:240000)+60000);w.on('message',end);w.on('error',e=>end({level:row.level,status:'error',error:e.stack}));});fs.writeFileSync(path.join(OUT,'level-'+row.level+'.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({level:r.level,status:r.status,method:r.method,tested:r.tested,constructed:r.constructed,seeds:r.seeds,failures:r.failures,ms:r.ms,error:r.error}));}}));}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={complete,OUT};
