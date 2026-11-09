/* static_gates.js: the engine-only puzzle gates A1-A9 of the process design (section 4, table A of
   analysis/builder/process-design-synthesis.md). Claude, 2026-11-07. No bots, no file writes (except the CLI's --out).

     const { staticGates } = require('./static_gates.js');
     staticGates(design, { perms: 4, budget: 2.5e6, story, shape, previous, seed: 1, wallMs: 60000, stopEarly: false })
       -> { pass, gates: { A1..A9: { pass, detail, warn? } }, forks: [{ step, moves, tempting: [{ move, kind, cost, result }],
            winning: [moves] }], card, archetype, k, strictK, shipSpares, ms, nodes, warnings }

   Determinism. Budgets are engine search nodes (`budget`, default 2.5e6, split A4 35% / A5-A6 40% / A7 25%), not
   milliseconds, so a board gets the same verdicts on a busy PC. `wallMs` is a hang guard only: when it is hit the
   result carries warning 'wallClock' (and is then load-dependent). The design is deep-copied first, so engine
   proof caches never leak between calls. gate.js (A1) keeps its own ms-bounded budgets (not editable here).

   The puzzle is frozen apart from its clock budget (knobs.clockSpare): clock.n = k + s, k = engine.clockShortest
   (game rules, peek pairs included), s in the shippable spares {1, 2, 3} with k + s <= 19.

   A1 honest build: gate.js checkDesign (witness replays, honest clock: won at n = k and lost at k - 1, no free
      face-down tile at the start, no idle special, pictures 2 or 4 times, >= 72 tiles, keys one pair) without its
      brief-target checks, and the story (opts.story) is not frozenGuards / chainReaction. An unresolved special
      ablation ('idleUnresolved') is a warning.
   A2 readable: placement_score.readable, and both key overlays in sight at move 0 or within 3 witness moves
      (keys already taken count as seen). Boards without a lock pass the key half.
   A3 release-legal clock: the stored witness passes the strict rules (Hard.validSolution, no peek pair), takes
      the clock at move k (its clock index + 1 = engine.clockShortest k), the strict fewest (exact.js) equals k
      (no peek-pair shortcut), and some spare 1..3 fits k + s <= 19.
   A4 no hidden single order: engine.classify at the opening finds >= 2 winning actions; at every witness state
      up to the clock with exactly one winning action (and no 'unknown' among the others) that action is obvious
      (obvious.js: the clock, a blocker within 3 of the clock, a visible key or lock, a tray match). Checked per
      shippable spare: a state with one winning move at a loose spare has that same single move at every tighter
      spare, so the tightest spare is classified fully and only its offending states are re-checked looser.
      detail.okSpares lists the spares at which A4 holds; pass = at least one. Unknowns are warnings.
   A5 priced temptation: at witness states in the first 15-60% of the way to the clock (move m with
      ceil(0.15 k) <= m <= floor(0.6 k)), some visible tempting move (a free face-up pair or a face-up tray match off
      engine toClock; detour.js) costs exactly 1-2 clock moves (clock need after it - clock need before it).
   A6 fair lose-forks: every tempting move up to the clock that loses at every shippable spare must be fair
      (publicfork.js: loses, with a goal-directed alternative winning, under K re-deals of the face-down pictures not
      yet seen; the loss shows within 6 removals; >= 60% of tiles left). Unfair fails the board; 'unknown' and
      budget are warnings, never a loss.
   A7 luck bounded: design_traps.roomProfile ok, unrelieved = 0 and tightBlind <= 1, and no re-deal of all
      face-down pictures (K, the identity included) is proven lost from the start at the loosest shippable deadline.
      'unknown' is a warning.
   A8 opening clock: k <= 6 -> flag 'spare>=2 only' (always passes; it removes spare 1 from shipSpares).
   A9 original and shaped: originality.compare against the live boards (default levels 70-199 from
      www/levels-hard.js; opts.previous overrides) finds no same layout, same puzzle or > 75% shared layout; the shape
      (opts.shape, else the builder layout with the same layoutKey) is not a blob or block; > 88 tiles -> flag
      'lv%10==0 only'.
   shipSpares = the shippable spares that satisfy A4 and A8. pass = A1-A7 and A9 all pass and shipSpares is not empty.
   'unknown' from the engine is never read as a loss. */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('../engine.js');
const L = global.Layouts;
const Hard = require('../../../www/hard.js');
const O = require('./obvious.js');
const D = require('./detour.js');
const P = require('./publicfork.js');

const N_MAX = 19, SHIP = [1, 2, 3], BANNED_STORIES = new Set(['frozenGuards', 'chainReaction']);
const DEFAULT_BUDGET = 2.5e6, PER_MOVE = 40000, PER_NEED = 60000, PER_FORK = 60000, PER_DEAL = 300000;
const ROOT = path.join(__dirname, '..', '..', '..');
let readableFn = null, roomFn = null, Orig = null, Gate = null, liveCache = null, layoutShapes = null;
const readableOf = d => { readableFn ||= require('../../factory/placement_score.js').readable; try { return readableFn(d); } catch (e) { return false; } };
const roomOf = d => { roomFn ||= require('../../factory/design_traps.js').roomProfile; try { return roomFn(d); } catch (e) { return { ok: false, error: String(e.message || e) }; } };

const moveText = a => typeof a === 'object' && a ? `peek pair ${a.pair[0]}+${a.pair[1]}` : String(a);
const clone = d => JSON.parse(JSON.stringify(d));

// the witness as engine actions on game g (singles; a pair where a single would fail and the pair is legal)
function actionsOf(g, flat) {
  const acts = [], states = [E.start(g)];
  const tryStep = (s, a) => { try { return E.step(g, s, a); } catch (e) { return null; } };
  for (let p = 0; p < flat.length; p++) {
    const s = states[states.length - 1];
    let x = tryStep(s, flat[p]), a = flat[p];
    if (!x && p + 1 < flat.length) { a = { pair: [flat[p], flat[p + 1]] }; x = tryStep(s, a); if (x) p++; }
    if (!x) return { ok: false, acts, states, at: p };
    acts.push(a); states.push(x);
  }
  return { ok: E.won(g, states[states.length - 1]), acts, states };
}
const takesClock = (g, a) => g.clock && (typeof a === 'object' ? a.pair.includes(g.clock.i) : a === g.clock.i);

function strictValid(d) {
  try {
    const tiles = d.tiles.map(t => ({ x: t[0], y: t[1], z: t[2] })), nb = L.neighbors(tiles), ob = d.obst || {}, keys = ob.keys || [];
    const rules = (Object.keys(ob.ice || {}).length || keys.length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: keys.length ? new Set(ob.locks || []) : null, keys } : null;
    return !!Hard.validSolution({ tiles, nb, faces: d.faces, rules, clock: d.clock }, d.solution);
  } catch (e) { return false; }
}

// the live boards the originality rule compares against (read-only: www/levels-hard.js through Hard.get)
function liveBoards(from = 70, to = 199) {
  if (liveCache && liveCache.from === from && liveCache.to === to) return liveCache.rows;
  Orig ||= require('../../factory/originality.js');
  const rows = Orig.previousBoards([{ level: to + 1 }], path.join(ROOT, 'www', 'levels-hard.js')).filter(r => r.level >= from && r.level <= to && r.design && r.design.tiles);
  liveCache = { from, to, rows };
  return rows;
}
function shapeOf(design, o) {
  if (o.shape) return o.shape;
  Orig ||= require('../../factory/originality.js');
  if (!layoutShapes) {
    layoutShapes = new Map();
    for (const l of JSON.parse(fs.readFileSync(path.join(ROOT, 'analysis', 'builder', 'data', 'layouts.json'), 'utf8'))) layoutShapes.set(Orig.layoutKey({ tiles: l.tiles }), l.shape);
  }
  return layoutShapes.get(Orig.layoutKey(design)) || null;
}

// ---------- A1 (gate.js), A2 (readable half), A9 ----------
function gateA1(design, k, o) {
  Gate ||= require('../gate.js');
  const story = o.story ?? null, why = [], warn = [];
  if (story && BANNED_STORIES.has(story)) why.push(`story ${story} is not allowed (frozen keys / chain reaction blind spots)`);
  if (design.tiles.length < 72) why.push(`${design.tiles.length} tiles (< 72)`);
  let check;
  try { check = Gate.checkDesign(design, { story: story || '', frame: { spare: k != null ? design.clock.n - k : 1 }, targets: {} }); }
  catch (e) { check = { problems: [{ kind: 'checkCrash', detail: String(e.message || e) }] }; }
  for (const p of check.problems) {
    if (p.kind === 'target') continue;                       // brief targets: not part of an honest build
    if (p.kind === 'idleUnresolved') { warn.push('special ablation unresolved: ' + p.detail); continue; }
    why.push(`${p.kind}: ${p.detail}`);
  }
  return { pass: !why.length, detail: { story, tiles: design.tiles.length, clock: check.clock || null, idle: check.idle ?? null, strictWitness: check.strict ?? null, why },
    ...(warn.length ? { warn: 'unknown', warnings: warn } : {}) };
}
function gateA9(design, o) {
  Orig ||= require('../../factory/originality.js');
  const shape = shapeOf(design, o), base = shape ? shape.split(' · ')[0] : null, why = [];
  if (base && /^blob|^block/.test(base)) why.push(`shape ${shape} is a blob/block shape`);
  const previous = o.previous || liveBoards();
  const clashes = [];
  for (const p of previous) {
    if (o.level != null && p.level === o.level) continue;
    const c = Orig.compare({ design }, p, o.maxLayoutShare ?? 0.75);
    if (c) clashes.push({ level: p.level, why: c });
  }
  if (clashes.length) why.push(`originality: ${clashes.length} live board${clashes.length > 1 ? 's' : ''} clash (${clashes.slice(0, 3).map(c => c.level + ' ' + c.why).join(', ')})`);
  const big = design.tiles.length > 88;
  return { pass: !why.length, flag: big ? 'lv%10==0 only' : null, detail: { shape, tiles: design.tiles.length, compared: previous.length, clashes: clashes.slice(0, 10), why } };
}

function staticGates(designIn, o = {}) {
  const t0 = Date.now(), design = clone(designIn), perms = o.perms ?? 4, seed = o.seed ?? 1, wallMs = o.wallMs ?? 60000;
  const total = typeof o.budget === 'number' ? o.budget : o.budget?.nodes ?? DEFAULT_BUDGET;
  const W = { A4: D.work(total * 0.35, wallMs), A56: D.work(total * 0.4, wallMs), A7: D.work(total * 0.25, wallMs) };
  const [wLo, wHi] = o.window || [0.15, 0.6];
  const gates = {}, warnings = [], forks = [], n = design.tiles.length;
  const done = extra => {
    const order = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
    for (const a of order) if (!gates[a]) gates[a] = { pass: null, detail: 'not run' };
    if (Object.values(W).some(w => w.wallHit)) warnings.push('wallClock: the hang guard was hit; verdicts may depend on PC load');
    const pass = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A9'].every(a => gates[a].pass === true) && !!(extra.shipSpares && extra.shipSpares.length);
    const ordered = Object.fromEntries(order.map(a => [a, gates[a]]));
    return { pass, gates: ordered, forks, card: extra.card ?? null, archetype: extra.archetype ?? null, k: extra.k ?? null, strictK: extra.strictK ?? null,
      shipSpares: extra.shipSpares ?? [], ms: Date.now() - t0, nodes: Math.round(Object.values(W).reduce((a, w) => a + w.used, 0)), warnings };
  };
  const stop = a => o.stopEarly && gates[a] && gates[a].pass === false;
  if (!design.clock || !Number.isInteger(design.clock.i)) {
    gates.A3 = { pass: false, detail: 'no clock' };
    return done({ card: 'No clock: not a clock puzzle.' });
  }

  // ---------- k (needed by everything) ----------
  const gP = E.game(design), cs = E.clockShortest(gP, { nodes: 400000, ms: D.SAFE_MS, finishNodes: 300000, finishMs: D.SAFE_MS });
  const k = cs ? cs.k : null;

  // ---------- A1, A2 (readable half), A9: the cheap ones first ----------
  gates.A1 = gateA1(design, k, o); if (stop('A1')) return done({ k });
  const readable = readableOf(design);
  // The real game/public observer displays one obstacle overlay per tile.
  // Ice hides a lock/key, and a lock hides a key; exposed geometry alone is
  // insufficient to claim that all intended special roles are readable.
  const ob=design.obst||{}, roleConflicts=[];
  for(let i=0;i<design.tiles.length;i++) {
    const roles=[...(ob.ice?.[i]>0?['ice']:[]),...((ob.locks||[]).includes(i)?['lock']:[]),...((ob.keys||[]).includes(i)?['key']:[])];
    if(roles.length>1)roleConflicts.push({tile:i,roles});
  }
  if (o.stopEarly && (!readable || roleConflicts.length)) { gates.A2 = { pass: false, detail: { readable, roleConflicts } }; return done({ k }); }
  gates.A9 = gateA9(design, o); if (stop('A9')) return done({ k });

  // ---------- A3: release-legal clock ----------
  const csS = E.clockShortest(E.game(design, { strict: true }), { nodes: 300000, ms: D.SAFE_MS });
  const strictK = csS ? csS.k : null;
  const sol = design.solution || [], clockAt = sol.indexOf(design.clock.i), strictOk = strictValid(design);
  const rep = E.replay(design, sol);
  const shippable = k == null ? [] : SHIP.filter(s => k + s <= N_MAX);
  {
    const why = [];
    if (k == null) why.push('engine.clockShortest unresolved within budget');
    if (cs && cs.unsure) why.push('clockShortest unsure (a finishing proof ran out of budget)');
    if (!rep.ok) why.push(`witness does not replay (${rep.why} at ${rep.at})`);
    if (!strictOk) why.push('witness fails the strict rules (Hard.validSolution)');
    if (k != null && clockAt + 1 !== k) why.push(`witness takes the clock at move ${clockAt + 1}, fewest is ${k}`);
    if (k != null && strictK != null && strictK !== k) why.push(`peek-pair shortcut: strict fewest ${strictK} vs game ${k}`);
    if (k != null && strictK == null) why.push('strict fewest unresolved within budget');
    if (k != null) { const dsp = design.clock.n - k; if (!SHIP.includes(dsp) || design.clock.n > N_MAX) why.push(`clock.n spare ${dsp} not in 1-3 or clock.n ${design.clock.n} > ${N_MAX}`); }
    if (k != null && !shippable.length) why.push(`k ${k} leaves no spare 1-3 within clock.n <= ${N_MAX}`);
    gates.A3 = { pass: !why.length, detail: { k, strictK, witnessClockMove: clockAt + 1, strictWitness: strictOk, designSpare: k != null ? design.clock.n - k : null, shippable, why } };
  }
  if (k == null) {
    const no = { pass: false, detail: 'no clock minimum (clockShortest unresolved)' };
    for (const a of ['A2', 'A4', 'A5', 'A6', 'A7']) gates[a] = no;
    gates.A8 = { pass: true, flag: null, detail: 'k unknown' };
    return done({ card: 'The clock minimum could not be proven.', k, strictK });
  }
  if (stop('A3')) return done({ k, strictK });

  // ---------- A8: opening clock ----------
  gates.A8 = { pass: true, flag: k <= 6 ? 'spare>=2 only' : null, detail: { k } };

  // the evaluation games: clock.n = k + s for each shippable s; the loosest shippable n for lose-forks and luck
  // (no shippable spare: A3 has failed; the other gates are still judged at spares 1-3 so their yields stay comparable)
  const evalSpares = shippable.length ? shippable : SHIP;
  const C = D.clockGames(design), sMin = evalSpares[0], nShipMax = k + evalSpares[evalSpares.length - 1], gE = C.at(k + sMin);
  let Wt = actionsOf(gE, sol), witnessSource = 'solution';
  if (!Wt.ok && cs.path) { Wt = actionsOf(gE, E.flatten(cs.path)); witnessSource = 'clockShortest'; }
  if (!Wt.ok) warnings.push(`no witness replays at clock.n = k + ${sMin}`);
  const ci = Wt.acts.findIndex(a => takesClock(gE, a));            // the action that takes the clock
  const K = ci >= 0 ? Wt.states[ci].moves + (typeof Wt.acts[ci] === 'object' ? Wt.acts[ci].pair.indexOf(gE.clock.i) + 1 : 1) : null;              // the witness's clock move (its action's start + 1)

  // ---------- A2: readable + keys in sight ----------
  {
    const keys = O.keysInSight(gP, Wt.states[0]);
    let keysAt = null;
    if (!keys.keys.length) keysAt = 0;
    else for (let m = 0; m < Wt.states.length && Wt.states[m].moves <= 3; m++) if (O.keysInSight(gP, Wt.states[m]).shown === keys.keys.length) { keysAt = Wt.states[m].moves; break; }
    gates.A2 = { pass: readable && keysAt != null && !roleConflicts.length, detail: { readable, roleConflicts, keys: keys.keys, keysShownAtStart: keys.shown, bothKeysSeenAtMove: keysAt } };
  }
  if (stop('A2')) return done({ k, strictK });

  // ---------- A4: no hidden single order (classify along the witness up to the clock), per shippable spare ----------
  const cls = [];
  {
    const w = W.A4, singles = [], skipped = [];
    let open = null;
    const last = Math.max(0, ci);
    const noClock = ci < 0;
    for (let m = 0; m <= last && m < Wt.states.length; m++) {
      const s = Wt.states[m], c = w.classify(gE, s, PER_MOVE);
      const wins = c.filter(x => x.result === 'win'), unk = c.filter(x => x.result === 'unknown').length;
      cls[m] = c;
      if (m === 0) open = { wins: wins.length, unknown: unk, legal: c.length };
      if (wins.length === 1 && unk === 0) {
        const ob = O.isObvious(gE, s, wins[0].move);
        singles.push({ step: m, moves: s.moves, move: wins[0].move, obvious: ob.obvious, reasons: ob.reasons });
      } else if (wins.length <= 1 && unk > 0) skipped.push(m);
    }
    // per spare: the tightest fully, looser ones only where the tighter one failed
    const perSpare = {};
    let bad = singles.filter(x => !x.obvious), openWins = open ? open.wins : 0, openUnk = open ? open.unknown : 0;
    for (const sp of evalSpares) {
      if (sp !== sMin) {
        const g = C.at(k + sp);
        bad = bad.filter(x => { const c = w.classify(g, Wt.states[x.step], PER_MOVE); const nw = c.filter(y => y.result === 'win').length; return nw === 1 || c.some(y => y.result === 'unknown'); });
      }
      if (sp !== sMin) { const c = w.classify(C.at(k + sp), Wt.states[0], PER_MOVE); openWins = c.filter(x => x.result === 'win').length; openUnk = c.filter(x => x.result === 'unknown').length; }
      const openOk = openWins >= 2;
      perSpare[sp] = { ok: openOk && !bad.length, openingWins: openWins, openingUnknown: openUnk, notObvious: bad.map(x => ({ atMove: x.moves + 1, move: x.move })) };
    }
    if (noClock) { skipped.push(-1); }
    const okSpares = noClock ? [] : evalSpares.filter(sp => perSpare[sp].ok && shippable.includes(sp)), loosest = evalSpares[evalSpares.length - 1];
    const why = [];
    if (!shippable.length) why.push('no shippable spare (A3)');
    if (noClock) why.push('no clock action in the witness');
    if (!evalSpares.some(sp => perSpare[sp].ok)) {
      const p = perSpare[loosest];
      if (p.openingWins < 2) why.push(`opening has ${p.openingWins} winning action${p.openingWins === 1 ? '' : 's'} even at spare ${loosest}`);
      for (const x of p.notObvious) why.push(`move ${x.atMove}: the only winning move ${moveText(x.move)} is not obvious at every spare`);
    }
    const unsure = skipped.length || openUnk || (open && open.wins < 2 && open.unknown) || w.hit;
    if (w.hit) warnings.push('A4: node budget ran out before the clock');
    gates.A4 = { pass: okSpares.length > 0, detail: { opening: open, singleWinStates: singles.length, obviousSingles: singles.filter(x => x.obvious).length, statesWithUnknown: skipped.length, okSpares, perSpare, why },
      ...(unsure ? { warn: w.hit ? 'budget' : 'unknown' } : {}) };
  }
  if (stop('A4')) return done({ k, strictK });

  // ---------- A5 / A6: tempting moves along the way to the clock ----------
  const lo = Math.ceil(wLo * k), hi = Math.floor(wHi * k);
  const priced = [], loseForks = [];
  {
    const w = W.A56, seen = new Set(), forkMemo = new Map();
    const optimal = K === k;
    for (let m = 0; m <= Math.max(0, ci) && m < Wt.states.length; m++) {
      const s = Wt.states[m];
      for (let i = 0; i < n; i++) if (s.alive[i] && L.isFree(i, s.alive, gP.nb)) seen.add(i);
      if (s.clockTaken) break;
      const temp = D.temptingMoves(gE, s, { singles: o.singles });
      if (!temp.length) continue;
      const base = optimal ? k : D.clockNeed(C, s, { upTo: nShipMax, nodes: PER_NEED, w }).k;
      const row = { step: m, moves: s.moves, inWindow: s.moves >= lo && s.moves <= hi, tempting: [], winning: (cls[m] || []).filter(x => x.result === 'win').map(x => x.move) };
      for (const t of temp) {
        const p = D.priceMove(C, s, t, { base, nShipMax, nodes: PER_NEED, w });
        const e = { move: t.take, kind: t.kind, ...(t.peek ? { peek: true } : {}), cost: p.cost, result: p.result, ...(p.instant ? { instant: true } : {}) };
        row.tempting.push(e);
        if (row.inWindow && !t.peek && (t.kind === 'pair' || t.kind === 'match') && p.cost != null && p.cost >= 1 && p.cost <= 2 && p.exact) priced.push({ ...e, step: m, moves: s.moves });
        if (p.result === 'lose') {
          const unseen = [];
          for (let i = 0; i < n; i++) if (gP.down[i] && s.alive[i] && !seen.has(i)) unseen.push(i);
          const f = P.fairFork(C, s, t, { unseen, perms, seed, nShipMax, w, nodes: PER_FORK, memo: forkMemo });
          e.fair = f.fair; if (f.why.length) e.why = f.why; if (f.unknown) e.fairUnknown = true; e.forkChecks = f.checks;
          loseForks.push({ ...e, step: m, moves: s.moves });
        }
      }
      forks.push(row);
    }
    if (w.hit) warnings.push('A5/A6: node budget ran out on the way to the clock');
    const best = priced.slice().sort((a, b) => a.cost - b.cost || a.moves - b.moves)[0] || null;
    gates.A5 = { pass: priced.length > 0, detail: { window: [lo, hi], wayMoves: k, priced: priced.length, best, temptingSeen: forks.reduce((a, r) => a + r.tempting.length, 0) },
      ...(w.hit && !priced.length ? { warn: 'budget' } : {}) };
    const unfair = loseForks.filter(f => f.why && f.why.length), unk = loseForks.filter(f => f.fairUnknown);
    if (unk.length) warnings.push(`A6: ${unk.length} lose-fork${unk.length > 1 ? 's' : ''} unresolved ('unknown')`);
    const luckForks = loseForks.filter(f => f.forkChecks && f.forkChecks.dealsLostAnyway);
    if (luckForks.length) warnings.push(`A6: at ${luckForks.length} lose-fork${luckForks.length > 1 ? 's' : ''} some re-deal of the unseen pictures loses the board whatever the player does (luck)`);
    gates.A6 = { pass: !unfair.length, detail: { loseForks: loseForks.length, fair: loseForks.filter(f => f.fair).length, unfair: unfair.map(f => ({ move: f.move, kind: f.kind, atMove: f.moves + 1, why: f.why })), unknown: unk.length },
      ...(unk.length || w.hit ? { warn: w.hit ? 'budget' : 'unknown' } : {}) };
  }

  // ---------- A7: luck bounded ----------
  {
    const room = roomOf(design), res = P.luckFromStart(design, nShipMax, { perms, seed: seed + 100, w: W.A7, nodes: PER_DEAL });
    const T7 = { unrelieved: 0, tightBlind: 1, lostDeals: 0, ...(o.thresholds?.A7 || {}) };   // E5 hook; defaults = the process design
    const roomOk = !!room.ok && room.unrelieved <= T7.unrelieved && (room.tightBlind ?? 0) <= T7.tightBlind, lost = res.filter(r => r === 'lose').length, unk = res.filter(r => r === 'unknown').length;
    if (unk) warnings.push(`A7: ${unk} re-deal${unk > 1 ? 's' : ''} could not be proven winnable (unknown)`);
    const why = [];
    if (!room.ok) why.push('roomProfile: no path found' + (room.error ? ' (' + room.error + ')' : ''));
    if (room.unrelieved > T7.unrelieved) why.push(`${room.unrelieved} unrelieved luck moment${room.unrelieved > 1 ? 's' : ''}`);
    if ((room.tightBlind ?? 0) > T7.tightBlind) why.push(`tightBlind ${room.tightBlind} (> ${T7.tightBlind})`);
    if (lost) why.push(`${lost} of ${res.length} re-deals of the face-down pictures are lost from the start at clock.n ${nShipMax}`);
    gates.A7 = { pass: roomOk && lost <= T7.lostDeals, detail: { roomPass: roomOk, dealsPass: lost <= T7.lostDeals, roomOk: !!room.ok, unrelieved: room.unrelieved ?? null, tightBlind: room.tightBlind ?? null, faceDown: (design.down || []).length, perms: res.length, results: res, why },
      ...(unk ? { warn: 'unknown' } : {}) };
  }

  const shipSpares = gates.A4.detail.okSpares.filter(sp => !(gates.A8.flag && sp < 2));
  const archetype = archetypeOf(design, gE, priced, loseForks, o.story);
  return done({ k, strictK, shipSpares, archetype, card: cardOf({ k, priced, loseForks, A8: gates.A8.flag, archetype }), witnessSource });
}

/* Archetype label (process design section 4, "Card"): what the way to the clock is about, from what the board holds.
   'keys before the clock' - a lock on the clock or its way (the keys are on engine toClock);
   'thaw order'            - ice on the clock or on a tile on its way;
   'free-pair relief'      - neither, and the priced temptation (A5) is a free pair or tray match;
   'clock race'            - none of these. 'second act' (a post-clock fork) is not judged here (trace gate B6). */
function archetypeOf(design, g, priced, loseForks, story) {
  const ob = design.obst || {}, ice = ob.ice || {}, ck = design.clock.i;
  const way = i => i === ck || g.toClock[i] === 1;
  if ((ob.locks || []).some(way) && (ob.keys || []).length) return 'keys before the clock';
  if (Object.keys(ice).some(i => ice[i] > 0 && way(+i))) return 'thaw order';
  if (priced.length) return 'free-pair relief';
  return 'clock race';
}
const kindWord = e => e.kind === 'match' ? 'the tray match' : e.kind === 'pair' ? (e.peek ? 'the peek pair' : 'the free pair') : 'the single';
function cardOf({ k, priced, loseForks, A8 }) {
  const best = priced.slice().sort((a, b) => a.cost - b.cost || a.moves - b.moves)[0];
  const fair = loseForks.filter(f => f.fair).sort((a, b) => a.moves - b.moves)[0];
  const tail = A8 ? ' (a fast opening clock: ship with spare 2 or more)' : '';
  if (best) {
    const extra = fair && fair.moves !== best.moves ? `, and ${kindWord(fair)} at move ${fair.moves + 1} loses the board` : '';
    return `The clock needs ${k} moves; taking ${kindWord(best)} in sight at move ${best.moves + 1} before the clock costs ${best.cost} spare move${best.cost > 1 ? 's' : ''}${extra}${tail}.`;
  }
  if (fair) return `The clock needs ${k} moves; taking ${kindWord(fair)} in sight at move ${fair.moves + 1} before the clock loses the board${tail}.`;
  return `The clock needs ${k} moves and nothing in sight tempts you off the way${tail}.`;
}

module.exports = { staticGates, actionsOf, strictValid, cardOf, archetypeOf, liveBoards, gateA1, gateA9 };

/* ---------- yield measurement (single process, engine only) ----------
   node source/tools/builder/loop/static_gates.js [--builds 100] [--qualified] [--out file.json] [--budget 2.5e6]
   Builds readable builder-v3 boards from briefs-v1.json (stories other than frozenGuards and chainReaction;
   hiddenOnWay capped at 1 so the builder's readable intent stays in force), seeds 1, 2, 3, ... until --builds
   distinct boards are built, and/or reads the 18 qualified 200-225 boards; runs staticGates on each (all gates,
   no early stop); prints the pass rate per gate and writes every result (forks trimmed to 3 rows) to --out. */
if (require.main === module) {
  const crypto = require('crypto');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
  const nBuilds = +arg('builds', process.argv.includes('--qualified') ? 0 : 100), out = arg('out', null), budget = +arg('budget', DEFAULT_BUDGET);
  const rows = [], hash = d => crypto.createHash('sha1').update(JSON.stringify([d.tiles, d.faces, d.down, d.obst, d.clock.i])).digest('hex').slice(0, 12);
  const G = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'];
  const run = (set, id, design, meta, opts) => {
    let r;
    try { r = staticGates(design, { budget, ...opts }); } catch (e) { console.log(`${set} ${id} CRASH ${e.stack}`); rows.push({ set, id, ...meta, crash: String(e.message) }); return; }
    rows.push({ set, id, ...meta, tiles: design.tiles.length, hash: hash(design), pass: r.pass, ms: r.ms, nodes: r.nodes, k: r.k, strictK: r.strictK, shipSpares: r.shipSpares, A8: r.gates.A8.flag, A9flag: r.gates.A9.flag || null,
      gates: Object.fromEntries(Object.entries(r.gates).map(([g, v]) => [g, { pass: v.pass, ...(v.warn ? { warn: v.warn } : {}), detail: v.detail }])),
      card: r.card, archetype: r.archetype, warnings: r.warnings, forks: r.forks.slice(0, 3) });
    const x = rows[rows.length - 1];
    console.log(`${set} ${id} ${x.ms}ms ${x.pass ? 'PASS' : 'fail'} ` + G.map(g => g + (x.gates[g].pass ? '+' : x.gates[g].pass === false ? '-' : '?') + (x.gates[g].warn ? '~' : '')).join(' ') + ` spares[${x.shipSpares}]`);
  };
  let buildStats = null;
  if (nBuilds > 0) {
    const B = require('../builder.js'), briefs = require('../briefs-v1.json').filter(b => !BANNED_STORIES.has(b.story));
    let built = 0, failed = 0, dup = 0; const seen = new Set(), buildMs = [];
    for (let seed = 1; built < nBuilds && seed <= 20; seed++) for (const b0 of briefs) {
      if (built >= nBuilds) break;
      const brief = { ...b0, seed, targets: { ...(b0.targets || {}), hiddenOnWay: Math.min(1, b0.targets?.hiddenOnWay ?? 0) } };
      const t = Date.now(), r = B.build(brief), ms = Date.now() - t;
      if (r.fail) { failed++; continue; }
      const h = hash(r.design); if (seen.has(h)) { dup++; continue; } seen.add(h);
      built++; buildMs.push(ms);
      const shape = b0.layout != null ? B.LAYOUTS[b0.layout].shape : b0.shape;
      run('builds', `${b0.id}-s${seed}`, r.design, { story: b0.story, seed, buildMs: ms, briefSpare: brief.frame?.spare ?? 1, intentsUnproven: r.intents.filter(i => !i.proven).map(i => i.name) }, { story: b0.story, shape });
    }
    buildStats = { built, failed, dup, buildMsMedian: buildMs.sort((a, b) => a - b)[buildMs.length >> 1] };
    console.log('builds: ' + JSON.stringify(buildStats));
  }
  if (process.argv.includes('--qualified')) {
    const file = path.join(ROOT, 'analysis', 'builder', 'data', 'qualified-200-225.jsonl');
    for (const q of fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l)))
      run('qualified', `${q.level}-${q.id}`, q.design, { level: q.level, shape: q.shape }, { shape: q.shape, level: q.level, previous: liveBoards(70, 199) });
  }
  const sum = {};
  for (const set of [...new Set(rows.map(r => r.set))]) {
    const rs = rows.filter(r => r.set === set && !r.crash), ms = rs.map(r => r.ms).sort((a, b) => a - b), q = p => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
    sum[set] = { boards: rs.length, crashes: rows.filter(r => r.set === set && r.crash).length, pass: rs.filter(r => r.pass).length, ms: { median: q(0.5), p90: q(0.9), max: ms[ms.length - 1], total: ms.reduce((a, b) => a + b, 0) },
      gates: Object.fromEntries(G.map(g => [g, rs.filter(r => r.gates[g].pass === true).length])),
      gateWarnings: Object.fromEntries(G.map(g => [g, rs.filter(r => r.gates[g].warn).length])),
      A8flag: rs.filter(r => r.A8).length, A9bigFlag: rs.filter(r => r.A9flag).length,
      allButOne: Object.fromEntries(G.filter(g => g !== 'A8').map(g => [g, rs.filter(r => !r.pass && G.filter(h => h !== 'A8' && r.gates[h].pass !== true).length === 1 && r.gates[g].pass !== true).length])),
      shipSpares: Object.fromEntries([1, 2, 3].map(s => [s, rs.filter(r => r.pass && r.shipSpares.includes(s)).length])),
      archetypes: rs.filter(r => r.pass).reduce((a, r) => (a[r.archetype] = (a[r.archetype] || 0) + 1, a), {}),
      withWarnings: rs.filter(r => r.warnings.length).length };
    console.log(set, JSON.stringify(sum[set]));
  }
  if (out) fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), budget, buildStats, summary: sum, rows }, null, 1));
}
