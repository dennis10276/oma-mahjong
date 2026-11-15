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
  // Claude 2026-11-15, the same idea for every board: only the BASE layer is too wide (or too long) when the layers above already fit
  // inside it by half a tile. Each base line keeps its order and moves onto the half-offset grid one half tile inward; a line that has
  // seven tiles gives up one ordinary tile (the packer puts it low elsewhere). Upper layers do not move. Nine-row piles get the same
  // along the columns. Tiles of the trap may slide by half a tile; the full check decides.
  {
    const shortenAxis=(T0,ax,limit)=>{
      const live=T0.filter(Boolean),lo=Math.min(...live.map(p=>p[ax])),hi=Math.max(...live.map(p=>p[ax]));
      if(hi-lo<=10)return [{T:T0,removed:[]}];
      if(T0.some(p=>p&&p[2]>0&&(p[ax]<lo+1||p[ax]>hi-1)))return [];
      const slots=[];for(let v=lo+1;v<=hi-1;v+=2)slots.push(v);
      const lines=new Map();T0.forEach((p,i)=>{if(p&&p[2]===0){const k=p[1-ax];if(!lines.has(k))lines.set(k,[]);lines.get(k).push(i);}});
      const perLine=[];
      for(const ids of lines.values()){
        ids.sort((i,j)=>T0[i][ax]-T0[j][ax]);
        const ups=(i,v)=>{const p=T0[i];return T0.map((q,j)=>q&&q[2]===1&&base.M.has(j)&&Math.abs((ax?q[1]:q[0])-v)<2&&Math.abs((ax?q[0]:q[1])-p[1-ax])<2?j:-1).filter(j=>j>=0).join(',');};
        const cost=(i,v)=>Math.abs(T0[i][ax]-v)+(base.M.has(i)&&ups(i,v)!==ups(i,T0[i][ax])?1000:0);
        const fit=kept=>{ // order-preserving assignment of kept tiles to slots, least total movement
          const n=kept.length,m=slots.length;if(n>m)return null;const INF=1e9,D=Array.from({length:n+1},()=>new Array(m+1).fill(INF));for(let j=0;j<=m;j++)D[0][j]=0;
          for(let i=1;i<=n;i++)for(let j=i;j<=m;j++)D[i][j]=Math.min(D[i][j-1],D[i-1][j-1]+cost(kept[i-1],slots[j-1]));
          if(D[n][m]>=1000)return null;const pos=new Map();let i=n,j=m;while(i>0){if(j>i&&D[i][j]===D[i][j-1])j--;else{pos.set(kept[i-1],slots[j-1]);i--;j--;}}return pos;
        };
        const opts=[];
        if(ids.length<=slots.length){const pos=fit(ids);if(pos)opts.push({omit:[],pos});}
        else{const centre=(lo+hi)/2;const cand=ids.filter(i=>!special.has(i)&&!base.M.has(i)).concat(ids.filter(i=>!special.has(i)&&base.M.has(i)));
          for(const o of cand.sort((i,j)=>(base.M.has(i)-base.M.has(j))||Math.abs(T0[i][ax]-centre)-Math.abs(T0[j][ax]-centre))){const kept=ids.filter(i=>i!==o),pos=fit(kept);if(pos)opts.push({omit:[o],pos});}}
        if(!opts.length)return [];perLine.push(opts);
      }
      const out=[],seenKey=new Set();
      for(let k=0;k<limit;k++){const T=copy(T0),removed=[];
        perLine.forEach((opts,li)=>{const o=opts[k===0?0:(k<opts.length&&k<4?k:Math.floor(rng(k*7919+li*31)()*opts.length))%opts.length];for(const [id,v] of o.pos)T[id]=T[id].slice(),T[id][ax]=v;removed.push(...o.omit);});
        const key=JSON.stringify(T);if(seenKey.has(key))continue;seenKey.add(key);out.push({T,removed});}
      return out;
    };
    for(const x of shortenAxis(copy(a.tiles),0,24))for(const y of shortenAxis(x.T,1,6))add(y.T,x.removed.concat(y.removed),'Pull the base layer in by half a tile; upper layers stay');
  }
  // Claude 2026-11-15: peel one outer side. Every tile within the outermost tile of that side (all layers) goes, when none of them
  // belongs to the trap; the packer puts them low inside the narrower outline. For nine-row piles the top or bottom is peeled too.
  {
    const live=a.tiles,X=live.map(p=>p[0]),Y=live.map(p=>p[1]),x0=Math.min(...X),x1=Math.max(...X),y0=Math.min(...Y),y1=Math.max(...Y);
    const wide=x1-x0>10,tall=y1-y0>14,sides=[];
    const band=(f)=>live.map((p,i)=>f(p)?i:-1).filter(i=>i>=0);
    const H=wide?[band(p=>p[0]<=x0+1),band(p=>p[0]>=x1-1)]:[[]],V=tall?[band(p=>p[1]<=y0+1),band(p=>p[1]>=y1-1)]:[[]];
    for(const h of H)for(const v of V){const ids=[...new Set(h.concat(v))];if(!ids.length||ids.some(i=>base.M.has(i)||special.has(i)))continue;add(a.tiles,ids,'Peel one outer side; its tiles go low inside the outline');}
  }
  // Claude 2026-11-15 (Dennis: "for the trap that touches every edge try moving the trap in a smart way without changing it"): the whole
  // trap moves as one rigid piece, together with everything that holds it up, by up to one tile in each direction; the finish tiles that
  // are then in its way, or outside a 6.5 x 8 window around it, go low into the free places (the packer below), so nothing inside the
  // trap changes its relations.
  {
    const inTrap=new Set(base.M),T0=a.tiles;
    // what holds the trap up, layer by layer, joins it
    for(let ch=true;ch;){ch=false;for(const i of [...inTrap])if(T0[i][2]>0)for(let j=0;j<T0.length;j++)if(!inTrap.has(j)&&T0[j][2]===T0[i][2]-1&&Math.abs(T0[j][0]-T0[i][0])<2&&Math.abs(T0[j][1]-T0[i][1])<2){inTrap.add(j);ch=true;}}
    const kx=[...inTrap].map(i=>T0[i][0]),ky=[...inTrap].map(i=>T0[i][1]),kw=Math.max(...kx)-Math.min(...kx)+2,kh=Math.max(...ky)-Math.min(...ky)+2;
    if(kw<=13&&kh<=16){
      const X=T0.map(p=>p[0]),Y=T0.map(p=>p[1]),x0=Math.min(...X),x1=Math.max(...X),y0=Math.min(...Y),y1=Math.max(...Y),rowsCap=(y1-y0+2>16||!F.measure(a,{minimum:58}).ok)?14:16;
      for(const dx of [0,1,-1,2,-2])for(const dy of [0,1,-1,2,-2]){
        const T=T0.map(p=>p.slice());for(const i of inTrap){T[i][0]+=dx;T[i][1]+=dy;}
        const kx0=Math.min(...[...inTrap].map(i=>T[i][0])),ky0=Math.min(...[...inTrap].map(i=>T[i][1]));
        // the window: 13 x rowsCap units around the trap, as central in the old outline as it allows
        for(const wx of [Math.max(x0,Math.min(kx0,x1-11)),kx0-(13-kw),Math.round((x0+x1-11)/2)])for(const wy of [Math.max(y0,Math.min(ky0,y1-rowsCap+2)),ky0-(rowsCap-kh),Math.round((y0+y1-rowsCap+2)/2)]){
          if([...inTrap].some(i=>T[i][0]<wx||T[i][0]>wx+11||T[i][1]<wy||T[i][1]>wy+rowsCap-2))continue;
          const out=[];for(let i=0;i<T.length;i++){if(inTrap.has(i))continue;const p=T[i];if(p[0]<wx||p[0]>wx+11||p[1]<wy||p[1]>wy+rowsCap-2||[...inTrap].some(j=>T[j][2]===p[2]&&M.overlap(T[j],p)))out.push(i);}
          if(out.some(i=>special.has(i)))continue;
          add(T,out,'Move the whole trap as one piece; finish tiles go low around it');
        }
      }
    }
  }
  seeds.sort((u,v)=>u.moving.length-v.moving.length);
  const oldBadges=SR.measure(a).rows.filter(q=>q.clear),oldTwins=SEP.closeTwins(a),oldVisible=new Set(oldTwins.closeVisible.map(q=>q.slice(0,2).join(',')));
  function partialOK(T){const d={...a,tiles:T.map((p,i)=>p||[50+i*3,50,0])},g=E.game(d,{strict:true,reserveCuts:false}),links=P.relations(g,core);
    for(let i=0;i<oldLinks.length;i++)if(T[oldLinks[i][0]]&&T[oldLinks[i][1]]&&!same(oldLinks[i],links[i]))return false;
    let s=E.start(g);for(const id of prefix){try{s=E.step(g,s,id);}catch{return false;}if(!s)return false;}return true;
  }
  const why={};
  function pack(seed,attempt){const T=copy(seed.tiles),random=rng(row.level*7919+attempt*104729),live=T.filter(Boolean),left=Math.min(...live.map(t=>t[0])),right=Math.max(...live.map(t=>t[0])),top=Math.min(...live.map(t=>t[1])),bottom=Math.max(...live.map(t=>t[1])),cx=(left+right)/2,cy=(top+bottom)/2;
    if(!partialOK(T)){why.startBroken=(why.startBroken||0)+1;return null;}
    const order=seed.moving.slice().sort((i,j)=>(rank.get(i)??1e3)-(rank.get(j)??1e3)||((i*37+attempt*13)%97)-((j*37+attempt*13)%97));
    for(const id of order){const options=[];for(let z=0;z<=2;z++)for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const p=[x,y,z],others=T.filter(Boolean);if(others.some(q=>q[2]===z&&M.overlap(q,p))||!M.supported(others,p))continue;
      const mirror=others.some(q=>q[0]===left+right-x&&q[1]===y&&q[2]===z),sameRow=others.some(q=>q[2]===z&&q[1]===y&&Math.abs(q[0]-x)===2),score=z*120+(mirror?-20:0)+(sameRow?-5:0)+Math.abs(y-cy)*.8+Math.abs(x-cx)+random()*(attempt%4===0?80:35);
      options.push({p,score});}
      options.sort((u,v)=>u.score-v.score);let found=false;for(const q of options.slice(0,50)){T[id]=q.p;if(partialOK(T)){found=true;break;}}if(!found){why.noSpot=(why.noSpot||0)+1;return null;}
    }
    if(!G.valid(T)){why.invalid=(why.invalid||0)+1;return null;}if(!F.measure(T,{minimum:58}).ok){why.small=(why.small||0)+1;return null;}
    // Dennis 2026-11-15: at most 6.5 tiles wide ("6.5 is okay cause we get 58.x px")
    {const xs=T.map(p=>p[0]);if(Math.max(...xs)-Math.min(...xs)+2>13){why.wide=(why.wide||0)+1;return null;}}
    const d={...a,tiles:T},twins=SEP.closeTwins(d);if(twins.visible>oldTwins.visible||twins.closeVisible.some(q=>!oldVisible.has(q.slice(0,2).join(',')))){why.twins=(why.twins||0)+1;return null;}
    const badges=SR.measure(d);if(oldBadges.some(r=>!badges.rows.some(q=>q.tile===r.tile&&q.kind===r.kind&&q.clear))){why.badge=(why.badge||0)+1;return null;}
    return T;
  }
  for(let attempt=0;attempt<150&&Date.now()-start<ms;attempt++)for(const seed of seeds){if(Date.now()-start>=ms)break;const T=pack(seed,attempt);constructed++;if(T){const result=full(T,seed.method);if(result)return result;}}
  return {level:row.level,baseHash:row.baseHash,status:'open',note:user?.note||'',seeds:seeds.length,tested,constructed,failures,packRejects:why,ms:Date.now()-start};
}
if(!isMainThread&&require.main===module){try{parentPort.postMessage(complete(workerData.row,workerData.user,workerData.ms));}catch(e){parentPort.postMessage({level:workerData.row.level,status:'error',error:e.stack});}}
async function run(){const dataset=JSON.parse(fs.readFileSync(path.join(B.OUT,'placement-data.json'))),input=JSON.parse(fs.readFileSync(path.join(OUT,'input-notes.json'))),arg=process.argv.indexOf('--levels'),selected=arg>=0?process.argv[arg+1].split(',').map(Number):Object.keys(input.users).map(Number),levels=dataset.levels.filter(r=>selected.includes(r.level));let next=0;const W=+(process.argv[process.argv.indexOf('--workers')+1]||4),MS=+(process.argv.indexOf('--ms')>=0?process.argv[process.argv.indexOf('--ms')+1]:240000);await Promise.all(Array.from({length:process.argv.includes('--workers')?W:4},async()=>{while(next<levels.length){const row=levels[next++],r=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:{row,user:input.users[row.level],ms:process.argv.includes('--ms')?MS:240000}});let done=false;const end=x=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(x);};const timer=setTimeout(()=>end({level:row.level,status:'timeout'}),(process.argv.includes('--ms')?MS:240000)+60000);w.on('message',end);w.on('error',e=>end({level:row.level,status:'error',error:e.stack}));});fs.writeFileSync(path.join(OUT,'level-'+row.level+'.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({level:r.level,status:r.status,method:r.method,tested:r.tested,constructed:r.constructed,seeds:r.seeds,failures:r.failures,ms:r.ms,error:r.error}));}}));}
if(isMainThread&&require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports={complete,OUT};
