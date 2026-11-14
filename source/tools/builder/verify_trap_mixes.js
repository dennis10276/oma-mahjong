'use strict';
// Deliberately does NOT require trap_mixes.js or trap_stories.js. This verifier
// consumes a board and factual card, using independent E.winnable calls rather
// than story.prove, clockShortest or D.priceMove.
const fs=require('fs'),path=require('path');
const E=require('./engine.js'),B=require('./builder.js'),Hard=require('../../www/hard.js');
const Tail=require('./bank/tail.js'),SEP=require('./bank/separate.js'),Ledger=require('./bank/ledger.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function checkDesign(d){
  const n=d.tiles.length,counts=new Map();d.faces.forEach(f=>counts.set(f,(counts.get(f)||0)+1));
  if(n<72||n>96||d.faces.length!==n||[...counts].some(([f,n])=>!Number.isInteger(f)||f<0||f>=36||![2,4].includes(n)))return 'pictures';
  if(!Array.isArray(d.solution)||d.solution.length!==n||new Set(d.solution).size!==n)return 'solutionPermutation';
  if((d.down||[]).length/n>.30)return 'faceDownShare';
  if((d.down||[]).some(i=>!Number.isInteger(i)||i<0||i>=n)||new Set(d.down||[]).size!==(d.down||[]).length)return 'downIndices';
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
  const all=new Set([...sp,...Object.keys(ob.after||{}).map(Number),...Object.values(ob.after||{}),...sp.flatMap(i=>[...c.above[i]]),...Object.keys(ob.ice).map(Number).flatMap(i=>c.inb[i])]);
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
  const modes={doubleFalseStart:'freezeLock',twoLonelyMelts:'dualMelt',sharedRoofLocks:'addLock',splitThawLocks:'earlyClock',frozenExitFork:'freezeTwoLocks',nestedMeltFork:'freezeTwoRight',keyRoofMeltFork:'freezeRight',freeClockIce:'earlyClock',freeClockKeys:'earlyClock',freeClockShared:'earlyClock',frozenKeyShared:'addLock',frozenRoofShared:'earlyClock',secondActIce:'tailIce',secondActKeys:'tailLock',roofKeyMelt:'roofKey',roofKeyGuard:'roofKey',roofKeySharedMelt:'roofKey',repeatedKeyChoice:'repeatKeys',repeatedFrozenKey:'repeatKeys'};
  if((modes[t.type]||require('./chained_shapes.js').SHAPES[t.type]?.mode)!==m.mode)return 'familyRecipe';
  const ice=Object.keys(d.obst.ice).map(Number),locks=d.obst.locks;
  if(['frozenKeyShared','repeatedFrozenKey'].includes(t.type)&&!d.obst.keys.some(i=>ice.includes(i)))return 'frozenKey';
  if(t.type==='frozenRoofShared'&&(locks.length<1||locks.includes(m.originalClock)||!locks.some(i=>ice.includes(i)&&B.context(d.tiles).above[m.originalClock].has(i))||ice.length<2))return 'frozenRoof';
  if(t.type==='splitThawLocks'&&(!locks.includes(m.originalClock)||!ice.some(i=>B.context(d.tiles).above[m.originalClock].has(i)&&locks.some(l=>l!==m.originalClock&&E.game(d).iceNb[i].includes(l)))))return 'splitThawLocks';
  if(t.type==='splitThawLocks'){
    const q=m.relay,c=B.context(d.tiles);if(!q||!locks.includes(q.locked)||d.faces[q.dig]!==d.faces[q.locked]||d.faces.filter(f=>f===d.faces[q.dig]).length!==2||!d.obst.keys.some(k=>B.necessary(c,{clock:k,ice:d.obst.ice,keys:d.obst.keys,locks:new Set(locks),holderSpecials:new Set()},[q.dig]).has(q.dig)))return 'lockedPictureRelay';
  }
  if(m.mode==='addLock'&&(!locks.includes(m.added)||locks.length<2))return 'sharedLocks';
  if(m.mode==='sharedCoverLock'&&(!locks.includes(m.added)||locks.length<2||!B.context(d.tiles).above[d.clock.i].has(m.added)))return 'sharedCoverLock';
  if(m.mode==='freezeLock'&&!locks.some(i=>i===m.added&&ice.includes(i)))return 'frozenExit';
  if(m.mode==='freezeTwoLocks'&&locks.filter(i=>ice.includes(i)).length<2)return 'twoFrozenExits';
  if(m.mode==='freezeRight'&&(ice.length<2||!ice.includes(m.added)||!ice.some(i=>i!==m.added&&E.game(d).iceNb[i].includes(m.added))))return 'nestedMelt';
  if(m.mode==='freezeTwoRight'&&(ice.length<3||m.addedTiles?.length!==2||m.addedTiles.some(i=>!ice.includes(i)||!E.game(d).iceNb[m.originalClock].includes(i))))return 'parallelMelts';
  if(m.mode==='earlyClock'&&(!E.legal(E.game(d),E.start(E.game(d))).includes(d.clock.i)||!t.baits.some(p=>p.tiles.includes(d.clock.i))||m.originalClock===d.clock.i||d.faces[m.originalClock]!==d.faces[d.clock.i]))return 'freeClock';
  if((m.mode==='tailIce'||m.mode==='tailLock')&&(d.solution.indexOf(m.added)<=d.solution.indexOf(d.clock.i)||!t.effects.some(e=>e.tile===m.added)))return 'secondAct';
  if((t.type==='twoLonelyMelts'||t.type==='doubleFalseStart')&&t.baits.length<2)return 'dualBait';
  if(m.mode==='dualMelt'&&(ice.length<2||!ice.includes(m.added)||!t.baits.some(p=>E.game(d).iceNb[m.added].includes(p.tiles[0]))))return 'twoMeltFronts';
  if(m.mode==='roofKey'&&(!d.obst.keys.includes(m.added)||!B.context(d.tiles).above[d.clock.i].has(m.added)||!t.baits.some(p=>p.tiles.includes(m.added))))return 'keyOnClockRoof';
  if(m.mode==='repeatKeys'||m.repeat){
    const q=m.repeat;if(!q||q.copies.length!==4||new Set(q.copies).size!==4||q.copies.some(i=>d.faces[i]!==q.face)||d.faces.filter(f=>f===q.face).length!==4||!q.wrongPair.some(i=>d.obst.keys.includes(i))||q.wrongPair.every(i=>d.obst.keys.includes(i))||!t.baits.some(p=>same(p.tiles,q.wrongPair)))return 'fourCopyKeyChoice';
  }
  return null;
}
function combinedMarkerClear(d,i){
  const boxes=d.tiles.map(t=>{const [x,y,z]=Array.isArray(t)?t:[t.x,t.y,t.z];return {x:x/2-z*.14,y:y*.62-z*.14,order:z*10000+y*100+x};});
  const tile=boxes[i];
  return !boxes.some((b,j)=>j!==i&&b.order>tile.order&&b.x<tile.x+.32&&b.x+1.15>tile.x-.04&&b.y<tile.y+.372&&b.y+1.42>tile.y-.075);
}
function verify(example,opts={}){
  const d=example.design,card=example.card,errors=[],checks=[],fail=x=>errors.push(x);
  if(!d||!card?.trap)return {ok:false,errors:['missingDesignOrCard']};
  const bad=checkDesign(d);if(bad)return {ok:false,errors:[bad]};
  if(!B.LAYOUTS[card.layout]||!same(d.tiles,B.LAYOUTS[card.layout].tiles))fail('layoutMismatch');
  const t=card.trap,k=card.clock.fewestMoves,spare=card.clock.spare;
  if(example.roles?.bait?.pairs?.some(([a,b])=>d.faces[a]!==d.faces[b]))fail('authoredBaitPair');
  const shape=structure(d,t);if(shape)fail('structure:'+shape);
  if(!Number.isInteger(k)||spare<1||spare>3||d.clock.n!==k+spare||d.clock.n>19||t.priceHorizon!==Math.min(19,k+3))fail('clockNumber');
  if(!Hard.validSolution(E.game(d,{strict:true}),d.solution)||!E.replay(d,d.solution,{strict:true}).ok||!E.replay(d,d.solution).ok)fail('strictReplay');else checks.push('strictReplay');
  if(d.solution.indexOf(d.clock.i)+1!==k)fail('witnessNotShortest');
  const atK={...d,clock:{...d.clock,n:k}};
  if(!E.replay(atK,d.solution,{strict:true}).ok||oracle(d,k-1,[],opts)!=='lose')fail('unprovenClockMinimum');else checks.push('minimumByUnsatisfiableEarlierDeadline');
  const g=E.game(d),s0=E.start(g),vis=tileVisibility(g.tiles,{...s0,down:g.down,openPeek:-1},null).tiles;
  const specials=[d.clock.i,...(t.mechanism.mode==='earlyClock'?[t.mechanism.originalClock]:[]),...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)];
  if(specials.some(i=>g.down[i]||!vis[i].role))fail('hiddenSpecial');
  for(const i of specials.filter(i=>d.obst.ice[i]&&(d.obst.keys.includes(i)||d.obst.locks.includes(i))))if(!combinedMarkerClear(d,i))fail('combinedBadgeCovered:'+i);
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
  if(t.control.dearest){const p=reprice(d,k,t.control.dearest.tiles,opts);if(!p.exact||costValue(p)!==max||p.result!==t.control.dearest.result||p.cost!==t.control.dearest.cost)fail('dearestControl');}
  for(const p of t.baits||[])if(p.aboveControl!=null&&p.aboveControl!==(costValue(p)>max))fail('baitControlComparison');
  let wins=0,unknown=0;const opening=[];
  for(const i of E.legal(g,s0).filter(x=>typeof x==='number')){const r=oracle(d,d.clock.n,[i],opts);if(r==='win')wins++;if(r==='unknown')unknown++;opening.push({tile:i,result:r});}
  if(t.firstMoves && (wins<t.firstMoves.winning||t.firstMoves.rows.some(r=>r.result==='win'&&!opening.some(a=>a.tile===r.tile&&a.result==='win'))))fail('winningFirstMoves');
  if(t.firstMoves && (t.firstMoves.legal!==opening.length||t.firstMoves.winning!==t.firstMoves.rows.filter(r=>r.result==='win').length||t.firstMoves.unknown!==t.firstMoves.rows.filter(r=>r.result==='unknown').length||t.firstMoves.rows.some(r=>r.result==='lose'&&!opening.some(a=>a.tile===r.tile&&a.result==='lose'))))fail('openingClassification');
  if(wins<2)fail('fewerThan2WinningStarts');
  for(const e of t.effects||[]){
    const dd=clone(d);if(e.kind==='lock')dd.obst.locks=dd.obst.locks.filter(i=>i!==e.tile);else if(e.kind==='ice')delete dd.obst.ice[e.tile];else{fail('effectKind');continue;}
    if(e.by==='clockRoute'){
      if(!(e.kWithout<k)||oracle(dd,e.kWithout,[],opts)!=='win'||oracle(dd,e.kWithout-1,[],opts)!=='lose')fail('clockEffect:'+e.tile);
    }else if(e.by==='baitDefused'){
      if(e.winsAt!==d.clock.n||oracle(dd,e.winsAt,e.bait,opts)!=='win')fail('baitEffect:'+e.tile);
    }else if(e.by==='tailGreedy'){
      const a=Tail.measure(d,{seed:e.seed,playouts:e.playouts}).tailGreedyWin,b=Tail.measure(dd,{seed:e.seed,playouts:e.playouts}).tailGreedyWin;
      if(a!==e.with||b!==e.without||b-a<.1-1e-9||e.delta!==+(b-a).toFixed(4))fail('tailEffect:'+e.tile);
    }else if(e.by==='tailFork'){
      if(!Array.isArray(e.prefix)||!e.prefix.includes(d.clock.i)||!same(e.prefix,d.solution.slice(0,e.prefix.length))||oracle(d,d.clock.n,e.prefix.concat(e.bait),opts)!=='lose'||oracle(dd,dd.clock.n,e.prefix.concat(e.bait),opts)!=='win')fail('tailFork:'+e.tile);
    }else fail('effectEvidence:'+e.tile);
  }
  for(const [kind,tile]of[...d.obst.locks.map(i=>['lock',i]),...Object.keys(d.obst.ice).map(i=>['ice',+i])])if(!t.effects?.some(e=>e.kind===kind&&e.tile===tile))fail('missingSpecialEffect:'+kind+':'+tile);
  const close=SEP.closeTwins(d);
  if(opts.finished!==false && !close.meets)fail('twinsTogether');
  const tail=Tail.measure(d,{seed:977,playouts:800});
  if(opts.finished!==false && (tail.tailGreedyWin<(opts.tailBand?.[0]??.15)||tail.tailGreedyWin>(opts.tailBand?.[1]??.40)))fail('tailOutsideBand');
  if(card.tail && !same(card.tail,tail))fail('tailCard');
  const pressure=storedPressure(d);
  if(card.pressure && !same(card.pressure,pressure))fail('pressureCard');
  if(card.pressureFacts){
    const p=card.pressureFacts,caps={};
    for(const [label,cap]of[['cap1',1],['cap2',2]])if(['win','lose'].includes(p.capProof?.[label])){caps[cap]=capacity(d,cap);if(caps[cap]!==p.capProof[label])fail('capacityProof:'+cap);}
    if(p.needsWaitingProven){
      if(p.needsWaiting>=2&&(caps[1]??capacity(d,1))!=='lose')fail('capacityOne');
      if(p.needsWaiting>=3&&(caps[2]??capacity(d,2))!=='lose')fail('capacityTwo');
    }
    if(p.firstMoves?.winning>wins)fail('pressureOpeningCount');
  }
  if(opts.previous){const l=Ledger.check(example,opts.previous);if(!l.ok)fail('ledger:'+l.reasons.join(';'));}
  return {ok:!errors.length,errors,checks,k,spare,winningFirstMoves:wins,unknownFirstMoves:unknown,firstMoves:{winning:wins,unknown,legal:opening.length,rows:opening},tailGreedyWin:tail.tailGreedyWin,close:SEP.summary(close),pressure};
}
if(require.main===module){
  const dir=process.argv[2]||path.resolve(__dirname,'../../analysis/builder/bank/variety-v1/examples');
  const files=fs.statSync(dir).isDirectory()?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>path.join(dir,f)):[dir];
  const rows=files.map(file=>({file,...verify(JSON.parse(fs.readFileSync(file,'utf8')))}));
  console.log(JSON.stringify({ok:rows.every(r=>r.ok),rows},null,2));if(rows.some(r=>!r.ok))process.exitCode=1;
}
module.exports={mechanism,verify,checkDesign,reprice,oracle,controls,storedPressure,structure,capacity,combinedMarkerClear};
