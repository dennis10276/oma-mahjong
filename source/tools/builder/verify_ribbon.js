'use strict';
// Independent prototype claims: no constructor or story proof is imported.
const E=require('./engine.js'),V=require('./verify_trap_mixes.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function badgeClear(d,i){
  const boxes=d.tiles.map(([x,y,z])=>({x:x/2-z*.14,y:y*.62-z*.14,order:z*10000+y*100+x})),a=boxes[i];
  return !boxes.some((b,j)=>j!==i&&b.order>a.order&&b.x<a.x+1.05&&b.x+1.15>a.x+.65&&b.y<a.y+.38&&b.y+1.42>a.y-.08);
}
function verify(r,previous){
  const base=V.verify(r,{previous}),d=r.design,errors=[...base.errors],entries=Object.entries(d.obst.after||{});
  if(entries.length!==1)errors.push('oneRibbonRequired');
  const g=E.game(d),s=E.start(g),vis=tileVisibility(g.tiles,{...s,down:g.down,openPeek:-1},null).tiles;
  for(const [key,j]of entries){const i=+key;
    if([i,j].some(k=>g.down[k]||!vis[k].role||!badgeClear(d,k)))errors.push('ribbonNotVisible');
    if(E.legal(g,s).includes(i))errors.push('ribbonTargetInitiallyTakeable');
    const dd=clone(d);delete dd.obst.after;
    const k=r.card.ribbon.kWithout;
    if(!(k<r.card.clock.fewestMoves)||V.oracle(dd,k)!=='win'||V.oracle(dd,k-1)!=='lose')errors.push('ribbonDoesNotChangeClock');
    if(r.card.ribbon.source!==j||r.card.ribbon.target!==i)errors.push('ribbonCard');
  }
  return {...base,ok:!errors.length,errors,checks:base.checks.concat('ribbonVisibility','ribbonMinimumAblation')};
}
module.exports={verify,badgeClear};
