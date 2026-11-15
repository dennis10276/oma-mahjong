'use strict';
// Independent physical/behavioural comparison. Never calls the constructor's proof function.
const crypto = require('crypto'), L = require('../../www/layouts.js'), E = require('./engine.js');
const clone = x => JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const hash = d => crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
const sorted = xs => Array.from(xs).sort((a,b)=>a-b);
function constraints(before){
  const d=before.design||before,ga=E.game(clone(d)),core=new Set(),trap=before.card?.trap;
  const baits=trap?.baits || (trap?.bait?[...(trap.bait.single||[]).map(i=>({tiles:[i]})),...(trap.bait.pairs||[]).map(tiles=>({tiles}))]:[]);
  for(const i of [d.clock?.i,...(d.obst?.keys||[]),...(d.obst?.locks||[]),...Object.keys(d.obst?.ice||{}).map(Number),...d.solution.slice(0,d.solution.indexOf(d.clock?.i)+1),...baits.flatMap(q=>q.tiles)])if(Number.isInteger(i))core.add(i);
  const faces=new Set([...core].map(i=>d.faces[i]));d.faces.forEach((f,i)=>{if(faces.has(f))core.add(i)});
  // A design without a factual trap card needs complete rule-graph preservation.
  if(!baits.length)for(let i=0;i<d.tiles.length;i++)core.add(i);
  return {core,nb:ga.nb,iceNb:ga.iceNb,ice:new Set(Object.keys(d.obst?.ice||{}).map(Number))};
}
function verify(before, after, opts = {}) {
  const a=before.design||before, b=after.design||after, errors=[], checks=[];
  if (!a?.tiles || !b?.tiles) return { ok:false, errors:['missingDesign'] };
  for (const k of ['faces','down','gold','obst','clock','solution']) if (!same(a[k]??null,b[k]??null)) errors.push('changed:'+k);
  if (a.tiles.length!==b.tiles.length) errors.push('tileCount');
  if (errors.length) return {ok:false,errors};
  const ga=E.game(clone(a)), gb=E.game(clone(b));
  const nbA=L.neighbors(ga.tiles), nbB=L.neighbors(gb.tiles), core=new Set();
  const trap=before.card?.trap, baits=trap?.baits || (trap?.bait ? [
    ...(trap.bait.single||[]).map(i=>({tiles:[i]})),
    ...(trap.bait.pairs||[]).map(tiles=>({tiles})),
  ] : []);
  const add=i=>{if(Number.isInteger(i)&&i>=0&&i<a.tiles.length)core.add(i)};
  for (const i of [a.clock?.i,...(a.obst?.keys||[]),...(a.obst?.locks||[]),...Object.keys(a.obst?.ice||{}).map(Number)]) add(i);
  for (const i of a.solution.slice(0,a.solution.indexOf(a.clock?.i)+1)) add(i);
  for (const q of baits) for (const i of q.tiles) add(i);
  // All copies of a core picture matter to lookalike/waiting-twin traps.
  const faces=new Set([...core].map(i=>a.faces[i]));
  a.faces.forEach((f,i)=>{if(faces.has(f))add(i)});
  for (const i of core) {
    // A permanently empty side makes the tile side-free in every state; neighbours
    // on its other side cannot affect a move. Compare the blocking expression.
    const sides=nb=>!nb.left[i].length||!nb.right[i].length?[]:[sorted(nb.left[i]),sorted(nb.right[i])].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (!same(sorted(nbA.above[i]),sorted(nbB.above[i])) || !same(sides(nbA),sides(nbB))) errors.push('dependency:'+i);
  }
  for (const i of Object.keys(a.obst?.ice||{}).map(Number)) if (!same(sorted(ga.iceNb[i]),sorted(gb.iceNb[i]))) errors.push('thawNeighbours:'+i);
  if(errors.length) return {ok:false,errors,core:[...core]};
  checks.push('samePicturesSpecialsClockAndRoute','sameCoreBlockersAndThawLinks');
  const visibility=require('../sim/refit/human_board_visibility.js').tileVisibility;
  const va=visibility(ga.tiles,{...E.start(ga),down:ga.down,openPeek:-1},null).tiles;
  const vb=visibility(gb.tiles,{...E.start(gb),down:gb.down,openPeek:-1},null).tiles;
  for(const i of core)for(const k of ['picture','role'])if(va[i][k]&&!vb[i][k])errors.push('visibility:'+i+':'+k);
  const SR=require('./chained_special_readability.js');
  const ra=SR.measure(a), rb=SR.measure(b);
  for(const row of ra.rows.filter(r=>r.clear))if(!rb.rows.some(r=>r.tile===row.tile&&r.kind===row.kind&&r.clear))errors.push('specialBadgeVisibility');
  for (const [label,d] of [['before',a],['after',b]]) if (!E.replay(d,d.solution,{strict:true}).ok) errors.push(label+':strictWin');
  const budget={nodes:opts.nodes??400000,ms:opts.ms??10000};
  const ca=E.clockShortest(ga,budget), cb=E.clockShortest(gb,budget);
  if (!ca||!cb||ca.unsure||cb.unsure||!Number.isInteger(ca.k)||ca.k!==cb.k) errors.push('clockMinimumChangedOrUnproven');
  else checks.push('sameProvenClockMinimumAndSpare');
  if(errors.length)return {ok:false,errors,checks};
  const prices=[];
  if (baits.length) {
    const V=require('./verify_trap_mixes.js');
    for (const q of baits) {
      const p=V.reprice(a,ca.k,q.tiles,opts), n=V.reprice(b,ca.k,q.tiles,opts);
      prices.push({tiles:q.tiles,before:p,after:n});
      if (!p.exact||!n.exact||p.result!==n.result||p.cost!==n.cost||
          q.result!==undefined&&p.result!==q.result||q.cost!==undefined&&p.cost!==q.cost ||
          !(p.result==='lose'||p.result==='win'&&p.cost>a.clock.n-ca.k)) errors.push('baitChangedOrUnproven:'+q.tiles);
    }
    checks.push('repricedEveryAuthoredWrongMove');
  } else {
    // Without authored intent metadata, accept only complete rule-graph equivalence.
    // This proves every legal state and move, not merely the stored winning route.
    for(let i=0;i<a.tiles.length;i++) for(const k of ['above','left','right']) if(!same(sorted(nbA[k][i]),sorted(nbB[k][i]))) errors.push('unrecordedIntentGraphChanged:'+i+':'+k);
    if(!errors.length)checks.push('completeRuleGraphEquivalent');
  }
  const f=trap?.type&&require('./chained_shapes.js').SHAPES[trap.type];
  if(f){const C=require('./verify_chained_mixes.js');for(const [label,d]of[['before',a],['after',b]])errors.push(...C.chainStructure({...before,design:d},f).map(e=>label+':chain:'+e));checks.push('sameDeclaredChainStructure');}
  return {ok:!errors.length,errors,checks,beforeHash:hash(a),afterHash:hash(b),clockMinimum:ca?.k,spare:a.clock&&ca?a.clock.n-ca.k:null,prices,core:[...core]};
}
module.exports={verify,constraints};
if(require.main===module){
  const fs=require('fs');
  const [beforeFile,afterFile]=process.argv.slice(2);
  if(!beforeFile||!afterFile)throw Error('usage: node preserve_trap.js before-record.json after-record.json');
  const proof=verify(JSON.parse(fs.readFileSync(beforeFile,'utf8')),JSON.parse(fs.readFileSync(afterFile,'utf8')));
  console.log(JSON.stringify(proof,null,2));if(!proof.ok)process.exitCode=1;
}
