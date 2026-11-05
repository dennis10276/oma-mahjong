'use strict';
const assert = require('assert/strict');

const Layouts = require('./physics/layouts.js');
const { inferMatchedPicture } = require('./public_matched_picture.js');
const {clockMateRouteBudget}=require('./public_clock_mate_budget.js');
const {createKeyIdentityMemory}=require('./public_key_identity_memory.js');
const {createRetryAccessMemory}=require('./public_retry_access_memory.js');

// Behavioral controller adapted from238f5ec. The trusted shared runner owns
// terminal classification, capped means and independent production replay.

// Frozen human-v0 profiles remain counterfactual controls and define base fields.
// Released API defaults are versioned separately in human_release.js.
const PROFILES = {
  dennis: {
    clockHorizon: 3,
    partnerHorizon: 2,
    clockWeight: 42,
    postClockKeyWeight: 32,
    clockUrgencyPower: 2,
    trayCost: 6,
    pairReward: 15,
    exploration: 4,
    freePeekBonus: 18,
    zWeight: 1.8,
    temperature: 0.8,
    lapse: 0.005,
    memoryDecay: 0.0005,
    retryRetention: 0.88,
    peekPatience: 2,
    outWeight: 9,
    trayDepth: 3,
    clockTrayDepth: 3,
    futureWeight: 3.5,
    strictClockSlack: true,
    flippedBlockerBalk0: 12.8,
    flippedBlockerBalk1: -5.0
  },
  family: {
    clockHorizon: 2,
    partnerHorizon: 1,
    clockWeight: 32,
    postClockKeyWeight: 20,
    clockUrgencyPower: 1.6,
    trayCost: 4.8,
    pairReward: 16,
    exploration: 5,
    freePeekBonus: 12,
    zWeight: 1.2,
    temperature: 1.8,
    lapse: 0.04,
    memoryDecay: 0.015,
    retryRetention: 0.65,
    peekPatience: 2,
    outWeight: 6,
    trayDepth: 2,
    clockTrayDepth: 2,
    futureWeight: 1.8,
    strictClockSlack: false,
    flippedBlockerBalk0: 6.0,
    flippedBlockerBalk1: -2.0,
    extraClockLookProbability: 0.5
  }
};

Object.values(PROFILES).forEach(Object.freeze);Object.freeze(PROFILES);

function visibleRole(game, state, index) {
  if (!game.rules || state.relieved) return 'none';
  const r = game.rules, gone = r.iceNb[index].filter(i => !state.alive[i]).length;
  const remaining = Math.max(0, (r.ice[index] || 0) - gone);
  if (remaining) return remaining > 1 ? 'ice2' : 'ice';
  const keysLeft = r.keys.some(i => state.alive[i]);
  if (keysLeft && r.locks?.has(index)) return 'lock';
  return keysLeft && r.keys.includes(index) ? 'key' : 'none';
}

function lossPhaseName(state, clock) {
  if (clock && state.alive[clock.i]) return 'beforeClock';
  return state.alive.reduce((a, b) => a + b, 0) <= 10 ? 'late' : 'mid';
}

function createBotController(tiles, profile, seed) {
  assert(Number.isInteger(seed));
  const allowed=new Set([...Object.keys(PROFILES.dennis),'extraClockLookProbability','deadlineAttentionProbability','deadlineLearningRate','clockRowPreview','sharedClockIce','clockOutsPlan','clockCompletionBonus','retryClockTrayDepth','retryClockHorizon','retryKeyIdentityMemory','retryLockedCarryKeys','retryPrepareKeyOuts','retryKeyRouteValue','retryKeyPictureRelations','retryAccessMemory','clockBesideLockKeys','spotPenalty','planAhead','lookDepth','lookPenalty','lookFrom','pairFirst','clockFirst','clockNeedFull','routePlan','routeBeam','routeHope','routeNeed','routeNeedTray']);
  assert(Object.entries(profile).every(([key,value])=>allowed.has(key)&&(key==='strictClockSlack'?typeof value==='boolean':Number.isFinite(value))),'Only fixed global behavioral parameters are supported');
  assert(Object.keys(PROFILES.dennis).every(key=>Object.hasOwn(profile,key)),'Incomplete behavioral profile');
  const p = { ...profile }, random = Layouts.rng(seed);
  if (process.env.G51_SPOT) p.spotPenalty = +process.env.G51_SPOT;   // (calibration switch)
  if (process.env.G51_PLAN) p.planAhead = +process.env.G51_PLAN;   // (calibration switch)
  if (process.env.G51_TRAYCOST) p.trayCost = +process.env.G51_TRAYCOST;   // (calibration switch)
  if (process.env.G51_PAIR) p.pairFirst = +process.env.G51_PAIR;   // (calibration switch)
  if (process.env.G51_PEEK) p.freePeekBonus = +process.env.G51_PEEK;   // (calibration switch)
  if (process.env.G51_CLOCKFIRST) p.clockFirst = +process.env.G51_CLOCKFIRST;   // (calibration switch)
  if (process.env.G51_NEEDFULL) p.clockNeedFull = +process.env.G51_NEEDFULL;   // (calibration switch)
  if (process.env.G51_ROUTE) { const [w, b] = process.env.G51_ROUTE.split(',').map(Number); p.routePlan = w; if (b) p.routeBeam = b; } if (process.env.G51_HOPE) p.routeHope = +process.env.G51_HOPE;   // (calibration switch)
  if (process.env.G51_PEEKPAT) p.peekPatience = +process.env.G51_PEEKPAT;   // (calibration switch)
  if (process.env.G51_LOOK) { const [d, w, f] = process.env.G51_LOOK.split(',').map(Number); p.lookDepth = d; p.lookPenalty = w; if (f) p.lookFrom = f; }   // (calibration switch)
  for(const key of ['clockHorizon','partnerHorizon','trayDepth','clockTrayDepth'])assert(Number.isInteger(p[key])&&p[key]>=0&&p[key]<=4,'Human planning horizon must stay within four actions/dependencies');
  for(const key of ['lapse','memoryDecay','retryRetention'])assert(p[key]>=0&&p[key]<=1);
  assert(p.temperature>0);
  assert(!p.retryKeyPictureRelations||p.retryKeyIdentityMemory===1,'Picture relationships require observed key identities');
  assert(!p.retryKeyRouteValue||p.retryLockedCarryKeys===1,'Key-route value requires actual-loss dependency learning');
  assert(!p.retryPrepareKeyOuts||p.retryLockedCarryKeys===1,'Key preparation requires actual-loss dependency learning');
  assert(p.retryClockHorizon===undefined||Number.isInteger(p.retryClockHorizon)&&p.retryClockHorizon>=p.clockHorizon&&p.retryClockHorizon<=4);
  assert(p.retryClockTrayDepth===undefined||Number.isInteger(p.retryClockTrayDepth)&&p.retryClockTrayDepth>=p.clockTrayDepth&&p.retryClockTrayDepth<=p.trayDepth&&p.retryClockTrayDepth<=4);
  assert(p.clockCompletionBonus===undefined||p.clockCompletionBonus>=0&&p.clockCompletionBonus<=120);
  for(const [key,value]of Object.entries(p))if(key!=='strictClockSlack'&&!key.startsWith('flippedBlockerBalk'))assert(value>=0);
  for(const key of ['extraClockLookProbability','deadlineAttentionProbability','deadlineLearningRate'])assert(p[key]===undefined||Number.isFinite(p[key])&&p[key]>=0&&p[key]<=1);
  for(const key of ['clockRowPreview','sharedClockIce','clockOutsPlan','retryKeyIdentityMemory','retryLockedCarryKeys','retryPrepareKeyOuts','retryKeyRouteValue','retryKeyPictureRelations','retryAccessMemory','clockBesideLockKeys'])assert(p[key]===undefined||p[key]===0||p[key]===1);
  // A separate attention stream leaves the released move-noise sequence intact.
  const attentionRandom=Layouts.rng((seed^0x4d2c6df7)|0);
  let clockHorizon=p.clockHorizon,strictClockSlack=p.strictClockSlack;
  const nb = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles);
  const n = tiles.length;
  const retryKeyMemory=p.retryKeyIdentityMemory?createKeyIdentityMemory(n):null;
  const keyPictureRelations=new Map();
  const retryAccess=p.retryAccessMemory?createRetryAccessMemory(n):null;
  const aboveTrans = tiles.map((_, i) => {
    const set = new Set(), stack = [...nb.above[i]];
    while (stack.length) {
      const u = stack.pop();
      if (!set.has(u)) { set.add(u); stack.push(...nb.above[u]); }
    }
    return set;
  });
  const below = tiles.map((_, i) => tiles.map((__, j) => j).filter(j => nb.above[j].includes(i)));

  let memory = tiles.map(() => null);
  let roles = tiles.map(() => null);
  let state, seen, visits = new Map(), attempt = 0, lastDecision = null;
  let clockLosses = 0, initialClock = null, earlyClockLosses = 0, tookEarlyClockThisAttempt = false;
  const failedDigs = new Map();
  const learnedLockedCarry=new Map();
  let attemptDigs = [];
  let routeCache = null;

  function rememberedKeyTargets(){
    return retryKeyMemory?retryKeyMemory.entries().filter(f=>f.attempt<attempt&&state?.alive[f.index]).map(f=>f.index):[];
  }

  function clockTrayPlanningDepth(){
    return Math.min(p.trayDepth??0,clockLosses>0&&p.retryClockTrayDepth!==undefined?p.retryClockTrayDepth:(p.clockTrayDepth??3));
  }

  function beginAttempt() {
    routeCache = null;
    tookEarlyClockThisAttempt = false;
    clockHorizon=Math.min(4,(clockLosses>0&&p.retryClockHorizon!==undefined?p.retryClockHorizon:p.clockHorizon)+(p.extraClockLookProbability!==undefined&&attentionRandom()<p.extraClockLookProbability?1:0));
    strictClockSlack=p.deadlineAttentionProbability===undefined?p.strictClockSlack:attentionRandom()<Math.min(1,p.deadlineAttentionProbability+clockLosses*(p.deadlineLearningRate??0));
    if (attempt++) {
      memory = memory.map(v => random() < p.retryRetention ? v : null);
    }
    roles = tiles.map(() => null);
    visits = new Map();
    lastDecision = null;
    attemptDigs = [];
  }

  function endAttempt(phase, terminalTray) {
    if (phase === 'beforeClock') clockLosses++;
    if (phase !== null && tookEarlyClockThisAttempt) earlyClockLosses++;
    if(p.retryLockedCarryKeys&&['beforeClock','mid','late'].includes(phase)&&Array.isArray(terminalTray)){
      for(const face of terminalTray){
        const partner=memory.findIndex((f,i)=>f===face&&state.alive[i]&&roles[i]==='lock');
        if(partner>=0&&!learnedLockedCarry.has(face))learnedLockedCarry.set(face,{face,partner,attempt,physicalTaps:state.physicalTaps,source:'actual terminal carry and remembered observed locked matching partner; retry goal only'});
      }
    }
    if (phase !== null && Array.isArray(terminalTray)) {
      for (const d of attemptDigs) {
        if (d.face !== null && terminalTray.includes(d.face)) {
          failedDigs.set(d.index, (failedDigs.get(d.index) ?? 0) + 1);
        }
      }
    }
  }

  function observe(s, o) {
    if (o.clock && !initialClock) initialClock = { i: o.clock.i, n: o.clock.n };
    if (lastDecision) {
      const proof = inferMatchedPicture(lastDecision, lastDecision.index, {
        alive: s.alive, moves: s.moves, openPeek: s.openPeek, physicalTaps: s.physicalTaps, tray: s.tray
      });
      if (proof) { memory = memory.slice(); memory[proof.index] = proof.picture; }
      if (!s.alive[lastDecision.index] && s.tray.length > lastDecision.tray.length) {
        const addedFace = s.tray.at(-1);
        if (initialClock && lastDecision.index === initialClock.i) {
          initialClock.face = addedFace;
          if (initialClock.n >= 14 && (initialClock.n - lastDecision.moves) >= 8) {
            tookEarlyClockThisAttempt = true;
          }
        }
        if (lastDecision.tray.length >= 1) {
          attemptDigs.push({ index: lastDecision.index, face: addedFace, trayLen: lastDecision.tray.length });
        }
      }
      lastDecision = null;
    }
    state = {
      alive: Array.from(s.alive), tray: Array.from(s.tray), moves: s.moves,
      openPeek: s.openPeek, relieved: !!s.relieved, arriving: Array.from(s.arriving ?? []),
      physicalTaps: s.physicalTaps
    };
    seen = {
      pictures: Array.from(o.pictures), roles: Array.from(o.roles),
      down: Array.from(o.down), takeable: Array.from(o.takeable),
      clock: o.clock ? { i: o.clock.i, n: o.clock.n, remaining: o.clock.remaining } : null
    };
    memory = memory.map((v, i) => o.pictures[i] !== null ? o.pictures[i] : s.alive[i] && random() < p.memoryDecay ? null : v);
    roles = roles.map((v, i) => o.roles[i] ?? v);
    retryKeyMemory?.observe(state,seen.roles,attempt);
    retryAccess?.observe(state,seen,attempt);
    if(p.retryKeyPictureRelations){
      const keys=retryKeyMemory.keys();
      for(let a=0;a<keys.length;a++)for(let b=a+1;b<keys.length;b++){
        const i=keys[a],j=keys[b],id=i+'|'+j;
        if(memory[i]!==null&&memory[i]===memory[j]&&!keyPictureRelations.has(id))keyPictureRelations.set(id,{a:i,b:j,attempt,physicalTaps:state.physicalTaps,source:'actual known pictures of observed key identities matched; static relationship only'});
      }
      for(const [id,fact]of keyPictureRelations){
        if(fact.attempt>=attempt)continue;
        const a=memory[fact.a],b=memory[fact.b];
        if(a!==null&&b!==null&&a!==b){keyPictureRelations.delete(id);continue;}
        if(a!==null&&b===null&&state.alive[fact.b])memory[fact.b]=a;
        else if(b!==null&&a===null&&state.alive[fact.a])memory[fact.a]=b;
      }
    }
  }

  function suggestsNoEasyEscape(index) {
    const face = memory[index];
    if (face === null || face === 101 || state.tray.includes(101)) return false;
    const alive = state.alive.slice(), tray = state.tray.slice();
    let peek = state.openPeek;
    const onPile = peek >= 0 && peek !== index && alive[peek] && memory[peek] === face && seen.takeable[peek] === true;
    alive[index] = 0;
    const q = tray.indexOf(face);
    if (q >= 0) tray.splice(q, 1);
    else if (onPile) { alive[peek] = 0; peek = -1; }
    else tray.push(face);
    if (peek === index) peek = -1;

    if (tray.length >= 4) return true;
    if (tray.length < 3) return false;

    let unlocked = state.relieved || roles[index] === 'key' || seen.roles[index] === null ||
      (onPile && (roles[state.openPeek] === 'key' || seen.roles[state.openPeek] === null));

    const usable = i => {
      if (!alive[i] || !Layouts.isFree(i, alive, nb)) return false;
      if (seen.takeable[i] === true || unlocked) return true;
      if (seen.roles[i] === 'lock') return false;
      const need = seen.roles[i] === 'ice' ? 1 : seen.roles[i] === 'ice2' ? 2 : 0;
      if (need && iceNb[i].filter(j => state.alive[j] && !alive[j]).length < need) return false;
      return true;
    };

    // A greedy, limited heuristic, never an exhaustive death certificate.
    const maxResolveSteps = p.trayDepth >= 3 ? 4 : 1;
    for (let step = 0; step < maxResolveSteps; step++) {
      const cands = [];
      for (let i = 0; i < n; i++) if (usable(i)) cands.push(i);
      if (cands.some(i => memory[i] === null || memory[i] === 101 || tray.includes(memory[i]))) return false;
      let matchedPair = null;
      for (let a = 0; a < cands.length && !matchedPair; a++) {
        for (let b = a + 1; b < cands.length; b++) {
          const u = cands[a], v = cands[b];
          if (memory[u] === memory[v] && (seen.down[u] !== 0 || seen.down[v] !== 0)) {
            matchedPair = [u, v];
            break;
          }
        }
      }
      if (!matchedPair) return true;
      const [u, v] = matchedPair;
      alive[u] = 0; alive[v] = 0;
      if (roles[u] === 'key' || seen.roles[u] === null || roles[v] === 'key' || seen.roles[v] === null) unlocked = true;
    }
    return false;
  }

  function computeTrayHorizon(depth,keyWork=[],knownKeyIds=null) {
    if (!depth) return new Map();
    const val = s => (n - s.alive.reduce((a, b) => a + b, 0)) * 4 - s.tray.length * (s.tray.length + 1) * 4 + p.pairReward*keyWork.reduce((v,i)=>v+(!s.alive[i]?1:0),0);
    const initial = { alive: state.alive.slice(), tray: state.tray.slice(), peek: state.openPeek, unlock: false };
    const base = val(initial), scores = new Map(),accessMasks=new WeakMap();
    const rememberedDown=i=>seen.down[i]??retryAccess?.downValue(i,attempt)??null;
    const accessProved=(s,i)=>{if(!retryAccess)return false;let mask=accessMasks.get(s);if(mask===undefined){mask=retryAccess.removedMask(s.alive);accessMasks.set(s,mask);}return retryAccess.canTake(i,mask,state.relieved,attempt);};

    function iceReady(s, i) {
      const need = roles[i] === 'ice' ? 1 : roles[i] === 'ice2' ? 2 : 0;
      return need > 0 && iceNb[i].filter(j => initial.alive[j] && !s.alive[j]).length >= need;
    }

    function isFreeAndUsable(s, i) {
      if (!s.alive[i] || !Layouts.isFree(i, s.alive, nb)) return false;
      return seen.takeable[i] === true || roles[i] === 'none' || roles[i] === 'key' ||
        (roles[i] === 'lock' && s.unlock) || iceReady(s, i) || accessProved(s,i);
    }

    function stepMove(s, i) {
      if (rememberedDown(i) === null || s.tray.includes(101)) return null;
      const f = memory[i];
      if (f === null || f === 101) return null;
      const next = { alive: s.alive.slice(), tray: s.tray.slice(), peek: s.peek, unlock: s.unlock };
      const q = next.tray.indexOf(f);
      const mate = s.peek >= 0 && s.peek !== i && s.alive[s.peek] && memory[s.peek] === f && isFreeAndUsable(s, s.peek);
      if (q >= 0) {
        next.alive[i] = 0; next.tray.splice(q, 1); if (next.peek === i) next.peek = -1;
      } else if (mate) {
        next.alive[i] = 0; next.alive[s.peek] = 0; next.peek = -1;
      } else if (rememberedDown(i) === 1 && s.peek !== i) {
        // A known closed picture still needs its physical peek before a take.
        next.peek = i;
      } else {
        next.alive[i] = 0; next.tray.push(f); if (next.peek === i) next.peek = -1;
      }
      if (!next.alive[i] && (roles[i] === 'key' || retryAccess&&knownKeyIds?.includes(i) || mate&&(roles[s.peek]==='key'||retryAccess&&knownKeyIds?.includes(s.peek)))) {
        if (!(knownKeyIds?knownKeyIds.some(j=>next.alive[j]):roles.some((r,j)=>r==='key'&&next.alive[j]))) next.unlock = true;
      }
      return next.tray.length >= 4 ? null : next;
    }

    function search(s, left) {
      let best = val(s);
      if (left <= 0) return best;
      const avail = [];
      for (let i = 0; i < n; i++) {
        if (isFreeAndUsable(s, i)) {
          const nxt = stepMove(s, i);
          if (nxt) avail.push({ nxt, r: val(nxt) });
        }
      }
      avail.sort((a, b) => b.r - a.r);
      for (const { nxt } of avail.slice(0, 6)) {
        best = Math.max(best, search(nxt, left - 1));
      }
      return best;
    }

    for (let i = 0; i < n; i++) {
      if (seen.takeable[i] === true) {
        const nxt = stepMove(initial, i);
        const known = memory[i] !== null && rememberedDown(i) !== null && memory[i] !== 101 && !initial.tray.includes(101);
        scores.set(i, nxt ? search(nxt, depth - 1) - base : known ? -100 : 0);
      }
    }
    return scores;
  }

  function decide() {
    const { alive, tray, openPeek } = state;
    const legal = seen.takeable.flatMap((v, i) => v === true ? [i] : []);
    if (!legal.length) return null;
    const priorKeyTargets=new Set(rememberedKeyTargets());
    // Look-ahead (Dennis 2026-11-03: "the planning ahead I do"; "do this and keep calibrating planning until the 3-tray
    // rate gets close to my 10.5%"): with only the tiles whose pictures are known, can the tray be brought down again
    // (a match) within `d` more takes without a 4th tile waiting? Usable: free, not locked while keys remain, ice
    // with enough of its neighbours gone since now.
    const keyTiles = tiles.flatMap((_, k) => roles[k] === 'key' ? [k] : []);
    const usableIn = (al, j) => {
      if (!al[j] || !Layouts.isFree(j, al, nb)) return false;
      if (roles[j] === 'lock') return !keyTiles.some(k => al[k]);
      const ice = roles[j] === 'ice' ? 1 : roles[j] === 'ice2' ? 2 : 0;
      return !ice || seen.takeable[j] === true || iceNb[j].filter(k => alive[k] && !al[k]).length >= ice;
    };
    const canRelieve = (al, tr, d) => {
      const known = [];
      for (let j = 0; j < n; j++) if (memory[j] !== null && usableIn(al, j)) { if (tr.includes(memory[j])) return true; known.push(j); }
      if (d <= 0 || tr.length >= 3) return false;
      for (const j of known) { const al2 = al.slice(); al2[j] = 0; if (canRelieve(al2, tr.concat(memory[j]), d - 1)) return true; }
      return false;
    };
    // Route planner (Dennis 2026-11-03: "Build a route planner first" - a person finds the exact way to the clock over
    // a few tries): with the pictures known (unknown ones count as never matching), a beam search for a way to take the
    // clock tile within its moves, never more than 3 tiles waiting. The plan is kept while the board follows it and
    // made again when it does not; its next tile gets routePlan extra.
    const routeNext = (() => {
      const clock = seen.clock; if (!p.routePlan || !clock || !alive[clock.i]) return null;
      const sig = alive.join('') + '|' + tray.join(',');
      if (routeCache && (routeCache.sig === sig || routeCache.keep) && routeCache.path.length && usableIn(alive, routeCache.path[0])) { routeCache.sig = sig; routeCache.keep = false; return routeCache.path[0]; }
      const width = p.routeBeam ?? 48, ck = clock.i;
      // routeNeed (Claude 2026-11-05, Dennis: "look at the level yourself and how you'd play"): on a clock that is on top
      // but frozen beside locks whose keys lie across the pile, "tiles on the clock" is always 0, so the beam had no sense
      // of progress, kept the emptiest trays (pairs nearby) and never found the way. A person works back from the clock:
      // what covers it, the ice still to thaw (through its cheapest neighbours), locks among those, then the keys and
      // what covers them - that count is the progress measure.
      const coverOf = (al, u) => { let c = 0; for (const a of aboveTrans[u]) if (al[a]) c++; return c; };
      // Worked back all the way, as a person does (Codex, Task 04: a locked clock, and covers that are themselves locked or
      // frozen, were missed): every tile on the clock, the keys of any lock met on the way, and for ice the cheapest
      // neighbours still to go - each of those in turn with its own covers, locks and ice.
      const needLeft = al => {
        const need = new Set(), todo = [ck], keysLeft = keyTiles.filter(k => al[k]);
        const cost = u => 1 + coverOf(al, u) + (roles[u] === 'lock' && keysLeft.length ? 100 : 0) + (roles[u] === 'ice2' ? 4 : roles[u] === 'ice' ? 2 : 0);
        const add = u => { if (u !== ck && al[u] && !need.has(u)) { need.add(u); todo.push(u); } };
        while (todo.length) {
          const u = todo.pop();
          for (const a of aboveTrans[u]) add(a);
          if (roles[u] === 'lock') for (const k of keysLeft) add(k);
          const h = roles[u] === 'ice2' ? 2 : roles[u] === 'ice' ? 1 : 0;
          if (h && seen.takeable[u] !== true) {
            const left = Math.max(0, h - iceNb[u].filter(k => !al[k] || need.has(k)).length);
            for (const k of iceNb[u].filter(k => al[k] && !need.has(k) && !aboveTrans[k].has(u)).sort((a, b) => cost(a) - cost(b)).slice(0, left)) add(k);
          }
        }
        return need.size;
      };
      const coverLeft = al => p.routeNeed ? needLeft(al) : coverOf(al, ck);
      let beam = [{ al: alive.slice(), tr: tray.slice(), path: [] }], found = null;
      // routeNeed: when no whole way to the clock shows (unseen pictures), follow the best partial way - the state with the
      // fewest tiles the clock still needs, then the emptiest tray - as long as it gets nearer than now (a person heads for
      // the keys and the locks beside the clock instead of pairing elsewhere)
      const need0 = p.routeNeed ? coverLeft(alive) : 0; let partial = null;
      for (let step = 0; step < clock.remaining && beam.length && !found; step++) {
        const next = [], seenK = new Set();
        for (const st of beam) {
          for (let j = 0; j < n; j++) {
            if (!usableIn(st.al, j)) continue;
            const f = memory[j] ?? (-1000 - j), q = st.tr.indexOf(f);
            const tr = q >= 0 ? st.tr.filter((_, k) => k !== q) : st.tr.concat(f);
            // routeHope (Dennis's hard boards: he finds the way over his tries; the plan treated every unseen picture as
            // useless and found nothing on long, tight clocks): an unseen tile in the tray counts as only routeHope of a spot
            const effLen = tr.filter(x => x > -1000).length + (p.routeHope ?? 1) * tr.filter(x => x <= -1000).length;
            if (effLen > 3) continue;
            const al = st.al.slice(); al[j] = 0;
            const path = st.path.concat(j);
            // the clock taken with room to go on: at most 2 waiting, or a known way to bring the tray down
            if (j === ck) { if (tr.length <= 2 || canRelieve(al, tr, 2)) { found = path; break; } continue; }
            const key = al.join('') + '|' + tr.slice().sort((x, y) => x - y).join(',');
            if (seenK.has(key)) continue; seenK.add(key);
            const needNow = coverLeft(al);
            next.push({ al, tr, path, h: needNow * 2 + tr.length + (usableIn(al, ck) ? -3 : 0) });
            if (p.routeNeed && needNow < need0 && tr.length <= (p.routeNeedTray ?? 3) && (!partial || needNow * 4 + tr.length < partial.score || (needNow * 4 + tr.length === partial.score && path.length < partial.path.length))) partial = { score: needNow * 4 + tr.length, path };
          }
          if (found) break;
        }
        next.sort((x, y) => x.h - y.h); beam = next.slice(0, width);
      }
      if (!found && partial) found = partial.path;
      routeCache = { sig, path: found || [] };
      return found ? found[0] : null;
    })();

    function sideChain(i, dir) {
      const chain = [], visited = new Set([i]);
      let frontier = (dir < 0 ? nb.left[i] : nb.right[i]).filter(j => alive[j]);
      while (frontier.length) {
        const next = [];
        for (const u of frontier) {
          if (visited.has(u)) continue;
          visited.add(u); chain.push(u);
          for (const v of (dir < 0 ? nb.left[u] : nb.right[u])) if (alive[v] && !visited.has(v)) next.push(v);
        }
        frontier = next;
      }
      return chain;
    }

    function sideChainCost(i, chain) {
      const parentAbove = aboveTrans[i];
      const extraAbove = new Set();
      let locks = 0, icePen = 0;
      for (const u of chain) {
        for (const a of aboveTrans[u]) if (alive[a] && !parentAbove.has(a)) extraAbove.add(a);
        if (roles[u] === 'lock') locks += 2;
        if (roles[u] === 'ice') icePen += 1;
        if (roles[u] === 'ice2') icePen += 2;
      }
      for (const a of extraAbove) {
        if (roles[a] === 'lock') locks += 2;
      }
      return chain.length + extraAbove.size + locks + icePen;
    }

    // Geometry shared by every clock access route; no unknown picture is used.
    const requiredClockTop = new Set(seen.clock ? [seen.clock.i,...aboveTrans[seen.clock.i]].filter(i=>alive[i]) : []);
    function blockers(i) {
      const top = nb.above[i].filter(j => alive[j]);
      const left = nb.left[i].filter(j => alive[j]), right = nb.right[i].filter(j => alive[j]);
      let side = [];
      if (left.length && right.length) {
        const lChain = sideChain(i, -1), rChain = sideChain(i, 1);
        side = sideChainCost(i, lChain) <= sideChainCost(i, rChain) ? left : right;
      }
      let ice = [];
      if (roles[i] === 'ice' || roles[i] === 'ice2') {
        const need = roles[i] === 'ice2' ? 2 : 1;
        const sharedClock = p.sharedClockIce && requiredClockTop.has(i);
        const validIce = iceNb[i].filter(j => alive[j] && !aboveTrans[j].has(i));
        const already = validIce.filter(j => top.includes(j) || side.includes(j));
        if (already.length >= need) {
          ice = already;
        } else {
          const others = validIce.filter(j => !already.includes(j)).sort((a, b) => {
            const cost = u => nb.above[u].filter(k => alive[k]).length +
              (nb.left[u].some(k => alive[k]) && nb.right[u].some(k => alive[k]) ? 1 : 0) +
              (roles[u] === 'lock' ? 3 : 0);
            const reuse = sharedClock;
            if(reuse && requiredClockTop.has(a)!==requiredClockTop.has(b))return requiredClockTop.has(a)?-1:1;
            return cost(a) - cost(b);
          });
          ice = [...already, ...others.slice(0, Math.max(0, need + (sharedClock ? 0 : 1) - already.length))];
        }
      }
      return [...new Set([...top, ...side, ...ice])];
    }

    const attraction = new Map(), clock = seen.clock;
    // A short cone may pursue a useful-looking key/mate goal without
    // considering all three links (clock, mate, keys) and their full cost.
    const clockMateLocked = Boolean(p.clockOutsPlan && clock && memory[clock.i]!==null && !tray.includes(memory[clock.i]) && memory.some((face,i)=>i!==clock.i&&alive[i]&&face===memory[clock.i]&&roles[i]==='lock'&&(clockHorizon<3||clockMateRouteBudget({alive,nb,clock,mate:i,roles,down:seen.down}).fits)));
    let clockBlockingMate=false;
    if(p.clockOutsPlan && clock && openPeek>=0 && alive[openPeek] && memory[clock.i]!==null && memory[openPeek]===memory[clock.i] && roles[clock.i]==='none' && !seen.takeable[clock.i] && tray.length<=2 && clock.remaining>=2){
      const after=alive.slice();after[openPeek]=0;
      clockBlockingMate=Layouts.isFree(clock.i,after,nb);
    }
    function attract(i, depth, weight, maxDepth, isSideRow = false, path = new Set()) {
      if (path.has(i)) return;
      attraction.set(i, Math.max(attraction.get(i) ?? 0, weight));
      if (depth >= maxDepth) return;
      const nextPath = new Set([...path, i]);
      for (const j of blockers(i)) {
        const nextDepth = depth + 1;
        const decay = (nextDepth > clockHorizon && !isSideRow)
          ? (clockLosses === 0 ? 0.05 : clockLosses === 1 ? 0.25 : 0.82)
          : 0.82;
        attract(j, nextDepth, weight * decay, maxDepth, isSideRow, nextPath);
      }
    }

    let clockMovesNeeded = 0;
    if (clock) {
      const c = clock.i;
      const isSideBlockedOnly = nb.above[c].every(j => !alive[j]) &&
        nb.left[c].some(j => alive[j]) && nb.right[c].some(j => alive[j]);
      const maxD = Math.min(5, clockHorizon + 1 + (clockLosses > 0 ? 1 : 0));
      attract(c, 0, p.clockWeight, maxD, isSideBlockedOnly);
      if(p.clockRowPreview&&isSideBlockedOnly){
        // A visible sideways row remains a clock goal beyond the short thought
        // cone. This is geometry recognition, not a solved physical route.
        const left=sideChain(c,-1),right=sideChain(c,1);
        const row=sideChainCost(c,left)<=sideChainCost(c,right)?left:right;
        for(const index of row)if((attraction.get(index)??0)<p.clockWeight*.3)
          attract(index,0,p.clockWeight*.82,clockHorizon,false);
      }
      const maxPerceivedZDiff = clockHorizon + (clockLosses >= 2 ? 2 : 0);
      const needSet = new Set([c]);
      for (const a of aboveTrans[c]) {
        if (alive[a] && tiles[a].z - tiles[c].z <= maxPerceivedZDiff) needSet.add(a);
      }
      if (nb.left[c].some(j => alive[j]) && nb.right[c].some(j => alive[j])) {
        const lChain = sideChain(c, -1), rChain = sideChain(c, 1);
        for (const u of (sideChainCost(c, lChain) <= sideChainCost(c, rChain) ? lChain : rChain)) {
          needSet.add(u);
          for (const a of aboveTrans[u]) if (alive[a]) needSet.add(a);
        }
      }
      for (const u of [...needSet]) {
        if (roles[u] === 'ice' || roles[u] === 'ice2') {
          const validIce = iceNb[u].filter(j => alive[j] && !aboveTrans[j].has(u));
          if (!validIce.some(j => needSet.has(j)) && validIce.length) {
            needSet.add(validIce[0]);
            for (const a of aboveTrans[validIce[0]]) if (alive[a]) needSet.add(a);
          }
        }
      }
      if ([...needSet].some(u => roles[u] === 'lock')) {
        for (let k = 0; k < n; k++) if (alive[k] && (roles[k] === 'key'||priorKeyTargets.has(k))) needSet.add(k);
      }
      // clockNeedFull (2026-11-03, blind 194: the clock under 4 tiles but 23 moves away behind locks and ice; the count
      // above saw a short way and the bot paired away its time): the keys' own covers, the second neighbour a double
      // ice needs, and whatever those in turn need, counted too
      if (p.clockNeedFull) for (let round = 0; round < 3; round++) {
        for (const u of [...needSet]) {
          if (roles[u] === 'key') for (const a of aboveTrans[u]) if (alive[a]) needSet.add(a);
          const h = roles[u] === 'ice2' ? 2 : roles[u] === 'ice' ? 1 : 0;
          if (h) {
            const have = iceNb[u].filter(j => needSet.has(j)).length;
            for (const j of iceNb[u].filter(j => alive[j] && !needSet.has(j) && !aboveTrans[j].has(u)).slice(0, Math.max(0, h - have))) { needSet.add(j); for (const a of aboveTrans[j]) if (alive[a]) needSet.add(a); }
          }
        }
        if ([...needSet].some(u => roles[u] === 'lock')) for (let k = 0; k < n; k++) if (alive[k] && roles[k] === 'key') { needSet.add(k); for (const a of aboveTrans[k]) if (alive[a]) needSet.add(a); }
      }
      clockMovesNeeded = needSet.size;
      // and the tray: every needed tile without its twin among the needed ones waits in the tray, which holds 3 (one kept
      // free); beyond that, a twin has to be taken from elsewhere too (unknown pictures count as unpaired)
      if (p.clockNeedFull) {
        const cnt = new Map(); let unknown = 0;
        for (const u of needSet) { if (u === c) continue; const f = memory[u]; if (f === null) unknown++; else cnt.set(f, (cnt.get(f) ?? 0) + 1); }
        const unpaired = unknown + [...cnt.values()].filter(v => v % 2).length - tray.filter(f => cnt.has(f)).length;
        clockMovesNeeded += Math.max(0, unpaired - 2);
      }

    }

    const boardHasLocks = roles.some((role, i) => alive[i] && role === 'lock');
    // Remembered membership is a goal location, never a current role/takeability claim.
    const knownKeys = tiles.map((_, i) => i).filter(i => alive[i] && (roles[i] === 'key'||priorKeyTargets.has(i)));
    const freeKeys = knownKeys.filter(i => legal.includes(i));
    const prepareKeyOut=!!p.retryPrepareKeyOuts&&legal.some(i=>{
      const fact=learnedLockedCarry.get(memory[i]);
      return fact&&alive[fact.partner]&&!tray.includes(memory[i])&&(!clock||(attraction.get(i)??0)>0);
    });
    const learnedKeyOut=knownKeys.length>0&&!state.relieved&&(tray.some(face=>learnedLockedCarry.has(face))||prepareKeyOut);
    // human-g5.1 (Gemini's unfinished g5.1, finished by Claude 2026-11-02): a lock right next to the clock (left,
    // right or on top) reads as "the clock needs the keys", so until the clock has been lost twice a person goes for
    // the keys first, a detour when the clock's moves do not allow it. Level 132 (clock 6, lock beside it): Gerda
    // lost 54 of 70 tries to the clock, the bot 1.13 -> 4.65 tries. No other live level 85-174 or tested factory
    // board moved by 0.3 or more. (A profile switch, clockBesideLockKeys, on in the release profiles: the older
    // mechanism fixtures keep their own profiles without it.)
    const clockFlankedByLock = p.clockBesideLockKeys && clock && clockLosses < 2 && (
      nb.left[clock.i].some(j => alive[j] && roles[j] === 'lock') ||
      nb.right[clock.i].some(j => alive[j] && roles[j] === 'lock') ||
      nb.above[clock.i].some(j => alive[j] && roles[j] === 'lock')
    );
    const clockNeedsKeys = clock && (clockMateLocked || clockFlankedByLock || [...attraction.keys()].some(i=>alive[i]&&roles[i]==='lock') || learnedKeyOut&&clock.remaining-clockMovesNeeded>=knownKeys.length);
    if (clockNeedsKeys) {
      const keyW = p.clockWeight * (clockMateLocked||learnedKeyOut ? 1.35 : 0.92);
      const keyD = clockHorizon + (clockLosses > 0 ? 1 : 0);
      for (const i of knownKeys) attract(i, 0, keyW, keyD, false);
    } else if (!clock && boardHasLocks) {
      const keyW = (p.postClockKeyWeight ?? p.clockWeight * 0.75)*(learnedKeyOut?1.35:1);
      for (const i of knownKeys) {
        if (!legal.includes(i) || freeKeys.length >= 2 || tray.length <= 1) {
          attract(i, 0, keyW, clockHorizon, false);
        }
      }
    }

    const partnerAttract = new Map();
    function addPartnerAttract(target, weight, maxD) {
      function rec(u, d, w, path) {
        if (path.has(u) || d > maxD) return;
        if (d > 0) partnerAttract.set(u, Math.max(partnerAttract.get(u) ?? 0, w));
        if (d === maxD) return;
        const bl = blockers(u);
        if (bl.length > maxD - d + 1) return;
        for (const b of bl) if (roles[b] !== 'lock') rec(b, d + 1, w * 0.65, new Set([...path, u]));
      }
      rec(target, 0, weight, new Set());
    }

    if (p.partnerHorizon > 0) {
      for (let j = 0; j < n; j++) {
        if (!alive[j] || seen.takeable[j] === true || roles[j] === 'lock') continue;
        const pic = memory[j];
        if (pic === null) continue;
        if (tray.includes(pic)) {
          addPartnerAttract(j, (p.outWeight ?? 9) * (tray.length >= 2 ? 3.2 : 2.2), p.partnerHorizon);
        } else if (tray.length <= 2 && legal.some(k => memory[k] === pic)) {
          addPartnerAttract(j, (p.outWeight ?? 9) * 1.6, Math.min(2, p.partnerHorizon));
        }
      }
    }

    const unmatchedClockInTray = tookEarlyClockThisAttempt && initialClock && initialClock.face !== undefined && tray.includes(initialClock.face);
    const depth = unmatchedClockInTray ? (p.firstTryTrayDepth ?? 1) : (clock ? clockTrayPlanningDepth() : (p.trayDepth ?? 3));
    const keyWork=new Set();
    if(p.retryKeyRouteValue&&learnedKeyOut&&(!clock||clockNeedsKeys)){
      for(const k of knownKeys){
        for(const i of [k,...aboveTrans[k]])if(alive[i])keyWork.add(i);
        if(nb.left[k].some(i=>alive[i])&&nb.right[k].some(i=>alive[i])){
          const left=sideChain(k,-1),right=sideChain(k,1),row=sideChainCost(k,left)<=sideChainCost(k,right)?left:right;
          for(const i of row)for(const j of [i,...aboveTrans[i]])if(alive[j])keyWork.add(j);
        }
      }
    }
    const future = computeTrayHorizon(depth,[...keyWork],keyWork.size||retryAccess?knownKeys:null);

    const effectiveNeed = strictClockSlack ? Math.max(clockHorizon, clockMovesNeeded) : clockHorizon;
    const clockSlack = clock ? clock.remaining - clockMovesNeeded : 99;
    const urgency = clock
      ? Math.max(1, (effectiveNeed / Math.max(1, clock.remaining)) ** (p.clockUrgencyPower ?? 2)) * (clockLosses > 0 ? 1.5 : 1)
      : 1;

    const matchingNow = legal.some(i => memory[i] !== null && (
      tray.includes(memory[i]) ||
      (openPeek >= 0 && i !== openPeek && memory[i] === memory[openPeek]) ||
      legal.some(j => j !== i && memory[j] === memory[i])
    ));

    const signature = alive.join('') + '|' + tray.join(',');

    const balkingAtFlippedClockBlocker = Boolean(
      clock && clockLosses < 2 && clock.remaining >= 3 && tray.length >= 1 &&
      openPeek >= 0 && seen.down[openPeek] === 1 &&
      (attraction.get(openPeek) ?? 0) >= p.clockWeight * 0.3 &&
      memory[openPeek] !== null && !tray.includes(memory[openPeek])
    );

    const anyTrayMatch = legal.some(j => memory[j] !== null && seen.down[j] !== 1 && tray.includes(memory[j]));
    const scored = legal.map(i => {
      const face = memory[i], down = seen.down[i] === 1, peek = down && openPeek !== i;
      const trayMatch = face !== null && tray.includes(face);
      const twin = face === null ? null : legal.find(j => j !== i && memory[j] === face);
      const openTwin = openPeek >= 0 && openPeek !== i && face !== null && memory[openPeek] === face;
      const hasTwin = twin !== undefined && twin !== null;
      const knownDig = peek && face !== null && !trayMatch && !openTwin && !hasTwin && !(face === 101 && tray.length);
      const knownFatal = tray.length >= 3 && face !== null && !trayMatch && !openTwin && face !== 101 && !tray.includes(101) && (!peek || knownDig);

      const maxUnmatchedBlockers = Math.min(p.partnerHorizon, Math.max(0, 2 - tray.length));
      const reachable = face === null ? false : memory.some((other, j) => {
        if (j === i || !alive[j] || other !== face || roles[j] === null || roles[j] === 'lock') return false;
        const bl = blockers(j);
        const unmatchedBl = bl.filter(b => memory[b] === null || !tray.includes(memory[b])).length;
        return bl.length <= p.partnerHorizon && unmatchedBl <= maxUnmatchedBlockers;
      });

      const visitsKey = signature + '|' + i, count = visits.get(visitsKey) ?? 0;
      const ownGoal = attraction.get(i) ?? 0;
      const goal = Math.max(
        ownGoal,
        openTwin ? (attraction.get(openPeek) ?? 0) : 0,
        hasTwin ? (attraction.get(twin) ?? 0) * 0.85 : 0
      );

      const structBonus = tiles[i].z * (p.zWeight ?? 1.8) + below[i].filter(j => alive[j]).length * 0.4;
      let score = (knownFatal ? -2000 : goal * urgency) + (clock ? 0 : (partnerAttract.get(i) ?? 0)) + structBonus;

      const offClock = clock && goal < p.clockWeight * 0.3;
      const tightClock = Boolean(strictClockSlack && clock && !balkingAtFlippedClockBlocker && (clockSlack < 2 || clockLosses >= 2));

      if (trayMatch) {
        const urgentLastClockMove = clock && clock.remaining <= 1 && ownGoal === 0;
        score += urgentLastClockMove ? 0 : (p.pairReward * 2.6 + (!clock && tray.length >= 2 ? (tray.length - 1) * 6 : 0));
      } else if (face === 101 && tray.length) {
        score += p.pairReward * 2.5;
      } else if (openTwin) {
        score += p.pairReward * 2.6;
      } else if (hasTwin) {
        const sidePairPenalty = offClock
          ? (tightClock ? p.clockWeight * 1.3 : p.pairReward * 0.25)
          : 0;
        score += p.pairReward + (down || seen.down[twin] === 1 ? 3 : 0) - sidePairPenalty;
      } else if (peek && face === null) {
        const freePeekBonus = ownGoal > 0 ? p.pairReward : (!matchingNow ? (p.freePeekBonus ?? 18) : 4);
        score += p.exploration + freePeekBonus + (tray.length >= 2 ? 6 : 0);
      } else {
        score -= p.trayCost * Math.max(1, tray.length * 2);
        if (reachable && !(offClock && tightClock)) score += p.trayCost * 1.1;
        if (tray.length >= 2 && !reachable) score -= p.trayCost * 2;
        if (offClock && tightClock) score -= p.clockWeight * 1.2;
        if (balkingAtFlippedClockBlocker && i === openPeek) {
          score += clockLosses === 0 ? (p.flippedBlockerBalk0 ?? 12.8) : (p.flippedBlockerBalk1 ?? -5.0);
        }
        if (!clock && roles[i] === 'key' && freeKeys.length < 2 && tray.length >= 2) {
          score -= 35;
        }
        const prevFail = failedDigs.get(i) ?? 0;
        if (prevFail > 0 && tray.length >= 1 && (!clock || ownGoal === 0)) {
          score -= prevFail * 28;
        }
      }

      if (p.outWeight && (!peek || knownDig)) {
        const next = alive.slice(); next[i] = 0; if (openTwin) next[openPeek] = 0;
        const nextTray = trayMatch ? tray.filter(f => f !== face) : openTwin ? tray : tray.concat(face === null ? [-1] : [face]);
        const usableAfter = j => {
          if (!Layouts.isFree(j, next, nb)) return false;
          if (roles[j] === null || roles[j] === 'none' || roles[j] === 'key') return true;
          const ice = roles[j] === 'ice' ? 1 : roles[j] === 'ice2' ? 2 : null;
          return ice !== null && iceNb[j].filter(k => alive[k] && !next[k]).length >= ice;
        };
        const newlyFree = tiles.flatMap((_, j) => next[j] && !legal.includes(j) && usableAfter(j) ? [j] : []);
        for (const j of newlyFree) {
          const matchesExistingTray = memory[j] !== null && tray.includes(memory[j]);
          const matchesNewSelf = memory[j] !== null && nextTray.includes(memory[j]) && !matchesExistingTray;
          if (matchesExistingTray || (matchesNewSelf && !(offClock && tightClock))) {
            score += p.outWeight * 3.5;
          } else if (memory[j] !== null && !(offClock && tightClock) && legal.some(k => k !== i && next[k] && memory[k] === memory[j] && (nextTray.length < 3 || seen.down[j] === 1 || seen.down[k] === 1))) {
            score += p.outWeight * 1.2;
          } else if (memory[j] === null) {
            // planAhead (Dennis: "playing to the most possible outs"; "the planning ahead I do"): an unknown tile is
            // a hope, not an out - it counts for less
            score += p.outWeight * 0.9 * (1 - 0.7 * (p.planAhead ?? 0));
          } else {
            score += p.outWeight * 0.08;
          }
        }
        for (const j of below[i]) {
          if (next[j] && !newlyFree.includes(j)) {
            if (roles[j] === 'lock' && freeKeys.length < 2) {
              score -= p.outWeight * 1.6;
            } else if (memory[j] === null || seen.roles[j] === null) {
              score += p.outWeight * 0.25;
            }
          }
        }
        if (tray.length >= 2 && !trayMatch && !openTwin && face !== null) {
          const directMate = memory.some((other, j) => next[j] && other === face && usableAfter(j));
          const freesUnknown = newlyFree.some(j => memory[j] === null);
          // planAhead: with two waiting, only a known mate is a way out; uncovering an unknown tile is a gamble
          if (!directMate && (!freesUnknown || (p.planAhead && random() < p.planAhead))) score -= p.outWeight * 2.5;
        }
      }

      if(p.clockOutsPlan && clock && seen.takeable[clock.i] && memory[clock.i]!==null && tray.includes(memory[clock.i])){
        if(i===clock.i)score+=p.pairReward*2.6;
        else if(trayMatch&&face===memory[clock.i])score-=p.pairReward*2.6;
      }
      if (clock && clock.n >= 14 && i === clock.i && !trayMatch && clock.remaining >= 5) {
        if (earlyClockLosses > 0 && random() < Math.min(0.85, earlyClockLosses * 0.45)) score -= p.clockWeight * 1.5;
        else if (tray.length >= 2) score -= p.clockWeight * 1.1;
      }
      if(clock && (i===clock.i || openTwin && openPeek===clock.i))score+=p.clockCompletionBonus??0;
      if(clockBlockingMate){
        // Preserve the observed matching blocker for the clock immediately
        // behind it; pairing it elsewhere can consume the only short out.
        if(i===openPeek && !peek)score+=p.pairReward*2.6;
        else if(openTwin && i!==clock.i)score-=p.pairReward*2.6;
      }
      if(p.clockOutsPlan && clock){
        // An immediate pair can consume both last clock ticks. Free inspection
        // remains possible; this local budget check needs no deep search.
        const removes = !peek || trayMatch || openTwin;
        const containsClock = i===clock.i || openTwin && openPeek===clock.i;
        const ticks = openTwin || hasTwin && !trayMatch && offClock ? 2 : 1;
        if(removes && !containsClock && ticks>=clock.remaining)score-=2000;
        const setsUpClock=face!==null && face===memory[clock.i] && seen.takeable[clock.i];
        if(clock.remaining<=2 && peek && face!==null && !trayMatch && !openTwin && count>=1 && !setsUpClock)score-=2400;
      }
      if (knownDig) {
        score -= 0.5;
      } else if (down && openPeek === i && !trayMatch && !openTwin && !hasTwin) {
        score += 1.5;
      }

      if (peek) score -= Math.max(0, count - p.peekPatience + 1) * 8 + (count >= 4 ? (count - 3) * 30 : 0);
      if (!peek && count) score -= count * 2;

      score += (future.get(i) ?? 0) * (p.futureWeight ?? 1) * (clock ? 0.15 : 1);
      if ((!peek || knownDig) && !(clock && i === clock.i) && suggestsNoEasyEscape(i)) score -= 1200;

      // From the recordings: with one tile waiting (clock gone) Dennis takes another unmatched tile in 46% of his takes,
      // the bot in 78% - he puts a tile in the tray when he can see its way out (its twin within reach), so the check
      // runs from the first tile in the tray (lookFrom 1) as well
      if (p.lookPenalty && !clock && !trayMatch && !openTwin && !(peek && face === null) && face !== null) {
        const al = alive.slice(); al[i] = 0; const tr = tray.concat(face);
        if (tr.length >= (p.lookFrom ?? 2)) { const ok = canRelieve(al, tr, p.lookDepth ?? 1); if (global.__lookStats) { global.__lookStats.checks++; if (!ok) global.__lookStats.fired++; } if (!ok) score -= p.lookPenalty; }
      }
      if (routeNext !== null && i === routeNext) score += p.routePlan;
      // clockFirst (2026-11-03, blind 194: told every hidden picture the bot kept pairing and lost to its 24-move clock 297
      // times against 125): when the clock's moves left come within SLACK of what its way still needs, a match or pair
      // off that way costs this much - unless 3 tiles wait (then a match is the only safe move)
      if (p.clockFirst && clock && offClock && tray.length < 3 && clockSlack <= (p.clockFirstSlack ?? 1) && (trayMatch || openTwin || hasTwin)) score -= p.clockFirst;
      // pairFirst (from the recordings): after the clock, people put a tile in the tray when its twin lies free and face-up
      // (Dennis 35-54% of such takes, Gerda 41-61%), the bot 16-23%: it digs where they take the safe pair
      // (only when no tile in the tray can be matched right now: a match comes first)
      if (p.pairFirst && !clock && hasTwin && !trayMatch && !openTwin && !anyTrayMatch) score += p.pairFirst;
      // spotPenalty (Dennis's free-spot habit, from the recordings): once the clock is gone, a take that leaves 3 tiles
      // waiting (one spot left) costs this much; turning a face-down tile over, a match or a pair with the open tile
      // do not. Dennis let the tray reach 3 in 11% of his takes after the clock, the bot without it 19%.
      if (p.spotPenalty && !clock && tray.length >= 2 && !trayMatch && !openTwin && !(peek && face === null)) score -= p.spotPenalty;
      const u = Math.max(1e-12, Math.min(1 - 1e-12, random()));
      const noisy = score - p.temperature * Math.log(-Math.log(u));
      return { index: i, score, noisy, visitsKey };
    });

    const selected = random() < p.lapse
      ? scored[Math.floor(random() * scored.length)]
      : scored.reduce((a, b) => a.noisy >= b.noisy ? a : b);
    visits.set(selected.visitsKey, (visits.get(selected.visitsKey) ?? 0) + 1);
    lastDecision = { ...state, pictures: memory.slice(), down: seen.down.slice(), index: selected.index };
    if (routeCache && routeCache.path.length && routeCache.path[0] === selected.index) routeCache = { sig: null, path: routeCache.path.slice(1), keep: true };
    return { index: selected.index, score: selected.score };
  }

  return { beginAttempt, endAttempt, observe, decide, retryAccessEvidence:()=>retryAccess?.evidence()??[], keyPictureRelationEvidence:()=>[...keyPictureRelations.values()].map(f=>({...f})), lockedCarryEvidence:()=>[...learnedLockedCarry.values()].map(f=>({...f})), rememberedKeyTargets, keyIdentityEvidence:()=>retryKeyMemory?.entries()??[], remembered:()=>memory.slice(), planningAttention:()=>({clockHorizon,strictClockSlack,clockTrayDepth:clockTrayPlanningDepth()}) };
}

module.exports={createFactoryController:createBotController,PROFILES};
