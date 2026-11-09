'use strict';
const E=require('./engine.js'),L=require('../../www/layouts.js');
// Add authored, visible two-move detours without changing any original tile,
// picture, neighbour or obstacle. Once the extra pairs are removed, the source
// game is exactly restored. Extra copies use pictures already present twice.
function build(source,pairs,spare=2,options={}) {
  if(!source.clock||!Array.isArray(pairs)||pairs.length>3||![1,2,3].includes(spare))return {fail:'invalidPlan'};
  const n=source.tiles.length;if(n+2*pairs.length>96)return {fail:'tileCount'};
  const counts=source.faces.reduce((a,f)=>(a[f]=(a[f]||0)+1,a),{}),keys=new Set((source.obst?.keys||[]).map(i=>source.faces[i]));
  if(pairs.some(p=>!p||!Number.isInteger(p.face)||p.face<0||p.face>=36)||new Set(pairs.map(p=>p.face)).size!==pairs.length||pairs.some(p=>counts[p.face]!==2||keys.has(p.face)||!Array.isArray(p.tiles)||p.tiles.length!==2||p.tiles.some(t=>!Array.isArray(t)||t.length!==3||t.some(x=>!Number.isFinite(x))||!Number.isInteger(t[2])||t[2]<0)))return {fail:'invalidPair'};
  const d=JSON.parse(JSON.stringify(source)),added=[];
  for(const p of pairs){const ids=[d.tiles.length,d.tiles.length+1];d.tiles.push(...p.tiles.map(t=>t.slice()));d.faces.push(p.face,p.face);added.push({tiles:ids,face:p.face});}
  const objects=tiles=>tiles.map(t=>Array.isArray(t)?{x:t[0],y:t[1],z:t[2]}:t),before=L.neighbors(objects(source.tiles)),after=L.neighbors(objects(d.tiles));
  const geometry=objects(d.tiles);for(let i=n;i<geometry.length;i++)for(let j=0;j<i;j++)if(geometry[i].z===geometry[j].z&&Math.abs(geometry[i].x-geometry[j].x)<2&&Math.abs(geometry[i].y-geometry[j].y)<2)return {fail:'tileOverlap'};
  const boxes=tiles=>objects(tiles).map(t=>({x:t.x/2-t.z*.14,y:t.y/2*1.24-t.z*.14})),oldBoxes=boxes(source.tiles),newBoxes=boxes(d.tiles).slice(n);
  const bounds={l:Math.min(...oldBoxes.map(t=>t.x)),r:Math.max(...oldBoxes.map(t=>t.x+1)),t:Math.min(...oldBoxes.map(t=>t.y)),b:Math.max(...oldBoxes.map(t=>t.y+1.24))};
  if(newBoxes.some(t=>t.x<bounds.l||t.x+1>bounds.r||t.y<bounds.t||t.y+1.24>bounds.b))return {fail:'boardFootprintWouldGrow'};
  for(let i=0;i<n;i++)for(const side of ['above','left','right'])if(before[side][i].join(',')!==after[side][i].join(','))return {fail:'sourceGeometryChanged'};
  const oldIce=L.iceNeighbors(objects(source.tiles)),newIce=L.iceNeighbors(objects(d.tiles));
  for(const i of Object.keys(source.obst?.ice||{}).map(Number))if(oldIce[i].join(',')!==newIce[i].join(','))return {fail:'sourceIceGeometryChanged'};
  const alive=new Uint8Array(d.tiles.length).fill(1),activation=alive.slice(),visibility=require('../sim/refit/human_board_visibility.js').tileVisibility;
  for(const p of added){
    p.initiallyFree=p.tiles.every(i=>L.isFree(i,alive,after));
    if(p.tiles.some(i=>!L.isFree(i,activation,after)))return {fail:'pairNotFreeInPlanOrder'};
    const visible=visibility(objects(d.tiles),{alive:activation,down:new Uint8Array(d.tiles.length),openPeek:-1},d.clock).tiles;
    if(p.tiles.some(i=>!visible[i].picture))return {fail:'pairNotVisible'};
    for(const i of p.tiles)activation[i]=0;
  }
  const limits={nodes:400000,totalNodes:700000,ms:Infinity,finishNodes:200000,finishMs:Infinity,...options};
  const original=E.clockShortest(E.game(source),limits);if(!original||original.unsure)return {fail:'sourceMinimumUnproven'};
  const clockAt=source.solution.indexOf(source.clock.i)+1;if(clockAt!==original.k)return {fail:'sourceWitnessNotMinimum'};
  d.clock.n=99;const way=E.clockShortest(E.game(d),limits);if(!way||way.unsure)return {fail:'minimumUnproven'};
  if(way.k!==original.k)return {fail:'frameMinimumChanged',minimum:way.k,originalMinimum:original.k};
  if(way.k+spare>19)return {fail:'clockTooDeep'};
  d.clock.n=way.k+spare;
  const g=E.game(d);let s=E.start(g),inserted=false;const solution=[];
  function insert(){for(const p of added)for(const i of p.tiles){s=E.step(g,s,i);if(!s)return false;solution.push(i);}inserted=true;return true;}
  for(const i of source.solution){
    if(!inserted&&s.clockTaken&&s.tray.length<=2&&!insert())return {fail:'witnessUnproven'};
    s=E.step(g,s,i);if(!s)return {fail:'witnessUnproven'};solution.push(i);
  }
  if(!inserted&&!insert())return {fail:'witnessUnproven'};
  d.solution=solution;if(!E.replay(d,solution,{strict:true}).ok)return {fail:'witnessUnproven'};
  return {design:d,proof:{minimum:way.k,originalMinimum:original.k,spare,addedPairs:added,
    detourMovesPerPair:added.every(p=>p.initiallyFree)?2:null,clearingAllPairsCosts:2*added.length,sourceNeighboursUnchanged:true,originalPicturesUnchanged:true,
    explanation:'Clearing the declared pair chain restores the source board with two moves spent per pair. The source clock minimum is unchanged.',
    preserved:['all original tile coordinates and pictures','down','gold','obst','clock.i'],changed:['added visible pairs','clock.n','solution']}};
}
module.exports={build};
