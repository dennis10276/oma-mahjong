'use strict';
const E=require('./engine.js'),B=require('./builder.js');
// Geometry/role evidence for the permitted medium second trap. The actual
// losing prices are proved separately; these facts establish its two links.
function mediumEvidence(d,roles,baits){
  const c=B.context(d.tiles),g=E.game(d),out=[];
  for(const p of baits){
    if(p.tiles.length===1){
      const i=p.tiles[0],wi=(roles.bait.wrong||[]).indexOf(i),twin=roles.bait.twins?.[wi];
      const hosts=Object.keys(d.obst.ice).map(Number).filter(h=>g.iceNb[h].includes(i));
      if(wi>=0&&twin!=null&&hosts.length&&d.faces[i]===d.faces[twin]&&c.above[twin].size>=2)out.push({bait:p.tiles,kind:'lonelyThaw',links:2,thawHosts:hosts,twin,twinCovers:[...c.above[twin]]});
      else if(d.obst.keys.includes(i)){
        const far=d.obst.keys.find(k=>k!==i);if(far!=null&&(d.obst.ice[far]||c.above[far].size))out.push({bait:p.tiles,kind:'earlyKey',links:2,partner:far,partnerCovers:[...c.above[far]],opens:d.obst.locks});
      }else if(i===d.clock.i&&roles.bait.mix.mode==='earlyClock'){
        const twin=roles.bait.mix.originalClock;if(d.faces[i]===d.faces[twin]&&(d.obst.ice[twin]||d.obst.locks.includes(twin)||c.above[twin].size))out.push({bait:p.tiles,kind:'waitingClock',links:2,twin,twinCovers:[...c.above[twin]]});
      }
    }else if(p.tiles.length===2&&roles.bait.repeat&&p.tiles.some(i=>d.obst.keys.includes(i))&&p.tiles.some(i=>!d.obst.keys.includes(i)))out.push({bait:p.tiles,kind:'ordinaryKeyLookalike',links:2,realKeys:d.obst.keys,opens:d.obst.locks});
  }
  return out;
}
module.exports={mediumEvidence};
