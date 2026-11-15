'use strict';
// Tidy geometry proposals for Task 19. No random offsets or free repacking:
// complete stacks/outer strips move together, by one or half a tile, along one
// chosen edge. Every proposal must still pass narrow_proof independently.
const N=require('./narrow'),F=require('../footprint');
const clone=x=>JSON.parse(JSON.stringify(x)),over=(p,q)=>Math.abs(p[0]-q[0])<2&&Math.abs(p[1]-q[1])<2;
function bounds(ts){return [Math.min(...ts.map(t=>t[0])),Math.max(...ts.map(t=>t[0])),Math.min(...ts.map(t=>t[1])),Math.max(...ts.map(t=>t[1]))];}
function supported(T){for(let i=0;i<T.length;i++){const [x,y,z]=T[i];if(z===0)continue;for(const a of [x,x+1])for(const b of [y,y+1])if(!T.some((p,j)=>j!==i&&p[2]===z-1&&p[0]<=a&&p[0]+2>a&&p[1]<=b&&p[1]+2>b))return false;}return true;}
function valid(T){if(T.some(t=>t.some(x=>!Number.isInteger(x))||t[2]<0||t[2]>7))return false;for(let i=0;i<T.length;i++)for(let j=0;j<i;j++)if(T[i][2]===T[j][2]&&over(T[i],T[j]))return false;return supported(T);}
function normalize(T){const b=bounds(T);return T.map(([x,y,z])=>[x-b[0],y-b[2],z]);}
// Lift each whole edge stack onto the same inside offset. Half-offsets are only
// proposed when already used in this layout. Complete columns move by a single
// amount, including their staggered upper stacks.
function edge(a,axis,side,amount,width=2,shiftOther=0){
  const T=a.tiles.map(t=>t.slice()),v=T.map(t=>t[axis]),lo=Math.min(...v),hi=Math.max(...v);
  const ids=T.map((_,i)=>i).filter(i=>side>0?T[i][axis]>hi-width:T[i][axis]<lo+width);
  if(!ids.length)return {why:'emptyStrip'};
  const groups=new Map();for(const i of ids){const key=T[i].slice(0,2).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
  const selected=new Set(ids),placed=T.map((_,i)=>i).filter(i=>!selected.has(i));
  // Innermost first; every whole stack retains its internal layer spacing.
  const gs=[...groups.values()].sort((p,q)=>side*(T[p[0]][axis]-T[q[0]][axis]));
  for(const group of gs){
    const p=T[group[0]].slice();p[axis]-=side*amount;p[1-axis]+=shiftOther;
    const minZ=Math.min(...group.map(i=>T[i][2]));
    let floor=0;for(const j of placed)if(over(T[j],p))floor=Math.max(floor,T[j][2]+1);
    const dz=Math.max(0,floor-minZ);
    for(const i of group){T[i][axis]-=side*amount;T[i][1-axis]+=shiftOther;T[i][2]+=dz;placed.push(i);}
  }
  const tiles=normalize(T);if(!valid(tiles))return {why:'unsupportedOrCollision'};
  return {tiles,moved:ids};
}
function slab(a,axis,side,amount,width,raise,shiftOther=0){
  const T=a.tiles.map(t=>t.slice()),v=T.map(t=>t[axis]),lo=Math.min(...v),hi=Math.max(...v),moved=[];
  for(let i=0;i<T.length;i++)if(side>0?T[i][axis]>hi-width:T[i][axis]<lo+width){T[i][axis]-=side*amount;T[i][1-axis]+=shiftOther;T[i][2]+=raise;moved.push(i);}
  const tiles=normalize(T);if(!valid(tiles))return {why:'unsupportedOrCollision'};
  return {tiles,moved};
}
// Slide an outer portion of the pile inward as a rigid block. This permits a
// special on the edge to move with its covers/thaw neighbours, provided the
// exact trap relation checks later establish that the seam is harmless.
function rigid(a,axis,side,amount,cut){
  const T=a.tiles.map(t=>t.slice()),moved=[];
  for(let i=0;i<T.length;i++)if(side>0?T[i][axis]>=cut:T[i][axis]<=cut){T[i][axis]-=side*amount;moved.push(i);}
  const tiles=normalize(T);if(!valid(tiles))return {why:'unsupportedOrCollision'};
  return {tiles,moved};
}
function capVariants(before,prep){
  const a=before.design,M=N.trapSet(before,prep),b=bounds(a.tiles),out=[],why={};
  const cols=b[1]-b[0]>10?[...new Set(a.tiles.map(t=>t[0]))]:[null],rows=b[3]-b[2]>14?[...new Set(a.tiles.map(t=>t[1]))]:[null];
  const position=new Map(a.solution.map((t,i)=>[t,i]));
  const orders=[(i,j)=>position.get(i)-position.get(j),(i,j)=>position.get(j)-position.get(i),(i,j)=>a.tiles[j][2]-a.tiles[i][2]||j-i,(i,j)=>j-i];
  const halfX=a.tiles.some(t=>t[0]%2),halfY=a.tiles.some(t=>t[1]%2);
  for(const col of cols)for(const row of rows)for(const shiftX of col!=null&&halfX?[1,2]:[2])for(const shiftY of row!=null&&halfY?[1,2]:[2])for(let order=0;order<orders.length;order++){
    const ids=a.tiles.map((_,i)=>i).sort(orders[order]),index=new Map(ids.map((id,i)=>[id,i]));
    // narrow.squeeze closes by two coordinate units. Open the chosen seam by
    // one first to close it by only a half tile instead; both resulting halves
    // remain on this layout's already-used integer/half-offset grid.
    const input=ids.map(i=>a.tiles[i].map((v,k)=>v+(k===0&&col!=null&&v>col?2-shiftX:k===1&&row!=null&&v>row?2-shiftY:0)));
    const q=N.squeeze({tiles:input},new Set([...M].map(i=>index.get(i))),col,row);
    if(!q.tiles){why[q.why]=(why[q.why]||0)+1;continue;}
    const tiles=[];q.tiles.forEach((t,i)=>tiles[ids[i]]=t);
    out.push({tiles,moved:q.moved.map(i=>ids[i]),method:`column/row out; ${shiftX===1?'half-width seam; ':''}${shiftY===1?'half-height seam; ':''}cap order ${order+1}`,column:col,row});
  }
  return {out,why};
}
function capSites(before,prep,proposal){
  const a=before.design,M=N.trapSet(before,prep),removed=proposal.moved,omit=new Set(removed),out=[];
  if(!removed.length)return out;
  const original=proposal.design?.tiles||proposal.tiles,b=bounds(original),targets=[[.25,.25],[.75,.25],[.25,.75],[.75,.75],[.5,.5]];
  for(const [fx,fy]of targets){
    const T=original.map((t,i)=>omit.has(i)?null:t.slice()),placed=T.map((t,i)=>t?i:null).filter(i=>i!=null),tx=b[0]+(b[1]-b[0])*fx,ty=b[2]+(b[3]-b[2])*fy;
    let failed=false;
    for(const i of removed){let best=null;
      for(const j of placed){const [x,y,z0]=T[j],z=z0+1,p=[x,y,z];if(z>6||placed.some(k=>T[k][2]===z&&over(T[k],p)))continue;
        if([...M].some(k=>T[k]&&((T[k][2]===z&&Math.abs(T[k][0]-x)<=2&&Math.abs(T[k][1]-y)<2)||(T[k][2]===z-1&&over(T[k],p)))))continue;
        const score=z*100+Math.abs(x-tx)*3+Math.abs(y-ty)*2;if(!best||score<best.score)best={score,p};
      }
      if(!best){failed=true;break;}T[i]=best.p;placed.push(i);
    }
    if(!failed&&valid(T))out.push({...proposal,design:undefined,tiles:T,method:(proposal.method||'column/row out')+`; straight cap near ${fx},${fy}`});
  }
  return out;
}
function candidates(before,prep){
  const a=before.design,initial=N.candidates(before,prep,58),out=[],why={...initial.why},seen=new Set();
  const add=q=>{const d={...(q.design||clone(a)),tiles:normalize(q.design?.tiles||q.tiles)},fit=F.measure(d,{minimum:58});if(!fit.ok){why.footprint=(why.footprint||0)+1;return;}
    if(!valid(d.tiles)){why.invalidGeometry=(why.invalidGeometry||0)+1;return;}
    const key=JSON.stringify(d.tiles);if(seen.has(key))return;seen.add(key);
    out.push({...q,design:d,footprint:fit,method:q.method||(q.hop?'hop '+q.hop:'column/row out'),movedCount:q.moved.length});};
  initial.out.forEach(add);
  const cap=capVariants(before,prep);cap.out.forEach(add);for(const[k,v]of Object.entries(cap.why))why['cap:'+k]=(why['cap:'+k]||0)+v;
  for(const p of [...initial.out,...cap.out])for(const q of capSites(before,prep,p))add(q);
  const b=bounds(a.tiles),fp=F.measure(a,{minimum:58}),needX=b[1]-b[0]>10||(!fp.ok&&fp.limit==='width'),needY=b[3]-b[2]>14||(!fp.ok&&fp.limit==='height');
  const ops=[];
  for(const axis of [0,1]){
    if((axis===0&&!needX)||(axis===1&&!needY))continue;
    const half=a.tiles.some(t=>t[axis]%2),lo=b[axis*2],hi=b[axis*2+1];
    const otherHalf=a.tiles.some(t=>t[1-axis]%2);
    for(const side of [-1,1])for(const amount of half?[1,2,3,4]:[2,4])for(const width of [1,2])for(const shiftOther of otherHalf?[-1,0,1]:[0])ops.push({axis,side,amount,width,shiftOther});
    for(const side of [-1,1])for(const amount of half?[1,2,3,4]:[2,4])for(const width of [1,2,3,4,5,6])for(let raise=0;raise<=4;raise++){
      const q=slab(a,axis,side,amount,width,raise);if(q.tiles)ops.push({axis,side,amount,width,raise,slab:true});else why['slab:'+q.why]=(why['slab:'+q.why]||0)+1;
    }
    // Rigid compression has one seam for the whole board; never per-row jitter.
    for(const side of [-1,1])for(const amount of half?[1,2]:[2])for(let cut=lo;cut<=hi;cut++){
      const q=rigid(a,axis,side,amount,cut);if(q.tiles)ops.push({axis,side,amount,cut,rigid:true});else why['rigid:'+q.why]=(why['rigid:'+q.why]||0)+1;
    }
  }
  const apply=(d,op)=>op.rigid?rigid(d,op.axis,op.side,op.amount,op.cut):op.slab?slab(d,op.axis,op.side,op.amount,op.width,op.raise,op.shiftOther):edge(d,op.axis,op.side,op.amount,op.width,op.shiftOther);
  const name=o=>`${o.rigid?'rigid strip':o.slab?'rigid lifted strip':'stack hop'} ${o.axis?'row':'column'} ${o.side>0?'far':'near'} ${o.amount/2} tile${o.rigid?' at '+o.cut:''}${o.shiftOther?' cross offset '+o.shiftOther/2:''}`;
  for(const op of ops){const q=apply(a,op);if(q.tiles)add({...q,method:name(op),operations:[op]});else why['edge:'+q.why]=(why['edge:'+q.why]||0)+1;}
  // Both axes on nine-row seven-wide piles. Try row then column and reverse,
  // since the supporting stack can differ. Every move remains a whole strip.
  if(needX&&needY)for(const p of ops.filter(o=>!o.rigid&&!o.slab))for(const q of ops.filter(o=>!o.rigid&&!o.slab&&o.axis!==p.axis)){
    const first=apply(a,p);if(!first.tiles)continue;const second=apply({tiles:first.tiles},q);if(!second.tiles)continue;
    add({...second,moved:[...new Set([...first.moved,...second.moved])],method:name(p)+'; '+name(q),operations:[p,q]});
  }
  out.sort((a,b)=>a.movedCount-b.movedCount||b.footprint.tilePx-a.footprint.tilePx);
  return {out,why,M:initial.M};
}
module.exports={candidates,edge,rigid,slab,valid,supported,bounds};
