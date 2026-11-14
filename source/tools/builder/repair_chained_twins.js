'use strict';
// Last-twin repair may change the strict winning order, rather than requiring
// the old order to survive every picture swap. The full trap is re-proved after
// a new minimum and witness have been found. No shared builder file is edited.
const E=require('./engine.js'),S=require('./bank/separate.js');
function repair(d,roles,name,spare,opts={}){
  const M=require('./trap_mixes.js'),until=Date.now()+(opts.wallMs??25000),notes=[],protectedFaces=new Set([...roles.bait.tiles,...roles.keys,...(roles.bait.repeat?.copies||[]),...(roles.bait.mix.mode==='earlyClock'?[d.clock.i,roles.bait.mix.originalClock]:[])].map(i=>d.faces[i]));
  let cur=d,tested=0;
  for(let pass=0;pass<4&&Date.now()<until;pass++){
    const geo=S.geometry(cur),before=S.closeTwins(cur,geo);if(before.meets)break;
    const candidates=[];
    for(const [a,b]of before.closeVisible)for(const u of [a,b]){
      if(protectedFaces.has(cur.faces[u]))continue;
      for(let v=0;v<cur.tiles.length;v++){
        if(u===v||cur.faces[u]===cur.faces[v]||protectedFaces.has(cur.faces[v]))continue;
        const faces=cur.faces.slice();[faces[u],faces[v]]=[faces[v],faces[u]];
        const dd={...cur,faces},after=S.closeTwins(dd,geo);
        if(after.visible>=before.visible||after.four>before.four||after.share>.05)continue;
        candidates.push({d:dd,u,v,after,hidden:geo.vis[v]?1:0});
      }
    }
    candidates.sort((a,b)=>a.after.visible-b.after.visible||a.after.count-b.after.count||a.hidden-b.hidden);
    let kept=false;
    for(const cd of candidates.slice(0,100)){
      if(Date.now()>=until)break;tested++;
      const cs=M.shortest({...cd.d,clock:{...cd.d.clock,n:99}},{strict:true,nodes:120000,totalNodes:200000,ms:800});if(!cs)continue;
      const proposal={...cd.d,clock:{...cd.d.clock,n:cs.k+spare},solution:E.flatten(cs.path)};
      if(proposal.clock.n>19)continue;
      const rt=M.retime(proposal,spare,{nodes:120000,totalNodes:200000,ms:800});if(!rt.ok)continue;
      const p=M.prove(name,rt.design,roles,{k:rt.k,spare},{skipOpening:true,skipEffects:true,skipControl:true});if(!p.ok)continue;
      const full=M.prove(name,rt.design,roles,{k:rt.k,spare},{skipOpening:true});if(!full.ok)continue;
      cur=rt.design;notes.push({swap:[cd.u,cd.v],before:before.visible,after:cd.after.visible,k:rt.k});kept=true;break;
    }
    if(!kept){notes.push({pass,why:'noProvenRepair',candidates:candidates.length});break;}
  }
  return {design:cur,tested,notes,after:S.summary(S.closeTwins(cur))};
}
module.exports={repair};
