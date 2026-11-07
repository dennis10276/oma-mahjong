'use strict';
const assert = require('assert/strict');

const Layouts = require('./physics/layouts.js');
const { inferMatchedPicture } = require('./public_matched_picture.js');
const { clockMateRouteBudget } = require('./public_clock_mate_budget.js');
const { createKeyIdentityMemory } = require('./public_key_identity_memory.js');
const { createRetryAccessMemory } = require('./public_retry_access_memory.js');
const { createFactoryController: createRefFactoryController, PROFILES } = require('./human_factory_controller.js');

const NO_PIC = -0x7fffffff;
const EMPTY_SLOT = 0x7fffffff;

function pop32(x) {
  x = (x - ((x >>> 1) & 0x55555555)) | 0;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

// Reusable synchronous scratch buffers per thread/isolate (guarded against re-entrancy).
function makeScratch() {
  const tableCap = 1 << 17; // 131072 slots (> 4x max single-step beam * n)
  let pathCap = 1 << 17;
  const maxNext = 40960;
  return {
    busy: false,
    tableCap,
    tableMask: tableCap - 1,
    seenGen: 1,
    seenStamp: new Int32Array(tableCap),
    seenKeys: new Int32Array(tableCap * 7),
    pathCap,
    pathMove: new Int32Array(pathCap),
    pathParent: new Int32Array(pathCap),
    ensurePathCap(minCap) {
      if (minCap <= this.pathCap) return;
      while (this.pathCap < minCap) this.pathCap <<= 1;
      const nm = new Int32Array(this.pathCap);
      const np = new Int32Array(this.pathCap);
      nm.set(this.pathMove);
      np.set(this.pathParent);
      this.pathMove = nm;
      this.pathParent = np;
    },
    maxNext,
    nextW0: new Int32Array(maxNext),
    nextW1: new Int32Array(maxNext),
    nextW2: new Int32Array(maxNext),
    nextW3: new Int32Array(maxNext),
    nextT0: new Int32Array(maxNext),
    nextT1: new Int32Array(maxNext),
    nextT2: new Int32Array(maxNext),
    nextTLen: new Uint8Array(maxNext),
    nextNode: new Int32Array(maxNext),
    nextH: new Int16Array(maxNext),
    beamW0: new Int32Array(2048),
    beamW1: new Int32Array(2048),
    beamW2: new Int32Array(2048),
    beamW3: new Int32Array(2048),
    beamT0: new Int32Array(2048),
    beamT1: new Int32Array(2048),
    beamT2: new Int32Array(2048),
    beamTLen: new Uint8Array(2048),
    beamNode: new Int32Array(2048),
    bucketCount: new Int32Array(512),
    bucketOffset: new Int32Array(512),
    todoBuf: new Int32Array(128),
    keysLeftBuf: new Int32Array(128),
    iceCandIdx: new Int32Array(32),
    iceCandCost: new Int32Array(32),
    relieveStack: new Int32Array(512),
    // Tray horizon per-depth buffers (depths 1..4)
    thW0: new Int32Array(512),
    thW1: new Int32Array(512),
    thW2: new Int32Array(512),
    thW3: new Int32Array(512),
    thT0: new Int32Array(512),
    thT1: new Int32Array(512),
    thT2: new Int32Array(512),
    thTLen: new Uint8Array(512),
    thPeek: new Int16Array(512),
    thUnlock: new Uint8Array(512),
    thDead: new Int16Array(512),
    thDeadKey: new Int16Array(512),
    thVal: new Float64Array(512),
    thPicked: new Uint8Array(512),
  };
}

const SHARED_SCRATCH = makeScratch();

function createFastPlannerController(tiles, profile, seed) {
  const n = tiles.length;
  if (n > 128) return createRefFactoryController(tiles, profile, seed);

  assert(Number.isInteger(seed));
  const allowed = new Set([
    ...Object.keys(PROFILES.dennis),
    'extraClockLookProbability', 'deadlineAttentionProbability', 'deadlineLearningRate',
    'clockRowPreview', 'sharedClockIce', 'clockOutsPlan', 'clockCompletionBonus',
    'retryClockTrayDepth', 'retryClockHorizon', 'retryKeyIdentityMemory',
    'retryLockedCarryKeys', 'retryPrepareKeyOuts', 'retryKeyRouteValue',
    'retryKeyPictureRelations', 'retryAccessMemory', 'clockBesideLockKeys',
    'spotPenalty', 'planAhead', 'lookDepth', 'lookPenalty', 'lookFrom',
    'pairFirst', 'clockFirst', 'clockNeedFull', 'routePlan', 'routeBeam',
    'routeHope', 'routeNeed', 'routeNeedTray', 'routeNeedSlack',
  ]);
  assert(
    Object.entries(profile).every(([key, value]) => allowed.has(key) && (key === 'strictClockSlack' ? typeof value === 'boolean' : Number.isFinite(value))),
    'Only fixed global behavioral parameters are supported'
  );
  assert(Object.keys(PROFILES.dennis).every(key => Object.hasOwn(profile, key)), 'Incomplete behavioral profile');

  const p = { ...profile }, random = Layouts.rng(seed);
  if (process.env.G51_SPOT) p.spotPenalty = +process.env.G51_SPOT;
  if (process.env.G51_PLAN) p.planAhead = +process.env.G51_PLAN;
  if (process.env.G51_TRAYCOST) p.trayCost = +process.env.G51_TRAYCOST;
  if (process.env.G51_PAIR) p.pairFirst = +process.env.G51_PAIR;
  if (process.env.G51_PEEK) p.freePeekBonus = +process.env.G51_PEEK;
  if (process.env.G51_CLOCKFIRST) p.clockFirst = +process.env.G51_CLOCKFIRST;
  if (process.env.G51_NEEDFULL) p.clockNeedFull = +process.env.G51_NEEDFULL;
  if (process.env.G51_ROUTE) {
    const [w, b] = process.env.G51_ROUTE.split(',').map(Number);
    p.routePlan = w;
    if (b) p.routeBeam = b;
  }
  if (process.env.G51_HOPE) p.routeHope = +process.env.G51_HOPE;
  if (process.env.G51_PEEKPAT) p.peekPatience = +process.env.G51_PEEKPAT;
  if (process.env.G51_LOOK) {
    const [d, w, f] = process.env.G51_LOOK.split(',').map(Number);
    p.lookDepth = d;
    p.lookPenalty = w;
    if (f) p.lookFrom = f;
  }
  for (const key of ['clockHorizon', 'partnerHorizon', 'trayDepth', 'clockTrayDepth']) {
    assert(Number.isInteger(p[key]) && p[key] >= 0 && p[key] <= 4, 'Human planning horizon must stay within four actions/dependencies');
  }
  for (const key of ['lapse', 'memoryDecay', 'retryRetention']) assert(p[key] >= 0 && p[key] <= 1);
  assert(p.temperature > 0);
  assert(!p.retryKeyPictureRelations || p.retryKeyIdentityMemory === 1, 'Picture relationships require observed key identities');
  assert(!p.retryKeyRouteValue || p.retryLockedCarryKeys === 1, 'Key-route value requires actual-loss dependency learning');
  assert(!p.retryPrepareKeyOuts || p.retryLockedCarryKeys === 1, 'Key preparation requires actual-loss dependency learning');
  assert(p.retryClockHorizon === undefined || (Number.isInteger(p.retryClockHorizon) && p.retryClockHorizon >= p.clockHorizon && p.retryClockHorizon <= 4));
  assert(p.retryClockTrayDepth === undefined || (Number.isInteger(p.retryClockTrayDepth) && p.retryClockTrayDepth >= p.clockTrayDepth && p.retryClockTrayDepth <= p.trayDepth && p.retryClockTrayDepth <= 4));
  assert(p.clockCompletionBonus === undefined || (p.clockCompletionBonus >= 0 && p.clockCompletionBonus <= 120));
  for (const [key, value] of Object.entries(p)) {
    if (key !== 'strictClockSlack' && !key.startsWith('flippedBlockerBalk')) assert(value >= 0);
  }
  for (const key of ['extraClockLookProbability', 'deadlineAttentionProbability', 'deadlineLearningRate']) {
    assert(p[key] === undefined || (Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 1));
  }
  for (const key of ['clockRowPreview', 'sharedClockIce', 'clockOutsPlan', 'retryKeyIdentityMemory', 'retryLockedCarryKeys', 'retryPrepareKeyOuts', 'retryKeyRouteValue', 'retryKeyPictureRelations', 'retryAccessMemory', 'clockBesideLockKeys']) {
    assert(p[key] === undefined || p[key] === 0 || p[key] === 1);
  }

  const attentionRandom = Layouts.rng((seed ^ 0x4d2c6df7) | 0);
  let clockHorizon = p.clockHorizon, strictClockSlack = p.strictClockSlack;
  const nb = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles);
  const retryKeyMemory = p.retryKeyIdentityMemory ? createKeyIdentityMemory(n) : null;
  const keyPictureRelations = new Map();
  const retryAccess = p.retryAccessMemory ? createRetryAccessMemory(n) : null;
  const fastWitnesses = p.retryAccessMemory ? Array.from({ length: n }, () => []) : null;
  const witStart = new Int32Array(n), witEnd = new Int32Array(n);
  const witR0 = new Int32Array(n * 8), witR1 = new Int32Array(n * 8), witR2 = new Int32Array(n * 8), witR3 = new Int32Array(n * 8);

  const aboveTrans = tiles.map((_, i) => {
    const set = new Set(), stack = [...nb.above[i]];
    while (stack.length) {
      const u = stack.pop();
      if (!set.has(u)) { set.add(u); stack.push(...nb.above[u]); }
    }
    return set;
  });
  const aboveTransArr = aboveTrans.map(s => Int32Array.from(s));
  const below = tiles.map((_, i) => tiles.map((__, j) => j).filter(j => nb.above[j].includes(i)));
  const belowArr = below.map(arr => Int32Array.from(arr));
  const iceNoCycle = iceNb.map((arr, u) => Int32Array.from(arr.filter(k => !aboveTrans[k].has(u))));
  const iceNbLen = Int32Array.from(iceNb.map(arr => arr.length));

  // Precomputed 128-bit geometry masks (4 x Int32 per tile)
  const abv0 = new Int32Array(n), abv1 = new Int32Array(n), abv2 = new Int32Array(n), abv3 = new Int32Array(n);
  const lft0 = new Int32Array(n), lft1 = new Int32Array(n), lft2 = new Int32Array(n), lft3 = new Int32Array(n);
  const rgt0 = new Int32Array(n), rgt1 = new Int32Array(n), rgt2 = new Int32Array(n), rgt3 = new Int32Array(n);
  const abvT0 = new Int32Array(n), abvT1 = new Int32Array(n), abvT2 = new Int32Array(n), abvT3 = new Int32Array(n);
  const blw0 = new Int32Array(n), blw1 = new Int32Array(n), blw2 = new Int32Array(n), blw3 = new Int32Array(n);
  const ice0 = new Int32Array(n), ice1 = new Int32Array(n), ice2 = new Int32Array(n), ice3 = new Int32Array(n);
  const tileZ = Float64Array.from(tiles.map(t => t.z));

  const setMaskFromList = (list, m0, m1, m2, m3, idx) => {
    let w0 = 0, w1 = 0, w2 = 0, w3 = 0;
    for (const u of list) {
      const w = u >>> 5, b = 1 << (u & 31);
      if (w === 0) w0 |= b; else if (w === 1) w1 |= b; else if (w === 2) w2 |= b; else w3 |= b;
    }
    m0[idx] = w0; m1[idx] = w1; m2[idx] = w2; m3[idx] = w3;
  };
  for (let i = 0; i < n; i++) {
    setMaskFromList(nb.above[i], abv0, abv1, abv2, abv3, i);
    setMaskFromList(nb.left[i], lft0, lft1, lft2, lft3, i);
    setMaskFromList(nb.right[i], rgt0, rgt1, rgt2, rgt3, i);
    setMaskFromList(aboveTrans[i], abvT0, abvT1, abvT2, abvT3, i);
    setMaskFromList(below[i], blw0, blw1, blw2, blw3, i);
    setMaskFromList(iceNb[i], ice0, ice1, ice2, ice3, i);
  }
  const validMask0 = n >= 32 ? -1 : ((1 << n) - 1);
  const validMask1 = n <= 32 ? 0 : n >= 64 ? -1 : ((1 << (n - 32)) - 1);
  const validMask2 = n <= 64 ? 0 : n >= 96 ? -1 : ((1 << (n - 64)) - 1);
  const validMask3 = n <= 96 ? 0 : n === 128 ? -1 : ((1 << (n - 96)) - 1);

  // Per-controller reusable decision buffers
  const memInt = new Int32Array(n);
  const usableRole = new Uint8Array(n); // for usableIn: 0=always once free, 1=ice1, 2=ice2, 3=lock
  const afterRole = new Uint8Array(n);  // for usableAfter: 0=free->ok, 1=ice1, 2=ice2, 3=lock(never)
  const roleCode = new Uint8Array(n);   // 0=null, 1=none, 2=key, 3=lock, 4=ice, 5=ice2
  const seenRoleCode = new Uint8Array(n);
  const seenTakeable = new Uint8Array(n);
  const seenDown = new Int8Array(n);
  const remDown = new Int8Array(n);
  const steppableTiles = new Int32Array(n);
  const knownTiles = new Int32Array(n);
  const keyTilesArr = new Int32Array(n);
  const legalArr = new Int32Array(n);
  const legalMask = new Uint8Array(n);
  const newlyFreeBuf = new Int32Array(n);
  const newlyFreeMask = new Uint8Array(n);
  const isKeyWork = new Uint8Array(n);
  const isKeyTrigger = new Uint8Array(n);
  const candsBuf = new Int32Array(n);

  let memory = tiles.map(() => null);
  let roles = tiles.map(() => null);
  let state, seen, visits = new Map(), attempt = 0, lastDecision = null;
  let clockLosses = 0, initialClock = null, earlyClockLosses = 0, tookEarlyClockThisAttempt = false;
  const failedDigs = new Map();
  const learnedLockedCarry = new Map();
  let attemptDigs = [];
  let routeCache = null;

  function rememberedKeyTargets() {
    return retryKeyMemory ? retryKeyMemory.entries().filter(f => f.attempt < attempt && state?.alive[f.index]).map(f => f.index) : [];
  }

  function clockTrayPlanningDepth() {
    return Math.min(p.trayDepth ?? 0, clockLosses > 0 && p.retryClockTrayDepth !== undefined ? p.retryClockTrayDepth : (p.clockTrayDepth ?? 3));
  }

  function beginAttempt() {
    routeCache = null;
    tookEarlyClockThisAttempt = false;
    clockHorizon = Math.min(4, (clockLosses > 0 && p.retryClockHorizon !== undefined ? p.retryClockHorizon : p.clockHorizon) + (p.extraClockLookProbability !== undefined && attentionRandom() < p.extraClockLookProbability ? 1 : 0));
    strictClockSlack = p.deadlineAttentionProbability === undefined ? p.strictClockSlack : attentionRandom() < Math.min(1, p.deadlineAttentionProbability + clockLosses * (p.deadlineLearningRate ?? 0));
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
    if (p.retryLockedCarryKeys && ['beforeClock', 'mid', 'late'].includes(phase) && Array.isArray(terminalTray)) {
      for (const face of terminalTray) {
        const partner = memory.findIndex((f, i) => f === face && state.alive[i] && roles[i] === 'lock');
        if (partner >= 0 && !learnedLockedCarry.has(face)) {
          learnedLockedCarry.set(face, {
            face, partner, attempt, physicalTaps: state.physicalTaps,
            source: 'actual terminal carry and remembered observed locked matching partner; retry goal only',
          });
        }
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
        alive: s.alive, moves: s.moves, openPeek: s.openPeek, physicalTaps: s.physicalTaps, tray: s.tray,
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
      physicalTaps: s.physicalTaps,
    };
    seen = {
      pictures: Array.from(o.pictures), roles: Array.from(o.roles),
      down: Array.from(o.down), takeable: Array.from(o.takeable),
      clock: o.clock ? { i: o.clock.i, n: o.clock.n, remaining: o.clock.remaining } : null,
    };
    memory = memory.map((v, i) => o.pictures[i] !== null ? o.pictures[i] : s.alive[i] && random() < p.memoryDecay ? null : v);
    roles = roles.map((v, i) => o.roles[i] ?? v);
    retryKeyMemory?.observe(state, seen.roles, attempt);
    retryAccess?.observe(state, seen, attempt);
    if (p.retryKeyPictureRelations) {
      const keys = retryKeyMemory.keys();
      for (let a = 0; a < keys.length; a++) {
        for (let b = a + 1; b < keys.length; b++) {
          const i = keys[a], j = keys[b], id = i + '|' + j;
          if (memory[i] !== null && memory[i] === memory[j] && !keyPictureRelations.has(id)) {
            keyPictureRelations.set(id, {
              a: i, b: j, attempt, physicalTaps: state.physicalTaps,
              source: 'actual known pictures of observed key identities matched; static relationship only',
            });
          }
        }
      }
      for (const [id, fact] of keyPictureRelations) {
        if (fact.attempt >= attempt) continue;
        const a = memory[fact.a], b = memory[fact.b];
        if (a !== null && b !== null && a !== b) { keyPictureRelations.delete(id); continue; }
        if (a !== null && b === null && state.alive[fact.b]) memory[fact.b] = a;
        else if (b !== null && a === null && state.alive[fact.a]) memory[fact.a] = b;
      }
    }
  }

  function isFreeBits(j, w0, w1, w2, w3) {
    const wj = j >>> 5, bj = 1 << (j & 31);
    const word = wj === 0 ? w0 : wj === 1 ? w1 : wj === 2 ? w2 : w3;
    if ((word & bj) === 0) return false;
    if (((w0 & abv0[j]) | (w1 & abv1[j]) | (w2 & abv2[j]) | (w3 & abv3[j])) !== 0) return false;
    if (((w0 & lft0[j]) | (w1 & lft1[j]) | (w2 & lft2[j]) | (w3 & lft3[j])) === 0) return true;
    return ((w0 & rgt0[j]) | (w1 & rgt1[j]) | (w2 & rgt2[j]) | (w3 & rgt3[j])) === 0;
  }

  function coverOfBits(w0, w1, w2, w3, u) {
    return pop32(w0 & abvT0[u]) + pop32(w1 & abvT1[u]) + pop32(w2 & abvT2[u]) + pop32(w3 & abvT3[u]);
  }

  function decide() {
    const { alive, tray, openPeek } = state;

    let legalLen = 0;
    legalMask.fill(0);
    for (let i = 0; i < n; i++) {
      if (seen.takeable[i] === true) {
        legalArr[legalLen++] = i;
        legalMask[i] = 1;
      }
    }
    if (!legalLen) return null;

    // Encode current board state into 4 x Int32 bitset + fast typed arrays
    let aw0 = 0, aw1 = 0, aw2 = 0, aw3 = 0;
    let key0 = 0, key1 = 0, key2 = 0, key3 = 0;
    let lock0 = 0, lock1 = 0, lock2 = 0, lock3 = 0;
    let keyTilesLen = 0, knownLen = 0;
    for (let i = 0; i < n; i++) {
      const bit = 1 << (i & 31), wd = i >>> 5;
      if (alive[i]) {
        if (wd === 0) aw0 |= bit; else if (wd === 1) aw1 |= bit; else if (wd === 2) aw2 |= bit; else aw3 |= bit;
      }
      const m = memory[i];
      memInt[i] = m === null ? NO_PIC : m;
      if (m !== null) knownTiles[knownLen++] = i;

      const tk = seen.takeable[i] === true ? 1 : 0;
      seenTakeable[i] = tk;
      const sd = seen.down[i];
      seenDown[i] = sd === null || sd === undefined ? -1 : sd;

      const r = roles[i];
      const rc = r === null ? 0 : r === 'none' ? 1 : r === 'key' ? 2 : r === 'lock' ? 3 : r === 'ice' ? 4 : 5;
      roleCode[i] = rc;
      const sr = seen.roles[i];
      seenRoleCode[i] = sr === null ? 0 : sr === 'none' ? 1 : sr === 'key' ? 2 : sr === 'lock' ? 3 : sr === 'ice' ? 4 : 5;

      if (rc === 2) {
        keyTilesArr[keyTilesLen++] = i;
        if (wd === 0) key0 |= bit; else if (wd === 1) key1 |= bit; else if (wd === 2) key2 |= bit; else key3 |= bit;
      } else if (rc === 3) {
        if (wd === 0) lock0 |= bit; else if (wd === 1) lock1 |= bit; else if (wd === 2) lock2 |= bit; else lock3 |= bit;
      }
      usableRole[i] = rc === 3 ? 3 : (rc === 4 && !tk) ? 1 : (rc === 5 && !tk) ? 2 : 0;
      afterRole[i] = rc <= 2 ? 0 : rc === 4 ? 1 : rc === 5 ? 2 : 3;
    }

    const scratch = SHARED_SCRATCH.busy ? makeScratch() : SHARED_SCRATCH;
    scratch.busy = true;
    try {
      const priorKeyTargets = new Set(rememberedKeyTargets());

      const usableInBits = (w0, w1, w2, w3, j) => {
        if (!isFreeBits(j, w0, w1, w2, w3)) return false;
        const ur = usableRole[j];
        if (ur === 0) return true;
        if (ur === 3) return ((w0 & key0) | (w1 & key1) | (w2 & key2) | (w3 & key3)) === 0;
        const rm0 = aw0 & ~w0, rm1 = aw1 & ~w1, rm2 = aw2 & ~w2, rm3 = aw3 & ~w3;
        if (ur === 1) return ((rm0 & ice0[j]) | (rm1 & ice1[j]) | (rm2 & ice2[j]) | (rm3 & ice3[j])) !== 0;
        return pop32(rm0 & ice0[j]) + pop32(rm1 & ice1[j]) + pop32(rm2 & ice2[j]) + pop32(rm3 & ice3[j]) >= 2;
      };

      const canRelieveBits = (w0, w1, w2, w3, t0, t1, t2, tLen, d, stackBase) => {
        if (d <= 0 || tLen >= 3) {
          for (let idx = 0; idx < knownLen; idx++) {
            const j = knownTiles[idx];
            const mj = memInt[j];
            if ((mj === t0 || (tLen >= 2 && mj === t1) || (tLen >= 3 && mj === t2)) && usableInBits(w0, w1, w2, w3, j)) {
              return true;
            }
          }
          return false;
        }
        const rStack = scratch.relieveStack;
        let count = 0;
        for (let idx = 0; idx < knownLen; idx++) {
          const j = knownTiles[idx];
          if (usableInBits(w0, w1, w2, w3, j)) {
            const mj = memInt[j];
            if ((tLen >= 1 && mj === t0) || (tLen >= 2 && mj === t1)) return true;
            rStack[stackBase + count++] = j;
          }
        }
        const nextBase = stackBase + count;
        for (let idx = 0; idx < count; idx++) {
          const j = rStack[stackBase + idx];
          const wd = j >>> 5, mask = ~(1 << (j & 31));
          const nw0 = wd === 0 ? (w0 & mask) : w0;
          const nw1 = wd === 1 ? (w1 & mask) : w1;
          const nw2 = wd === 2 ? (w2 & mask) : w2;
          const nw3 = wd === 3 ? (w3 & mask) : w3;
          const mj = memInt[j];
          const nt0 = tLen === 0 ? mj : t0;
          const nt1 = tLen === 1 ? mj : t1;
          const nt2 = tLen === 2 ? mj : t2;
          if (canRelieveBits(nw0, nw1, nw2, nw3, nt0, nt1, nt2, tLen + 1, d - 1, nextBase)) return true;
        }
        return false;
      };

      const canRelieveGeneral = (w0, w1, w2, w3, tr, d, stackBase) => {
        if (tr.length <= 3) {
          return canRelieveBits(w0, w1, w2, w3, tr[0] ?? NO_PIC, tr[1] ?? NO_PIC, tr[2] ?? NO_PIC, tr.length, d, stackBase);
        }
        for (let idx = 0; idx < knownLen; idx++) {
          const j = knownTiles[idx];
          if (tr.includes(memInt[j]) && usableInBits(w0, w1, w2, w3, j)) return true;
        }
        return false;
      };

      const needLeftBits = (w0, w1, w2, w3, ck) => {
        let nw0 = 0, nw1 = 0, nw2 = 0, nw3 = 0, needSize = 0;
        const todo = scratch.todoBuf;
        let todoLen = 1;
        todo[0] = ck;

        const keysLeft = scratch.keysLeftBuf;
        let keysLeftLen = 0;
        for (let idx = 0; idx < keyTilesLen; idx++) {
          const k = keyTilesArr[idx];
          const kw = k >>> 5, kb = 1 << (k & 31);
          if (((kw === 0 ? w0 : kw === 1 ? w1 : kw === 2 ? w2 : w3) & kb) !== 0) keysLeft[keysLeftLen++] = k;
        }
        const lockExtra = keysLeftLen > 0 ? 100 : 0;

        const add = u => {
          if (u === ck) return;
          const uw = u >>> 5, ub = 1 << (u & 31);
          const awWord = uw === 0 ? w0 : uw === 1 ? w1 : uw === 2 ? w2 : w3;
          if ((awWord & ub) === 0) return;
          const nwWord = uw === 0 ? nw0 : uw === 1 ? nw1 : uw === 2 ? nw2 : nw3;
          if ((nwWord & ub) !== 0) return;
          if (uw === 0) nw0 |= ub; else if (uw === 1) nw1 |= ub; else if (uw === 2) nw2 |= ub; else nw3 |= ub;
          needSize++;
          todo[todoLen++] = u;
        };

        const cIdx = scratch.iceCandIdx, cCost = scratch.iceCandCost;
        while (todoLen > 0) {
          const u = todo[--todoLen];
          const abvArr = aboveTransArr[u];
          for (let idx = 0; idx < abvArr.length; idx++) add(abvArr[idx]);
          const rcu = roleCode[u];
          if (rcu === 3) {
            for (let idx = 0; idx < keysLeftLen; idx++) add(keysLeft[idx]);
          }
          const h = rcu === 5 ? 2 : rcu === 4 ? 1 : 0;
          if (h && !seenTakeable[u]) {
            const an0 = w0 & ~nw0, an1 = w1 & ~nw1, an2 = w2 & ~nw2, an3 = w3 & ~nw3;
            const aliveNotNeedCount = pop32(an0 & ice0[u]) + pop32(an1 & ice1[u]) + pop32(an2 & ice2[u]) + pop32(an3 & ice3[u]);
            const goneOrNeed = iceNbLen[u] - aliveNotNeedCount;
            const left = h - goneOrNeed;
            if (left > 0) {
              const src = iceNoCycle[u];
              let cLen = 0;
              for (let idx = 0; idx < src.length; idx++) {
                const k = src[idx];
                const kw = k >>> 5, kb = 1 << (k & 31);
                if (((kw === 0 ? an0 : kw === 1 ? an1 : kw === 2 ? an2 : an3) & kb) !== 0) {
                  const rck = roleCode[k];
                  cIdx[cLen] = k;
                  cCost[cLen] = 1 + coverOfBits(w0, w1, w2, w3, k) + (rck === 3 ? lockExtra : rck === 5 ? 4 : rck === 4 ? 2 : 0);
                  cLen++;
                }
              }
              // Stable insertion sort matching ES2019 Array.prototype.sort((a, b) => cost(a) - cost(b))
              for (let a = 1; a < cLen; a++) {
                const ki = cIdx[a], kc = cCost[a];
                let b = a - 1;
                while (b >= 0 && cCost[b] > kc) {
                  cIdx[b + 1] = cIdx[b];
                  cCost[b + 1] = cCost[b];
                  b--;
                }
                cIdx[b + 1] = ki;
                cCost[b + 1] = kc;
              }
              const lim = left < cLen ? left : cLen;
              for (let a = 0; a < lim; a++) add(cIdx[a]);
            }
          }
        }
        return needSize;
      };

      const routeNext = (() => {
        const clock = seen.clock;
        if (!p.routePlan || !clock || !alive[clock.i]) return null;
        const sig = alive.join('') + '|' + tray.join(',');
        if (routeCache && (routeCache.sig === sig || routeCache.keep) && routeCache.path.length && usableInBits(aw0, aw1, aw2, aw3, routeCache.path[0])) {
          routeCache.sig = sig;
          routeCache.keep = false;
          return routeCache.path[0];
        }
        const width = p.routeBeam ?? 48, ck = clock.i;
        const useNeed = Boolean(p.routeNeed);
        const routeNeedTray = p.routeNeedTray ?? 3;
        const routeNeedSlack = p.routeNeedSlack ?? 4;
        const hope = p.routeHope ?? 1;
        const need0 = useNeed ? needLeftBits(aw0, aw1, aw2, aw3, ck) : 0;

        // Rare calibration-switch fallback when routeHope !== 1 (allows >3 unseen tiles in tray)
        if (hope !== 1 || tray.length > 3 || width > 2048) {
          const coverLeftFallback = (w0, w1, w2, w3) => useNeed ? needLeftBits(w0, w1, w2, w3, ck) : coverOfBits(w0, w1, w2, w3, ck);
          let beam = [{ w0: aw0, w1: aw1, w2: aw2, w3: aw3, tr: tray.slice(), path: [] }], found = null, partial = null;
          for (let step = 0; step < clock.remaining && beam.length && !found; step++) {
            const next = [], seenK = new Set();
            for (const st of beam) {
              for (let j = 0; j < n; j++) {
                if (!usableInBits(st.w0, st.w1, st.w2, st.w3, j)) continue;
                const mj = memInt[j], f = mj !== NO_PIC ? mj : (-1000 - j), q = st.tr.indexOf(f);
                const tr = q >= 0 ? st.tr.filter((_, k) => k !== q) : st.tr.concat(f);
                let seenCnt = 0, unseenCnt = 0;
                for (let k = 0; k < tr.length; k++) if (tr[k] > -1000) seenCnt++; else unseenCnt++;
                if (seenCnt + hope * unseenCnt > 3) continue;
                const wd = j >>> 5, mask = ~(1 << (j & 31));
                const nw0 = wd === 0 ? (st.w0 & mask) : st.w0;
                const nw1 = wd === 1 ? (st.w1 & mask) : st.w1;
                const nw2 = wd === 2 ? (st.w2 & mask) : st.w2;
                const nw3 = wd === 3 ? (st.w3 & mask) : st.w3;
                const path = st.path.concat(j);
                if (j === ck) {
                  if (tr.length <= 2 || canRelieveGeneral(nw0, nw1, nw2, nw3, tr, 2, 0)) { found = path; break; }
                  continue;
                }
                const key = nw0 + ',' + nw1 + ',' + nw2 + ',' + nw3 + '|' + tr.slice().sort((x, y) => x - y).join(',');
                if (seenK.has(key)) continue;
                seenK.add(key);
                const needNow = coverLeftFallback(nw0, nw1, nw2, nw3);
                next.push({ w0: nw0, w1: nw1, w2: nw2, w3: nw3, tr, path, h: needNow * 2 + tr.length + (usableInBits(nw0, nw1, nw2, nw3, ck) ? -3 : 0) });
                if (useNeed && needNow < need0 && tr.length <= routeNeedTray && (!partial || needNow * 4 + tr.length < partial.score || (needNow * 4 + tr.length === partial.score && path.length < partial.path.length))) {
                  partial = { score: needNow * 4 + tr.length, path };
                }
              }
              if (found) break;
            }
            next.sort((x, y) => x.h - y.h);
            beam = next.slice(0, width);
          }
          if (!found && partial && clock.remaining - need0 <= routeNeedSlack) found = partial.path;
          routeCache = { sig, path: found || [] };
          return found ? found[0] : null;
        }

        // Zero-allocation fast beam search (hope === 1, tray.length <= 3, width <= 2048)
        const {
          tableMask, seenStamp, seenKeys,
          beamW0, beamW1, beamW2, beamW3, beamT0, beamT1, beamT2, beamTLen, beamNode,
          nextW0, nextW1, nextW2, nextW3, nextT0, nextT1, nextT2, nextTLen, nextNode, nextH,
          bucketCount, bucketOffset,
        } = scratch;

        scratch.pathParent[0] = -1;
        scratch.pathMove[0] = -1;
        let nodeCount = 1;

        beamW0[0] = aw0; beamW1[0] = aw1; beamW2[0] = aw2; beamW3[0] = aw3;
        beamT0[0] = tray[0] ?? 0; beamT1[0] = tray[1] ?? 0; beamT2[0] = tray[2] ?? 0;
        beamTLen[0] = tray.length;
        beamNode[0] = 0;
        let beamLen = 1;

        let foundNode = -1, foundLastMove = -1;
        let hasPartial = false, partialScore = 0, partialLen = 0, partialNode = -1;

        for (let step = 0; step < clock.remaining && beamLen > 0 && foundNode < 0; step++) {
          let gen = ++scratch.seenGen;
          if (gen >= 0x7ffffff0) {
            seenStamp.fill(0);
            gen = scratch.seenGen = 1;
          }
          scratch.ensurePathCap(nodeCount + beamLen * n + 8);
          const pathMove = scratch.pathMove, pathParent = scratch.pathParent;
          let nextLen = 0;
          const pathLen = step + 1;

          for (let b = 0; b < beamLen; b++) {
            const sw0 = beamW0[b], sw1 = beamW1[b], sw2 = beamW2[b], sw3 = beamW3[b];
            const st0 = beamT0[b], st1 = beamT1[b], st2 = beamT2[b], stLen = beamTLen[b];
            const sNode = beamNode[b];

            for (let j = 0; j < n; j++) {
              if (!usableInBits(sw0, sw1, sw2, sw3, j)) continue;
              const mj = memInt[j], f = mj !== NO_PIC ? mj : (-1000 - j);
              let q = -1;
              if (stLen >= 1 && st0 === f) q = 0;
              else if (stLen >= 2 && st1 === f) q = 1;
              else if (stLen === 3 && st2 === f) q = 2;

              if (q < 0 && stLen === 3) continue; // effLen === 4 > 3

              let nt0 = 0, nt1 = 0, nt2 = 0, ntLen = 0;
              if (q >= 0) {
                ntLen = stLen - 1;
                if (q === 0) { nt0 = st1; nt1 = st2; }
                else if (q === 1) { nt0 = st0; nt1 = st2; }
                else { nt0 = st0; nt1 = st1; }
              } else {
                ntLen = stLen + 1;
                if (stLen === 0) { nt0 = f; }
                else if (stLen === 1) { nt0 = st0; nt1 = f; }
                else { nt0 = st0; nt1 = st1; nt2 = f; }
              }

              const wd = j >>> 5, mask = ~(1 << (j & 31));
              const nw0 = wd === 0 ? (sw0 & mask) : sw0;
              const nw1 = wd === 1 ? (sw1 & mask) : sw1;
              const nw2 = wd === 2 ? (sw2 & mask) : sw2;
              const nw3 = wd === 3 ? (sw3 & mask) : sw3;

              if (j === ck) {
                if (ntLen <= 2 || canRelieveBits(nw0, nw1, nw2, nw3, nt0, nt1, nt2, ntLen, 2, 0)) {
                  foundNode = sNode;
                  foundLastMove = j;
                  break;
                }
                continue;
              }

              // Canonical sorted tray tuple (s0 <= s1 <= s2)
              let s0 = EMPTY_SLOT, s1 = EMPTY_SLOT, s2 = EMPTY_SLOT;
              if (ntLen === 1) {
                s0 = nt0;
              } else if (ntLen === 2) {
                if (nt0 <= nt1) { s0 = nt0; s1 = nt1; } else { s0 = nt1; s1 = nt0; }
              } else if (ntLen === 3) {
                s0 = nt0; s1 = nt1; s2 = nt2;
                if (s0 > s1) { const t = s0; s0 = s1; s1 = t; }
                if (s1 > s2) { const t = s1; s1 = s2; s2 = t; }
                if (s0 > s1) { const t = s0; s0 = s1; s1 = t; }
              }

              // Open-addressed hash table lookup/insert for (nw0..nw3, s0..s2)
              let h = Math.imul(nw0 ^ Math.imul(nw1, 0x9e3779b1), 0x85ebca77);
              h = Math.imul(h ^ nw2 ^ Math.imul(nw3, 0xc2b2ae3d), 0x27d4eb2f);
              h = Math.imul(h ^ s0 ^ Math.imul(s1, 0x165667b1) ^ Math.imul(s2, 0xd3a2646c), 0x9e3779b9);
              h ^= h >>> 15;
              let slot = h & tableMask;
              let dup = false;
              while (seenStamp[slot] === gen) {
                const base = slot * 7;
                if (
                  seenKeys[base] === nw0 && seenKeys[base + 1] === nw1 &&
                  seenKeys[base + 2] === nw2 && seenKeys[base + 3] === nw3 &&
                  seenKeys[base + 4] === s0 && seenKeys[base + 5] === s1 && seenKeys[base + 6] === s2
                ) {
                  dup = true;
                  break;
                }
                slot = (slot + 1) & tableMask;
              }
              if (dup) continue;
              seenStamp[slot] = gen;
              const base = slot * 7;
              seenKeys[base] = nw0; seenKeys[base + 1] = nw1;
              seenKeys[base + 2] = nw2; seenKeys[base + 3] = nw3;
              seenKeys[base + 4] = s0; seenKeys[base + 5] = s1; seenKeys[base + 6] = s2;

              const childNode = nodeCount++;
              pathParent[childNode] = sNode;
              pathMove[childNode] = j;

              const needNow = useNeed ? needLeftBits(nw0, nw1, nw2, nw3, ck) : coverOfBits(nw0, nw1, nw2, nw3, ck);
              const hScore = needNow * 2 + ntLen + (usableInBits(nw0, nw1, nw2, nw3, ck) ? -3 : 0);

              const idx = nextLen++;
              nextW0[idx] = nw0; nextW1[idx] = nw1; nextW2[idx] = nw2; nextW3[idx] = nw3;
              nextT0[idx] = nt0; nextT1[idx] = nt1; nextT2[idx] = nt2; nextTLen[idx] = ntLen;
              nextNode[idx] = childNode;
              nextH[idx] = hScore;

              if (useNeed && needNow < need0 && ntLen <= routeNeedTray) {
                const pScore = needNow * 4 + ntLen;
                if (!hasPartial || pScore < partialScore || (pScore === partialScore && pathLen < partialLen)) {
                  hasPartial = true;
                  partialScore = pScore;
                  partialLen = pathLen;
                  partialNode = childNode;
                }
              }
            }
            if (foundNode >= 0) break;
          }

          if (foundNode >= 0 || nextLen === 0) {
            if (nextLen === 0) beamLen = 0;
            break;
          }

          // Exact stable bucket selection of top `width` states by `hScore` (integer in -3 .. 2*n+3)
          if (nextLen <= width) {
            // Even when nextLen <= width, next.sort((x, y) => x.h - y.h) orders `beam` for the next step!
            const maxBucket = n * 2 + 8;
            bucketCount.fill(0, 0, maxBucket);
            for (let i = 0; i < nextLen; i++) bucketCount[nextH[i] + 3]++;
            let sum = 0;
            for (let bk = 0; bk < maxBucket; bk++) {
              const c = bucketCount[bk];
              bucketOffset[bk] = sum;
              sum += c;
            }
            for (let i = 0; i < nextLen; i++) {
              const pos = bucketOffset[nextH[i] + 3]++;
              beamW0[pos] = nextW0[i]; beamW1[pos] = nextW1[i]; beamW2[pos] = nextW2[i]; beamW3[pos] = nextW3[i];
              beamT0[pos] = nextT0[i]; beamT1[pos] = nextT1[i]; beamT2[pos] = nextT2[i]; beamTLen[pos] = nextTLen[i];
              beamNode[pos] = nextNode[i];
            }
            beamLen = nextLen;
          } else {
            const maxBucket = n * 2 + 8;
            bucketCount.fill(0, 0, maxBucket);
            for (let i = 0; i < nextLen; i++) bucketCount[nextH[i] + 3]++;
            let sum = 0, cutoffBucket = maxBucket;
            for (let bk = 0; bk < maxBucket; bk++) {
              const c = bucketCount[bk];
              bucketOffset[bk] = sum;
              sum += c;
              if (sum >= width && cutoffBucket === maxBucket) cutoffBucket = bk;
            }
            for (let i = 0; i < nextLen; i++) {
              const bk = nextH[i] + 3;
              if (bk > cutoffBucket) continue;
              const pos = bucketOffset[bk];
              if (pos >= width) continue;
              bucketOffset[bk] = pos + 1;
              beamW0[pos] = nextW0[i]; beamW1[pos] = nextW1[i]; beamW2[pos] = nextW2[i]; beamW3[pos] = nextW3[i];
              beamT0[pos] = nextT0[i]; beamT1[pos] = nextT1[i]; beamT2[pos] = nextT2[i]; beamTLen[pos] = nextTLen[i];
              beamNode[pos] = nextNode[i];
            }
            beamLen = width;
          }
        }

        const reconstruct = (endNode, extraMove) => {
          const rev = [];
          if (extraMove >= 0) rev.push(extraMove);
          let cur = endNode;
          while (cur > 0) {
            rev.push(scratch.pathMove[cur]);
            cur = scratch.pathParent[cur];
          }
          rev.reverse();
          return rev;
        };

        let found = null;
        if (foundNode >= 0) {
          found = reconstruct(foundNode, foundLastMove);
        } else if (hasPartial && clock.remaining - need0 <= routeNeedSlack) {
          found = reconstruct(partialNode, -1);
        }
        routeCache = { sig, path: found || [] };
        return found ? found[0] : null;
      })();

      function sideChain(i, dir) {
        const chain = [];
        let vw0 = 0, vw1 = 0, vw2 = 0, vw3 = 0;
        const iw = i >>> 5, ib = 1 << (i & 31);
        if (iw === 0) vw0 |= ib; else if (iw === 1) vw1 |= ib; else if (iw === 2) vw2 |= ib; else vw3 |= ib;
        const adj = dir < 0 ? nb.left : nb.right;
        let frontier = adj[i].filter(j => alive[j]);
        while (frontier.length) {
          const next = [];
          for (let fIdx = 0; fIdx < frontier.length; fIdx++) {
            const u = frontier[fIdx];
            const uw = u >>> 5, ub = 1 << (u & 31);
            const vWord = uw === 0 ? vw0 : uw === 1 ? vw1 : uw === 2 ? vw2 : vw3;
            if ((vWord & ub) !== 0) continue;
            if (uw === 0) vw0 |= ub; else if (uw === 1) vw1 |= ub; else if (uw === 2) vw2 |= ub; else vw3 |= ub;
            chain.push(u);
            const neighborsU = adj[u];
            for (let k = 0; k < neighborsU.length; k++) {
              const v = neighborsU[k];
              if (!alive[v]) continue;
              const vw = v >>> 5, vb = 1 << (v & 31);
              if (((vw === 0 ? vw0 : vw === 1 ? vw1 : vw === 2 ? vw2 : vw3) & vb) === 0) next.push(v);
            }
          }
          frontier = next;
        }
        return chain;
      }

      function sideChainCost(i, chain) {
        let ex0 = 0, ex1 = 0, ex2 = 0, ex3 = 0;
        let locks = 0, icePen = 0;
        for (let k = 0; k < chain.length; k++) {
          const u = chain[k];
          ex0 |= abvT0[u]; ex1 |= abvT1[u]; ex2 |= abvT2[u]; ex3 |= abvT3[u];
          const rcu = roleCode[u];
          if (rcu === 3) locks += 2;
          else if (rcu === 4) icePen += 1;
          else if (rcu === 5) icePen += 2;
        }
        ex0 = ex0 & aw0 & ~abvT0[i];
        ex1 = ex1 & aw1 & ~abvT1[i];
        ex2 = ex2 & aw2 & ~abvT2[i];
        ex3 = ex3 & aw3 & ~abvT3[i];
        const extraSize = pop32(ex0) + pop32(ex1) + pop32(ex2) + pop32(ex3);
        const extraLocks = 2 * (pop32(ex0 & lock0) + pop32(ex1 & lock1) + pop32(ex2 & lock2) + pop32(ex3 & lock3));
        return chain.length + extraSize + locks + extraLocks + icePen;
      }

      const requiredClockTop = new Set(seen.clock ? [seen.clock.i, ...aboveTrans[seen.clock.i]].filter(i => alive[i]) : []);
      const blockersMemo = new Array(n).fill(null);

      function blockers(i) {
        const cached = blockersMemo[i];
        if (cached !== null) return cached;
        const top = nb.above[i].filter(j => alive[j]);
        const left = nb.left[i].filter(j => alive[j]), right = nb.right[i].filter(j => alive[j]);
        let side = [];
        if (left.length && right.length) {
          const lChain = sideChain(i, -1), rChain = sideChain(i, 1);
          side = sideChainCost(i, lChain) <= sideChainCost(i, rChain) ? left : right;
        }
        let ice = [];
        const rci = roleCode[i];
        if (rci === 4 || rci === 5) {
          const need = rci === 5 ? 2 : 1;
          const sharedClock = p.sharedClockIce && requiredClockTop.has(i);
          const src = iceNoCycle[i];
          const validIce = [];
          for (let k = 0; k < src.length; k++) if (alive[src[k]]) validIce.push(src[k]);
          const already = validIce.filter(j => top.includes(j) || side.includes(j));
          if (already.length >= need) {
            ice = already;
          } else {
            const others = validIce.filter(j => !already.includes(j)).sort((a, b) => {
              const cost = u => pop32(aw0 & abv0[u]) + pop32(aw1 & abv1[u]) + pop32(aw2 & abv2[u]) + pop32(aw3 & abv3[u]) +
                (((aw0 & lft0[u]) | (aw1 & lft1[u]) | (aw2 & lft2[u]) | (aw3 & lft3[u])) !== 0 &&
                 ((aw0 & rgt0[u]) | (aw1 & rgt1[u]) | (aw2 & rgt2[u]) | (aw3 & rgt3[u])) !== 0 ? 1 : 0) +
                (roleCode[u] === 3 ? 3 : 0);
              if (sharedClock && requiredClockTop.has(a) !== requiredClockTop.has(b)) return requiredClockTop.has(a) ? -1 : 1;
              return cost(a) - cost(b);
            });
            ice = [...already, ...others.slice(0, Math.max(0, need + (sharedClock ? 0 : 1) - already.length))];
          }
        }
        const res = [...new Set([...top, ...side, ...ice])];
        blockersMemo[i] = res;
        return res;
      }

      const attraction = new Map(), clock = seen.clock;
      const clockMateLocked = Boolean(
        p.clockOutsPlan && clock && memInt[clock.i] !== NO_PIC && !tray.includes(memInt[clock.i]) &&
        memory.some((face, i) => i !== clock.i && alive[i] && face === memory[clock.i] && roleCode[i] === 3 &&
          (clockHorizon < 3 || clockMateRouteBudget({ alive, nb, clock, mate: i, roles, down: seen.down }).fits))
      );
      let clockBlockingMate = false;
      if (
        p.clockOutsPlan && clock && openPeek >= 0 && alive[openPeek] && memInt[clock.i] !== NO_PIC &&
        memInt[openPeek] === memInt[clock.i] && roleCode[clock.i] === 1 && !seenTakeable[clock.i] &&
        tray.length <= 2 && clock.remaining >= 2
      ) {
        const wd = openPeek >>> 5, mask = ~(1 << (openPeek & 31));
        clockBlockingMate = isFreeBits(
          clock.i,
          wd === 0 ? (aw0 & mask) : aw0,
          wd === 1 ? (aw1 & mask) : aw1,
          wd === 2 ? (aw2 & mask) : aw2,
          wd === 3 ? (aw3 & mask) : aw3
        );
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
        if (p.clockRowPreview && isSideBlockedOnly) {
          const left = sideChain(c, -1), right = sideChain(c, 1);
          const row = sideChainCost(c, left) <= sideChainCost(c, right) ? left : right;
          for (const index of row) {
            if ((attraction.get(index) ?? 0) < p.clockWeight * 0.3) {
              attract(index, 0, p.clockWeight * 0.82, clockHorizon, false);
            }
          }
        }
        const maxPerceivedZDiff = clockHorizon + (clockLosses >= 2 ? 2 : 0);
        const needSet = new Set([c]);
        const abvC = aboveTransArr[c];
        for (let idx = 0; idx < abvC.length; idx++) {
          const a = abvC[idx];
          if (alive[a] && tileZ[a] - tileZ[c] <= maxPerceivedZDiff) needSet.add(a);
        }
        if (nb.left[c].some(j => alive[j]) && nb.right[c].some(j => alive[j])) {
          const lChain = sideChain(c, -1), rChain = sideChain(c, 1);
          for (const u of (sideChainCost(c, lChain) <= sideChainCost(c, rChain) ? lChain : rChain)) {
            needSet.add(u);
            const abvU = aboveTransArr[u];
            for (let idx = 0; idx < abvU.length; idx++) if (alive[abvU[idx]]) needSet.add(abvU[idx]);
          }
        }
        for (const u of [...needSet]) {
          if (roleCode[u] === 4 || roleCode[u] === 5) {
            const src = iceNoCycle[u];
            const validIce = [];
            for (let k = 0; k < src.length; k++) if (alive[src[k]]) validIce.push(src[k]);
            if (!validIce.some(j => needSet.has(j)) && validIce.length) {
              needSet.add(validIce[0]);
              const abv0Arr = aboveTransArr[validIce[0]];
              for (let idx = 0; idx < abv0Arr.length; idx++) if (alive[abv0Arr[idx]]) needSet.add(abv0Arr[idx]);
            }
          }
        }
        if ([...needSet].some(u => roleCode[u] === 3)) {
          for (let k = 0; k < n; k++) if (alive[k] && (roleCode[k] === 2 || priorKeyTargets.has(k))) needSet.add(k);
        }
        if (p.clockNeedFull) {
          for (let round = 0; round < 3; round++) {
            for (const u of [...needSet]) {
              if (roleCode[u] === 2) {
                const abvU = aboveTransArr[u];
                for (let idx = 0; idx < abvU.length; idx++) if (alive[abvU[idx]]) needSet.add(abvU[idx]);
              }
              const h = roleCode[u] === 5 ? 2 : roleCode[u] === 4 ? 1 : 0;
              if (h) {
                const have = iceNb[u].filter(j => needSet.has(j)).length;
                const src = iceNoCycle[u];
                let rem = Math.max(0, h - have);
                for (let idx = 0; idx < src.length && rem > 0; idx++) {
                  const j = src[idx];
                  if (alive[j] && !needSet.has(j)) {
                    needSet.add(j);
                    const abvJ = aboveTransArr[j];
                    for (let m = 0; m < abvJ.length; m++) if (alive[abvJ[m]]) needSet.add(abvJ[m]);
                    rem--;
                  }
                }
              }
            }
            if ([...needSet].some(u => roleCode[u] === 3)) {
              for (let k = 0; k < n; k++) {
                if (alive[k] && roleCode[k] === 2) {
                  needSet.add(k);
                  const abvK = aboveTransArr[k];
                  for (let idx = 0; idx < abvK.length; idx++) if (alive[abvK[idx]]) needSet.add(abvK[idx]);
                }
              }
            }
          }
        }
        clockMovesNeeded = needSet.size;
        if (p.clockNeedFull) {
          const cnt = new Map();
          let unknown = 0;
          for (const u of needSet) {
            if (u === c) continue;
            const f = memory[u];
            if (f === null) unknown++;
            else cnt.set(f, (cnt.get(f) ?? 0) + 1);
          }
          const unpaired = unknown + [...cnt.values()].filter(v => v % 2).length - tray.filter(f => cnt.has(f)).length;
          clockMovesNeeded += Math.max(0, unpaired - 2);
        }
      }

      let boardHasLocks = false;
      for (let i = 0; i < n; i++) if (alive[i] && roleCode[i] === 3) { boardHasLocks = true; break; }
      const knownKeys = [];
      for (let i = 0; i < n; i++) if (alive[i] && (roleCode[i] === 2 || priorKeyTargets.has(i))) knownKeys.push(i);
      const freeKeys = knownKeys.filter(i => legalMask[i] === 1);
      let prepareKeyOut = false;
      if (p.retryPrepareKeyOuts) {
        for (let idx = 0; idx < legalLen; idx++) {
          const i = legalArr[idx];
          const fact = learnedLockedCarry.get(memory[i]);
          if (fact && alive[fact.partner] && !tray.includes(memory[i]) && (!clock || (attraction.get(i) ?? 0) > 0)) {
            prepareKeyOut = true;
            break;
          }
        }
      }
      const learnedKeyOut = knownKeys.length > 0 && !state.relieved && (tray.some(face => learnedLockedCarry.has(face)) || prepareKeyOut);
      const clockFlankedByLock = p.clockBesideLockKeys && clock && clockLosses < 2 && (
        nb.left[clock.i].some(j => alive[j] && roleCode[j] === 3) ||
        nb.right[clock.i].some(j => alive[j] && roleCode[j] === 3) ||
        nb.above[clock.i].some(j => alive[j] && roleCode[j] === 3)
      );
      const clockNeedsKeys = clock && (
        clockMateLocked || clockFlankedByLock ||
        [...attraction.keys()].some(i => alive[i] && roleCode[i] === 3) ||
        (learnedKeyOut && clock.remaining - clockMovesNeeded >= knownKeys.length)
      );
      if (clockNeedsKeys) {
        const keyW = p.clockWeight * (clockMateLocked || learnedKeyOut ? 1.35 : 0.92);
        const keyD = clockHorizon + (clockLosses > 0 ? 1 : 0);
        for (const i of knownKeys) attract(i, 0, keyW, keyD, false);
      } else if (!clock && boardHasLocks) {
        const keyW = (p.postClockKeyWeight ?? p.clockWeight * 0.75) * (learnedKeyOut ? 1.35 : 1);
        for (const i of knownKeys) {
          if (legalMask[i] === 0 || freeKeys.length >= 2 || tray.length <= 1) {
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
          for (const b of bl) if (roleCode[b] !== 3) rec(b, d + 1, w * 0.65, new Set([...path, u]));
        }
        rec(target, 0, weight, new Set());
      }

      if (p.partnerHorizon > 0) {
        for (let j = 0; j < n; j++) {
          if (!alive[j] || seenTakeable[j] === 1 || roleCode[j] === 3) continue;
          const pic = memInt[j];
          if (pic === NO_PIC) continue;
          if (tray.includes(pic)) {
            addPartnerAttract(j, (p.outWeight ?? 9) * (tray.length >= 2 ? 3.2 : 2.2), p.partnerHorizon);
          } else if (tray.length <= 2) {
            let hasLegalPic = false;
            for (let idx = 0; idx < legalLen; idx++) if (memInt[legalArr[idx]] === pic) { hasLegalPic = true; break; }
            if (hasLegalPic) addPartnerAttract(j, (p.outWeight ?? 9) * 1.6, Math.min(2, p.partnerHorizon));
          }
        }
      }

      const unmatchedClockInTray = tookEarlyClockThisAttempt && initialClock && initialClock.face !== undefined && tray.includes(initialClock.face);
      const depth = unmatchedClockInTray ? (p.firstTryTrayDepth ?? 1) : (clock ? clockTrayPlanningDepth() : (p.trayDepth ?? 3));
      const keyWork = new Set();
      if (p.retryKeyRouteValue && learnedKeyOut && (!clock || clockNeedsKeys)) {
        for (const k of knownKeys) {
          if (alive[k]) keyWork.add(k);
          const abvK = aboveTransArr[k];
          for (let idx = 0; idx < abvK.length; idx++) if (alive[abvK[idx]]) keyWork.add(abvK[idx]);
          if (nb.left[k].some(i => alive[i]) && nb.right[k].some(i => alive[i])) {
            const left = sideChain(k, -1), right = sideChain(k, 1);
            const row = sideChainCost(k, left) <= sideChainCost(k, right) ? left : right;
            for (const i of row) {
              if (alive[i]) keyWork.add(i);
              const abvI = aboveTransArr[i];
              for (let idx = 0; idx < abvI.length; idx++) if (alive[abvI[idx]]) keyWork.add(abvI[idx]);
            }
          }
        }
      }

      // Fast zero-allocation bitset computeTrayHorizon
      const future = (() => {
        const scores = new Map();
        if (!depth) return scores;
        const knownKeyIds = (keyWork.size || retryAccess) ? knownKeys : null;

        isKeyWork.fill(0);
        let initDeadKeyWork = 0;
        for (const i of keyWork) {
          isKeyWork[i] = 1;
          if (!alive[i]) initDeadKeyWork++;
        }

        isKeyTrigger.fill(0);
        let remKey0 = 0, remKey1 = 0, remKey2 = 0, remKey3 = 0;
        if (knownKeyIds !== null) {
          for (let idx = 0; idx < knownKeyIds.length; idx++) {
            const k = knownKeyIds[idx];
            if (retryAccess) isKeyTrigger[k] = 1;
            const kw = k >>> 5, kb = 1 << (k & 31);
            if (kw === 0) remKey0 |= kb; else if (kw === 1) remKey1 |= kb; else if (kw === 2) remKey2 |= kb; else remKey3 |= kb;
          }
        } else {
          remKey0 = key0; remKey1 = key1; remKey2 = key2; remKey3 = key3;
        }
        for (let idx = 0; idx < keyTilesLen; idx++) isKeyTrigger[keyTilesArr[idx]] = 1;

        let steppableLen = 0;
        for (let i = 0; i < n; i++) {
          const sd = seenDown[i];
          const rd = sd !== -1 ? sd : (retryAccess ? (retryAccess.downValue(i, attempt) ?? -1) : -1);
          remDown[i] = rd;
          if (memInt[i] !== NO_PIC && memInt[i] !== 101 && rd !== -1) {
            steppableTiles[steppableLen++] = i;
          }
        }

        const initTrayHasJoker = tray.includes(101);
        if (initTrayHasJoker || tray.length >= 4) {
          for (let idx = 0; idx < legalLen; idx++) scores.set(legalArr[idx], 0);
          return scores;
        }

        const initDead = n - (pop32(aw0) + pop32(aw1) + pop32(aw2) + pop32(aw3));
        const initTLen = tray.length;
        const initT0 = tray[0] ?? 0, initT1 = tray[1] ?? 0, initT2 = tray[2] ?? 0;
        const pairRew = p.pairReward;
        const baseVal = initDead * 4 - initTLen * (initTLen + 1) * 4 + pairRew * initDeadKeyWork;
        const canUseRetryAccess = Boolean(retryAccess && attempt > 1);
        const stateRelieved = state.relieved;

        const isFreeAndUsableTH = (w0, w1, w2, w3, unlock, i, cachedBigObj) => {
          if (!isFreeBits(i, w0, w1, w2, w3)) return false;
          const rci = roleCode[i];
          if (seenTakeable[i] === 1 || rci === 1 || rci === 2 || (rci === 3 && unlock)) return true;
          if (rci === 4 || rci === 5) {
            const rm0 = aw0 & ~w0, rm1 = aw1 & ~w1, rm2 = aw2 & ~w2, rm3 = aw3 & ~w3;
            if (rci === 4) {
              if (((rm0 & ice0[i]) | (rm1 & ice1[i]) | (rm2 & ice2[i]) | (rm3 & ice3[i])) !== 0) return true;
            } else {
              if (pop32(rm0 & ice0[i]) + pop32(rm1 & ice1[i]) + pop32(rm2 & ice2[i]) + pop32(rm3 & ice3[i]) >= 2) return true;
            }
          }
          if (!canUseRetryAccess) return false;
          if (cachedBigObj.mask === null) {
            cachedBigObj.mask =
              BigInt((~w0 & validMask0) >>> 0) |
              (BigInt((~w1 & validMask1) >>> 0) << 32n) |
              (BigInt((~w2 & validMask2) >>> 0) << 64n) |
              (BigInt((~w3 & validMask3) >>> 0) << 96n);
          }
          return retryAccess.canTake(i, cachedBigObj.mask, stateRelieved, attempt);
        };

        const {
          thW0, thW1, thW2, thW3, thT0, thT1, thT2, thTLen,
          thPeek, thUnlock, thDead, thDeadKey, thVal, thPicked,
        } = scratch;

        function searchTH(w0, w1, w2, w3, t0, t1, t2, tLen, peek, unlock, dead, deadKey, left) {
          let best = dead * 4 - tLen * (tLen + 1) * 4 + pairRew * deadKey;
          if (left <= 0) return best;

          const cachedBigObj = { mask: null };

          // Leaf-level fast path (left === 1): search(nxt, 0) === val(nxt), so max over top-6 === max over all!
          if (left === 1) {
            for (let sIdx = 0; sIdx < steppableLen; sIdx++) {
              const i = steppableTiles[sIdx];
              if (!isFreeAndUsableTH(w0, w1, w2, w3, unlock, i, cachedBigObj)) continue;
              const f = memInt[i];
              let q = -1;
              if (tLen >= 1 && t0 === f) q = 0;
              else if (tLen >= 2 && t1 === f) q = 1;
              else if (tLen === 3 && t2 === f) q = 2;

              let nDead = dead, nTLen = tLen, nDeadKey = deadKey;
              if (q >= 0) {
                nDead = dead + 1;
                nTLen = tLen - 1;
                nDeadKey = deadKey + isKeyWork[i];
              } else {
                const mate = peek >= 0 && peek !== i && memInt[peek] === f && isFreeAndUsableTH(w0, w1, w2, w3, unlock, peek, cachedBigObj);
                if (mate) {
                  nDead = dead + 2;
                  nDeadKey = deadKey + isKeyWork[i] + isKeyWork[peek];
                } else if (remDown[i] === 1 && peek !== i) {
                  continue; // nxtVal === best, cannot strictly improve `best`
                } else {
                  if (tLen >= 3) continue; // tray overflow (4) -> null
                  nDead = dead + 1;
                  nTLen = tLen + 1;
                  nDeadKey = deadKey + isKeyWork[i];
                }
              }
              const v = nDead * 4 - nTLen * (nTLen + 1) * 4 + pairRew * nDeadKey;
              if (v > best) best = v;
            }
            return best;
          }

          // Interior depth (left >= 2): store valid children in per-depth slice of scratch arrays
          const baseOff = (left - 2) * 128;
          let count = 0;
          for (let sIdx = 0; sIdx < steppableLen; sIdx++) {
            const i = steppableTiles[sIdx];
            if (!isFreeAndUsableTH(w0, w1, w2, w3, unlock, i, cachedBigObj)) continue;
            const f = memInt[i];
            let q = -1;
            if (tLen >= 1 && t0 === f) q = 0;
            else if (tLen >= 2 && t1 === f) q = 1;
            else if (tLen === 3 && t2 === f) q = 2;

            let nw0 = w0, nw1 = w1, nw2 = w2, nw3 = w3;
            let nt0 = t0, nt1 = t1, nt2 = t2, ntLen = tLen;
            let nPeek = peek, nUnlock = unlock, nDead = dead, nDeadKey = deadKey;
            let removedI = false, mate = false;

            if (q >= 0) {
              const wd = i >>> 5, mask = ~(1 << (i & 31));
              if (wd === 0) nw0 &= mask; else if (wd === 1) nw1 &= mask; else if (wd === 2) nw2 &= mask; else nw3 &= mask;
              removedI = true;
              ntLen = tLen - 1;
              if (q === 0) { nt0 = t1; nt1 = t2; }
              else if (q === 1) { nt0 = t0; nt1 = t2; }
              if (nPeek === i) nPeek = -1;
              nDead = dead + 1;
              nDeadKey = deadKey + isKeyWork[i];
            } else {
              mate = peek >= 0 && peek !== i && memInt[peek] === f && isFreeAndUsableTH(w0, w1, w2, w3, unlock, peek, cachedBigObj);
              if (mate) {
                const wd = i >>> 5, mask = ~(1 << (i & 31));
                if (wd === 0) nw0 &= mask; else if (wd === 1) nw1 &= mask; else if (wd === 2) nw2 &= mask; else nw3 &= mask;
                const pwd = peek >>> 5, pmask = ~(1 << (peek & 31));
                if (pwd === 0) nw0 &= pmask; else if (pwd === 1) nw1 &= pmask; else if (pwd === 2) nw2 &= pmask; else nw3 &= pmask;
                removedI = true;
                nPeek = -1;
                nDead = dead + 2;
                nDeadKey = deadKey + isKeyWork[i] + isKeyWork[peek];
              } else if (remDown[i] === 1 && peek !== i) {
                nPeek = i;
              } else {
                if (tLen >= 3) continue;
                const wd = i >>> 5, mask = ~(1 << (i & 31));
                if (wd === 0) nw0 &= mask; else if (wd === 1) nw1 &= mask; else if (wd === 2) nw2 &= mask; else nw3 &= mask;
                removedI = true;
                ntLen = tLen + 1;
                if (tLen === 0) nt0 = f;
                else if (tLen === 1) nt1 = f;
                else nt2 = f;
                if (nPeek === i) nPeek = -1;
                nDead = dead + 1;
                nDeadKey = deadKey + isKeyWork[i];
              }
            }

            if (removedI && !nUnlock && (isKeyTrigger[i] || (mate && isKeyTrigger[peek]))) {
              if (((nw0 & remKey0) | (nw1 & remKey1) | (nw2 & remKey2) | (nw3 & remKey3)) === 0) nUnlock = 1;
            }

            const slot = baseOff + count++;
            thW0[slot] = nw0; thW1[slot] = nw1; thW2[slot] = nw2; thW3[slot] = nw3;
            thT0[slot] = nt0; thT1[slot] = nt1; thT2[slot] = nt2; thTLen[slot] = ntLen;
            thPeek[slot] = nPeek; thUnlock[slot] = nUnlock;
            thDead[slot] = nDead; thDeadKey[slot] = nDeadKey;
            thVal[slot] = nDead * 4 - ntLen * (ntLen + 1) * 4 + pairRew * nDeadKey;
            thPicked[slot] = 0;
          }

          // Select top min(6, count) children in exact stable descending `r` order (earliest index wins ties)
          const kLim = count < 6 ? count : 6;
          for (let pick = 0; pick < kLim; pick++) {
            let bestIdx = -1, bestR = -Infinity;
            for (let c = 0; c < count; c++) {
              const slot = baseOff + c;
              if (thPicked[slot]) continue;
              const r = thVal[slot];
              if (r > bestR) { bestR = r; bestIdx = slot; }
            }
            thPicked[bestIdx] = 1;
            const sub = searchTH(
              thW0[bestIdx], thW1[bestIdx], thW2[bestIdx], thW3[bestIdx],
              thT0[bestIdx], thT1[bestIdx], thT2[bestIdx], thTLen[bestIdx],
              thPeek[bestIdx], thUnlock[bestIdx], thDead[bestIdx], thDeadKey[bestIdx],
              left - 1
            );
            if (sub > best) best = sub;
          }
          return best;
        }

        const rootBigObj = { mask: null };
        for (let idx = 0; idx < legalLen; idx++) {
          const i = legalArr[idx];
          const f = memInt[i];
          const known = f !== NO_PIC && remDown[i] !== -1 && f !== 101;
          if (!known) {
            scores.set(i, 0);
            continue;
          }
          let q = -1;
          if (initTLen >= 1 && initT0 === f) q = 0;
          else if (initTLen >= 2 && initT1 === f) q = 1;
          else if (initTLen === 3 && initT2 === f) q = 2;

          let nw0 = aw0, nw1 = aw1, nw2 = aw2, nw3 = aw3;
          let nt0 = initT0, nt1 = initT1, nt2 = initT2, ntLen = initTLen;
          let nPeek = openPeek, nUnlock = 0, nDead = initDead, nDeadKey = initDeadKeyWork;
          let removedI = false, mate = false;

          if (q >= 0) {
            const wd = i >>> 5, mask = ~(1 << (i & 31));
            if (wd === 0) nw0 &= mask; else if (wd === 1) nw1 &= mask; else if (wd === 2) nw2 &= mask; else nw3 &= mask;
            removedI = true;
            ntLen = initTLen - 1;
            if (q === 0) { nt0 = initT1; nt1 = initT2; }
            else if (q === 1) { nt0 = initT0; nt1 = initT2; }
            if (nPeek === i) nPeek = -1;
            nDead = initDead + 1;
            nDeadKey = initDeadKeyWork + isKeyWork[i];
          } else {
            mate = openPeek >= 0 && openPeek !== i && memInt[openPeek] === f && isFreeAndUsableTH(aw0, aw1, aw2, aw3, 0, openPeek, rootBigObj);
            if (mate) {
              const wd = i >>> 5, mask = ~(1 << (i & 31));
              if (wd === 0) nw0 &= mask; else if (wd === 1) nw1 &= mask; else if (wd === 2) nw2 &= mask; else nw3 &= mask;
              const pwd = openPeek >>> 5, pmask = ~(1 << (openPeek & 31));
              if (pwd === 0) nw0 &= pmask; else if (pwd === 1) nw1 &= pmask; else if (pwd === 2) nw2 &= pmask; else nw3 &= pmask;
              removedI = true;
              nPeek = -1;
              nDead = initDead + 2;
              nDeadKey = initDeadKeyWork + isKeyWork[i] + isKeyWork[openPeek];
            } else if (remDown[i] === 1 && openPeek !== i) {
              nPeek = i;
            } else {
              if (initTLen >= 3) {
                scores.set(i, -100);
                continue;
              }
              const wd = i >>> 5, mask = ~(1 << (i & 31));
              if (wd === 0) nw0 &= mask; else if (wd === 1) nw1 &= mask; else if (wd === 2) nw2 &= mask; else nw3 &= mask;
              removedI = true;
              ntLen = initTLen + 1;
              if (initTLen === 0) nt0 = f;
              else if (initTLen === 1) nt1 = f;
              else nt2 = f;
              if (nPeek === i) nPeek = -1;
              nDead = initDead + 1;
              nDeadKey = initDeadKeyWork + isKeyWork[i];
            }
          }

          if (removedI && (isKeyTrigger[i] || (mate && isKeyTrigger[openPeek]))) {
            if (((nw0 & remKey0) | (nw1 & remKey1) | (nw2 & remKey2) | (nw3 & remKey3)) === 0) nUnlock = 1;
          }

          scores.set(i, searchTH(nw0, nw1, nw2, nw3, nt0, nt1, nt2, ntLen, nPeek, nUnlock, nDead, nDeadKey, depth - 1) - baseVal);
        }
        return scores;
      })();

      const suggestsNoEasyEscapeFast = index => {
        const face = memInt[index];
        if (face === NO_PIC || face === 101 || tray.includes(101)) return false;
        let nw0 = aw0, nw1 = aw1, nw2 = aw2, nw3 = aw3;
        let t0 = tray[0] ?? 0, t1 = tray[1] ?? 0, t2 = tray[2] ?? 0, tLen = tray.length;
        let peek = openPeek;
        const onPile = peek >= 0 && peek !== index && alive[peek] && memInt[peek] === face && seenTakeable[peek] === 1;

        const iwd = index >>> 5, imask = ~(1 << (index & 31));
        if (iwd === 0) nw0 &= imask; else if (iwd === 1) nw1 &= imask; else if (iwd === 2) nw2 &= imask; else nw3 &= imask;

        let q = -1;
        if (tLen >= 1 && t0 === face) q = 0;
        else if (tLen >= 2 && t1 === face) q = 1;
        else if (tLen >= 3 && t2 === face) q = 2;

        if (q >= 0) {
          tLen--;
          if (q === 0) { t0 = t1; t1 = t2; }
          else if (q === 1) { t0 = t0; t1 = t2; }
        } else if (onPile) {
          const pwd = peek >>> 5, pmask = ~(1 << (peek & 31));
          if (pwd === 0) nw0 &= pmask; else if (pwd === 1) nw1 &= pmask; else if (pwd === 2) nw2 &= pmask; else nw3 &= pmask;
          peek = -1;
        } else {
          if (tLen >= 3) return true; // tray.length >= 4
          if (tLen === 0) t0 = face;
          else if (tLen === 1) t1 = face;
          else t2 = face;
          tLen++;
        }
        if (peek === index) peek = -1;

        if (tLen >= 4) return true;
        if (tLen < 3) return false;

        let unlocked = state.relieved || roleCode[index] === 2 || seenRoleCode[index] === 0 ||
          (onPile && (roleCode[openPeek] === 2 || seenRoleCode[openPeek] === 0));

        const maxResolveSteps = p.trayDepth >= 3 ? 4 : 1;
        for (let step = 0; step < maxResolveSteps; step++) {
          let cLen = 0;
          const rm0 = aw0 & ~nw0, rm1 = aw1 & ~nw1, rm2 = aw2 & ~nw2, rm3 = aw3 & ~nw3;
          for (let j = 0; j < n; j++) {
            if (!isFreeBits(j, nw0, nw1, nw2, nw3)) continue;
            if (seenTakeable[j] !== 1 && !unlocked) {
              const srj = seenRoleCode[j];
              if (srj === 3) continue;
              if (srj === 4) {
                if (((rm0 & ice0[j]) | (rm1 & ice1[j]) | (rm2 & ice2[j]) | (rm3 & ice3[j])) === 0) continue;
              } else if (srj === 5) {
                if (pop32(rm0 & ice0[j]) + pop32(rm1 & ice1[j]) + pop32(rm2 & ice2[j]) + pop32(rm3 & ice3[j]) < 2) continue;
              }
            }
            const mj = memInt[j];
            if (mj === NO_PIC || mj === 101 || mj === t0 || mj === t1 || mj === t2) return false;
            candsBuf[cLen++] = j;
          }
          let mu = -1, mv = -1;
          for (let a = 0; a < cLen && mu < 0; a++) {
            const u = candsBuf[a], muFace = memInt[u], du = seenDown[u];
            for (let b = a + 1; b < cLen; b++) {
              const v = candsBuf[b];
              if (muFace === memInt[v] && (du !== 0 || seenDown[v] !== 0)) {
                mu = u; mv = v;
                break;
              }
            }
          }
          if (mu < 0) return true;
          const uwd = mu >>> 5, umask = ~(1 << (mu & 31));
          if (uwd === 0) nw0 &= umask; else if (uwd === 1) nw1 &= umask; else if (uwd === 2) nw2 &= umask; else nw3 &= umask;
          const vwd = mv >>> 5, vmask = ~(1 << (mv & 31));
          if (vwd === 0) nw0 &= vmask; else if (vwd === 1) nw1 &= vmask; else if (vwd === 2) nw2 &= vmask; else nw3 &= vmask;
          if (roleCode[mu] === 2 || seenRoleCode[mu] === 0 || roleCode[mv] === 2 || seenRoleCode[mv] === 0) unlocked = true;
        }
        return false;
      };

      const effectiveNeed = strictClockSlack ? Math.max(clockHorizon, clockMovesNeeded) : clockHorizon;
      const clockSlack = clock ? clock.remaining - clockMovesNeeded : 99;
      const urgency = clock
        ? Math.max(1, (effectiveNeed / Math.max(1, clock.remaining)) ** (p.clockUrgencyPower ?? 2)) * (clockLosses > 0 ? 1.5 : 1)
        : 1;

      let matchingNow = false;
      for (let idx = 0; idx < legalLen; idx++) {
        const i = legalArr[idx], fi = memInt[i];
        if (fi === NO_PIC) continue;
        if (tray.includes(fi) || (openPeek >= 0 && i !== openPeek && fi === memInt[openPeek])) {
          matchingNow = true; break;
        }
        for (let idx2 = 0; idx2 < legalLen; idx2++) {
          const j = legalArr[idx2];
          if (j !== i && memInt[j] === fi) { matchingNow = true; break; }
        }
        if (matchingNow) break;
      }

      const signature = alive.join('') + '|' + tray.join(',');

      const balkingAtFlippedClockBlocker = Boolean(
        clock && clockLosses < 2 && clock.remaining >= 3 && tray.length >= 1 &&
        openPeek >= 0 && seenDown[openPeek] === 1 &&
        (attraction.get(openPeek) ?? 0) >= p.clockWeight * 0.3 &&
        memInt[openPeek] !== NO_PIC && !tray.includes(memInt[openPeek])
      );

      let anyTrayMatch = false;
      for (let idx = 0; idx < legalLen; idx++) {
        const j = legalArr[idx];
        if (memInt[j] !== NO_PIC && seenDown[j] !== 1 && tray.includes(memInt[j])) {
          anyTrayMatch = true; break;
        }
      }

      const scored = new Array(legalLen);
      const maxUnmatchedBlockers = Math.min(p.partnerHorizon, Math.max(0, 2 - tray.length));
      const zWeight = p.zWeight ?? 1.8;

      for (let lIdx = 0; lIdx < legalLen; lIdx++) {
        const i = legalArr[lIdx];
        const face = memory[i], fInt = memInt[i], down = seenDown[i] === 1, peek = down && openPeek !== i;
        const trayMatch = fInt !== NO_PIC && tray.includes(fInt);
        let twin = undefined;
        if (fInt !== NO_PIC) {
          for (let kIdx = 0; kIdx < legalLen; kIdx++) {
            const j = legalArr[kIdx];
            if (j !== i && memInt[j] === fInt) { twin = j; break; }
          }
        }
        const openTwin = openPeek >= 0 && openPeek !== i && fInt !== NO_PIC && memInt[openPeek] === fInt;
        const hasTwin = twin !== undefined;
        const knownDig = peek && fInt !== NO_PIC && !trayMatch && !openTwin && !hasTwin && !(fInt === 101 && tray.length);
        const knownFatal = tray.length >= 3 && fInt !== NO_PIC && !trayMatch && !openTwin && fInt !== 101 && !tray.includes(101) && (!peek || knownDig);

        const visitsKey = signature + '|' + i, count = visits.get(visitsKey) ?? 0;
        const ownGoal = attraction.get(i) ?? 0;
        const goal = Math.max(
          ownGoal,
          openTwin ? (attraction.get(openPeek) ?? 0) : 0,
          hasTwin ? (attraction.get(twin) ?? 0) * 0.85 : 0
        );

        const aliveBelow = pop32(aw0 & blw0[i]) + pop32(aw1 & blw1[i]) + pop32(aw2 & blw2[i]) + pop32(aw3 & blw3[i]);
        const structBonus = tileZ[i] * zWeight + aliveBelow * 0.4;
        let score = (knownFatal ? -2000 : goal * urgency) + (clock ? 0 : (partnerAttract.get(i) ?? 0)) + structBonus;

        const offClock = clock && goal < p.clockWeight * 0.3;
        const tightClock = Boolean(strictClockSlack && clock && !balkingAtFlippedClockBlocker && (clockSlack < 2 || clockLosses >= 2));

        if (trayMatch) {
          const urgentLastClockMove = clock && clock.remaining <= 1 && ownGoal === 0;
          score += urgentLastClockMove ? 0 : (p.pairReward * 2.6 + (!clock && tray.length >= 2 ? (tray.length - 1) * 6 : 0));
        } else if (fInt === 101 && tray.length) {
          score += p.pairReward * 2.5;
        } else if (openTwin) {
          score += p.pairReward * 2.6;
        } else if (hasTwin) {
          const sidePairPenalty = offClock
            ? (tightClock ? p.clockWeight * 1.3 : p.pairReward * 0.25)
            : 0;
          score += p.pairReward + (down || seenDown[twin] === 1 ? 3 : 0) - sidePairPenalty;
        } else if (peek && fInt === NO_PIC) {
          const freePeekBonus = ownGoal > 0 ? p.pairReward : (!matchingNow ? (p.freePeekBonus ?? 18) : 4);
          score += p.exploration + freePeekBonus + (tray.length >= 2 ? 6 : 0);
        } else {
          let reachable = false;
          if (fInt !== NO_PIC) {
            for (let kIdx = 0; kIdx < knownLen; kIdx++) {
              const j = knownTiles[kIdx];
              if (j === i || !alive[j] || memInt[j] !== fInt || roleCode[j] === 0 || roleCode[j] === 3) continue;
              const bl = blockers(j);
              if (bl.length > p.partnerHorizon) continue;
              let unmatchedBl = 0;
              for (let bIdx = 0; bIdx < bl.length; bIdx++) {
                const mb = memInt[bl[bIdx]];
                if (mb === NO_PIC || !tray.includes(mb)) unmatchedBl++;
              }
              if (unmatchedBl <= maxUnmatchedBlockers) { reachable = true; break; }
            }
          }
          score -= p.trayCost * Math.max(1, tray.length * 2);
          if (reachable && !(offClock && tightClock)) score += p.trayCost * 1.1;
          if (tray.length >= 2 && !reachable) score -= p.trayCost * 2;
          if (offClock && tightClock) score -= p.clockWeight * 1.2;
          if (balkingAtFlippedClockBlocker && i === openPeek) {
            score += clockLosses === 0 ? (p.flippedBlockerBalk0 ?? 12.8) : (p.flippedBlockerBalk1 ?? -5.0);
          }
          if (!clock && roleCode[i] === 2 && freeKeys.length < 2 && tray.length >= 2) {
            score -= 35;
          }
          const prevFail = failedDigs.get(i) ?? 0;
          if (prevFail > 0 && tray.length >= 1 && (!clock || ownGoal === 0)) {
            score -= prevFail * 28;
          }
        }

        if (p.outWeight && (!peek || knownDig)) {
          let nw0 = aw0, nw1 = aw1, nw2 = aw2, nw3 = aw3;
          const iwd = i >>> 5, imask = ~(1 << (i & 31));
          if (iwd === 0) nw0 &= imask; else if (iwd === 1) nw1 &= imask; else if (iwd === 2) nw2 &= imask; else nw3 &= imask;
          if (openTwin) {
            const pwd = openPeek >>> 5, pmask = ~(1 << (openPeek & 31));
            if (pwd === 0) nw0 &= pmask; else if (pwd === 1) nw1 &= pmask; else if (pwd === 2) nw2 &= pmask; else nw3 &= pmask;
          }
          const rm0 = aw0 & ~nw0, rm1 = aw1 & ~nw1, rm2 = aw2 & ~nw2, rm3 = aw3 & ~nw3;
          const nextTray = trayMatch ? tray.filter(f => f !== face) : openTwin ? tray : tray.concat(face === null ? [-1] : [face]);

          const usableAfterBits = j => {
            if (!isFreeBits(j, nw0, nw1, nw2, nw3)) return false;
            const ar = afterRole[j];
            if (ar === 0) return true;
            if (ar === 3) return false;
            if (ar === 1) return ((rm0 & ice0[j]) | (rm1 & ice1[j]) | (rm2 & ice2[j]) | (rm3 & ice3[j])) !== 0;
            return pop32(rm0 & ice0[j]) + pop32(rm1 & ice1[j]) + pop32(rm2 & ice2[j]) + pop32(rm3 & ice3[j]) >= 2;
          };

          let nfLen = 0;
          newlyFreeMask.fill(0);
          for (let j = 0; j < n; j++) {
            if (legalMask[j] === 0 && usableAfterBits(j)) {
              newlyFreeBuf[nfLen++] = j;
              newlyFreeMask[j] = 1;
            }
          }

          for (let nfIdx = 0; nfIdx < nfLen; nfIdx++) {
            const j = newlyFreeBuf[nfIdx], mj = memInt[j];
            const matchesExistingTray = mj !== NO_PIC && tray.includes(mj);
            const matchesNewSelf = mj !== NO_PIC && nextTray.includes(mj) && !matchesExistingTray;
            if (matchesExistingTray || (matchesNewSelf && !(offClock && tightClock))) {
              score += p.outWeight * 3.5;
            } else if (mj !== NO_PIC && !(offClock && tightClock)) {
              let pairable = false;
              for (let kIdx = 0; kIdx < legalLen; kIdx++) {
                const k = legalArr[kIdx];
                if (k === i || (openTwin && k === openPeek)) continue;
                if (memInt[k] === mj && (nextTray.length < 3 || seenDown[j] === 1 || seenDown[k] === 1)) {
                  pairable = true; break;
                }
              }
              score += pairable ? p.outWeight * 1.2 : p.outWeight * 0.08;
            } else if (mj === NO_PIC) {
              score += p.outWeight * 0.9 * (1 - 0.7 * (p.planAhead ?? 0));
            } else {
              score += p.outWeight * 0.08;
            }
          }

          const blwArr = belowArr[i];
          for (let bIdx = 0; bIdx < blwArr.length; bIdx++) {
            const j = blwArr[bIdx];
            if (j === i || (openTwin && j === openPeek) || !alive[j]) continue;
            if (newlyFreeMask[j] === 0) {
              if (roleCode[j] === 3 && freeKeys.length < 2) {
                score -= p.outWeight * 1.6;
              } else if (memInt[j] === NO_PIC || seenRoleCode[j] === 0) {
                score += p.outWeight * 0.25;
              }
            }
          }

          if (tray.length >= 2 && !trayMatch && !openTwin && fInt !== NO_PIC) {
            let directMate = false;
            for (let kIdx = 0; kIdx < knownLen; kIdx++) {
              const j = knownTiles[kIdx];
              if (j === i || (openTwin && j === openPeek) || !alive[j]) continue;
              if (memInt[j] === fInt && usableAfterBits(j)) { directMate = true; break; }
            }
            let freesUnknown = false;
            for (let nfIdx = 0; nfIdx < nfLen; nfIdx++) {
              if (memInt[newlyFreeBuf[nfIdx]] === NO_PIC) { freesUnknown = true; break; }
            }
            if (!directMate && (!freesUnknown || (p.planAhead && random() < p.planAhead))) score -= p.outWeight * 2.5;
          }
        }

        if (p.clockOutsPlan && clock && seenTakeable[clock.i] === 1 && memInt[clock.i] !== NO_PIC && tray.includes(memInt[clock.i])) {
          if (i === clock.i) score += p.pairReward * 2.6;
          else if (trayMatch && fInt === memInt[clock.i]) score -= p.pairReward * 2.6;
        }
        if (clock && clock.n >= 14 && i === clock.i && !trayMatch && clock.remaining >= 5) {
          if (earlyClockLosses > 0 && random() < Math.min(0.85, earlyClockLosses * 0.45)) score -= p.clockWeight * 1.5;
          else if (tray.length >= 2) score -= p.clockWeight * 1.1;
        }
        if (clock && (i === clock.i || (openTwin && openPeek === clock.i))) score += p.clockCompletionBonus ?? 0;
        if (clockBlockingMate) {
          if (i === openPeek && !peek) score += p.pairReward * 2.6;
          else if (openTwin && i !== clock.i) score -= p.pairReward * 2.6;
        }
        if (p.clockOutsPlan && clock) {
          const removes = !peek || trayMatch || openTwin;
          const containsClock = i === clock.i || (openTwin && openPeek === clock.i);
          const ticks = openTwin || (hasTwin && !trayMatch && offClock) ? 2 : 1;
          if (removes && !containsClock && ticks >= clock.remaining) score -= 2000;
          const setsUpClock = fInt !== NO_PIC && fInt === memInt[clock.i] && seenTakeable[clock.i] === 1;
          if (clock.remaining <= 2 && peek && fInt !== NO_PIC && !trayMatch && !openTwin && count >= 1 && !setsUpClock) score -= 2400;
        }
        if (knownDig) {
          score -= 0.5;
        } else if (down && openPeek === i && !trayMatch && !openTwin && !hasTwin) {
          score += 1.5;
        }

        if (peek) score -= Math.max(0, count - p.peekPatience + 1) * 8 + (count >= 4 ? (count - 3) * 30 : 0);
        if (!peek && count) score -= count * 2;

        score += (future.get(i) ?? 0) * (p.futureWeight ?? 1) * (clock ? 0.15 : 1);
        if ((!peek || knownDig) && !(clock && i === clock.i) && suggestsNoEasyEscapeFast(i)) score -= 1200;

        if (p.lookPenalty && !clock && !trayMatch && !openTwin && !(peek && fInt === NO_PIC) && fInt !== NO_PIC) {
          const newTLen = tray.length + 1;
          if (newTLen >= (p.lookFrom ?? 2)) {
            const iwd = i >>> 5, imask = ~(1 << (i & 31));
            const nw0 = iwd === 0 ? (aw0 & imask) : aw0;
            const nw1 = iwd === 1 ? (aw1 & imask) : aw1;
            const nw2 = iwd === 2 ? (aw2 & imask) : aw2;
            const nw3 = iwd === 3 ? (aw3 & imask) : aw3;
            let ok;
            if (newTLen <= 3) {
              const nt0 = tray.length === 0 ? fInt : tray[0];
              const nt1 = tray.length === 1 ? fInt : (tray[1] ?? 0);
              const nt2 = tray.length === 2 ? fInt : (tray[2] ?? 0);
              ok = canRelieveBits(nw0, nw1, nw2, nw3, nt0, nt1, nt2, newTLen, p.lookDepth ?? 1, 0);
            } else {
              ok = canRelieveGeneral(nw0, nw1, nw2, nw3, tray.concat(fInt), p.lookDepth ?? 1, 0);
            }
            if (global.__lookStats) { global.__lookStats.checks++; if (!ok) global.__lookStats.fired++; }
            if (!ok) score -= p.lookPenalty;
          }
        }
        if (routeNext !== null && i === routeNext) score += p.routePlan;
        if (p.clockFirst && clock && offClock && tray.length < 3 && clockSlack <= (p.clockFirstSlack ?? 1) && (trayMatch || openTwin || hasTwin)) score -= p.clockFirst;
        if (p.pairFirst && !clock && hasTwin && !trayMatch && !openTwin && !anyTrayMatch) score += p.pairFirst;
        if (p.spotPenalty && !clock && tray.length >= 2 && !trayMatch && !openTwin && !(peek && fInt === NO_PIC)) score -= p.spotPenalty;

        const u = Math.max(1e-12, Math.min(1 - 1e-12, random()));
        const noisy = score - p.temperature * Math.log(-Math.log(u));
        scored[lIdx] = { index: i, score, noisy, visitsKey };
      }

      const selected = random() < p.lapse
        ? scored[Math.floor(random() * scored.length)]
        : scored.reduce((a, b) => a.noisy >= b.noisy ? a : b);
      visits.set(selected.visitsKey, (visits.get(selected.visitsKey) ?? 0) + 1);
      lastDecision = { ...state, pictures: memory.slice(), down: seen.down.slice(), index: selected.index };
      if (routeCache && routeCache.path.length && routeCache.path[0] === selected.index) {
        routeCache = { sig: null, path: routeCache.path.slice(1), keep: true };
      }
      return { index: selected.index, score: selected.score };
    } finally {
      scratch.busy = false;
    }
  }

  return {
    beginAttempt,
    endAttempt,
    observe,
    decide,
    retryAccessEvidence: () => retryAccess?.evidence() ?? [],
    keyPictureRelationEvidence: () => [...keyPictureRelations.values()].map(f => ({ ...f })),
    lockedCarryEvidence: () => [...learnedLockedCarry.values()].map(f => ({ ...f })),
    rememberedKeyTargets,
    keyIdentityEvidence: () => retryKeyMemory?.entries() ?? [],
    remembered: () => memory.slice(),
    planningAttention: () => ({ clockHorizon, strictClockSlack, clockTrayDepth: clockTrayPlanningDepth() }),
  };
}

module.exports = { createFactoryController: createFastPlannerController, createFastPlannerController, PROFILES };
