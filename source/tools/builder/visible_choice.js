'use strict';
// visible_choice.js: Opt-in level construction module for Task G5.
// Builds boards with visible intent, a genuine early/mid-board choice with observable
// pressure and learnable consequence. Pipeline traces and acceptance judge actual pacing and quality.
// Dennis & Codex rules: LEVEL-DESIGN-FACTS.md and TASK-G5-visible-choice-builder.md.

const path = require('path'), fs = require('fs');
const L = global.Layouts || (global.Layouts = require('../../www/layouts.js'));
const E = require('./engine.js');
const B = require('./builder.js');
const D = require('./loop/detour.js');
const O = require('./loop/obvious.js');
const Pk = require('./loop/publicfork.js');
const SG = require('./loop/static_gates.js');
const { exactRoute } = require('../lab/exact.js');
const { tileVisibility } = require('../sim/refit/human_board_visibility.js');
const PS = require('../factory/placement_score.js');
const GP = require('./loop/gate_profile.js');

const readableOf = d => { try { return PS.readable(d); } catch (e) { return false; } };
const rngOf = seed => { let s = (seed >>> 0) || 1; return () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296; };
const shuffle = (rng, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const capOf = brief => Math.max(1, Math.min(3, 3 - (brief.targets?.trayRoom ?? 1)));
const luckTargetOf = (brief, cap = capOf(brief)) => cap >= 3 ? Math.max(0, brief.targets?.luck ?? brief.targets?.hiddenOnWay ?? 0) : 0;

function choiceProofs(report, authored) {
  return (report.forks || []).flatMap(f => (f.tempting || []).filter(t =>
    Array.isArray(t.move) && authored.some(pair => pair.length === t.move.length && pair.every(i => t.move.includes(i))) &&
    (f.winning || []).length > 0 && ((Number.isFinite(t.cost) && t.cost >= 1 && t.cost <= 2) || (t.result === 'lose' && t.fair === true))
  ).map(t => ({ step:f.step, moves:f.moves, move:t.move, cost:t.cost ?? null, result:t.result, fair:t.fair ?? null })));
}

// A measurement of the stored route, not a claim about all player routes or bot losses.
function witnessTail(design) {
  const g = E.game(JSON.parse(JSON.stringify(design))); let s = E.start(g), maxTray = 0, removals = 0;
  for (let i=0; i<design.solution.length; i++) {
    let next = E.step(g,s,design.solution[i]);
    if (!next && i+1<design.solution.length) { next=E.step(g,s,{pair:[design.solution[i],design.solution[i+1]]}); if(next)i++; }
    if (!next) return {valid:false, why:'witness step failed'};
    s=next;
    if(s.clockTaken) { maxTray=Math.max(maxTray,s.tray.length); removals++; }
  }
  return {valid:E.won(g,s),maxTray,removals,scope:'stored witness only; trace gates judge actual pacing'};
}

function rulesOf(c, roles) {
  const ice = Object.keys(roles.ice).length, locks = roles.locks.size;
  if (!ice && !locks) return null;
  return {
    ice: Object.fromEntries(Object.entries(roles.ice).map(([k, v]) => [+k, v])),
    iceNb: c.inb,
    locks: roles.locks.size ? new Set(roles.locks) : null,
    keys: roles.locks.size ? roles.keys.slice() : [],
  };
}

function digPairs(c, roles, P, orphans, cap) {
  const pos = new Map(P.map((t, k) => [t, k])), ck = roles.clock, orph = new Set(orphans);
  const inKeys = roles.keys.filter(k => pos.has(k));
  if (inKeys.length === 1) return null;
  const keys = inKeys.length === 2 ? inKeys.sort((a, b) => pos.get(a) - pos.get(b)) : null;
  const pairOf = new Map(), open = [], occ = [], opens = []; let w = 0;
  const close = (t, o) => { pairOf.set(t, o); pairOf.set(o, t); open.splice(open.indexOf(o), 1); };
  for (const t of P) {
    let opened = false;
    if (orph.has(t)) { w++; opened = true; }
    else if (keys && t === keys[1]) close(t, keys[0]);
    else if (keys && t === keys[0]) { open.push(t); opened = true; }
    else {
      const cl = open.filter(o => !keys || o !== keys[0]);
      if (cl.length) close(t, cl.find(o => c.above[t].has(o)) ?? cl[cl.length - 1]);
      else { open.push(t); opened = true; }
    }
    if (w + open.length > cap) return null;
    occ.push(w + open.length); opens.push(opened);
  }
  const clockOpen = open.includes(ck);
  if (open.length > (clockOpen ? 1 : 0)) return null;
  return { pairOf, orphans: orphans.slice(), clockOpen, occ, opens, open: [...orphans, ...open] };
}

function planDigPictures(c, roles, P, N, cap, rng, variant, three, luck = 0) {
  const want = Math.max(0, cap - 1), pos = new Map(P.map((t, k) => [t, k]));
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const frees = []; { const al = new Uint8Array(c.n).fill(1);
    for (const t of P) { const before = []; for (let i = 0; i < c.n; i++) before.push(al[i] && L.isFree(i, al, c.nb)); al[t] = 0;
      let k = false; for (let i = 0; i < c.n && !k; i++) if (al[i] && !before[i] && !special.has(i) && L.isFree(i, al, c.nb)) k = true; frees.push(k); } }
  const luckSteps = d => d.opens.filter((o, k) => o && (k ? d.occ[k - 1] : 0) >= 2 && frees[k]).length;
  const nec = P.filter(t => N.has(t) && t !== roles.clock && !roles.keys.includes(t));
  const cands = nec.length >= want ? nec : nec.concat(P.filter(t => !N.has(t) && !roles.keys.includes(t) && !roles.locks.has(t)));
  for (let m = Math.min(want, cands.length); m >= 0; m--) {
    let combos = [];
    if (m === 0) combos = [[]];
    else if (m === 1) combos = cands.map(a => [a]);
    else for (let a = 0; a < cands.length; a++) for (let b = a + 1; b < cands.length; b++) combos.push([cands[a], cands[b]]);
    const ok = [];
    for (const o of combos) { const d = digPairs(c, roles, P, o, cap); if (d) ok.push(d); }
    if (!ok.length) continue;
    const at3 = d => d.occ.filter(w => w >= 3).length, early = d => d.orphans.reduce((s, t) => s + pos.get(t), 0);
    const cost = d => (three != null ? Math.abs(at3(d) - three) * 100 : 0) + Math.max(0, luck - luckSteps(d)) * 40 + early(d) + (variant ? rng() * 3 * variant : 0);
    ok.sort((a, b) => cost(a) - cost(b));
    return { ...ok[0], forcedShape: m === want && want > 0 && ok[0].orphans.every(t => N.has(t)) };
  }
  return null;
}

function planRest(c, roles, P, wanted, rng) {
  const alive = new Uint8Array(c.n).fill(1), all = alive.slice(), rules = rulesOf(c, roles), Q = [];
  for (const i of P) alive[i] = 0;
  const can = i => rules ? L.takeable(i, alive, c.nb, rules, all) : L.isFree(i, alive, c.nb);
  for (let left = c.n - P.length; left > 0; left--) {
    const ready = []; for (let i = 0; i < c.n; i++) if (alive[i] && can(i)) ready.push(i);
    if (!ready.length) return null;
    const keysLeft = roles.keys.filter(k => alive[k]), keysReady = keysLeft.every(k => can(k));
    const score = i => (wanted.has(i) ? 3 : 0) + ([...wanted].some(w => alive[w] && c.above[w].has(i)) ? 2 : 0) + rng()
      + (roles.keys.includes(i) ? (keysReady ? 10 : -10) : 0);
    ready.sort((a, b) => score(b) - score(a));
    const i = ready[0]; alive[i] = 0; Q.push(i);
  }
  return Q;
}

// Find visible tempting pair(s) with genuine early/mid-board consequence
// Prioritizes pairs that become takeable at dig steps 1..4 (B3 in [0.08, 0.60] and B4 <= 6)
function findTemptingPairs(c, roles, P, wanted, Q, brief, rng) {
  const inP = new Set(P);
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const nearDig = new Set();
  for (const t of P) { for (const j of c.nb.left[t]) nearDig.add(j); for (const j of c.nb.right[t]) nearDig.add(j); }
  for (const f of Object.keys(roles.ice).map(Number)) for (const j of c.inb[f]) nearDig.add(j);

  const al = new Uint8Array(c.n).fill(1);
  const stepFree = new Array(c.n).fill(Infinity);
  for (let i = 0; i < c.n; i++) if (c.free0[i] && !inP.has(i) && !special.has(i) && !wanted.has(i) && !nearDig.has(i)) stepFree[i] = 0;
  for (let s = 0; s < P.length; s++) {
    al[P[s]] = 0;
    for (let i = 0; i < c.n; i++) {
      if (al[i] && stepFree[i] === Infinity && !inP.has(i) && !special.has(i) && !wanted.has(i) && !nearDig.has(i) && L.isFree(i, al, c.nb)) {
        stepFree[i] = s + 1;
      }
    }
  }

  const qpos = new Map(Q.map((t, k) => [t, k]));
  const eligible = [...Array(c.n).keys()].filter(i => qpos.has(i) && Number.isFinite(stepFree[i]));

  const maxMidStep = Math.min(5, Math.max(1, Math.floor(P.length / 2)));
  const pairsDelayed = [];
  const pairsStart = [];

  for (let a = 0; a < eligible.length; a++) {
    for (let b = a + 1; b < eligible.length; b++) {
      const x = eligible[a], y = eligible[b];
      const takeAt = Math.max(stepFree[x], stepFree[y]);
      if (takeAt >= 1 && takeAt <= maxMidStep) {
        pairsDelayed.push([x, y, takeAt]);
      } else if (takeAt === 0) {
        pairsStart.push([x, y, 0]);
      }
    }
  }

  const nTraps = Math.max(1, brief.targets?.traps ?? 2);
  const pool = pairsDelayed.length >= nTraps ? pairsDelayed : pairsDelayed.concat(pairsStart);
  const ordered = shuffle(rng, pool);

  const traps = [];
  const used = new Set();
  for (const [x, y] of ordered) {
    if (traps.length >= nTraps) break;
    if (used.has(x) || used.has(y)) continue;
    used.add(x); used.add(y);
    traps.push([x, y]);
  }
  return traps;
}

function findTemptingPairCandidates(c, roles, P, wanted) {
  const inP = new Set(P);
  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const nearDig = new Set();
  for (const t of P) { for (const j of c.nb.left[t]) nearDig.add(j); for (const j of c.nb.right[t]) nearDig.add(j); }
  for (const f of Object.keys(roles.ice).map(Number)) for (const j of c.inb[f]) nearDig.add(j);
  return [...Array(c.n).keys()].filter(i => c.free0[i] && !inP.has(i) && !special.has(i) && !wanted.has(i) && !nearDig.has(i));
}

// Plan pictures with visible choice and calm tail
function placePicturesVC(c, roles, P, hold, brief, rng, N, variant = 0) {
  const cap = capOf(brief), spare = brief.frame?.spare ?? 1;
  const tailPairWidth = brief.targets?.tailPairWidth ?? 1;
  const inP = new Set(P), { cov, holders } = hold, ck = roles.clock;

  const after = new Uint8Array(c.n).fill(1); for (const i of P) after[i] = 0;
  const deep = t => {
    const a = after.slice(); let cost = 1; for (const x of c.above[t]) if (a[x]) { a[x] = 0; cost++; }
    return cost + (L.isFree(t, a, c.nb) ? 0 : 1) > spare;
  };
  const mayHold = t => holders ? holders.has(t) : !!cov[t] && !inP.has(t) && deep(t);
  const wanted = new Set(holders ? [...holders] : [...Array(c.n).keys()].filter(mayHold));
  if (holders && [...holders].some(h => roles.locks.has(h))) for (const k of roles.keys) if (!inP.has(k)) wanted.add(k);

  const dig = planDigPictures(c, roles, P, N || new Set([ck]), cap, rng, variant, brief.targets?.three, luckTargetOf(brief, cap));
  if (!dig) return { fail: 'digPictures' };

  let Q = planRest(c, roles, P, wanted, rng);
  if (!Q) return { fail: 'restOrder' };

  // Place visible tempting pair(s)
  const traps = findTemptingPairs(c, roles, P, wanted, Q, brief, rng);
  for (const [x, y] of traps) {
    Q = Q.filter(t => t !== y);
    Q.splice(Q.indexOf(x) + 1, 0, y);
  }
const W = P.concat(Q), pos = new Array(c.n);
  W.forEach((t, k) => pos[t] = k);
  const pairOf = new Array(c.n).fill(-1);
  for (const [a, b] of dig.pairOf) pairOf[a] = b;

  const fixed = new Map();
  for (const [x, y] of traps) { fixed.set(x, y); fixed.set(y, x); }
  const qKeys = roles.keys.length === 2 && roles.keys.every(k => !inP.has(k)) ? roles.keys : null;
  if (qKeys) { fixed.set(qKeys[0], qKeys[1]); fixed.set(qKeys[1], qKeys[0]); }

  const open = dig.open.slice(), fromDig = o => pos[o] < P.length;
  const closeWith = (t, o) => { pairOf[t] = o; pairOf[o] = t; open.splice(open.indexOf(o), 1); };

  // A planned sequence AABB (width 1), ABAB (2), or ABCABC (3).
  // Only the early/middle remainder is woven; the final third closes promptly.
  // Dig holders and fixed keys/temptations retain priority over this pattern.
  let closingBlock = false;
  const weaveEnd = P.length + Math.floor(Q.length * 2 / 3);
  let freeLeft = Q.filter(t => !fixed.has(t)).length;
  for (let k = P.length; k < W.length; k++) {
    const t = W[k];
    const f = fixed.get(t);
    if (f !== undefined) {
      if (open.includes(f)) closeWith(t, f);
      else {
        if (open.length >= 3) return { fail: 'trayOverflow' };
        open.push(t);
      }
      continue;
    }
    const closable = open.filter(o => !fixed.has(o) && (o === ck || !fromDig(o) || mayHold(t)));
    const openFree = open.filter(o => !fixed.has(o)).length;
    const mustClose = open.length >= 3 || openFree >= freeLeft;
    freeLeft--;
    const tailOpen = open.filter(o => !fixed.has(o) && !fromDig(o)).length;
    if (!tailOpen) closingBlock = false;
    if (tailOpen >= tailPairWidth) closingBlock = true;
    const close = closable.some(fromDig) || mustClose || closingBlock || k >= weaveEnd;
    if (close && closable.length) {
      const target = closable.filter(fromDig)[0] || closable[0];
      closeWith(t, target);
    } else {
      if (open.length >= 3) return { fail: 'trayOverflow' };
      open.push(t);
    }
  }
  if (open.length) return { fail: 'unpaired' };

  // Assign pictures to pairs
  const pairs = [], seen = new Set();
  for (const t of W) if (!seen.has(t)) { seen.add(t); seen.add(pairOf[t]); pairs.push([t, pairOf[t]]); }
  const doubles = Math.max(0, pairs.length - 36);
  const trapT = new Set(traps.flat());

  // Calm doubles separation: when n > 72, ensure duplicated picture faces are separated in time
  const late = pairs.map((p, k) => k).filter(k => Math.min(pos[pairs[k][0]], pos[pairs[k][1]]) > P.length + 4 && !trapT.has(pairs[k][0]));
  if (late.length < doubles * 2) return { fail: 'tooFewLatePairs' };

  late.sort((a, b) => Math.min(pos[pairs[a][0]], pos[pairs[a][1]]) - Math.min(pos[pairs[b][0]], pos[pairs[b][1]]));
  const lateList = [];
  const lateSet = new Set();
  for (let i = 0; i < doubles; i++) {
    const p1 = late[i];
    const maxP1 = Math.max(pos[pairs[p1][0]], pos[pairs[p1][1]]);
    const p2 = late.slice(doubles).find(k => !lateSet.has(k) && Math.min(pos[pairs[k][0]], pos[pairs[k][1]]) > maxP1);
    if (p2 !== undefined) {
      lateSet.add(p1); lateSet.add(p2);
      lateList.push(p1, p2);
    }
  }

  if (lateList.length < doubles * 2) {
    const rem = late.filter(k => !lateSet.has(k));
    while (lateList.length < doubles * 2 && rem.length) {
      const pick = rem.shift();
      lateSet.add(pick);
      lateList.push(pick);
    }
  }

  const order = shuffle(rng, [...Array(36).keys()]);
  const faces = new Array(c.n).fill(-1);
  let f = 0;
  pairs.forEach((p, k) => {
    if (!lateSet.has(k)) { faces[p[0]] = faces[p[1]] = order[f++]; }
  });
  for (let k = 0; k < lateList.length; k += 2) {
    const face = order[f++];
    for (const q of [lateList[k], lateList[k + 1]]) faces[pairs[q][0]] = faces[pairs[q][1]] = face;
  }

  const wovenPairs = pairs.filter(([a,b]) => pos[a] >= P.length && pos[b] >= P.length && Math.abs(pos[a]-pos[b]) > 1);
  // Keep the pictures and covers of the deliberate interleavings face-up. These
  // challenges must not be manufactured by adding hidden tiles to the weave.
  const weaveVisible = new Set();
  if (tailPairWidth > 1) for (const [a,b] of wovenPairs) for (const t of [a,b]) {
    weaveVisible.add(t); for (const cover of c.above[t]) weaveVisible.add(cover);
  }
  const maxWait = Math.max(0, ...dig.occ), atCap = dig.occ.filter(w => w >= cap).length;
  return { W, Q, faces, pairOf, pos, cap, maxWait, atCap, dig, traps, clockTwin: pairOf[ck], weaveVisible,
    tailPlan: {pairWidth:tailPairWidth, wovenPairs:wovenPairs.length, untilRemoval:weaveEnd, scope:'planned order; not a bot difficulty guarantee'} };
}

// Place face-down tiles with guaranteed readable intent
function placeDownVC(c, roles, P, plan, brief, rng) {
  const target = Math.round((brief.targets?.maxDown ?? 0.25) * c.n);
  // Dennis's rule: no blind digging on the clock way. At most 1 hidden route tile!
  const onWay = Math.min(1, brief.targets?.hiddenOnWay ?? 0);
  const onDig = Math.min(1, Math.max(onWay, brief.targets?.hiddenOnWay ?? 0));

  const special = new Set([roles.clock, ...roles.keys, ...roles.locks, ...Object.keys(roles.ice).map(Number)]);
  const avoid = new Set([...special, plan.clockTwin, ...plan.traps.flat(), ...(plan.weaveVisible || [])]);
  const inP = new Set(P);

  const alive = new Uint8Array(c.n).fill(1), luckSteps = [], atLuck = new Set();
  for (let k = 0; k < P.length; k++) {
    const before = []; for (let i = 0; i < c.n; i++) before.push(alive[i] && L.isFree(i, alive, c.nb));
    alive[P[k]] = 0;
    const newly = []; for (let i = 0; i < c.n; i++) if (alive[i] && !before[i] && L.isFree(i, alive, c.nb)) newly.push(i);
    const wBefore = k ? plan.dig.occ[k - 1] : 0;
    if (plan.dig.opens[k] && wBefore >= 2) {
      if (P[k] !== roles.clock) luckSteps.push({ k, newly });
      for (const i of newly) atLuck.add(i);
    }
  }

  const down = [];
  if (onDig > 0) {
    const steps = luckSteps.filter(s => s.newly.some(i => !avoid.has(i)));
    if (steps.length > 0) {
      const s = steps[0];
      const ok = shuffle(rng, s.newly.filter(i => !avoid.has(i) && inP.has(i)));
      if (ok.length > 0) down.push(ok[0]);
    }
  }
  const luckPicked = down.length;

  const rest = shuffle(rng, [...Array(c.n).keys()].filter(i => !c.free0[i] && !avoid.has(i) && !inP.has(i) && !atLuck.has(i) && !down.includes(i)));
  const finalDown = down.concat(rest.slice(0, Math.max(0, target - down.length)));

  return { down: finalDown, luckPlanned: luckPicked, luckSteps: luckSteps.length };
}

function designOf(c, faces, down, roles, clock, solution = []) {
  return {
    tiles: c.tiles.map(t => [t.x, t.y, t.z]),
    faces,
    down,
    gold: [],
    obst: {
      ice: Object.fromEntries(Object.entries(roles.ice).map(([k, v]) => [+k, v])),
      locks: [...roles.locks],
      keys: roles.locks.size ? roles.keys.slice() : [],
    },
    clock,
    solution,
  };
}

// Build one visible-choice puzzle
function build(briefIn, opts = {}) {
  if (opts.keep || opts.hardWork != null || opts.softWork != null) return {fail:'unsupportedOption',detail:'visibleChoice does not implement keep or aggregate hardWork/softWork budgets; individual searches have node limits',ms:0};
  const brief = { targets: {}, ...briefIn };
  if (brief.targets?.tailPairWidth != null && ![1,2,3].includes(brief.targets.tailPairWidth)) return {fail:'incompatibleBrief',detail:'tailPairWidth must be 1, 2 or 3',ms:0};
  brief.targets = {
    ...brief.targets,
    hiddenOnWay: Math.min(1, brief.targets.hiddenOnWay ?? 0),
    traps: Math.max(1, brief.targets.traps ?? 2),
  };
  const story = B.STORIES[brief.story];
  if (!story) return { fail: 'unknownStory', detail: brief.story, ms: 0 };
  if (story.spec.keys && brief.targets.keysShown != null && brief.targets.keysShown !== 2) return {fail:'incompatibleBrief',detail:'visibleChoice requires both keys shown at the start',ms:0};
  if (story.spec.keys) {
    brief.targets.keysShown = 2;
  }

  let tiles = brief.tiles, shape = brief.shape || null;
  if (!tiles) {
    const lays = B.LAYOUTS.filter(l => l.shape === brief.shape || l.base === brief.shape);
    const lay = brief.layout != null ? B.LAYOUTS[brief.layout] : lays[(brief.seed ?? 0) % Math.max(1, lays.length)];
    if (!lay) return { fail: 'unknownShape', detail: brief.shape, ms: 0 };
    tiles = lay.tiles; shape = lay.shape;
  }
  if (tiles.length < 72 || tiles.length > 96) return { fail: 'tileCount', detail: 'Visible choice builder requires 72 to 96 tiles.', ms: 0 };
  const c = B.context(tiles);
  if (c.n % 2) return { fail: 'oddTiles', ms: 0 };

  const spare = brief.frame?.spare ?? 1, cap = capOf(brief), fails = {};
  const t0 = Date.now(), wallMs = opts.wallMs ?? 60000;
  const timedOut = () => Date.now()-t0 >= wallMs;
  const wallFailure = () => ({fail:'wallClock',detail:'visibleChoice safety deadline reached; no alternate board returned',fails,ms:Date.now()-t0});

  for (let attempt = 0; attempt < (opts.tries ?? 20); attempt++) {
    if(timedOut()) return wallFailure();
    const rng = rngOf((brief.seed ?? 1) * 7919 + attempt * 104729);

    const roles = B.placeRoles(c, story, brief, rng);
    if (roles.fail) { fails[roles.fail] = (fails[roles.fail] || 0) + 1; continue; }

    const P = B.planDig(c, roles, rng);
    if (!P) { fails['dig'] = (fails['dig'] || 0) + 1; continue; }
    if (brief.frame?.way != null && Math.abs(P.length - brief.frame.way) > 2) {
      fails['wayLength'] = (fails['wayLength'] || 0) + 1; continue;
    }

    const hold = B.chooseHolders(c, roles, P, story.spec, rng);
    if (hold.fail) { fails[hold.fail] = (fails[hold.fail] || 0) + 1; continue; }

    const N = B.necessary(c, roles, P);
    const plan = placePicturesVC(c, roles, P, hold, brief, rng, N);
    if (!plan || plan.fail) { fails[plan?.fail || 'pictures'] = (fails[plan?.fail || 'pictures'] || 0) + 1; continue; }

    if (hold.holders && roles.holderSpecials) {
      const orph = new Set(plan.dig.orphans);
      const used = [...hold.holders].filter(h => orph.has(plan.pairOf[h]));
      for (const h of hold.holders) if (!used.includes(h)) {
        if (roles.holderSpecials.delete('lock ' + h)) roles.locks.delete(h);
        if (roles.holderSpecials.delete('ice ' + h)) delete roles.ice[h];
      }
    }

    const pd = placeDownVC(c, roles, P, plan, brief, rng);

    // Compute exact clock shortest k and shippable solution
    const gTmp = E.game(designOf(c, plan.faces, pd.down, roles, { i: roles.clock, n: 99 }));
    const cs = E.clockShortest(gTmp, { nodes: 300000, ms: Infinity, finishNodes: 100000, finishMs: Infinity });
    if(timedOut()) return wallFailure();
    if (!cs || !cs.k || cs.unsure) { fails['clockShortest'] = (fails['clockShortest'] || 0) + 1; continue; }
    const k = cs.k;
    const reqSpare = brief.frame?.spare ?? 1;
    const spare = Math.min(reqSpare, Math.max(1, 19 - k));
    const clock = { i: roles.clock, n: k + spare };

    let sol = plan.W;
    const clockAt = sol.indexOf(roles.clock);
    if (clockAt + 1 !== k) {
      const strict = exactRoute({ tiles: c.tiles, nb: c.nb, faces: plan.faces, rules: rulesOf(c, roles) }, roles.clock, 300000, Infinity);
      if (strict && strict.k === k) sol = strict.path;
      else if (cs.path) sol = E.flatten(cs.path);
    }
    const design = designOf(c, plan.faces, pd.down, roles, clock, sol);

    const rep = E.replay(design, design.solution);
    if (!rep || !rep.ok) { fails['witness'] = (fails['witness'] || 0) + 1; continue; }

    if (!readableOf(design)) {
      const prep = PS.prepare(design, null);
      if (prep && prep.design && readableOf(prep.design)) {
        design.down = prep.design.down;
      } else {
        fails['readable'] = (fails['readable'] || 0) + 1;
        continue;
      }
    }

    const sg = GP.applyStatic(SG.staticGates(design, { story: brief.story }), GP.loadProfile('e5-v1'));
    if(timedOut() || sg.warnings?.some(w=>/^wallClock/.test(w))) return wallFailure();
    if (!sg.pass) {
      fails['staticGates'] = (fails['staticGates'] || 0) + 1;
      continue;
    }

    const proofs = choiceProofs(sg,plan.traps), hasPricedOrFork = proofs.length > 0;
    if (!hasPricedOrFork) {
      fails['noPricedTrap'] = (fails['noPricedTrap'] || 0) + 1;
      continue;
    }

    const ms = Date.now() - t0;
    const card = {
      story: story.title,
      sentence: story.sentence,
      shape,
      tiles: c.n,
      clock: { tile: roles.clock, fewestMoves: sg.k, spare, n: design.clock.n },
      readable: true,
      cardText: sg.card || 'Visible choice clock puzzle.',
      traps: [...new Map(proofs.map(p=>[p.move.slice().sort((a,b)=>a-b).join(','),p.move])).values()],
      choiceProofs: proofs,
      tail: witnessTail(design),
      tailPlan: plan.tailPlan,
      attempt,
    };

    const intents = [
      { name: 'witness valid', proven: true },
      { name: 'honest clock: fewest moves ' + sg.k + ' + spare ' + spare, proven: true },
      { name: 'readable intent: clock, keys and locks in sight', proven: true },
      { name: 'consequential visible choice: priced detour or fair lose fork', proven: hasPricedOrFork }
    ];

    return {
      design,
      card,
      intents,
      roles,
      keep: {
        geometry: JSON.stringify(c.tiles),
        story: brief.story,
        roles: { clock: roles.clock, locks: [...roles.locks], keys: roles.keys.slice(), ice: { ...roles.ice } },
        P: P.slice(),
      },
      fails,
      work: null,
      workNote: 'Individual proof searches are node-bounded; aggregate node work is not measured in this mode.',
      ms,
    };
  }

  return { fail: 'noProvenVisibleChoice', fails, ms: Date.now() - t0 };
}

module.exports = { build, placePicturesVC, placeDownVC, findTemptingPairCandidates, choiceProofs, witnessTail };
