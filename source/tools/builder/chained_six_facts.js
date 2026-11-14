'use strict';
// Board-only TASK 18 evidence. Never imports construction or its proof.
const E=require('./engine.js'),B=require('./builder.js'),O=require('./chained_obviousness.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
function evidence(kind,d,q){
  const no=why=>({ok:false,why});if(!q||q.kind!==kind)return no('missingRecipe');
  const g=E.game(d),s=E.start(g),c=B.context(d.tiles),free=E.legal(g,s).filter(Number.isInteger),P=d.solution.slice(0,d.solution.indexOf(d.clock.i)+1);
  const vis=tileVisibility(g.tiles,{...s,down:g.down,openPeek:-1},null).tiles;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const take=kind==='savePair'?q.free:kind==='selfLocked'?[q.lone]:kind==='freeMelt'?q.outside:kind==='clockCount'?q.pair:kind==='keysLater'?q.keys:q.take;
  if(!same(q.take,take))return no('baitRecipeChanged');
  const required=kind==='savePair'?[...q.free,q.third,q.buried]:kind==='selfLocked'?[q.host,q.lone,q.twin]:kind==='freeMelt'?[q.host,...q.outside,...q.twins]:kind==='clockCount'?[q.host,q.alternative,q.roof,...q.pair]:kind==='keysLater'?[...q.keys,q.lock]:[...q.hosts,...q.right,...q.take,...q.twins];
  if(required.some(i=>!Number.isInteger(i)||!q.visible.includes(i)||d.down.includes(i)||!vis[i].role))return no('hiddenReason');
  if(q.take.some(i=>!free.includes(i)))return no('baitNotFree');
  const picture=i=>!d.down.includes(i)&&vis[i].picture;
  if(kind==='savePair'){
    const [a,b]=q.free,copies=[a,b,q.third,q.buried];
    if(new Set(copies).size!==4||copies.some(i=>d.faces[i]!==d.faces[a]||!picture(i))||d.faces.filter(f=>f===d.faces[a]).length!==4)return no('fourCopies');
    if(!free.includes(a)||!free.includes(b)||free.includes(q.third)||free.includes(q.buried)||!P.includes(q.third)||P.includes(q.buried)||c.above[q.buried].size<2)return no('thirdNotInDig');
    if(!q.free.some(i=>P.includes(i)&&Math.abs(P.indexOf(i)-P.indexOf(q.third))<=2))return no('copyNotSaved');
  }else if(kind==='selfLocked'){
    if(!d.obst.ice[q.host]||!g.iceNb[q.host].includes(q.lone)||!c.above[q.twin].has(q.host)||d.faces[q.lone]!==d.faces[q.twin]||!picture(q.twin)||!P.includes(q.host))return no('selfLock');
    if(P.includes(q.lone)&&P.indexOf(q.lone)<P.indexOf(q.host))return no('loneNotLast');
  }else if(kind==='freeMelt'){
    if(!d.obst.keys.includes(q.host)&&!Object.keys(d.obst.ice).some(h=>+h!==q.host&&g.iceNb[+h].includes(q.host)))return no('notKeyOrThawTile');
    if(!d.obst.ice[q.host]||!P.includes(q.host)||q.route.length<d.obst.ice[q.host]||q.route.some(i=>!g.iceNb[q.host].includes(i)||!P.includes(i)||P.indexOf(i)>P.indexOf(q.host)))return no('digDoesNotMelt');
    if(q.outside.some(i=>P.includes(i)||!g.iceNb[q.host].includes(i)))return no('outsideOnDig');
  }else if(kind==='clockCount'){
    if(!q.side.includes(q.parkSide)||!P.includes(q.parkSide)||c.above[q.host].has(q.parkSide)||P.some(i=>i!==q.parkSide&&d.faces[i]===d.faces[q.parkSide]))return no('sideNotParkedAlternative');
    if(!d.obst.ice[q.host]||!g.iceNb[q.host].includes(q.alternative)||!c.above[q.alternative].has(q.roof)||P.includes(q.roof)||d.faces[q.pair[0]]!==d.faces[q.pair[1]]||q.side.some(i=>!P.includes(i)||!g.iceNb[q.host].includes(i)))return no('twoApproaches');
  }else if(kind==='keysLater'){
    if(!d.obst.locks.includes(q.lock)||q.keys.some(i=>!d.obst.keys.includes(i)||!free.includes(i)||P.includes(i))||P.includes(q.lock)||d.faces[q.keys[0]]!==d.faces[q.keys[1]])return no('keysOnClockRoute');
  }else if(kind==='doubleMelt'){
    if(q.hosts.length!==2||q.hosts.some((h,k)=>!d.obst.ice[h]||!g.iceNb[h].includes(q.right[k])||!g.iceNb[h].includes(q.take[k]))||q.right.some(i=>!free.includes(i)||!P.includes(i))||d.faces[q.right[0]]!==d.faces[q.right[1]])return no('sharedPair');
  }else return no('unknownKind');
  return {ok:true,evidence:structuredClone(q)};
}
function audit(r,opts={}){
  const errors=[];
  const links=r.roles.bait.sixLinks||[r.roles.bait.six],expected=require('./chained_shapes.js').SHAPES[r.brief.story]?.sixIdeas||[];
  const sameSet=(a,b)=>JSON.stringify(a.slice().sort())===JSON.stringify(b.slice().sort());
  if(!sameSet(expected,links.map(q=>q?.kind))||!sameSet(expected,(r.card.trap.newLinks||[r.card.trap.newLink]).map(q=>q?.kind)))errors.push('missingComposedLink');
  for(const q of links)errors.push(...auditLink(r,q,opts).errors);
  return {ok:!errors.length,errors};
}
function auditLink(r,q,opts={}){
  const d=r.design,kind=q?.kind,t=r.card.trap,errors=[],link=(t.newLinks||[t.newLink]).find(q=>q.kind===kind);
  const f=evidence(kind,d,q);if(!f.ok)errors.push('reason:'+f.why);
  if(JSON.stringify(link?.evidence)!==JSON.stringify(f.evidence)||link?.kind!==kind)errors.push('storedReason');
  let g=E.game(d),s=E.start(g);for(const i of q?.take||[])s=s&&E.step(g,s,i);
  if(s&&E.winnable(g,s,{nodes:opts.nodes??500000,ms:opts.callMs??5000}).result!=='lose')errors.push('baitNotProvenLost');
  const o=O.measure(d,{baits:t.baits,dial:2});
  if(!o.ok||!(t.newLinks||[t.newLink]).some(q=>o.preferredBaits.some(p=>JSON.stringify(p)===JSON.stringify(q?.take))))errors.push('newIdeaNotGreedyBait');
  if(kind==='keysLater'&&!t.effects.some(e=>e.kind==='lock'&&e.tile===q.lock&&['tailFork','tailGreedy'].includes(e.by)))errors.push('postClockLockEffect');
  if(kind==='clockCount'){
    const top=link?.top,relaxed={...d,clock:{...d.clock,n:99}},k=d.solution.indexOf(d.clock.i)+1;
    if(!top||!E.replay(relaxed,top.solution,{strict:true}).ok||top.clockAt!==top.solution.indexOf(d.clock.i)+1||top.clockAt<=d.clock.n||!q.side.includes(top.side)||!q.take.every((i,k)=>top.solution[k]===i)||!top.solution.slice(0,top.clockAt).includes(q.alternative)||top.solution.slice(0,top.clockAt).includes(top.side)||!d.solution.slice(0,k).includes(top.side))errors.push('topApproachWitness');
  }
  return {ok:!errors.length,errors};
}
module.exports={evidence,audit};
