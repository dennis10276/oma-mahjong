'use strict';
const E=require('./engine.js');
// Public information only. Pair-first greedy: tray matches, free visible pairs,
// then an exposed objective/key/thaw neighbour, then an arbitrary visible tile.
// Ties are a SET, so tile numbering cannot make an obvious route look subtle.
function greedy(d,g,s){
  const legal=E.legal(g,s).filter(Number.isInteger),visible=legal.filter(i=>!g.down[i]);
  let moves=visible.filter(i=>s.tray.some(j=>g.faces[j]===g.faces[i]));
  if(moves.length)return {rank:'trayMatch',tiles:moves};
  moves=visible.filter(i=>visible.some(j=>j!==i&&g.faces[j]===g.faces[i]));
  if(moves.length)return {rank:'freePair',tiles:moves};
  const thaw=new Set(Object.keys(d.obst.ice).flatMap(i=>g.iceNb[+i]));
  moves=visible.filter(i=>i===d.clock.i||d.obst.keys.includes(i)||thaw.has(i));
  return {rank:moves.length?'specialProgress':'single',tiles:moves.length?moves:visible};
}
function measure(d,opts={}){
  const g=E.game(d),s0=E.start(g),first=d.solution.slice(0,2),a=greedy(d,g,s0),s1=E.step(g,s0,first[0]),b=s1?greedy(d,g,s1):{rank:'illegal',tiles:[]};
  const free=E.legal(g,s0).filter(Number.isInteger),route=d.solution.slice(0,d.solution.indexOf(d.clock.i)+1).filter(i=>free.includes(i)&&!g.down[i]),routeFreePairs=[];
  for(let a=0;a<route.length;a++)for(let b=a+1;b<route.length;b++)if(g.faces[route[a]]===g.faces[route[b]])routeFreePairs.push([route[a],route[b]]);
  const rightFreePairs=routeFreePairs.length>0;
  const greedyPrefix=a.tiles.includes(first[0])&&b.tiles.includes(first[1]);
  const baits=opts.baits||[],preferredBaits=baits.filter(p=>p.tiles.every(i=>a.tiles.includes(i))).map(p=>p.tiles);
  const dial=opts.dial??0;
  return {ok:!greedyPrefix&&!rightFreePairs&&(dial<2||preferredBaits.length>0),dial,
    firstTwo:first,greedyFirst:a,greedySecond:b,greedyPrefix,rightFreePairs,routeFreePairs,preferredBaits,
    rule:'Reject both route taps in greedy tie sets, or any ready free pair on the pre-clock route; dial 2 also requires a greedy first bait.'};
}
module.exports={greedy,measure};
