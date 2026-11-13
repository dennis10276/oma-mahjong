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
const { tileVisibility } = require('../sim/refit/human_board_visibility.js');
const clone = x => JSON.parse(JSON.stringify(x));
const uniq = a => [...new Set(a)];
const rngOf = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const shuffled = (a, rng) => a.map(v => [rng(), v]).sort((a,b) => a[0]-b[0]).map(x=>x[1]);

// These are recipes, not twelve labels for unchanged chain shapes. Each adds a
// fork, changes the clock's position, or makes a branched / second-act mechanism.
const DEFINITIONS = [
  ['doubleFalseStart', 'lockedMelt', null, 'freezeLock', 'Fetch the far key before using either the free key or the lonely thaw tile, then thaw the locked exit.', 'Two distinct losing ideas; frozen shared exit.'],
  ['twoLonelyMelts', 'lockedMelt', null, 'dualMelt', 'The clock and a key roof each offer a lonely thaw tile; prepare their paired routes instead of parking either lonely picture.', 'Two thaw fronts, each with its own independently priced decoy.'],
  ['sharedRoofLocks', 'chain', 0, 'addLock', 'One key pair opens two different steps of the roof; clear the key route before parking the easy key.', 'A shared key pair and an extra locked prerequisite.'],
  ['splitThawLocks', 'chain', 3, 'addLock', 'The keys open separate thaw exits together; use the exit whose picture can leave the tray.', 'Branching locks on distinct thaw routes.'],
  ['frozenExitFork', 'lockedMelt', null, 'freezeTwoLocks', 'Opening the keys is only half the job: choose which of two frozen locked exits to thaw before freeing the clock.', 'Two parallel exits with two conditions each.'],
  ['nestedMeltFork', 'wrongMelt', null, 'freezeRight', 'Melt the inner neighbour first and save the lonely outer neighbour for its buried partner.', 'Two-stage thaw with an outer decoy.'],
  ['keyRoofMeltFork', 'chain', 0, 'freezeRight', 'Thaw the key roof through its own neighbour before collecting the two keys together.', 'A staged melt on the key side rather than the clock side.'],
  ['freeClockIce', 'wrongMelt', null, 'earlyClock', 'The clock is already free, but taking it now uses the tray space needed to melt the route to its partner.', 'A takeable clock is itself the bait.'],
  ['freeClockKeys', 'guardedKey', null, 'earlyClock', 'Leave the exposed clock until the frozen key roof is cleared, or its waiting picture blocks the key dig.', 'A free clock in parallel with a keyed ice gate.'],
  ['freeClockShared', 'lockedMelt', null, 'earlyClock', 'The free clock and the free melting neighbour compete for tray room while the keys open the clock partner route.', 'A clock bait beside a shared-lock thaw fork.'],
  ['frozenKeyShared', 'chain', 18, 'addLock', 'The frozen key opens two separate exits, so thaw its route before spending a slot on the other key.', 'A frozen key feeding a branched lock mechanism.'],
  ['frozenRoofShared', 'chain', 26, 'addLock', 'The icy locked roof and another locked step open together, but their thaw route still has to be prepared.', 'Three locks sharing keys, with a frozen roof.'],
  ['secondActIce', 'guardedKey', null, 'tailIce', 'Saving the clock leaves an icy gate in the remaining picture route; keep space for the tiles that melt it.', 'An independently measured obstacle after the clock.'],
  ['secondActKeys', 'wrongMelt', null, 'tailLock', 'Melt the clock without stranding its neighbour, then gather the tail keys before opening the waiting picture gate.', 'A separate keyed second act linked through a waiting picture.'],
];
const FAMILIES = Object.fromEntries(DEFINITIONS.map(([name, base, chain, mode, see, recipe]) => [name, {
  name, base, chain, mode, see, recipe, trapType: 'mix:' + name,
  dials: { easier: 'spare 2; one wrong neighbour; shorter key dig', harder: 'spare 1; two wrong neighbours; tail width 3' },
}]));

function place(name, c, brief, rng) {
  const f = FAMILIES[name]; if (!f) return { fail: 'unknownMix' };
  const b = { ...brief, targets: { ...brief.targets }, ...(f.chain != null ? { chain: T.CHAIN_SHAPES[f.chain] } : {}) };
  if (f.base === 'lockedMelt') { b.frame = { ...b.frame, depth: b.frame?.depth ?? 2 }; b.targets.locks = 4; }
  const r = T.STORIES[f.base].place(c, b, rng); if (r.fail) return r;
  let P = r.dig || B.planDig(c, r, rng); if (!P) return { fail: 'baseDig' };
  const bait = r.bait, originalClock = r.clock;
  const protectedTiles = new Set([r.clock, ...r.keys, ...r.locks, ...Object.keys(r.ice).map(Number), ...bait.tiles]);
  const visible = i => c.roleShown0[i] && T.vis0Of(c)[i].role;
  let added = null;
  if (f.mode === 'addLock') {
    const cand = shuffled(P.filter(i => !protectedTiles.has(i) && visible(i) && r.keys.every(k => P.indexOf(k) < P.indexOf(i))), rng);
    if (!cand.length) return { fail: 'noExtraLock' };
    added = cand[0]; r.locks.add(added);
  } else if (f.mode === 'freezeLock' || f.mode === 'freezeTwoLocks') {
    const cand = shuffled([...r.locks].filter(i => visible(i) && c.inb[i].length >= 2 && !r.ice[i]), rng);
    const count=f.mode==='freezeTwoLocks'?2:1;
    if (cand.length<count) return { fail: 'noFrozenExit' };
    added = cand[0]; for(const tile of cand.slice(0,count))r.ice[tile] = 2;
    P = null;
  } else if (f.mode === 'freezeRight') {
    const hosts = Object.keys(r.ice).map(Number);
    const cand = shuffled(uniq(hosts.flatMap(h => T.thawNbs(c,h))).filter(i => !protectedTiles.has(i) && visible(i) && c.inb[i].length >= 2 && P.includes(i)), rng);
    if (!cand.length) return { fail: 'noInnerMelt' };
    added = cand[0]; r.ice[added] = 2; P = null;
  } else if (f.mode === 'dualMelt') {
    const far=bait.keyFar;
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
    const cand = shuffled([...Array(c.n).keys()].filter(i => c.free0[i] && visible(i) && !r.keys.includes(i) && !r.locks.has(i) && !r.ice[i] && !P.includes(i) && !bait.pairs.some(p => p.includes(i))), rng);
    // Prefer a new clock over a bait tile: retain the authored lonely-picture pair.
    if (!cand.length) return { fail: 'noFreeClock' };
    added = cand[0]; r.clock = added; P = P.concat(added);
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
  r.dig = P;
  const specials = uniq([r.clock, ...r.keys, ...r.locks, ...Object.keys(r.ice).map(Number)]);
  const mechanism = uniq([...specials, ...specials.flatMap(i => [...c.above[i]]), ...Object.keys(r.ice).map(Number).flatMap(i => c.inb[i])]);
  r.bait = { ...bait, type: name, keepUp: uniq([...bait.keepUp, ...mechanism]),
    tiles: uniq([...bait.tiles, ...(f.mode === 'earlyClock' ? [r.clock] : [])]),
    mix: { originalClock, added, mode: f.mode }, see: f.see };
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
  if ((d.down || []).length / d.tiles.length > .3) return {ok:false,why:'faceDownShare'};
  const g = E.game(d), s0 = E.start(g), vis = tileVisibility(g.tiles,{...s0,down:g.down,openPeek:-1},null).tiles;
  const special = uniq([d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)]);
  if (special.some(i=>g.down[i] || !vis[i].role)) return {ok:false,why:'hiddenSpecial'};
  const candidates = uniq([...(roles.bait.wrong || []), ...(roles.bait.keyEarly != null ? [roles.bait.keyEarly] : []),
    ...(roles.bait.keyNear != null ? [roles.bait.keyNear] : []), ...(roles.bait.keyB != null ? [roles.bait.keyB] : []),
    ...(f.mode==='earlyClock'?[d.clock.i]:[])]).map(i=>[i]);
  const C = D.clockGames(d), w = D.work(3e6,opts.wallMs ?? 18000);
  const baits = candidates.map(a=>price(d,a,k,{C,w})).filter(p=>costly(p,spare));
  if (!baits.length) return {ok:false,why:'noProvenBait'};
  if (f.mode==='earlyClock' && !baits.some(p=>p.tiles.includes(d.clock.i))) return {ok:false,why:'clockNotBait'};
  if (f.mode==='dualMelt' && (roles.bait.wrong.length<2 || roles.bait.wrong.some(i=>!baits.some(p=>p.tiles.includes(i))))) return {ok:false,why:'needTwoLonelyBaits'};
  if (name==='doubleFalseStart' && (!baits.some(p=>p.tiles.includes(roles.bait.keyNear)) || !baits.some(p=>roles.bait.wrong.includes(p.tiles[0])))) return {ok:false,why:'needTwoBaits'};
  const mech=mechanismOf(d), controls=D.temptingMoves(g,s0,{singles:true}).filter(m=>!m.peek && m.take.every(i=>!mech.has(i)));
  const rows=controls.map(m=>price(d,m.take,k,{C,w}));
  if(rows.some(p=>!p || !p.exact || p.result==='unknown')) return {ok:false,why:'controlUnknown'};
  const dearest=rows.sort((a,b)=>value(b,k)-value(a,k))[0] || null;
  // Report the complete control, not the capped sample used by the older stories.
  const control={ moves:rows.length,dearest,value:dearest?value(dearest,k):0 };
  for(const bait of baits)bait.aboveControl=value(bait,k)>control.value;
  const first=opts.skipOpening?null:opening(d);
  if(first && first.winning<3) return {ok:false,why:'fewerThan3WinningStarts'};
  const effects=[];
  if(!opts.skipEffects) for(const [kind,tile] of [...d.obst.locks.map(i=>['lock',i]),...Object.keys(d.obst.ice).map(i=>['ice',+i])]) {
    const dd=clone(d); if(kind==='lock') dd.obst.locks=dd.obst.locks.filter(i=>i!==tile); else delete dd.obst.ice[tile];
    const cs=shortest({...dd,clock:{...dd.clock,n:99}});
    let effect=cs&&cs.k<k?{by:'clockRoute',kWithout:cs.k}:null;
    if(!effect) for(const bait of baits) {
      const p=price(dd,bait.tiles,k,{nodes:250000});
      if(p?.exact && p.result==='win' && p.cost<=spare) { effect={by:'baitDefused',bait:bait.tiles,costWithout:p.cost};break; }
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
  const card={type:name,trapType:f.trapType,see:f.see,recipe:f.recipe,dials:f.dials,k,spare,baits,control,effects,firstMoves:first,mechanism:roles.bait.mix,
    needsUi:special.some(i=>d.obst.ice[i] && (d.obst.keys.includes(i)||d.obst.locks.includes(i)))?'TASK-13':null};
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
    const P=r.dig,hold=B.chooseHolders(c,r,P,{},rng),N=B.necessary(c,r,P);
    if(f.mode==='tailIce'||f.mode==='tailLock'){
      const extra=[...Array(c.n).keys()].filter(i=>hold.cov[i]&&!P.includes(i)&&i!==r.bait.mix.added&&!r.keys.includes(i)&&!r.bait.tiles.includes(i));
      hold.holders=new Set([r.bait.mix.added,...extra.slice(0,3)]);
    }
    const plan=VC.placePicturesVC(c,r,P,hold,used,rng,N);
    if(!plan || plan.fail){const why=plan?.fail||'pictures';fails[why]=(fails[why]||0)+1;continue;}
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
    const p=prove(name,d,r,{k,spare},opts.proof || {});
    if(!p.ok){fails[p.why]=(fails[p.why]||0)+1;continue;}
    const card={layout,shape:lay.shape,tiles:c.n,trapType:f.trapType,clock:{fewestMoves:k,spare,n:d.clock.n,tile:d.clock.i},trap:p.card,attempt};
    return {design:d,roles:r,brief:used,card,fails,ms:Date.now()-t0};
    }finally{opts.onAttempt?.({attempt,fails:{...fails}});}
  }
  return {fail:'noProvenMix',fails,ms:Date.now()-t0};
}

function finishExample(raw,opts={}){
  const t0=Date.now(),name=raw.brief.story,k=raw.card.clock.fewestMoves,spare=raw.card.clock.spare;
  const roles={...raw.roles,locks:new Set(raw.roles.locks),holderSpecials:new Set(raw.roles.holderSpecials)},notes=[];
  let d=clone(raw.design);
  const validate=dd=>{
    if(!E.replay(dd,dd.solution,{strict:true}).ok)return {ok:false,why:'strictReplay'};
    const cs=shortest({...dd,clock:{...dd.clock,n:99}});if(!cs||cs.k!==k)return {ok:false,why:'clockChanged'};
    return prove(name,dd,roles,{k,spare},{skipOpening:true});
  };
  for(let pass=0;pass<4&&!SEP.closeTwins(d).meets;pass++){
    const sep=SEP.separate(d,{k,seed:(opts.seed??1)+pass*7,wallMs:opts.sepMs??7000,freeze:pass<2?roles.bait.tiles:[],validate});
    notes.push({stage:'separate',pass,after:SEP.summary(sep.after),notes:sep.notes});if(sep.validated)d=sep.design;
  }
  if(!SEP.closeTwins(d).meets)return {fail:'separation',notes};
  const tune=Tail.tune(d,{seed:opts.seed??1,wallMs:opts.tailMs??12000,freeze:roles.bait.tiles,validate});
  notes.push({stage:'tail',before:tune.before.tailGreedyWin,after:tune.after.tailGreedyWin,notes:tune.notes});
  if(!tune.inBand||!tune.validated)return {fail:'tailBand',notes};
  d=tune.design;
  const p=prove(name,d,roles,{k,spare});if(!p.ok)return {fail:'finalProof:'+p.why,notes};
  const V=require('./verify_trap_mixes.js'),tail=Tail.measure(d,{seed:977,playouts:800});
  const r={schema:'trap-variety-v1',design:d,brief:raw.brief,roles:raw.roles,
    card:{...raw.card,trap:p.card,tail,pressure:V.storedPressure(d),pressureFacts:T.pressureFacts(d,{capNodes:60000,firstNodes:1e6}),
      faceDownShare:(d.down||[]).length/d.tiles.length,twins:SEP.summary(SEP.closeTwins(d))},notes,ms:Date.now()-t0};
  const verification=V.verify(r);if(!verification.ok)return {fail:'independentVerification',verification,notes};
  r.verification=verification;return r;
}

module.exports={FAMILIES,STORIES,build,place,prove,price,shortest,opening,mechanismOf,rngOf,clone,finishExample,SEP,Tail,Ledger};
