'use strict';
/* TASK 14. Experimental stories only; never edits level tables.
 * Uses the established geometry and picture planner, but proves the resulting
 * design directly. In particular a post-clock obstacle must have a measured
 * tail effect; it is not waved through A1's clock-only idle test.
 */
const T = require('./trap_stories.js');
const B = require('./builder.js');
const E = require('./engine.js');
const D = require('./loop/detour.js');
const VC = require('../builder-next/construct.js');
const Tail = require('./bank/tail.js');
const SEP = require('./bank/separate.js');
const Ledger = require('./bank/ledger.js');
const { tileVisibility,visibilityGeometry } = require('../sim/refit/human_board_visibility.js');
const clone = x => JSON.parse(JSON.stringify(x));
const uniq = a => [...new Set(a)];
const rngOf = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const shuffled = (a, rng) => a.map(v => [rng(), v]).sort((a,b) => a[0]-b[0]).map(x=>x[1]);
function keysFirst(c,r,P,rng){
  const Bkey=r.bait.keyEarly??r.bait.keyNear??r.bait.keyB,A=r.keys.find(i=>i!==Bkey);
  if(A==null||Bkey==null||!r.keys.every(i=>P.includes(i)))return P;
  const first=B.planDig(c,{...r,clock:A,locks:new Set(),keys:[],holderSpecials:new Set()},rng);
  if(!first||first.some(i=>!P.includes(i))||first.includes(Bkey))return P;
  const proposed=first.concat(Bkey,P.filter(i=>!first.includes(i)&&i!==Bkey)),alive=new Uint8Array(c.n).fill(1),init=alive.slice();
  const rules={ice:r.ice,iceNb:c.inb,locks:r.locks,keys:r.keys};
  for(const i of proposed){if(!global.Layouts.takeable(i,alive,c.nb,rules,init))return P;alive[i]=0;}
  return proposed;
}

// These are recipes, not twelve labels for unchanged chain shapes. Each adds a
// fork, changes the clock's position, or makes a branched / second-act mechanism.
const DEFINITIONS = [
  ['doubleFalseStart', 'lockedMelt', null, 'freezeLock', 'Fetch the far key before using either the free key or the lonely thaw tile, then thaw the locked exit.', 'Two distinct losing ideas; frozen shared exit.'],
  ['twoLonelyMelts', 'lockedMelt', null, 'dualMelt', 'The clock and a key roof each offer a lonely thaw tile; prepare their paired routes instead of parking either lonely picture.', 'Two thaw fronts, each with its own independently priced decoy.'],
  ['sharedRoofLocks', 'chain', 0, 'addLock', 'One key pair opens two different steps of the roof; clear the key route before parking the easy key.', 'A shared key pair and an extra locked prerequisite.'],
  ['splitThawLocks', 'chain', 40, 'earlyClock', 'The locked thaw tile clears a picture carried through the key dig; save the free clock’s tray slot until that relief is ready.', 'The same keys open the clock partner and a locked picture match on its thaw route.'],
  ['frozenExitFork', 'lockedMelt', null, 'freezeTwoLocks', 'Opening the keys is only half the job: choose which of two frozen locked exits to thaw before freeing the clock.', 'Two parallel exits with two conditions each.'],
  ['nestedMeltFork', 'wrongMelt', null, 'freezeTwoRight', 'Prepare both frozen thaw exits and save the lonely outer neighbour for its buried partner.', 'A two-front staged thaw, rather than one serial ice chain.'],
  ['keyRoofMeltFork', 'chain', 0, 'freezeRight', 'Thaw the key roof through its own neighbour before collecting the two keys together.', 'A staged melt on the key side rather than the clock side.'],
  ['freeClockIce', 'chain', 4, 'earlyClock', 'The clock is already free, but taking it now uses the tray space needed for the two-stage thaw of its partner.', 'A takeable clock competes with its nested frozen partner route.'],
  ['freeClockKeys', 'guardedKey', null, 'earlyClock', 'Leave the exposed clock until the frozen key roof is cleared, or its waiting picture blocks the key dig.', 'A free clock in parallel with a keyed ice gate.'],
  ['freeClockShared', 'lockedMelt', null, 'earlyClock', 'The free clock and the free melting neighbour compete for tray room while the keys open the clock partner route.', 'A clock bait beside a shared-lock thaw fork.'],
  ['frozenKeyShared', 'chain', 18, 'addLock', 'The frozen key opens two separate exits, so thaw its route before spending a slot on the other key.', 'A frozen key feeding a branched lock mechanism.'],
  ['frozenRoofShared', 'chain', 26, 'earlyClock', 'The free clock shares its picture with a tile behind a roof that is both frozen and locked; prepare the far key route first.', 'A free clock and its partner beneath a frozen locked roof, linked to an icy key cover.'],
  ['secondActIce', 'guardedKey', null, 'tailIce', 'Saving the clock leaves an icy gate in the remaining picture route; keep space for the tiles that melt it.', 'An independently measured obstacle after the clock.'],
  ['secondActKeys', 'wrongMelt', null, 'tailLock', 'Melt the clock without stranding its neighbour, then gather the remaining keys before opening the tail gate.', 'A keyed second act with a proven tail-fork or tail-pressure effect.'],
  ['roofKeyMelt', 'chain', 3, 'roofKey', 'The key on the clock roof is a lure: prepare the far key before opening the locked thaw exit.', 'Key-on-clock and a locked melt share the same cover.'],
  ['roofKeyGuard', 'chain', 0, 'roofKey', 'The easy key lies on the clock, but its partner is behind an icy roof on the other side.', 'A clock-cover key competes with a separate frozen key roof.'],
  ['roofKeySharedMelt', 'chain', 40, 'roofKey', 'One key on the clock opens both locks, yet the icy roof still needs its thaw exit prepared first.', 'Key-on-clock with a shared-lock melt branch.'],
  ['repeatedKeyChoice', 'keyOnClock', null, 'repeatKeys', 'Pictures can match while only one key leaves: pair the two real keys rather than the free key and its ordinary lookalike.', 'Four copies make the wrong matching pair a trap.'],
  ['repeatedFrozenKey', 'chain', 18, 'repeatKeys', 'The ordinary lookalike cannot replace the frozen key: thaw and pair the actual keys before using the shared picture elsewhere.', 'Four-copy choice across a frozen key and a clock thaw exit.'],
];
const FAMILIES = Object.fromEntries(DEFINITIONS.map(([name, base, chain, mode, see, recipe]) => [name, {
  name, base, chain, mode, see, recipe, trapType: 'mix:' + name,
  dials: { easier: 'spare 2; one wrong neighbour; shorter key dig', harder: 'spare 1; two wrong neighbours; tail width 3' },
}]));

Object.assign(FAMILIES, require('./chained_shapes.js').SHAPES);

function place(name, c, brief, rng) {
  const f = FAMILIES[name]; if (!f) return { fail: 'unknownMix' };
  const b = { ...brief, targets: { ...brief.targets }, ...(f.chain != null ? { chain: T.CHAIN_SHAPES[f.chain] } : {}) };
  if(f.chained&&f.mode==='roofKey')b.frame={...b.frame,depth:T.CHAIN_DEFS[f.chain].cover?2:(rng()<.5?1:2)};
  if (f.base === 'lockedMelt') {b.targets.locks=4;b.targets.digBefore??=[2,8];b.targets.keyCover??=[1,4];}
  if(f.mode==='freezeTwoRight'){b.frame={...b.frame,depth:0};b.targets.minWay=3;}
  const r = T.STORIES[f.base].place(c, b, rng); if (r.fail) return r;
  let P = r.dig || B.planDig(c, r, rng); if (!P) return { fail: 'baseDig' };
  const bait = r.bait, originalClock = r.clock;
  // A lock below another lock opened by the same keys is provably redundant.
  // The roof retains its lock; the matching tile below it is an ordinary tile.
  if(name==='frozenRoofShared')r.locks.delete(originalClock);
  const protectedTiles = new Set([r.clock, ...r.keys, ...r.locks, ...Object.keys(r.ice).map(Number), ...bait.tiles]);
  const visible = i => c.roleShown0[i] && T.vis0Of(c)[i].role;
  let added = null,addedTiles=[],setup=null;
  if (f.mode === 'roofKey') {
    const oldKey=bait.keyEarly;
    if(oldKey==null)return {fail:'noFreeRoofKeyRole'};
    const cand=shuffled([...c.above[r.clock]].filter(i=>visible(i)&&c.free0[i]&&!r.ice[i]&&!r.locks.has(i)&&!r.keys.includes(i)&&!bait.pairs.some(p=>p.includes(i))),rng);
    if(!cand.length)return {fail:'noRoofKeyCell'};
    added=cand[0];r.keys=r.keys.map(i=>i===oldKey?added:i);bait.keyEarly=added;
    bait.tiles=bait.tiles.filter(i=>i!==oldKey).concat(added);P=f.chained?uniq(P.map(i=>i===oldKey?added:i)):null;
  } else if (f.mode === 'addLock' || f.mode==='sharedCoverLock') {
    const cand = shuffled(P.filter(i => !protectedTiles.has(i) && visible(i) && (f.mode==='sharedCoverLock'?c.above[r.clock].has(i)&&!r.keys.some(k=>c.above[k].has(i)):r.keys.every(k => P.indexOf(k) < P.indexOf(i)))), rng);
    if (!cand.length) return { fail: 'noExtraLock' };
    added = cand[0]; r.locks.add(added);if(f.mode==='sharedCoverLock')P=null;
  } else if (f.mode === 'freezeLock' || f.mode === 'freezeTwoLocks') {
    const cand = shuffled([...r.locks].filter(i => visible(i) && c.inb[i].length >= 2 && !r.ice[i]), rng);
    const count=f.mode==='freezeTwoLocks'?2:1;
    if (cand.length<count) return { fail: 'noFrozenExit' };
    added = cand[0]; for(const tile of cand.slice(0,count))r.ice[tile] = 2;
    P = null;
  } else if (f.mode === 'freezeRight' || f.mode==='freezeTwoRight') {
    const hosts = Object.keys(r.ice).map(Number);
    const cand = shuffled(uniq(hosts.flatMap(h => T.thawNbs(c,h))).filter(i => !protectedTiles.has(i) && visible(i) && c.inb[i].length >= 2 && P.includes(i)), rng);
    const count=f.mode==='freezeTwoRight'?2:1;
    if (cand.length<count) return { fail: 'noInnerMelt' };
    addedTiles=cand.slice(0,count);added = cand[0];for(const tile of addedTiles)r.ice[tile] = 2; P = null;
  } else if (f.mode === 'dualMelt') {
    const far=bait.keyFar??r.keys.find(k=>k!==bait.keyEarly);
    const guards=shuffled([...c.above[far]].filter(i=>visible(i)&&c.free0[i]&&!r.ice[i]&&c.inb[i].length>=2),rng);
    if(!guards.length)return {fail:'noSecondMeltFront'};
    const guard=guards[0];r.ice[guard]=2;added=guard;
    const wrong=shuffled(T.thawNbs(c,guard).filter(i=>c.free0[i]&&!P.includes(i)&&!protectedTiles.has(i)&&!bait.pairs.some(p=>p.includes(i))),rng);
    const twins=shuffled([...Array(c.n).keys()].filter(i=>!P.includes(i)&&!protectedTiles.has(i)&&T.vis0Of(c)[i].picture&&c.above[i].size>=2&&!c.above[i].has(guard)),rng);
    if(!wrong.length||!twins.length)return {fail:'noSecondMeltBait'};
    const lone=wrong[0],twin=twins.find(i=>i!==lone&&!c.above[i].has(lone));if(twin==null)return {fail:'noSecondMeltTwin'};
    bait.wrong.push(lone);bait.twins.push(twin);bait.pairs.push([lone,twin]);bait.tiles.push(lone,twin);bait.keepUp.push(lone,twin,...c.above[twin]);
    P=null;
  } else if (f.mode === 'earlyClock') {
    if([...Array(c.n).keys()].filter(i=>!P.includes(i)&&c.above[i].has(originalClock)).length<2)return {fail:'noClockPartnerHolders'};
    const cand = shuffled([...Array(c.n).keys()].filter(i => c.free0[i] && visible(i) && !r.keys.includes(i) && !r.locks.has(i) && !r.ice[i] && !P.includes(i) && !bait.pairs.some(p => p.includes(i))), rng);
    // Prefer a new clock over a bait tile: retain the authored lonely-picture pair.
    if (!cand.length) return { fail: 'noFreeClock' };
    added = cand[0];
    if(P.length%2===0){if(cand.length<2)return {fail:'noClockSetupTile'};setup=cand[1];P=P.slice(0,-1).concat(setup,P.at(-1));}
    r.clock = added; P = P.concat(added);
  } else if (f.mode === 'tailIce' || f.mode === 'tailLock') {
    const cov=B.coveredDuringDig(c,P);
    const cand = shuffled([...Array(c.n).keys()].filter(i => cov[i] && !protectedTiles.has(i) && !P.includes(i) && visible(i) && c.inb[i].filter(j => !P.includes(j)).length >= 2), rng);
    if (!cand.length) return { fail: 'noTailGate' };
    added = cand[0];
    if (f.mode === 'tailIce') r.ice[added] = 2;
    else {
      r.locks.add(added);
      const keys = shuffled([...Array(c.n).keys()].filter(i => i !== added && !P.includes(i) && !protectedTiles.has(i) && visible(i) && !c.above[i].has(added)), rng);
      if (keys.length < 2) return { fail: 'noTailKeys' };
      r.keys = keys.slice(0,2);
    }
  }
  if (!P) {
    // Retain the original lonely-neighbour exclusions when planning the new melt.
    const wrong = new Set(bait.wrong || []);
    const inb = c.inb.map(a => a.filter(j => !wrong.has(j)));
    P = B.planDig({ ...c, inb }, r, rng);
    if (!P || [...wrong].some(i => P.includes(i))) return { fail: 'mixedDig' };
  }
  P=keysFirst(c,r,P,rng);r.dig = P;
  const specials = uniq([r.clock, ...r.keys, ...r.locks, ...Object.keys(r.ice).map(Number)]);
  const mechanism = uniq([...specials, ...specials.flatMap(i => [...c.above[i]]), ...Object.keys(r.ice).map(Number).flatMap(i => c.inb[i])]);
  r.bait = { ...bait, type: name, keepUp: uniq([...bait.keepUp, ...mechanism]),
    tiles: uniq([...bait.tiles, ...(f.mode === 'earlyClock' ? [r.clock] : [])]),
    mix: { originalClock, added, addedTiles, setup, mode: f.mode }, see: f.see };
  return r;
}

function mechanismOf(d) {
  const c = B.context(d.tiles), ob = d.obst, sp = uniq([d.clock.i, ...ob.keys, ...ob.locks, ...Object.keys(ob.ice).map(Number)]);
  const all = new Set([...sp, ...sp.flatMap(i => [...c.above[i]]), ...Object.keys(ob.ice).map(Number).flatMap(i => c.inb[i])]);
  for (const i of [...all]) for (const j of c.above[i]) all.add(j);
  return all;
}
function price(d, take, k, opts = {}) {
  const C = opts.C || D.clockGames(d), w = opts.w || D.work(1e6, opts.wallMs ?? 12000);
  const g = C.at(d.clock.n), legal = E.legal(g,E.start(g));
  if (!take.every(i=>legal.includes(i))) return null;
  const p = D.priceMove(C, E.start(g), { take }, { base:k, nShipMax: Math.min(19,k+3), nodes:opts.nodes ?? 180000, w });
  return { tiles: take.slice(), result:p.result, cost:p.cost, exact:p.exact, need:p.need ?? null };
}
const costly = (p, spare) => p && p.exact && (p.result === 'lose' || (p.result === 'win' && p.cost > spare));
const value = (p, k) => p.result === 'lose' ? Math.min(3,19-k)+1 : p.cost;
function shortest(d, opts = {}) {
  const cs = E.clockShortest(E.game(d,{strict:!!opts.strict}), { nodes:opts.nodes ?? 250000, totalNodes:opts.totalNodes ?? 500000, ms:opts.ms ?? 3000, finishNodes:opts.nodes ?? 250000, finishMs:opts.ms ?? 3000 });
  return cs && !cs.unsure && cs.k != null ? cs : null;
}
function opening(d, opts = {}) {
  const g = E.game(d), s = E.start(g), rows = [];
  for (const i of E.legal(g,s).filter(x=>typeof x==='number')) {
    const a = E.step(g,s,i), r = a ? E.winnable(g,a,{nodes:opts.nodes ?? 120000,ms:opts.ms ?? 1800}) : {result:'lose'};
    rows.push({ tile:i,result:r.result });
  }
  return { winning:rows.filter(r=>r.result==='win').length, unknown:rows.filter(r=>r.result==='unknown').length, legal:rows.length, rows };
}
function repeatedKeys(c,r,plan,rng){
  const face=plan.faces[r.keys[0]],freeKey=r.keys.find(i=>c.free0[i]&&!r.ice[i]);if(freeKey==null)return false;
  const groups=new Map();plan.faces.forEach((f,i)=>groups.set(f,(groups.get(f)||[]).concat(i)));
  const open=new Map(),pairs=[];
  for(const i of plan.W){const f=plan.faces[i];if(open.has(f)){pairs.push([open.get(f),i]);open.delete(f);}else open.set(f,i);}
  const inP=new Set(r.dig),v=T.vis0Of(c);
  const geo=c._mixGeo||(c._mixGeo=SEP.geometry({tiles:c.tiles,down:[]}));
  const candidates=shuffled(pairs.filter(([a,b])=>{
    const copies=[...r.keys,a,b];if(copies.some((i,k)=>copies.slice(k+1).some(j=>geo.close[i][j])))return false;
    const f=plan.faces[a],g=groups.get(f);return f!==face&&g.length===4&&g.every(i=>!inP.has(i)&&!r.bait.tiles.includes(i))&&((c.free0[a]&&c.above[b].size>=2&&v[b].picture)||(c.free0[b]&&c.above[a].size>=2&&v[a].picture));
  }),rng);
  if(!candidates.length)return false;
  const pair=candidates[0],near=pair.find(i=>c.free0[i]),far=pair.find(i=>i!==near);
  for(const i of pair)plan.faces[i]=face;
  r.bait.repeat={face,copies:[...r.keys,...pair],wrongPair:[freeKey,near]};
  r.bait.extraMoves=[[freeKey,near]];r.bait.tiles.push(...pair);r.bait.keepUp.push(...pair,...c.above[far]);
  return true;
}
function lockedRelay(c,r,plan){
  const old=r.bait.mix.originalClock,locked=[...r.locks].find(i=>i!==old),ci=plan.pos[r.clock];
  if(locked==null||plan.pos[locked]>=ci)return false;
  const other=plan.pairOf[locked],keyAt=Math.min(...r.keys.map(i=>plan.pos[i])),geo=c._mixGeo||(c._mixGeo=SEP.geometry({tiles:c.tiles,down:[]}));
  for(const dig of plan.dig.orphans){
    const twin=plan.pairOf[dig];
    if(plan.pos[dig]>=keyAt||plan.pos[twin]<=ci||new Set([dig,twin,locked,other]).size!==4||geo.close[dig][locked]||!geo.vis[dig])continue;
    if(!r.keys.some(k=>B.necessary(c,{...r,clock:k},[dig]).has(dig)))continue;
    const a=plan.faces[locked],b=plan.faces[twin];plan.faces[locked]=b;plan.faces[twin]=a;
    const tray=[];let valid=true;for(const i of plan.W){const q=tray.indexOf(plan.faces[i]);if(q>=0)tray.splice(q,1);else tray.push(plan.faces[i]);if(tray.length>=4){valid=false;break;}}
    if(!valid){plan.faces[locked]=a;plan.faces[twin]=b;continue;}
    plan.pairOf[dig]=locked;plan.pairOf[locked]=dig;plan.pairOf[other]=twin;plan.pairOf[twin]=other;
    r.bait.relay={dig,locked};r.bait.tiles.push(dig,locked);r.bait.keepUp.push(dig,locked);return true;
  }
  return false;
}
function tailFork(d,without,tile){
  const g=E.game(d),g2=E.game(without),ci=d.solution.indexOf(d.clock.i),left=d.solution.length-ci-1;
  let s=E.start(g);const lo=ci+1+Math.floor(left*.15),hi=ci+1+Math.floor(left*.60);
  let checked=0;
  for(let step=0;step<=hi;step++){
    if(step>=lo&&s.alive[tile])for(const move of D.temptingMoves(g,s,{singles:true}).filter(m=>!m.peek).slice(0,6)){
      if(++checked>24)return null;
      const after=D.playMove(g,s,move);if(!after)continue;
      const loss=E.winnable(g,after,{nodes:70000,ms:700});if(loss.result!=='lose')continue;
      const relief=E.winnable(g2,after,{nodes:100000,ms:1000});
      if(relief.result==='win')return {by:'tailFork',prefix:d.solution.slice(0,step),bait:move.take.slice(),with:'lose',without:'win'};
    }
    if(step===hi)break;s=E.step(g,s,d.solution[step]);if(!s)return null;
  }
  return null;
}

function prove(name, d, roles, ctx, opts = {}) {
  const f = FAMILIES[name], k = ctx.k, spare = ctx.spare;
  if (!f || !E.replay(d,d.solution,{strict:true}).ok) return {ok:false,why:'strictReplay'};
  if(roles.bait.mix.mode!==f.mode)return {ok:false,why:'recipeChanged'};
  if(f.mode==='earlyClock'&&d.faces[d.clock.i]!==d.faces[roles.bait.mix.originalClock])return {ok:false,why:'clockTwinNotGate'};
  if(d.obst.keys.length===2&&d.faces[d.obst.keys[0]]!==d.faces[d.obst.keys[1]])return {ok:false,why:'keysNotPair'};
  if(name==='splitThawLocks'&&(!roles.bait.relay||d.faces[roles.bait.relay.dig]!==d.faces[roles.bait.relay.locked]))return {ok:false,why:'relayChanged'};
  if(roles.bait.pairs.some(([a,b])=>d.faces[a]!==d.faces[b]))return {ok:false,why:'baitPairChanged'};
  if((f.mode==='repeatKeys'||f.repeat)&&(!roles.bait.repeat||roles.bait.repeat.copies.some(i=>d.faces[i]!==roles.bait.repeat.face)||d.faces.filter(f=>f===roles.bait.repeat.face).length!==4))return {ok:false,why:'repeatChoiceChanged'};
  if ((d.down || []).length / d.tiles.length > .3) return {ok:false,why:'faceDownShare'};
  const g = E.game(d), s0 = E.start(g), vis = tileVisibility(g.tiles,{...s0,down:g.down,openPeek:-1},null).tiles;
  const special = uniq([d.clock.i,...(f.mode==='earlyClock'?[roles.bait.mix.originalClock]:[]),...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)]);
  if (special.some(i=>g.down[i] || !vis[i].role)) return {ok:false,why:'hiddenSpecial'};
  const combined=special.filter(i=>d.obst.ice[i]&&(d.obst.keys.includes(i)||d.obst.locks.includes(i))),boxes=visibilityGeometry(g.tiles).boxes;
  for(const i of combined){const b=boxes[i],rect=[b.left-.04,b.top-.075,b.left+.32,b.top+.372];
    if(boxes.some((c,j)=>j!==i&&c.order>b.order&&c.left<rect[2]&&c.right>rect[0]&&c.top<rect[3]&&c.bottom>rect[1]))return {ok:false,why:'combinedBadgeCovered:'+i};
  }
  const candidates = uniq([...(roles.bait.wrong || []), ...(roles.bait.keyEarly != null ? [roles.bait.keyEarly] : []),
    ...(roles.bait.keyNear != null ? [roles.bait.keyNear] : []), ...(roles.bait.keyB != null ? [roles.bait.keyB] : []),
    ...(f.mode==='earlyClock'?[d.clock.i]:[])]).map(i=>[i]).concat(roles.bait.extraMoves||[]);
  const C = D.clockGames(d), w = D.work(3e6,opts.wallMs ?? 18000);
  const baits = candidates.map(a=>price(d,a,k,{C,w})).filter(p=>costly(p,spare));
  if (!baits.length) return {ok:false,why:'noProvenBait'};
  if (f.mode==='earlyClock' && !baits.some(p=>p.tiles.includes(d.clock.i))) return {ok:false,why:'clockNotBait'};
  if (f.mode==='roofKey' && !baits.some(p=>p.tiles.includes(roles.bait.keyEarly))) return {ok:false,why:'roofKeyNotBait'};
  if ((f.mode==='repeatKeys'||f.repeat) && !baits.some(p=>JSON.stringify(p.tiles)===JSON.stringify(roles.bait.repeat?.wrongPair))) return {ok:false,why:'wrongRepeatedPairNotBait'};
  if (f.mode==='dualMelt' && (roles.bait.wrong.length<2 || roles.bait.wrong.some(i=>!baits.some(p=>p.tiles.includes(i))))) return {ok:false,why:'needTwoLonelyBaits'};
  if (name==='doubleFalseStart' && (!baits.some(p=>p.tiles.includes(roles.bait.keyNear)) || !baits.some(p=>roles.bait.wrong.includes(p.tiles[0])))) return {ok:false,why:'needTwoBaits'};
  const mech=mechanismOf(d), controls=D.temptingMoves(g,s0,{singles:true}).filter(m=>!m.peek && m.take.every(i=>!mech.has(i)));
  const rows=opts.skipControl?[]:controls.map(m=>price(d,m.take,k,{C,w}));
  if(rows.some(p=>!p || !p.exact || p.result==='unknown')) return {ok:false,why:'controlUnknown'};
  const dearest=rows.sort((a,b)=>value(b,k)-value(a,k))[0] || null;
  // Report the complete control, not the capped sample used by the older stories.
  const control={ moves:rows.length,dearest,value:dearest?value(dearest,k):0 };
  for(const bait of baits)bait.aboveControl=value(bait,k)>control.value;
  const first=opts.skipOpening?null:opening(d);
  let subtle=null;
  if(f.chained){
    subtle=require('./chained_obviousness.js').measure(d,{baits,dial:ctx.obviousnessDial??0});
    if(!subtle.ok)return {ok:false,why:subtle.rightFreePairs?'obvious:freeRoutePair':'obvious:greedyPrefix'};
    if(baits.length<2 || !baits.some(p=>p.tiles.every(i=>!baits[0].tiles.includes(i))))return {ok:false,why:'twoMeaningfulBaits'};
  }
  if(first && first.winning<2) return {ok:false,why:'fewerThan2WinningStarts'};
  const effects=[];
  if(!opts.skipEffects) for(const [kind,tile] of [...d.obst.locks.map(i=>['lock',i]),...Object.keys(d.obst.ice).map(i=>['ice',+i])]) {
    const dd=clone(d); if(kind==='lock') dd.obst.locks=dd.obst.locks.filter(i=>i!==tile); else delete dd.obst.ice[tile];
    const cs=shortest({...dd,clock:{...dd.clock,n:99}});
    let effect=cs&&cs.k<k?{by:'clockRoute',kWithout:cs.k}:null;
    if(!effect) for(const bait of baits) {
      const p=price(dd,bait.tiles,k,{nodes:250000});
      if(p?.exact && p.result==='win' && p.cost<=spare) { effect={by:'baitDefused',bait:bait.tiles,winsAt:d.clock.n};break; }
    }
    if(!effect && (f.mode==='tailIce'||f.mode==='tailLock')) {
      effect=tailFork(d,dd,tile);
    }
    if(!effect && (f.mode==='tailIce'||f.mode==='tailLock')) {
      const before=Tail.measure(d,{seed:977,playouts:400}).tailGreedyWin, after=Tail.measure(dd,{seed:977,playouts:400}).tailGreedyWin;
      if(after-before>=.1) effect={by:'tailGreedy',with:before,without:after,delta:+(after-before).toFixed(4),seed:977,playouts:400};
    }
    if(!effect) return {ok:false,why:'idle:'+kind+':'+tile};
    effects.push({kind,tile,...effect});
  }
  const card={type:name,trapType:f.trapType,see:f.see,recipe:f.recipe,dials:f.dials,k,spare,priceHorizon:Math.min(19,k+3),baits,control,effects,firstMoves:first,mechanism:{...roles.bait.mix,repeat:roles.bait.repeat||null,relay:roles.bait.relay||null},
    ...(f.chained?{signature:f.signature,baseSignature:f.baseSignature,links:f.links,obviousness:subtle,twoTraps:{kind:'hardChainAndMediumBait',hardLinks:f.links,mediumLinks:2,mediumEvidence:require('./chained_facts.js').mediumEvidence(d,roles,baits),baits:baits.map(p=>p.tiles),note:'Two separately priced bad decisions on one connected chain; no claim of additive sequential costs.'}}:{}),
    combinedBadges:combined,needsUi:combined.length?'TASK-13':null};
  return {ok:true,card};
}

const STORIES = Object.fromEntries(Object.values(FAMILIES).map(f=>[f.name,{
  title:f.name,sentence:f.see,spec:{},place:(c,b,r)=>place(f.name,c,b,r),prove:(d,r,c)=>prove(f.name,d,r,c),profile:'traps-v1',
}]));
// Registration is opt-in on require; no existing story is replaced.
Object.assign(B.STORIES,STORIES);

function build(name, brief = {}, opts = {}) {
  if(!FAMILIES[name]) return {fail:'unknownMix'};
  const t0=Date.now(), wallMs=opts.wallMs ?? 20000, fails={};
  const layout=brief.layout ?? 0, lay=B.LAYOUTS[layout]; if(!lay) return {fail:'unknownLayout'};
  if(/^blob|^block/.test(lay.shape)) return {fail:'bannedLayout'};
  const c=B.context(lay.tiles), f=FAMILIES[name];
  const used={...brief,layout,story:name,frame:{spare:1,...brief.frame},targets:{trayRoom:0,maxDown:.2,hiddenOnWay:0,tailPairWidth:2,...brief.targets}};
  if(![1,2,3].includes(used.frame.spare))return {fail:'invalidSpare'};
  for(let attempt=0;attempt<(opts.tries ?? 30)&&Date.now()-t0<wallMs;attempt++) {
    try{
    const rng=rngOf((brief.seed??1)*7919+attempt*104729),r=STORIES[name].place(c,used,rng);
    if(r.fail){fails[r.fail]=(fails[r.fail]||0)+1;continue;}
    const geo=c._mixGeo||(c._mixGeo=SEP.geometry({tiles:c.tiles,down:[]}));
    const fixedPairs=[...(r.keys.length===2?[r.keys]:[]),...r.bait.pairs,...(f.mode==='earlyClock'?[[r.clock,r.bait.mix.originalClock]]:[])];
    if(fixedPairs.some(([a,b])=>geo.vis[a]&&geo.vis[b]&&geo.close[a][b])){fails.fixedTwinsClose=(fails.fixedTwinsClose||0)+1;continue;}
    const P=r.dig,hold=B.chooseHolders(c,r,P,{},rng),N=f.mode==='earlyClock'?B.necessary(c,{...r,clock:r.bait.mix.originalClock},P.filter(i=>i!==r.clock)):B.necessary(c,r,P);
    if(f.mode==='earlyClock'){
      N.add(r.clock);
      hold.holders=new Set([...Array(c.n).keys()].filter(i=>!P.includes(i)&&c.above[i].has(r.bait.mix.originalClock)&&!r.bait.tiles.includes(i)));
      if(hold.holders.size<2){fails.noClockPartnerHolders=(fails.noClockPartnerHolders||0)+1;continue;}
    }
    if(f.mode==='tailIce'||f.mode==='tailLock'){
      const extra=[...Array(c.n).keys()].filter(i=>hold.cov[i]&&!P.includes(i)&&i!==r.bait.mix.added&&!r.keys.includes(i)&&!r.bait.tiles.includes(i));
      hold.holders=new Set([r.bait.mix.added,...extra.slice(0,3)]);
    }
    const plan=VC.placePicturesVC(c,r,P,hold,used,rng,N);
    if(!plan || plan.fail){const why=plan?.fail||'pictures';fails[why]=(fails[why]||0)+1;continue;}
    if(f.mode==='earlyClock'&&plan.faces[r.clock]!==plan.faces[r.bait.mix.originalClock]){fails.clockTwinNotGate=(fails.clockTwinNotGate||0)+1;continue;}
    if(name==='splitThawLocks'&&!lockedRelay(c,r,plan)){fails.noLockedRelay=(fails.noLockedRelay||0)+1;continue;}
    if((f.mode==='repeatKeys'||f.repeat)&&!repeatedKeys(c,r,plan,rng)){fails.noRepeatedKeyPair=(fails.noRepeatedKeyPair||0)+1;continue;}
    const pd=VC.placeDownVC(c,r,P,plan,used,rng);
    const d={tiles:c.tiles.map(t=>[t.x,t.y,t.z]),faces:plan.faces,down:pd.down,gold:[],obst:{ice:{...r.ice},locks:[...r.locks],keys:r.keys.slice()},clock:{i:r.clock,n:99},solution:plan.W};
    const cs=shortest(d); if(!cs || cs.k>18){fails.clockShortest=(fails.clockShortest||0)+1;continue;}
    const k=cs.k,spare=used.frame.spare;d.clock.n=k+spare;
    if(d.clock.n>19){fails.clockNumber=(fails.clockNumber||0)+1;continue;}
    if(d.solution.indexOf(d.clock.i)+1!==k){
      const strict=shortest({...d,clock:{...d.clock,n:99}},{strict:true});
      if(!strict||strict.k!==k){fails.strictMinimum=(fails.strictMinimum||0)+1;continue;}
      d.solution=E.flatten(strict.path);
    }
    if(!E.replay(d,d.solution,{strict:true}).ok){fails.strictReplay=(fails.strictReplay||0)+1;continue;}
    if(f.chained){const ob=require('./chained_obviousness.js').measure(d);if(!ob.ok){const why=ob.rightFreePairs?'obvious:freeRoutePair':'obvious:greedyPrefix';fails[why]=(fails[why]||0)+1;continue;}}
    const p=prove(name,d,r,{k,spare,obviousnessDial:used.obviousnessDial},opts.proof || {});
    if(!p.ok){fails[p.why]=(fails[p.why]||0)+1;continue;}
    const card={layout,shape:lay.shape,tiles:c.n,trapType:f.trapType,clock:{fewestMoves:k,spare,n:d.clock.n,tile:d.clock.i},trap:p.card,attempt};
    return {design:d,roles:r,brief:used,card,fails,ms:Date.now()-t0};
    }finally{opts.onAttempt?.({attempt,fails:{...fails}});}
  }
  return {fail:'noProvenMix',fails,ms:Date.now()-t0};
}

function retime(d,spare,opts={}){
  if(!E.replay(d,d.solution,{strict:true}).ok)return {ok:false,why:'strictReplay'};
  const free={...d,clock:{...d.clock,n:99}},cs=shortest(free,opts);
  if(!cs||cs.k+spare>19)return {ok:false,why:'clockUnproven'};
  let solution=d.solution;
  if(solution.indexOf(d.clock.i)+1!==cs.k){const strict=shortest(free,{...opts,strict:true});if(!strict||strict.k!==cs.k)return {ok:false,why:'strictMinimum'};solution=E.flatten(strict.path);}
  const design={...d,clock:{...d.clock,n:cs.k+spare},solution};
  return E.replay(design,solution,{strict:true}).ok?{ok:true,design,k:cs.k}:{ok:false,why:'retimedWitness'};
}
function finishExample(raw,opts={}){
  const t0=Date.now(),name=raw.brief.story,spare=raw.card.clock.spare;let k=raw.card.clock.fewestMoves;
  const roles={...raw.roles,locks:new Set(raw.roles.locks),holderSpecials:new Set(raw.roles.holderSpecials)},notes=[],chained=!!FAMILIES[name]?.chained,band=chained?[.10,.28]:[.15,.40];
  if(roles.bait.mix.mode!==FAMILIES[name].mode)return {fail:'recipeChanged'};
  let d=clone(raw.design);
  const geo=SEP.geometry(d),mode=roles.bait.mix.mode;
  const fixed=[...(d.obst.keys.length===2?[d.obst.keys]:[]),...roles.bait.pairs,...(mode==='earlyClock'?[[d.clock.i,roles.bait.mix.originalClock]]:[])];
  if(fixed.some(([a,b])=>geo.vis[a]&&geo.vis[b]&&geo.close[a][b]))return {fail:'fixedTwinsClose'};
  const copies=roles.bait.repeat?.copies||[];
  if(copies.some((i,k)=>copies.slice(k+1).some(j=>geo.close[i][j])))return {fail:'fixedFourCopiesClose'};
  const validate=dd=>{
    const rt=retime(dd,spare);if(!rt.ok)return rt;
    return prove(name,rt.design,roles,{k:rt.k,spare},{skipOpening:true});
  };
  for(let pass=0;pass<(chained?2:6)&&!SEP.closeTwins(d).meets;pass++){
    const freeze=uniq([...d.obst.keys,...(roles.bait.repeat?.copies||[]),...roles.bait.tiles]);
    const sep=SEP.separate(d,{k,seed:(opts.seed??1)+pass*7,wallMs:opts.sepMs??7000,freeze,validate});
    notes.push({stage:'separate',pass,after:SEP.summary(sep.after),notes:sep.notes});if(sep.validated){const rt=retime(sep.design,spare);if(rt.ok){if(rt.k!==k)notes.push({stage:'retime',from:k,to:rt.k});d=rt.design;k=rt.k;}}
  }
  if(chained&&!SEP.closeTwins(d).meets){
    const repair=require('./repair_chained_twins.js').repair(d,roles,name,spare,{wallMs:25000});d=repair.design;k=d.solution.indexOf(d.clock.i)+1;notes.push({stage:'routeChangingRepair',...repair,design:undefined});
  }
  if(!SEP.closeTwins(d).meets)return {fail:'separation',notes};
  if(chained){
    const protect=new Set([...mechanismOf(d),...d.solution.slice(0,k),...roles.bait.tiles,roles.bait.mix.originalClock]);
    const down=Tail.addFaceDown(d,{protect,target:.25,cap:.30,seed:opts.seed??1});d=down.design;
    notes.push({stage:'extraFaceDown',added:down.added,want:down.want});
    if(d.down.length/d.tiles.length<.23)return {fail:'faceDownTarget',notes};
  }
  let tailReady=false;
  for(let round=0;round<2&&!tailReady;round++){
    const freeze=uniq([...roles.bait.tiles,...d.obst.keys,...(roles.bait.repeat?.copies||[])]);
    const tune=Tail.tune(d,{seed:(opts.seed??1)+round*17,wallMs:opts.tailMs??12000,band,freeze,validate});
    notes.push({stage:'tail',round,before:tune.before.tailGreedyWin,after:tune.after.tailGreedyWin,notes:tune.notes});
    if(!tune.validated)return {fail:'tailValidation',notes};
    const rt=retime(tune.design,spare);if(!rt.ok)return {fail:rt.why,notes};d=rt.design;k=rt.k;
    const score=Tail.measure(d,{seed:977,playouts:800}).tailGreedyWin;tailReady=score>=band[0]&&score<=band[1];
  }
  if(chained&&!tailReady){
    const fallback=require('./chained_tail.js').tune(d,{seed:opts.seed??1,wallMs:16000,freeze:roles.bait.tiles,validate});
    notes.push({stage:'tailPlateau',...fallback,design:undefined});if(fallback.ok){d=fallback.design;const rt=retime(d,spare);if(rt.ok){d=rt.design;k=rt.k;tailReady=true;}}
  }
  if(!tailReady)return {fail:'tailBand',notes};
  if(chained){
    for(let routePass=0;routePass<3;routePass++){
      const rr=Tail.reroute(d,{seed:(opts.seed??1)+routePass*17,gentle:true,pen:[24,120],width:180,wallMs:6000});
      if(rr.ok)d=rr.design;const o=Tail.occupancy(d);notes.push({stage:'tailRoute',routePass,ok:rr.ok,why:rr.why,occupancy:o});
      if(o.share[1]>=.40&&o.share[2]<=.20&&o.share[3]<=.05&&o.longest2plus<=6)break;
    }
    let o=Tail.occupancy(d);
    if(o.share[1]<.40||o.share[2]>.20||o.share[3]>.05||o.longest2plus>6){
      const directed=require('./chained_tail_route.js').reroute(d,{wallMs:10000,width:300});notes.push({stage:'waitingTwinRoute',...directed,design:undefined});if(directed.ok)d=directed.design;o=Tail.occupancy(d);
    }
    if(o.share[1]<.40||o.share[2]>.20||o.share[3]>.05||o.longest2plus>6)return {fail:'tailPressure',notes};
  }
  if(chained){
    const protect=new Set([...mechanismOf(d),...d.solution.slice(0,k),...roles.bait.tiles,roles.bait.mix.originalClock]),bad=d.down.filter(i=>protect.has(i));
    if(bad.length){
      d={...d,down:d.down.filter(i=>!protect.has(i))};const fd=Tail.addFaceDown(d,{protect,target:.25,cap:.30,seed:(opts.seed??1)+97});d=fd.design;
      notes.push({stage:'protectFinalRoute',removed:bad,added:fd.added});const rt=retime(d,spare);if(!rt.ok)return {fail:rt.why,notes};d=rt.design;k=rt.k;
      const score=Tail.measure(d,{seed:977,playouts:800}).tailGreedyWin;if(score<.10||score>.28)return {fail:'postVisibilityTailBand',notes};
    }
  }
  const p=prove(name,d,roles,{k,spare,obviousnessDial:raw.brief.obviousnessDial});if(!p.ok)return {fail:'finalProof:'+p.why,notes};
  const V=require(chained?'./verify_chained_mixes.js':'./verify_trap_mixes.js'),tail=Tail.measure(d,{seed:977,playouts:800});
  const pf=T.pressureFacts(d,{capNodes:60000,firstNodes:1e6}),pressureFacts={capProof:pf.capProof,needsWaiting:pf.needsWaitingProven?pf.needsWaiting:null,needsWaitingProven:pf.needsWaitingProven};
  const r={schema:chained?'chained-v1':'trap-variety-v1',design:d,brief:raw.brief,roles:raw.roles,
    card:{...raw.card,clock:{fewestMoves:k,spare,n:d.clock.n,tile:d.clock.i},trap:p.card,tail,pressure:V.storedPressure(d),pressureFacts,
      ...(chained?{layers:Math.max(...d.tiles.map(t=>t[2]))+1,tailOccupancy:Tail.occupancy(d)}:{}),
      faceDownShare:(d.down||[]).length/d.tiles.length,twins:SEP.summary(SEP.closeTwins(d))},notes,ms:Date.now()-t0};
  const verification=V.verify(r);if(!verification.ok)return {fail:'independentVerification',verification,notes};
  r.verification=verification;return chained?require('./loosen_chained.js').loosen(r):r;
}

module.exports={FAMILIES,STORIES,build,place,prove,price,shortest,opening,mechanismOf,rngOf,clone,retime,lockedRelay,finishExample,SEP,Tail,Ledger};
