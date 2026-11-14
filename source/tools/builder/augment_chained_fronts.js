'use strict';
// Find a second, already present lonely-neighbour choice on another frozen
// front. Pictures and geometry are unchanged; every added bait is engine-priced.
function augment(input){
  const M=require('./trap_mixes.js'),E=require('./engine.js'),B=require('./builder.js'),V=require('./verify_chained_mixes.js');
  const r=M.clone(input),d=r.design,c=B.context(d.tiles),g=E.game(d),free=E.legal(g,E.start(g)).filter(Number.isInteger),roles={...r.roles,locks:new Set(r.roles.locks),holderSpecials:new Set(r.roles.holderSpecials)};
  const vis=require('../sim/refit/human_board_visibility.js').tileVisibility(g.tiles,{...E.start(g),down:g.down,openPeek:-1},null).tiles;
  const fronts=[],special=new Set([d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)]),k=r.card.clock.fewestMoves,spare=r.card.clock.spare;
  for(const host of Object.keys(d.obst.ice).map(Number)){
    for(const lone of g.iceNb[host]){
      if(!free.includes(lone)||g.down[lone]||special.has(lone))continue;
      const twins=d.faces.map((f,i)=>f===d.faces[lone]?i:-1).filter(i=>i>=0);if(twins.length!==2)continue;
      const twin=twins.find(i=>i!==lone);if(g.down[twin]||c.above[twin].size<2||!vis[twin].picture)continue;
      let p=r.card.trap.baits.find(p=>p.tiles.length===1&&p.tiles[0]===lone);
      if(!p)p=M.price(d,[lone],k,{nodes:180000,wallMs:3000});
      if(!p?.exact||!(p.result==='lose'||p.cost>spare))continue;
      if(!roles.bait.wrong.includes(lone)){roles.bait.wrong.push(lone);roles.bait.twins.push(twin);roles.bait.pairs.push([lone,twin]);roles.bait.tiles.push(lone,twin);roles.bait.keepUp.push(lone,twin);}
      fronts.push({host,lone,twin});break;
    }
  }
  if(fronts.length<2)return input;
  const p=M.prove(r.card.trap.type,d,roles,{k,spare,obviousnessDial:r.brief.obviousnessDial});if(!p.ok)return input;
  r.card.trap={...p.card,twoFronts:fronts,see:p.card.see+' Each of two frozen fronts has its own proven lonely-neighbour bait.'};
  r.roles={...roles,locks:[...roles.locks],holderSpecials:[...roles.holderSpecials]};r.notes.push({stage:'twoFrozenFronts',fronts});
  const v=V.verify(r);if(!v.ok)return input;r.verification=v;return r;
}
module.exports={augment};
if(require.main===module){
  const fs=require('fs'),path=require('path'),{job,OUT}=require('./run_chained_mixes.js');
  (async()=>{const dir=path.join(OUT,'examples');for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
    const full=path.join(dir,file),x=await job({mode:'fronts',file:full,wallMs:90000});if(!x.design)continue;
    if(x.card.trap.twoFronts){fs.writeFileSync(full,JSON.stringify(x,null,2)+'\n');console.log(JSON.stringify({file,fronts:x.card.trap.twoFronts}));}
  }})();
}
