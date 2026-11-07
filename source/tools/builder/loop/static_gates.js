/* static_gates.js: the engine-only puzzle gates A2-A8 of the process design (section 4, table A of
   analysis/builder/process-design-synthesis.md). Claude, 2026-11-07. No bots, no file writes.

     const { staticGates } = require('./static_gates.js');
     staticGates(design, { perms: 4, budgetMs: 9000, spare: 1, window: [0.15, 0.6], seed: 1 })
       -> { pass, gates: { A2..A8: { pass, detail, warn? } }, forks, card, k, strictK, ms, warnings }

   The puzzle is judged frozen, apart from its clock budget: every check that depends on the deadline uses
   clock.n = k + spare, where k = engine.clockShortest (game rules, peek pairs included) and `spare` is the
   tightest shippable spare (default 1). A check passed at spare 1 holds at looser spares for A4 (a state with one
   winning move at spare 3 has the same single winning move at spare 1, since the witness wins at both).
   Lose-forks (A6) use the loosest shippable deadline, min(k + 3, 19): a move counts as losing only when it
   loses at every spare that could ship.

   A2 readable: placement_score.readable, and both key overlays in sight at move 0 or within 3 witness moves
      (keys already taken count as seen). Boards without a lock pass the key half.
   A3 release-legal clock: the stored witness passes the strict rules (Hard.validSolution, no peek pair), takes
      the clock at move k (its clock index + 1 = engine.clockShortest k), the strict shortest (lab/exact.js via
      engine strict mode) equals k (no peek-pair shortcut), and k + 1 <= 19 (some spare 1..3 fits).
   A4 no hidden single order: engine.classify at the opening finds >= 2 winning actions; at every witness state
      up to the clock with exactly one winning action (no 'unknown' among the others) that action is obvious
      (obvious.js: clock, a blocker within 3 of the clock, a visible key or lock, a tray match).
   A5 priced temptation: at witness states in the first 15-60% of the way to the clock (move index m with
      ceil(0.15 K) <= m <= floor(0.6 K), K = the witness's clock move), some visible tempting move (free face-up
      pair or tray match off engine toClock; detour.js) costs 1-2 clock moves (clock need after it - before it).
   A6 fair lose-forks: every tempting move up to the clock that loses at every shippable spare must be fair
      (detour.fairFork: loses and a goal-directed alternative wins under K re-deals of the unseen face-down
      pictures; the loss shows within 6 removals; at least 60% of the tiles left). An unfair one fails the board;
      an 'unknown' one is a warning only.
   A7 luck bounded: design_traps.roomProfile ok with unrelieved = 0 (tightBlind is reported), and winnable from
      the start under K re-deals of all face-down pictures (the identity included) at the loosest shippable
      deadline min(k + 3, 19); results at spare 1 are reported ('unknown' = warning, not a pass).
   A8 opening clock: k <= 6 -> flag 'spare>=2 only' (pass is always true; it limits which spares may ship).
   'unknown' from the engine is never read as a loss. A check that runs out of budget is reported as a warning
   and does not pass. */
'use strict';
const E = require('../engine.js');
const L = global.Layouts;
const Hard = require('../../../www/hard.js');
const O = require('./obvious.js');
const D = require('./detour.js');
let placementReadable = null, roomProfile = null;
const readableOf = d => { placementReadable ||= require('../../factory/placement_score.js').readable; try { return placementReadable(d); } catch (e) { return false; } };
const roomOf = d => { roomProfile ||= require('../../factory/design_traps.js').roomProfile; try { return roomProfile(d); } catch (e) { return { ok: false, error: String(e.message || e) }; } };

const N_MAX = 19, SHIP = [1, 2, 3];
const moveText = a => typeof a === 'object' && a ? `peek pair ${a.pair[0]}+${a.pair[1]}` : String(a);

// the witness as engine actions on game g (singles; a pair where a single would lose and the pair is legal)
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

function staticGates(design, o = {}) {
  const t0 = Date.now(), budgetMs = o.budgetMs ?? 9000, until = t0 + budgetMs, perms = o.perms ?? 4, seed = o.seed ?? 1;
  const spare = o.spare ?? 1, [wLo, wHi] = o.window || [0.15, 0.6], per = { nodes: o.nodes ?? 40000, ms: o.moveMs ?? 200 };
  const gates = {}, warnings = [], forks = [], n = design.tiles.length;
  const left = () => until - Date.now();
  const timed = (frac, cap) => Math.max(50, Math.min(cap, left() * frac));
  if (!design.clock) {
    const no = { pass: false, detail: 'no clock' };
    return { pass: false, gates: { A2: no, A3: no, A4: no, A5: no, A6: no, A7: no, A8: { pass: true, detail: 'no clock', flag: null } }, forks, card: 'No clock: not a clock puzzle.', ms: Date.now() - t0, warnings };
  }

  // ---------- A3: release-legal clock (k is needed by everything else) ----------
  const gP = E.game(design), cs = E.clockShortest(gP, { nodes: 400000, ms: timed(0.3, 4000) });
  const k = cs ? cs.k : null;
  const csS = E.clockShortest(E.game(design, { strict: true }), { nodes: 300000, ms: timed(0.15, 2000) });
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
    if (k != null && !shippable.length) why.push(`k ${k} leaves no spare 1-3 within clock.n <= ${N_MAX}`);
    gates.A3 = { pass: !why.length, detail: { k, strictK, witnessClockMove: clockAt + 1, strictWitness: strictOk, designSpare: k != null ? design.clock.n - k : null, shippable, why } };
  }
  if (k == null) {
    const no = { pass: false, detail: 'no clock minimum (clockShortest unresolved)' };
    for (const a of ['A2', 'A4', 'A5', 'A6', 'A7']) gates[a] = no;
    gates.A8 = { pass: true, flag: null, detail: 'k unknown' };
    return { pass: false, gates, forks, card: 'The clock minimum could not be proven.', k, strictK, ms: Date.now() - t0, warnings };
  }
  // ---------- A8: opening clock ----------
  gates.A8 = { pass: true, flag: k <= 6 ? 'spare>=2 only' : null, detail: { k } };

  // the evaluation games: clock.n = k + spare (tightest shippable) and the loosest shippable n
  const C = D.clockGames(design), nEval = k + spare, nShipMax = shippable.length ? k + Math.max(...shippable) : k + 3, gE = C.at(nEval);
  let W = actionsOf(gE, sol), witnessSource = 'solution';
  if (!W.ok && cs.path) { W = actionsOf(gE, E.flatten(cs.path)); witnessSource = 'clockShortest'; }
  if (!W.ok) warnings.push('no witness replays at clock.n = k + ' + spare);
  const ci = W.acts.findIndex(a => takesClock(gE, a));            // the action that takes the clock
  const K = ci >= 0 ? W.states[ci].moves + (typeof W.acts[ci] === 'object' ? 2 : 1) : null;   // the witness's clock move

  // ---------- A2: readable ----------
  {
    const readable = readableOf(design), keys = O.keysInSight(gP, W.states[0]);
    let keysAt = null;
    if (!keys.keys.length) keysAt = 0;
    else for (let m = 0; m <= 3 && m < W.states.length; m++) if (O.keysInSight(gP, W.states[m]).shown === keys.keys.length) { keysAt = W.states[m].moves; break; }
    const keysOk = keysAt != null && keysAt <= 3;
    gates.A2 = { pass: readable && keysOk, detail: { readable, keys: keys.keys, keysShownAtStart: keys.shown, bothKeysSeenAtMove: keysAt } };
  }

  // ---------- A4: no hidden single order (classify along the witness up to the clock) ----------
  const cls = [];
  {
    const singles = [], why = [];
    let open = null, budgetHit = false;
    for (let m = 0; m <= Math.max(0, ci); m++) {
      if (left() < budgetMs * 0.45) { budgetHit = true; break; }
      const s = W.states[m], c = E.classify(gE, s, per);
      const wins = c.filter(x => x.result === 'win'), unk = c.filter(x => x.result === 'unknown').length;
      cls[m] = c;
      if (m === 0) open = { wins: wins.length, unknown: unk, legal: c.length };
      if (wins.length === 1 && unk === 0) {
        const ob = O.isObvious(gE, s, wins[0].move);
        singles.push({ step: m, move: wins[0].move, obvious: ob.obvious, reasons: ob.reasons });
        if (!ob.obvious) why.push(`move ${s.moves + 1}: the only winning move ${moveText(wins[0].move)} is not obvious`);
      }
    }
    if (!open) why.push('opening not classified (budget)');
    else if (open.wins < 2) why.push(`opening has ${open.wins} winning action${open.wins === 1 ? '' : 's'}` + (open.unknown ? ` (${open.unknown} unknown)` : ''));
    if (budgetHit) warnings.push('A4: budget ran out before the clock');
    gates.A4 = { pass: !why.length && !budgetHit, detail: { opening: open, singleWinStates: singles.length, notObvious: singles.filter(x => !x.obvious), why }, ...(budgetHit ? { warn: 'budget' } : {}) };
  }

  // ---------- A5 / A6: tempting moves along the way to the clock ----------
  const lo = K != null ? Math.ceil(wLo * K) : 0, hi = K != null ? Math.floor(wHi * K) : -1;
  const priced = [], loseForks = [];
  {
    const seen = new Set(), forkMemo = new Map();
    let budgetHit = false;
    const baseExact = clockAt + 1 === k && witnessSource === 'solution';
    for (let m = 0; m <= Math.max(0, ci); m++) {
      const s = W.states[m];
      for (let i = 0; i < n; i++) if (s.alive[i] && L.isFree(i, s.alive, gP.nb)) seen.add(i);
      if (m === ci && s.clockTaken) break;
      const temp = D.temptingMoves(gE, s, { singles: o.singles });
      if (!temp.length) continue;
      if (left() < budgetMs * 0.15) { budgetHit = true; break; }
      const base = baseExact ? k : D.clockNeed(C, s, { upTo: nShipMax, ...per, until }).k;
      const row = { step: m, moves: s.moves, inWindow: s.moves >= lo && s.moves <= hi, tempting: [], winning: (cls[m] || []).filter(x => x.result === 'win').map(x => x.move) };
      for (const t of temp) {
        if (Date.now() > until) { budgetHit = true; row.tempting.push({ move: t.take, kind: t.kind, cost: null, result: 'unknown', budget: true }); continue; }
        const p = D.priceMove(C, s, t, { base, nShipMax, ...per, until });
        const e = { move: t.take, kind: t.kind, ...(t.peek ? { peek: true } : {}), cost: p.cost, result: p.result, ...(p.instant ? { instant: true } : {}) };
        row.tempting.push(e);
        if (row.inWindow && (t.kind === 'pair' || t.kind === 'match') && p.cost != null && p.cost >= 1 && p.cost <= 2 && p.exact) priced.push({ ...e, step: m, moves: s.moves });
        if (p.result === 'lose') {
          const unseen = [...gP.down.keys()].filter(i => gP.down[i] && s.alive[i] && !seen.has(i));
          const f = D.fairFork(C, s, t, { unseen, perms, seed, nShipMax, ...per, until, memo: forkMemo });
          e.fair = f.fair; if (f.why.length) e.why = f.why; if (f.unknown) e.fairUnknown = true; e.forkChecks = f.checks;
          loseForks.push({ ...e, step: m, moves: s.moves });
        }
      }
      if (!row.winning.length && cls[m] === undefined) delete row.winning;
      forks.push(row);
    }
    if (budgetHit) warnings.push('A5/A6: budget ran out on the way to the clock');
    gates.A5 = { pass: priced.length > 0, detail: { window: [lo, hi], wayMoves: K, priced: priced.length, best: priced.slice().sort((a, b) => a.cost - b.cost || a.moves - b.moves)[0] || null,
      temptingSeen: forks.reduce((a, r) => a + r.tempting.length, 0) }, ...(budgetHit && !priced.length ? { warn: 'budget' } : {}) };
    const unfair = loseForks.filter(f => f.why && f.why.length), unk = loseForks.filter(f => f.fairUnknown);
    if (unk.length) warnings.push(`A6: ${unk.length} lose-fork${unk.length > 1 ? 's' : ''} unresolved ('unknown')`);
    const luckForks = loseForks.filter(f => f.forkChecks && f.forkChecks.dealsLostAnyway);
    if (luckForks.length) warnings.push(`A6: at ${luckForks.length} lose-fork${luckForks.length > 1 ? 's' : ''} some re-deal of the unseen pictures loses the board whatever the player does (luck)`);
    gates.A6 = { pass: !unfair.length && !budgetHit, detail: { loseForks: loseForks.length, fair: loseForks.filter(f => f.fair).length, unfair: unfair.map(f => ({ move: f.move, kind: f.kind, atMove: f.moves + 1, why: f.why })), unknown: unk.length },
      ...(unk.length ? { warn: 'unknown' } : {}), ...(budgetHit ? { warn: 'budget' } : {}) };
  }

  // ---------- A7: luck bounded ----------
  {
    // each re-deal must be winnable from the start at the loosest shippable deadline (luck that no spare can fix);
    // spare 1 is reported too (how often a re-deal would also need more than the tightest clock)
    const room = roomOf(design), dealt = D.redeals(design, [...(design.down || [])], perms, seed + 101), res = [], res1 = [];
    const win = (d, nn) => {
      if (Date.now() > until + 1500) return 'unknown';
      const g = d === design ? C.at(nn) : E.game({ ...d, clock: { ...d.clock, n: nn } });
      return E.winnable(g, E.start(g), { nodes: 300000, ms: Math.max(300, Math.min(1500, until + 1500 - Date.now())) }).result;
    };
    for (const d of dealt) { res.push(win(d, nShipMax)); res1.push(nEval === nShipMax ? res[res.length - 1] : win(d, nEval)); }
    const roomOk = !!room.ok && room.unrelieved === 0, allWin = res.every(r => r === 'win');
    if (res.includes('unknown')) warnings.push('A7: a re-deal could not be proven winnable (unknown)');
    gates.A7 = { pass: roomOk && allWin, detail: { roomOk: !!room.ok, unrelieved: room.unrelieved ?? null, tightBlind: room.tightBlind ?? null, perms: dealt.length, faceDown: (design.down || []).length,
      results: res, resultsSpare1: res1 }, ...(res.includes('unknown') ? { warn: 'unknown' } : {}) };
  }

  const pass = ['A2', 'A3', 'A4', 'A5', 'A6', 'A7'].every(a => gates[a].pass);
  return { pass, gates, forks, card: cardOf({ k, spare, priced, loseForks, K, A8: gates.A8.flag }), k, strictK, nEval, nShipMax, witnessSource, ms: Date.now() - t0, warnings };
}

const kindWord = e => e.kind === 'match' ? 'the tray match' : e.kind === 'pair' ? (e.peek ? 'the peek pair' : 'the free pair') : 'the single';
function cardOf({ k, priced, loseForks, A8 }) {
  const best = priced.slice().sort((a, b) => a.cost - b.cost || a.moves - b.moves)[0];
  const fair = loseForks.filter(f => f.fair).sort((a, b) => a.moves - b.moves)[0];
  const tail = A8 ? ' (a fast opening clock: ship with spare 2 or more)' : '';
  if (best) {
    const extra = fair && fair.moves !== best.moves ? `, and ${kindWord(fair)} at move ${fair.moves + 1} loses outright` : '';
    return `Take ${kindWord(best)} in sight at move ${best.moves + 1} before the clock and you spend ${best.cost} of the clock's spare move${best.cost > 1 ? 's' : ''} (the clock needs ${k})${extra}${tail}.`;
  }
  if (fair) return `Take ${kindWord(fair)} in sight at move ${fair.moves + 1} before the clock and the board is lost; the clock needs ${k} moves${tail}.`;
  return `No priced temptation on the way: the clock needs ${k} moves and nothing in sight tempts you off the way${tail}.`;
}

module.exports = { staticGates, actionsOf, strictValid, cardOf };

/* ---------- yield measurement (single process, engine only) ----------
   node source/tools/builder/loop/static_gates.js [--builds 100] [--qualified] [--out file.json] [--budget 9000]
   Builds readable builder-v3 boards from briefs-v1.json (stories other than frozenGuards and chainReaction;
   hiddenOnWay capped at 1 so the builder's readable intent is in force), seeds 1, 2, 3, ... until --builds boards
   are built, and/or reads the 18 qualified 200-225 boards; runs staticGates on each; prints the pass rate per
   gate and writes every result (without the designs' forks detail beyond the first 3 rows) to --out. */
if (require.main === module) {
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
  const nBuilds = +arg('builds', process.argv.includes('--qualified') ? 0 : 100), out = arg('out', null), budgetMs = +arg('budget', 9000);
  const rows = [], hash = d => crypto.createHash('sha1').update(JSON.stringify([d.tiles, d.faces, d.down, d.obst, d.clock.i])).digest('hex').slice(0, 12);
  const run = (set, id, design, meta) => {
    const r = staticGates(design, { budgetMs });
    rows.push({ set, id, ...meta, tiles: design.tiles.length, hash: hash(design), pass: r.pass, ms: r.ms, k: r.k, strictK: r.strictK, A8: r.gates.A8.flag,
      gates: Object.fromEntries(Object.entries(r.gates).map(([g, v]) => [g, { pass: v.pass, ...(v.warn ? { warn: v.warn } : {}), detail: v.detail }])),
      card: r.card, warnings: r.warnings, forks: r.forks.slice(0, 3) });
    const x = rows[rows.length - 1];
    console.log(`${set} ${id} ${x.ms}ms ${x.pass ? 'PASS' : 'fail'} ` + Object.entries(x.gates).map(([g, v]) => g + (v.pass ? '+' : '-')).join(' ') + (x.A8 ? ' [' + x.A8 + ']' : ''));
  };
  if (nBuilds > 0) {
    const B = require('../builder.js'), briefs = require('../briefs-v1.json').filter(b => b.story !== 'frozenGuards' && b.story !== 'chainReaction');
    let built = 0, failed = 0, seen = new Set(), dup = 0;
    for (let seed = 1; built < nBuilds && seed <= 20; seed++) for (const b0 of briefs) {
      if (built >= nBuilds) break;
      const brief = { ...b0, seed, targets: { ...(b0.targets || {}), hiddenOnWay: Math.min(1, b0.targets?.hiddenOnWay ?? 0) } };
      const t = Date.now(), r = B.build(brief), buildMs = Date.now() - t;
      if (r.fail) { failed++; continue; }
      const h = hash(r.design); if (seen.has(h)) { dup++; continue; } seen.add(h);
      built++;
      run('builds', `${b0.id}-s${seed}`, r.design, { story: b0.story, buildMs, briefSpare: brief.frame?.spare ?? 1, readableCard: r.card.readable });
    }
    console.log(`builds: ${built} built, ${failed} failed, ${dup} duplicates skipped`);
    rows.buildStats = { built, failed, dup };
  }
  if (process.argv.includes('--qualified')) {
    const file = path.join(__dirname, '..', '..', '..', 'analysis', 'builder', 'data', 'qualified-200-225.jsonl');
    for (const q of fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l))) run('qualified', `${q.level}-${q.id}`, q.design, { level: q.level });
  }
  const sum = {};
  for (const set of [...new Set(rows.map(r => r.set))]) {
    const rs = rows.filter(r => r.set === set), ms = rs.map(r => r.ms).sort((a, b) => a - b), q = p => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
    sum[set] = { boards: rs.length, pass: rs.filter(r => r.pass).length, A8flag: rs.filter(r => r.A8).length, ms: { median: q(0.5), p90: q(0.9), max: ms[ms.length - 1] },
      gates: Object.fromEntries(['A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map(g => [g, rs.filter(r => r.gates[g].pass).length])),
      warnings: rs.filter(r => r.warnings.length).length };
    console.log(set, JSON.stringify(sum[set]));
  }
  if (out) fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), budgetMs, buildStats: rows.buildStats || null, summary: sum, rows }, null, 1));
}
