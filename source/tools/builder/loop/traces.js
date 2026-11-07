'use strict';
// Trace gates B1-B7 of the process design (source/analysis/builder/process-design-synthesis.md, section 4 B).
// The counterfactuals C1-C4 are in counterfactual.js.
//
//   const T = require('./traces.js');
//   T.traceGates(design, { spare, ys, forks, campaigns: 40 })
//     -> { B1..B7: { pass, value, ... }, pass, lossesAtTrapShare, firstErrorMedianShare, delayMedian,
//          lateSqueezeShare, postClockShare, repeatShare, biteShare, examples, ruler, D, counts, ms }
//
// What it does
//   1. Applies the spare (knobs.clockSpare: only clock.n changes; the witness is replayed).
//   2. Captures `campaigns` family campaigns with full per-tap decisions, on the CURVE block's seeds in
//      their meter order (sub-blocks of 20: 4711, 12630, 18427, 26346 - the first meter call {seed 4711,
//      seeds 2} is sub-blocks 4711 and 12630). 40 campaigns are therefore exactly the campaigns of the first
//      CURVE meter call, and the captured D equals that call's expectedTries.
//   3. Scores every try with Codex's Task 11 engine analyzer (task11_analyze.js; it is the code
//      task11_scoring.js runs, and it already contains the task11_delay.js correction: the delay counts
//      removals after the mistaken action). Nothing here re-implements that scoring.
//      An ERROR is Codex's firstError: in a try, the first committed move whose engine.classify result is
//      'lose' from a state the engine classifies 'win'. 'unknown' (engine budget) is never an error and
//      never a loss; a 'lose' move from an 'unknown' state is not counted either.
//   4. Matches errors and first-try moves against the designed forks (see normalizeForks).
//
// The ruler. Capture calls the bot module directly (the meter's compact() drops per-tap decisions). The
// default bot is the pinned family ruler family-key-memory-v1-fast (fingerprint 63be677e...). If a
// yardstick still pins the slow family-key-memory-v1 (5372bd4e...) or Codex's d362e85f..., the fast bot is
// used anyway: the meter lists those as zero-drift predecessors of 63be677e (FAMILY_CACHE_MIGRATIONS; Gemini
// Task G3: 0 drift on 60 boards / 635,635 moves). Any other bot is refused unless opts.botVersion is given
// explicitly, and then the result says ruler.pinned = false.
//
// CLI (prints JSON; one board, one spare):
//   node source/tools/builder/loop/traces.js <boards.jsonl|json> <index|id> <spare|asis> [campaigns=40]
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), K = require('../knobs.js'), M = require('../../factory/meter.js');
const A = require('../task11_analyze.js'), F = require('../task11_physics.js');

const FAST = 'family-key-memory-v1-fast', SLOW = 'family-key-memory-v1';
// Codex's frozen Task 11 classification budget (task11_plan.js `classification`). ms is wall-clock, so a heavily
// loaded PC can turn a few 'win'/'lose' into 'unknown'; unknowns are counted, never read as losses.
const BUDGET = Object.freeze({ nodes: 30000, ms: 60, cap: 12, depthNodes: 1500 });
// Thresholds of section 4 B. All are uncalibrated until experiment E5.
const THRESHOLDS = Object.freeze({
  B1: { min: 0.15 }, B2: { min: 0.5 }, B3: { min: 0.15, max: 0.60 }, B4: { max: 6 }, B5: { max: 0.10, leftShare: 0.25 },
  B6: { max: 0.40, secondActMin: 0.10, secondActFork: [0.40, 0.65] }, B7: { inflated: 0.5, maxTarget: 10, fromTry: 6 },
  coverage: 0.5, // B2-B4 are undecided (pass null) when fewer than half the lost tries have a proved first error
});
// CURVE seeds in meter order when no yardstick is at hand (library/yardstick.json: calls 4711 and 18427, seeds 2, stride 7919)
const CURVE_SUBBLOCKS = Object.freeze([4711, 12630, 18427, 26346]), SUBBLOCK_RUNS = 20, MAX_ATTEMPTS = 20;

const unwrap = d => d && d.design && d.design.tiles ? d.design : d;
const round = (x, k = 3) => x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 10 ** k) / 10 ** k;
const between = (v, lo, hi) => v == null ? null : v >= lo && v <= hi;

function atSpare(design, spare) {
  design = unwrap(design);
  if (spare == null) return { design };
  const r = K.clockSpare(design, spare);
  return r.fail ? { fail: r.fail } : { design: r.design, minimum: r.proof.minimum };
}

// ---------- the ruler ----------
const fps = new Map();
function fingerprintOf(botVersion) {
  const k = botVersion || 'reference';
  if (!fps.has(k)) fps.set(k, M.createMeter(botVersion && botVersion !== 'reference' ? { botVersion, cacheDir: false } : { cacheDir: false }).fingerprint);
  return fps.get(k);
}
function loadPins() { try { return require('./yardstick.js').loadPins(); } catch { return null; } }
// Which bot captures the traces, and whether it is the pinned family ruler.
function ruler(ys, botVersion) {
  const fast = fingerprintOf(FAST), zeroDrift = M.FAMILY_CACHE_MIGRATIONS[fast] || [];
  const pinFp = ys?.fingerprint ?? ys?.pins?.family?.fingerprint ?? loadPins()?.family?.fingerprint ?? null;
  if (botVersion) { // explicit choice (tests, parity checks): measured, but marked
    const fp = fingerprintOf(botVersion);
    return { botVersion, fingerprint: fp, pin: pinFp, pinned: fp === fast && (pinFp == null || pinFp === fast || zeroDrift.includes(pinFp)), explicit: true };
  }
  if (pinFp != null && pinFp !== fast && !zeroDrift.includes(pinFp))
    throw Error(`Trace ruler: the yardstick pins family fingerprint ${pinFp}, which is neither ${FAST} (${fast}) nor a zero-drift predecessor of it`);
  return { botVersion: FAST, fingerprint: fast, pin: pinFp, pinned: true,
    ...(pinFp && pinFp !== fast ? { zeroDriftOf: pinFp, note: `the yardstick pins ${pinFp.slice(0, 8)} (slow key memory); traces use its zero-drift fast path ${fast.slice(0, 8)} (meter FAMILY_CACHE_MIGRATIONS, Gemini Task G3)` } : {}) };
}
function botEntry(botVersion) {
  if (!botVersion || botVersion === 'reference') return require.resolve('../../sim/refit/human_bot.js');
  const entry = M.BOT_VERSIONS[botVersion]; if (!entry) throw Error('Unknown botVersion ' + botVersion); return entry;
}
// The CURVE block's sub-block seeds in meter order (each meter call {runs, seeds, seed} = seeds sub-blocks of runs).
function curveSubBlocks(ys) {
  const pins = ys?.pins || loadPins(), b = pins?.blocks?.CURVE, stride = pins?.subBlockStride ?? 7919;
  if (!b) return CURVE_SUBBLOCKS.map(seed => ({ seed, runs: SUBBLOCK_RUNS }));
  return b.calls.flatMap(c => Array.from({ length: c.seeds }, (_, s) => ({ seed: (c.seed + s * stride) | 0, runs: c.runs })));
}

// ---------- capture: one sub-block (the same call task11_capture_worker.js makes, with a chosen bot) ----------
function captureFamily(design, { runs = SUBBLOCK_RUNS, seed = 4711, botVersion = FAST } = {}) {
  const t = Date.now(), bot = require(botEntry(botVersion));
  const options = { runs, seeds: 1, seed, maxAttempts: MAX_ATTEMPTS, capture: true, setting: 'family' };
  const result = bot.measureHuman(M.boardOf(design), options);
  return { profile: 'family', botVersion, options, ms: Date.now() - t, result };
}

// ---------- forks: designed trap states and tempting moves ----------
// Accepts static_gates.js `forks` rows ({ step, moves, tempting: [{ move: [i] | [i, j], kind, cost, result, peek? }] })
// or engine.traps rows ({ step, moves, tempting: [{ move: i | {pair}, kind }] }). A tempting move counts as a designed
// trap when it loses (result 'lose', or an engine.traps row, which lists only losing moves) or is a priced detour
// (cost >= 1). Free moves (cost 0) are dropped. Rows are matched to witness states by `moves` (removals so far).
const tilesOf = m => m == null ? [] : typeof m === 'number' ? [m] : Array.isArray(m) ? m : m.pair || [];
function normalizeForks(forks) {
  const out = [];
  for (const f of forks || []) {
    const tempting = [];
    for (const t of f.tempting || []) {
      const designed = t.result === 'lose' || (t.cost != null && t.cost >= 1) || (t.result === undefined && t.cost === undefined);
      if (designed) tempting.push({ tiles: tilesOf(t.move), kind: t.kind ?? null, cost: t.cost ?? null, result: t.result ?? 'lose' });
    }
    if (tempting.length || f.lose) out.push({ step: f.step, moves: f.moves ?? null, tempting });
  }
  return out;
}
// The witness as engine actions (static_gates.actionsOf: singles, a peek pair where a single would lose).
function witnessStates(g) {
  try { return require('./static_gates.js').actionsOf(g, g.solution || []).states; } catch { return [E.start(g)]; }
}
// Default forks: losing tempting moves (engine kindOf: pair, match, twin, peek pair) at witness states up to the clock.
function defaultForks(g, budget = BUDGET) {
  const out = [];
  for (const s of witnessStates(g)) {
    if (s.clockTaken) break;
    const lose = E.classify(g, s, budget).filter(c => c.result === 'lose'), tempting = [];
    for (const c of lose) { const kind = E.kindOf(g, s, c.move); if (kind && kind !== 'clock') tempting.push({ move: c.move, kind, result: 'lose' }); }
    if (tempting.length) out.push({ step: out.length, moves: s.moves, tempting });
  }
  return out;
}
function forkIndex(g, forks) {
  const states = witnessStates(g), byMoves = new Map(states.map(s => [s.moves, s]));
  const keys = new Map(), tempting = []; let unmapped = 0;
  for (const f of forks) {
    for (const t of f.tempting) tempting.push({ step: f.step, moves: f.moves, ...t });
    const s = f.moves != null ? byMoves.get(f.moves) : states[f.step];
    if (s && !s.clockTaken) keys.set(F.stateKey(g, s), f.step); else unmapped++;
  }
  return { keys, tempting, unmapped };
}
// A bot move matches a tempting move when it takes one of its tiles (a pair temptation is taken as two singles).
function sameish(move, t) {
  const a = tilesOf(move), b = Array.isArray(t) ? t : t?.tiles ?? tilesOf(t);
  return a.length > 0 && a.some(i => b.includes(i));
}
const recordKey = r => r.alive.join('') + '/' + r.trayFaces.slice().sort((a, b) => a - b).join(',') + '/' + (r.preClock ? r.moves : '-');

// ---------- B1-B7 ----------
function traceGates(input, opts = {}) {
  const { spare = null, ys = null, campaigns = 40, secondAct = false, budget = BUDGET, maxExamples = 6 } = opts;
  const at = atSpare(input, spare); if (at.fail) return { spare, fail: at.fail };
  const design = at.design, n = design.tiles.length;
  const rule = opts.capture ? { botVersion: opts.botVersion ?? 'injected', fingerprint: null, pinned: null, injected: true } : ruler(ys, opts.botVersion);
  const capture = opts.capture || captureFamily;

  // capture and analyze sub-block by sub-block (full captures are large; only the analysis is kept)
  const a = A.analyzer({ design }, budget), tries = [], firstRows = [], subBlocks = [], counts0 = { unknownChosen: 0, engineMismatches: 0, recoveries: 0 };
  const errorKinds = {}, lossKinds = {}, wonOn = [], perCampaign = [], left = new Map();
  let captureMs = 0, analyzeMs = 0, valid = true;
  for (const blk of opts.subBlocks || curveSubBlocks(ys)) {
    if (wonOn.length >= campaigns) break;
    const runs = Math.min(blk.runs, campaigns - wonOn.length), t0 = Date.now();
    const raw = capture(design, { runs, seed: blk.seed, botVersion: rule.botVersion });
    captureMs += raw?.ms ?? Date.now() - t0;
    const results = raw?.result?.results;
    if (!Array.isArray(results) || results.some(c => c.attempts.some(x => !x.decisions || !x.terminal)))
      throw Error('capture must return { result: { results: [...] } } with full per-tap decisions (capture: true)');
    const off = wonOn.length, t1 = Date.now(), tr = a.trace({ profile: 'family', ...raw });
    analyzeMs += Date.now() - t1;
    valid = valid && raw.result.valid === true;
    subBlocks.push({ seed: blk.seed, runs: results.length, expectedTries: raw.result.expectedTries ?? null, valid: raw.result.valid ?? null });
    for (const [c, r] of results.entries()) {
      wonOn.push(r.wonOn); perCampaign.push(r.wonOn ?? MAX_ATTEMPTS);
      for (const x of r.attempts) left.set((off + c) + ':' + x.attempt, x.left);
    }
    for (const x of tr.profile.attemptProfiles) {
      const fe = x.firstError && (({ before, known, observed, prefixTaps, remainingTaps, sameAppearanceOppositeOutcomes, ...rest }) => rest)(x.firstError);
      tries.push({ ...x, campaign: x.campaign + off, firstError: fe });
    }
    for (const r of tr.moves) if (r.attempt === 1 && r.preClock && r.event !== 'peek')
      firstRows.push({ campaign: r.campaign + off, removalMove: r.removalMove, move: r.move, result: r.result, state: r.state });
    for (const k of Object.keys(counts0)) counts0[k] += tr.profile[k] || 0;
    for (const [k, v] of Object.entries(tr.profile.errorKinds)) errorKinds[k] = (errorKinds[k] || 0) + v;
    for (const [k, v] of Object.entries(tr.profile.lossKinds)) lossKinds[k] = (lossKinds[k] || 0) + v;
  }
  if (wonOn.length < campaigns) throw Error(`only ${wonOn.length} of ${campaigns} campaigns captured (not enough CURVE sub-blocks)`);
  // D as the meter computes it (estimateDifficulty): an unwon campaign counts as all the tries it was allowed
  const D = round(perCampaign.reduce((a, b) => a + b, 0) / perCampaign.length, 2);

  const forks = forkIndex(a.g, normalizeForks(opts.forks ?? defaultForks(a.g, budget)));
  const atFork = row => forks.keys.has(recordKey(a.records[row.state]));
  const temptingHit = row => forks.tempting.find(t => sameish(row.move, t)) || null;

  const losses = tries.filter(x => !x.win && !x.censored);
  const proved = losses.filter(x => x.firstError && !x.recovery), coverage = losses.length ? proved.length / losses.length : null;
  const covered = coverage != null && coverage >= THRESHOLDS.coverage;

  // B1: in a first try, before the clock, the bot commits a listed tempting move (its tiles), or a losing move at a fork state.
  const firstTries = tries.filter(x => x.attempt === 1 && !x.censored), bites = [];
  for (const x of firstTries) {
    const hit = firstRows.find(r => r.campaign === x.campaign && (temptingHit(r) || (r.result === 'lose' && atFork(r))));
    if (hit) bites.push({ campaign: x.campaign, removalMove: hit.removalMove, move: hit.move, result: hit.result, tempting: !!temptingHit(hit) });
  }
  const biteShare = firstTries.length ? bites.length / firstTries.length : null;

  // B2: the first irreversible error is at a fork state or on a listed tempting move (taken before the clock).
  const labelled = proved.map(x => {
    const e = x.firstError, fork = e.preClock && atFork(e), hit = e.preClock ? temptingHit(e) : null;
    return { x, e, fork, hit, trap: fork || !!hit };
  });
  const atTrap = labelled.filter(l => l.trap).length, lossesAtTrapShare = proved.length ? atTrap / proved.length : null;
  // B3, B4
  const firstErrorMedianShare = A.median(proved.map(x => x.firstError.removalMove / n));
  const delayMedian = A.median(proved.map(x => x.firstError.actualDelayToTerminal));
  // B5: tray losses with under 25% of the tiles left (the bot's own `left` at the end of the try).
  const leftOf = x => left.get(x.campaign + ':' + x.attempt) ?? (n - x.moves);
  const late = losses.filter(x => x.why === 'tray' && leftOf(x) < THRESHOLDS.B5.leftShare * n).length;
  const lateSqueezeShare = losses.length ? late / losses.length : null;
  // B6: losses after the clock was taken (the bot's loss phase 'mid' or 'late'; 'clock' = the clock was still on the board).
  const post = losses.filter(x => x.phase && x.phase !== 'clock'), postClockShare = losses.length ? post.length / losses.length : null;
  const postForkShare = A.median(post.filter(x => x.firstError && !x.recovery && !x.firstError.preClock).map(x => x.firstError.removalMove / n));
  // B7: losses in tries 6-20 whose first error repeats the same losing move from the same state earlier in that campaign.
  const lateTries = losses.filter(x => x.attempt >= THRESHOLDS.B7.fromTry);
  const repeats = lateTries.filter(x => x.firstError?.repeatedSameLosingMove).length, repeatShare = lateTries.length ? repeats / lateTries.length : null;
  const knownRepeats = lateTries.filter(x => x.firstError?.repeatedSameLosingMove && x.firstError.knownChoice).length;

  const B6pass = postClockShare == null ? null : secondAct
    ? postClockShare >= THRESHOLDS.B6.secondActMin && between(postForkShare, ...THRESHOLDS.B6.secondActFork) === true
    : postClockShare <= THRESHOLDS.B6.max;
  const inflated = repeatShare != null && repeatShare > THRESHOLDS.B7.inflated;
  const gates = {
    B1: { pass: biteShare == null ? null : biteShare >= THRESHOLDS.B1.min, value: round(biteShare), bites: bites.length, firstTries: firstTries.length },
    B2: { pass: covered ? lossesAtTrapShare >= THRESHOLDS.B2.min : null, value: round(lossesAtTrapShare), atTrap, atForkState: labelled.filter(l => l.fork).length,
      onTemptingMove: labelled.filter(l => l.hit).length, provedFirstErrors: proved.length, lostTries: losses.length, coverage: round(coverage) },
    B3: { pass: covered ? between(firstErrorMedianShare, THRESHOLDS.B3.min, THRESHOLDS.B3.max) : null, value: round(firstErrorMedianShare) },
    B4: { pass: covered && delayMedian != null ? delayMedian <= THRESHOLDS.B4.max : null, value: delayMedian },
    B5: { pass: lateSqueezeShare == null ? null : lateSqueezeShare <= THRESHOLDS.B5.max, value: round(lateSqueezeShare), lateTrayLosses: late },
    B6: { pass: B6pass, value: round(postClockShare), postClockLosses: post.length, secondAct, postClockErrorMedianShare: round(postForkShare) },
    // B7 is report-only: pass is always null; `inflated` limits the board to slots with T <= 10.
    B7: { pass: null, report: true, value: round(repeatShare), repeats, knownRepeats, lossesTries6to20: lateTries.length, inflated, maxTarget: inflated ? THRESHOLDS.B7.maxTarget : null },
  };
  const decided = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].map(k => gates[k].pass);
  const pass = decided.includes(false) ? false : decided.includes(null) ? null : true;

  // Examples: first-try losses first; trap and non-trap errors both shown.
  const ex = l => ({ campaign: l.x.campaign, attempt: l.x.attempt, errorAtRemoval: l.e.removalMove, errorShare: round(l.e.removalMove / n, 2), move: l.e.move, kind: l.e.kind,
    atForkState: !!l.fork, temptingMoves: l.hit ? l.hit.moves : null, delay: l.e.actualDelayToTerminal, lossWhy: l.x.why, phase: l.x.phase, left: leftOf(l.x),
    repeated: !!l.e.repeatedSameLosingMove, depth: l.e.depth,
    text: `Try ${l.x.attempt} of campaign ${l.x.campaign + 1}: the first losing move (${l.e.kind ?? 'move'}, tile ${JSON.stringify(l.e.move)}) was removal ${l.e.removalMove} of ${n}` +
      `${l.trap ? ', at a designed trap' : ', away from any designed trap'}; the loss (${l.x.why}) showed ${l.e.actualDelayToTerminal} removals later.` });
  const order = [...labelled].sort((p, q) => (p.x.attempt === 1 ? 0 : 1) - (q.x.attempt === 1 ? 0 : 1) || p.x.campaign - q.x.campaign || p.x.attempt - q.x.attempt);
  const half = Math.ceil(maxExamples / 2), trapEx = order.filter(l => l.trap).slice(0, half), otherEx = order.filter(l => !l.trap).slice(0, maxExamples - trapEx.length);
  const examples = trapEx.concat(otherEx).map(ex);

  return { spare, minimum: at.minimum ?? null, clockN: design.clock?.n ?? null, tiles: n, campaigns: wonOn.length, ruler: rule, subBlocks,
    D, wonOn, valid, ...gates, pass, calibrated: false,
    biteShare: round(biteShare), lossesAtTrapShare: round(lossesAtTrapShare), firstErrorMedianShare: round(firstErrorMedianShare), delayMedian,
    lateSqueezeShare: round(lateSqueezeShare), postClockShare: round(postClockShare), repeatShare: round(repeatShare),
    counts: { attempts: tries.length, losses: losses.length, provedFirstErrors: proved.length, ...counts0,
      engineStates: a.records.length, forkStates: forks.keys.size, temptingMoves: forks.tempting.length, forkStatesUnmapped: forks.unmapped, forksSource: opts.forks ? 'given' : 'engine.classify on the witness' },
    errorKinds, lossKinds, examples, ms: { capture: captureMs, analyze: analyzeMs }, thresholds: THRESHOLDS, budget };
}

module.exports = { traceGates, captureFamily, curveSubBlocks, ruler, defaultForks, normalizeForks, forkIndex, witnessStates, sameish, atSpare,
  THRESHOLDS, BUDGET, FAST, SLOW, CURVE_SUBBLOCKS };

if (require.main === module) {
  const [file, which, spareArg, campArg] = process.argv.slice(2);
  const text = fs.readFileSync(path.resolve(file), 'utf8').trim();
  const rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').map(l => JSON.parse(l));
  const row = /^\d+$/.test(which) ? rows[+which] : rows.find(r => r.id === which);
  const spare = spareArg === 'asis' ? null : +spareArg, campaigns = +(campArg || 40);
  const t = Date.now(), mem0 = process.memoryUsage().rss, g = traceGates(row, { spare, campaigns }), wall = Date.now() - t;
  console.log(JSON.stringify({ id: row.id, level: row.level, spare, wallMs: wall, rssMB: Math.round(process.memoryUsage().rss / 1e6), rssStartMB: Math.round(mem0 / 1e6),
    ...g, wonOn: undefined, thresholds: undefined, budget: undefined }, null, 1));
}
