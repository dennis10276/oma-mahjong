'use strict';
// Deliberately does NOT require trap_mixes.js or trap_stories.js. This verifier
// consumes a board and factual card, using independent E.winnable calls rather
// than story.prove, clockShortest or D.priceMove.
const fs=require('fs'),path=require('path');
const E=require('./engine.js'),B=require('./builder.js');
const Tail=require('./bank/tail.js'),SEP=require('./bank/separate.js'),Ledger=require('./bank/ledger.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function checkDesign(d){
  const n=d.tiles.length,counts=new Map();d.faces.forEach(f=>counts.set(f,(counts.get(f)||0)+1));
  if(n<72||n>96||d.faces.length!==n||[...counts].some(([f,n])=>!Number.isInteger(f)||f<0||f>=36||![2,4].includes(n)))return 'pictures';
  if(!Array.isArray(d.solution)||d.solution.length!==n||new Set(d.solution).size!==n)return 'solutionPermutation';
  if((d.down||[]).length/n>.30)return 'faceDownShare';
  if(d.obst.keys.length && (d.obst.keys.length!==2 || d.faces[d.obst.keys[0]]!==d.faces[d.obst.keys[1]]))return 'keysNotPair';
  if(d.obst.locks.length && d.obst.keys.length!==2)return 'locksWithoutKeys';
  return null;
}
function oracle(d,n,take=[],opts={}){
  const dd={...d,clock:{...d.clock,n}},g=E.game(dd);let s=E.start(g);
  try{for(const i of take){s=E.step(g,s,i);if(!s)return 'lose';}}catch{return 'illegal';}
  return E.winnable(g,s,{nodes:opts.nodes??500000,ms:opts.callMs??5000}).result;
}
function reprice(d,k,take,opts={}){
  let exact=true;
  for(let n=k;n<=Math.min(k+3,19);n++){
    const result=oracle(d,n,take,opts);
    if(result==='illegal')return {tiles:take,result:'illegal',exact:false};
    if(result==='unknown')exact=false;
    if(result==='win')return {tiles:take,result:'win',need:n,cost:n-k,exact};
  }
  return {tiles:take,result:exact?'lose':'unknown',need:null,cost:null,exact};
}
function mechanism(d){
  const c=B.context(d.tiles),ob=d.obst,sp=[d.clock.i,...ob.keys,...ob.locks,...Object.keys(ob.ice).map(Number)];
  const all=new Set([...sp,...sp.flatMap(i=>[...c.above[i]]),...Object.keys(ob.ice).map(Number).flatMap(i=>c.inb[i])]);
  for(const i of [...all])for(const j of c.above[i])all.add(j);
  return all;
}
function controls(d){
  const g=E.game(d),s=E.start(g),legal=E.legal(g,s).filter(x=>typeof x==='number'),mech=mechanism(d),out=[];
  const singles=legal.filter(i=>!mech.has(i)&&!g.down[i]&&!(g.toClock[i]||i===g.clock.i));
  for(let a=0;a<singles.length;a++)for(let b=a+1;b<singles.length;b++)if(g.faces[singles[a]]===g.faces[singles[b]])out.push([singles[a],singles[b]]);
  for(const i of singles)if(E.kindOf(g,s,i)==='twin')out.push([i]);
  return out;
}
function storedPressure(d){
  const g=E.game(d,{strict:true});let s=E.start(g),peak=0,run2=0,run=0,at3=0;const occ=[];
  for(const i of d.solution){s=E.step(g,s,i);if(!s)throw Error('pressure replay');occ.push(s.tray.length);peak=Math.max(peak,s.tray.length);run=s.tray.length>=2?run+1:0;run2=Math.max(run2,run);if(s.tray.length===3)at3++;if(i===d.clock.i)break;}
  return {peak,run2,at3,occ};
}
function capacity(d,cap,nodes=150000){
  const g=E.game(d),dead=new Set();let used=0;
  function visit(s){
    if(++used>nodes)return 'unknown';if(E.won(g,s))return 'win';
    const key=Array.from(s.alive).join('')+'/'+s.tray.map(i=>g.faces[i]).sort((a,b)=>a-b).join(',')+'/'+(s.clockTaken?'off':s.moves);
    if(dead.has(key))return 'lose';let unsure=false;
    const legal=E.legal(g,s).sort((a,b)=>Number(typeof b==='number'&&s.tray.some(i=>g.faces[i]===g.faces[b]))-Number(typeof a==='number'&&s.tray.some(i=>g.faces[i]===g.faces[a])));
    for(const a of legal){const next=E.step(g,s,a);if(!next||next.tray.length>cap)continue;const r=visit(next);if(r==='win')return r;if(r==='unknown')unsure=true;if(used>nodes)return 'unknown';}
    if(unsure)return 'unknown';dead.add(key);return 'lose';
  }
  return visit(E.start(g));
}
function structure(d,t){
  const m=t.mechanism;if(!m)return 'missingMechanism';
  const ice=Object.keys(d.obst.ice).map(Number),locks=d.obst.locks;
  if(m.mode==='addLock'&&(!locks.includes(m.added)||locks.length<2))return 'sharedLocks';
  if(m.mode==='freezeLock'&&!locks.some(i=>i===m.added&&ice.includes(i)))return 'frozenExit';
  if(m.mode==='freezeTwoLocks'&&locks.filter(i=>ice.includes(i)).length<2)return 'twoFrozenExits';
  if(m.mode==='freezeRight'&&(ice.length<2||!ice.includes(m.added)||!ice.some(i=>i!==m.added&&E.game(d).iceNb[i].includes(m.added))))return 'nestedMelt';
  if(m.mode==='earlyClock'&&(!E.legal(E.game(d),E.start(E.game(d))).includes(d.clock.i)||!t.baits.some(p=>p.tiles.includes(d.clock.i))||m.originalClock===d.clock.i))return 'freeClock';
  if((m.mode==='tailIce'||m.mode==='tailLock')&&(d.solution.indexOf(m.added)<=d.solution.indexOf(d.clock.i)||!t.effects.some(e=>e.tile===m.added)))return 'secondAct';
  if((t.type==='twoLonelyMelts'||t.type==='doubleFalseStart')&&t.baits.length<2)return 'dualBait';
  if(m.mode==='dualMelt'&&(ice.length<2||!ice.includes(m.added)||!t.baits.some(p=>E.game(d).iceNb[m.added].includes(p.tiles[0]))))return 'twoMeltFronts';
  return null;
}
function verify(example,opts={}){
  const d=example.design,card=example.card,errors=[],checks=[],fail=x=>errors.push(x);
  if(!d||!card?.trap)return {ok:false,errors:['missingDesignOrCard']};
  const bad=checkDesign(d);if(bad)return {ok:false,errors:[bad]};
  const t=card.trap,k=card.clock.fewestMoves,spare=card.clock.spare;
  const shape=structure(d,t);if(shape)fail('structure:'+shape);
  if(!Number.isInteger(k)||spare<1||spare>3||d.clock.n!==k+spare||d.clock.n>19)fail('clockNumber');
  if(!E.replay(d,d.solution,{strict:true}).ok||!E.replay(d,d.solution).ok)fail('strictReplay');else checks.push('strictReplay');
  if(d.solution.indexOf(d.clock.i)+1!==k)fail('witnessNotShortest');
  const atK={...d,clock:{...d.clock,n:k}};
  if(!E.replay(atK,d.solution,{strict:true}).ok||oracle(d,k-1,[],opts)!=='lose')fail('unprovenClockMinimum');else checks.push('minimumByUnsatisfiableEarlierDeadline');
  const g=E.game(d),s0=E.start(g),vis=tileVisibility(g.tiles,{...s0,down:g.down,openPeek:-1},null).tiles;
  const specials=[d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)];
  if(specials.some(i=>g.down[i]||!vis[i].role))fail('hiddenSpecial');
  const costValue=p=>p.result==='lose'?Math.min(3,19-k)+1:p.cost;
  for(const p of t.baits||[]){
    const actual=reprice(d,k,p.tiles,opts);
    if(!actual.exact||actual.result!==p.result||actual.cost!==p.cost)fail('baitPrice:'+p.tiles);
    if(!(actual.result==='lose'||actual.cost>spare))fail('harmlessBait:'+p.tiles);
  }
  if(!t.baits?.length)fail('missingBait');
  const priced=controls(d).map(take=>reprice(d,k,take,opts));
  if(priced.some(p=>!p.exact))fail('unprovenControl');
  const max=priced.length?Math.max(...priced.map(costValue)):0;
  if(t.control.moves!==priced.length||t.control.value!==max)fail('controlMaximum');
  if(t.control.dearest){const p=reprice(d,k,t.control.dearest.tiles,opts);if(!p.exact||costValue(p)!==max)fail('dearestControl');}
  let wins=0,unknown=0;const opening=[];
  for(const i of E.legal(g,s0).filter(x=>typeof x==='number')){const r=oracle(d,d.clock.n,[i],opts);if(r==='win')wins++;if(r==='unknown')unknown++;opening.push({tile:i,result:r});}
  if(t.firstMoves && (wins<t.firstMoves.winning||t.firstMoves.rows.some(r=>r.result==='win'&&!opening.some(a=>a.tile===r.tile&&a.result==='win'))))fail('winningFirstMoves');
  if(wins<3)fail('fewerThan3WinningStarts');
  for(const e of t.effects||[]){
    const dd=clone(d);if(e.kind==='lock')dd.obst.locks=dd.obst.locks.filter(i=>i!==e.tile);else if(e.kind==='ice')delete dd.obst.ice[e.tile];else{fail('effectKind');continue;}
    if(e.by==='clockRoute'){
      if(!(e.kWithout<k)||oracle(dd,e.kWithout,[],opts)!=='win'||oracle(dd,e.kWithout-1,[],opts)!=='lose')fail('clockEffect:'+e.tile);
    }else if(e.by==='baitDefused'){
      const p=reprice(dd,k,e.bait,opts);if(!p.exact||p.result!=='win'||p.cost>spare)fail('baitEffect:'+e.tile);
    }else if(e.by==='tailGreedy'){
      const a=Tail.measure(d,{seed:e.seed,playouts:e.playouts}).tailGreedyWin,b=Tail.measure(dd,{seed:e.seed,playouts:e.playouts}).tailGreedyWin;
      if(a!==e.with||b!==e.without||b-a<.1-1e-9)fail('tailEffect:'+e.tile);
    }else if(e.by==='tailFork'){
      if(!Array.isArray(e.prefix)||!e.prefix.includes(d.clock.i)||!same(e.prefix,d.solution.slice(0,e.prefix.length))||oracle(d,d.clock.n,e.prefix.concat(e.bait),opts)!=='lose'||oracle(dd,dd.clock.n,e.prefix.concat(e.bait),opts)!=='win')fail('tailFork:'+e.tile);
    }else fail('effectEvidence:'+e.tile);
  }
  for(const [kind,tile]of[...d.obst.locks.map(i=>['lock',i]),...Object.keys(d.obst.ice).map(i=>['ice',+i])])if(!t.effects?.some(e=>e.kind===kind&&e.tile===tile))fail('missingSpecialEffect:'+kind+':'+tile);
  const close=SEP.closeTwins(d);
  if(opts.finished!==false && !close.meets)fail('twinsTogether');
  const tail=Tail.measure(d,{seed:977,playouts:800});
  if(opts.finished!==false && (tail.tailGreedyWin<.15||tail.tailGreedyWin>.40))fail('tailOutsideBand');
  if(card.tail && !same(card.tail,tail))fail('tailCard');
  const pressure=storedPressure(d);
  if(card.pressure && !same(card.pressure,pressure))fail('pressureCard');
  if(card.pressureFacts){
    const p=card.pressureFacts;
    if(p.needsWaitingProven){
      if(p.needsWaiting>=2&&capacity(d,1)!=='lose')fail('capacityOne');
      if(p.needsWaiting>=3&&capacity(d,2)!=='lose')fail('capacityTwo');
    }
    if(p.firstMoves?.winning>wins)fail('pressureOpeningCount');
  }
  if(opts.previous){const l=Ledger.check(example,opts.previous);if(!l.ok)fail('ledger:'+l.reasons.join(';'));}
  return {ok:!errors.length,errors,checks,k,spare,winningFirstMoves:wins,unknownFirstMoves:unknown,tailGreedyWin:tail.tailGreedyWin,close:SEP.summary(close),pressure};
}
if(require.main===module){
  const dir=process.argv[2]||path.resolve(__dirname,'../../analysis/builder/bank/variety-v1/examples');
  const files=fs.statSync(dir).isDirectory()?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>path.join(dir,f)):[dir];
  const rows=files.map(file=>({file,...verify(JSON.parse(fs.readFileSync(file,'utf8')))}));
  console.log(JSON.stringify({ok:rows.every(r=>r.ok),rows},null,2));if(rows.some(r=>!r.ok))process.exitCode=1;
}
module.exports={verify,checkDesign,reprice,oracle,controls,storedPressure,structure,capacity};
