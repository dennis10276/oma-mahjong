'use strict';
// Trace gates B1-B7 and counterfactuals C1-C3 of the process design
// (source/analysis/builder/process-design-synthesis.md, section 4 B and C).
//
// traceGates(design, opts)      captures family campaigns on one frozen design at one spare and scores
//                               every lost try with Codex's Task 11 engine analyzer (task11_analyze.js,
//                               the code task11_scoring.js runs). Nothing here re-implements that scoring:
//                               "first error" is exactly Codex's firstError (the first committed move the
//                               engine classifies 'lose' from a state the engine classifies 'win'; 'unknown'
//                               never counts as a loss).
// counterfactuals(design, opts) C1 key-memory vs reference family D; C2/C3 planner face-up vs as is.
//
// CLI (prints JSON; one board, one spare):
//   node source/tools/builder/loop/traces.js <boards.jsonl|json> <index|id> <spare> [campaigns=40] [--cf]
const fs = require('fs'), path = require('path');
const E = require('../engine.js'), K = require('../knobs.js'), M = require('../../factory/meter.js');
const A = require('../task11_analyze.js'), F = require('../task11_physics.js');

// Codex's frozen Task 11 classification budget (task11_plan.js `classification`). ms is wall-clock, so
// a heavily loaded PC can turn a few 'win'/'lose' into 'unknown'; unknowns are counted, never read as losses.
const BUDGET = Object.freeze({ nodes: 30000, ms: 60, cap: 12, depthNodes: 1500 });
// Thresholds of section 4 B. All are "uncalibrated" until experiment E5.
const THRESHOLDS = Object.freeze({
  B1: { min: 0.15 }, B2: { min: 0.5 }, B3: { min: 0.15, max: 0.60 }, B4: { max: 6 }, B5: { max: 0.10, leftShare: 0.25 },
  B6: { max: 0.40, secondActMin: 0.10, secondActFork: [0.40, 0.65] }, B7: { inflated: 0.5, maxTarget: 10, fromTry: 6 },
  coverage: 0.5, // a share-of-errors gate is undecided (pass null) when fewer than half the lost tries have a proved first error
});
const DEFAULT_SEED = 4711; // first CURVE seed (synthesis section 2, seed blocks)

const unwrap = d => d && d.design && d.design.tiles ? d.design : d;
const round = (x, k = 3) => x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 10 ** k) / 10 ** k;
const between = (v, lo, hi) => v == null ? null : v >= lo && v <= hi;

function atSpare(design, spare) {
  design = unwrap(design);
  if (spare == null) return { design };
  const r = K.clockSpare(design, spare);
  return r.fail ? { fail: r.fail } : { design: r.design, minimum: r.proof.minimum };
}

// ---------- capture ----------
function botEntry(botVersion) {
  if (!botVersion || botVersion === 'reference') return require.resolve('../../sim/refit/human_bot.js');
  const entry = M.BOT_VERSIONS[botVersion]; if (!entry) throw Error('Unknown botVersion ' + botVersion); return entry;
}
const fingerprints = new Map();
function botFingerprint(botVersion) {
  const k = botVersion || 'reference';
  if (!fingerprints.has(k)) fingerprints.set(k, M.createMeter(botVersion && botVersion !== 'reference' ? { botVersion, cacheDir: false } : { cacheDir: false }).fingerprint);
  return fingerprints.get(k);
}
// The same call task11_capture_worker.js makes (full per-tap capture, 20 tries, one seed block), but with
// a chosen bot and campaign count. Returns the raw shape task11_analyze.trace reads.
function captureFamily(design, { runs = 40, seed = DEFAULT_SEED, botVersion = 'family-key-memory-v1' } = {}) {
  const t = Date.now(), bot = require(botEntry(botVersion));
  const options = { runs, seeds: 1, seed, maxAttempts: 20, capture: true, setting: 'family' };
  const result = bot.measureHuman(M.boardOf(design), options);
  return { profile: 'family', bot: botFingerprint(botVersion), botVersion: botVersion || 'reference', boardKey: M.boardKey(design), options, ms: Date.now() - t, result };
}

// ---------- forks (designed trap states along the stored witness) ----------
function sameish(evMove, t) {
  if (evMove == null || t == null) return false;
  const a = typeof evMove === 'number' ? [evMove] : evMove.pair, b = typeof t === 'number' ? [t] : t.pair;
  if (typeof evMove === 'number' && typeof t === 'number') return evMove === t;
  if (typeof evMove !== 'number' && typeof t !== 'number') return F.same(evMove, t);
  return a.some(i => b.includes(i)); // a take of one tile of a listed pair, or a pair that contains a listed take
}
function defaultForks(g) {
  try { return E.traps(g, null, BUDGET).map(f => ({ step: f.step, tempting: f.tempting })); } catch { return []; } // a witness E.traps cannot step has no mapped forks
}
function forkIndex(g, forks) {
  const keys = new Map(), tempting = [], p = g.design.solution; let s = E.start(g), k = 0, unmapped = 0;
  for (const f of [...forks].sort((a, b) => a.step - b.step)) {
    for (const t of f.tempting || []) tempting.push({ step: f.step, move: t.move, kind: t.kind ?? null });
    while (s && k < f.step) { try { s = E.step(g, s, p[k]); } catch { s = null; } k++; }
    if (s) keys.set(F.stateKey(g, s), f.step); else unmapped++;
  }
  return { keys, tempting, unmapped };
}
const recordKey = r => r.alive.join('') + '/' + r.trayFaces.slice().sort((a, b) => a - b).join(',') + '/' + (r.preClock ? r.moves : '-');

// ---------- B1-B7 ----------
function traceGates(input, opts = {}) {
  const { spare = null, ys = null, campaigns = 40, secondAct = false, budget = BUDGET, maxExamples = 6 } = opts;
  const at = atSpare(input, spare); if (at.fail) return { spare, fail: at.fail };
  const design = at.design, n = design.tiles.length, seed = opts.seed ?? ys?.curveSeed ?? DEFAULT_SEED;
  const botVersion = opts.botVersion ?? ys?.botVersion ?? 'family-key-memory-v1';
  const capture = opts.capture || (typeof ys?.capture === 'function' ? ys.capture.bind(ys) : captureFamily);
  const t0 = Date.now(), raw = capture(design, { runs: campaigns, seed, botVersion }), captureMs = Date.now() - t0;
  if (!raw?.result?.results) throw Error('capture must return { result: { results: [...] } } with full per-tap decisions');
  const t1 = Date.now(), a = A.analyzer({ design }, budget), tr = a.trace({ profile: raw.profile || 'family', ...raw }), analyzeMs = Date.now() - t1;
  const forks = forkIndex(a.g, opts.forks ?? defaultForks(a.g));
  const keyOf = id => recordKey(a.records[id]);
  const atFork = row => forks.keys.has(keyOf(row.state));
  const temptingHit = row => forks.tempting.find(t => sameish(row.move, t.move)) || null;
  const rawAttempt = (c, k) => raw.result.results[c]?.attempts?.[k - 1] || {};

  const tries = tr.profile.attemptProfiles, losses = tries.filter(x => !x.win && !x.censored);
  const proved = losses.filter(x => x.firstError && !x.recovery), coverage = losses.length ? proved.length / losses.length : null;
  const covered = coverage != null && coverage >= THRESHOLDS.coverage;

  // B1: in first tries, before the clock, the bot commits a listed tempting move, or a losing move at a fork state.
  const firstTries = tries.filter(x => x.attempt === 1 && !x.censored), bites = [];
  for (const x of firstTries) {
    const rows = tr.moves.filter(r => r.campaign === x.campaign && r.attempt === 1 && r.preClock && r.event !== 'peek');
    const hit = rows.find(r => temptingHit(r) || (r.result === 'lose' && atFork(r)));
    if (hit) bites.push({ campaign: x.campaign, removalMove: hit.removalMove, move: hit.move, result: hit.result, tempting: !!temptingHit(hit) });
  }
  const biteShare = firstTries.length ? bites.length / firstTries.length : null;

  // B2: first irreversible error at a fork state or on a listed tempting move.
  const labelled = proved.map(x => { const e = x.firstError, fork = atFork(e), hit = temptingHit(e); return { x, e, fork, hit, trap: fork || !!hit }; });
  const atTrap = labelled.filter(l => l.trap).length, lossesAtTrapShare = proved.length ? atTrap / proved.length : null;
  // B3, B4
  const firstErrorMedianShare = A.median(proved.map(x => x.firstError.removalMove / n));
  const delayMedian = A.median(proved.map(x => x.firstError.actualDelayToTerminal));
  // B5: tray losses with under 25% of the tiles left.
  const leftOf = x => rawAttempt(x.campaign, x.attempt).left ?? (n - x.moves);
  const late = losses.filter(x => x.why === 'tray' && leftOf(x) < THRESHOLDS.B5.leftShare * n).length;
  const lateSqueezeShare = losses.length ? late / losses.length : null;
  // B6: losses after the clock was taken (the bot's loss phase is 'mid' or 'late'; 'clock' = before the clock).
  const post = losses.filter(x => x.phase && x.phase !== 'clock'), postClockShare = losses.length ? post.length / losses.length : null;
  const postForkShare = A.median(post.filter(x => x.firstError && !x.recovery && !x.firstError.preClock).map(x => x.firstError.removalMove / n));
  // B7: losses in tries 6-20 whose first error repeats the same losing move from the same state earlier in that campaign.
  const lateTries = losses.filter(x => x.attempt >= THRESHOLDS.B7.fromTry);
  const repeats = lateTries.filter(x => x.firstError?.repeatedSameLosingMove).length, repeatShare = lateTries.length ? repeats / lateTries.length : null;

  const B6pass = postClockShare == null ? null : secondAct
    ? postClockShare >= THRESHOLDS.B6.secondActMin && between(postForkShare, ...THRESHOLDS.B6.secondActFork) === true
    : postClockShare <= THRESHOLDS.B6.max;
  const gates = {
    B1: { pass: biteShare == null ? null : biteShare >= THRESHOLDS.B1.min, value: round(biteShare), bites: bites.length, firstTries: firstTries.length },
    B2: { pass: proved.length && covered ? lossesAtTrapShare >= THRESHOLDS.B2.min : null, value: round(lossesAtTrapShare), atTrap, atForkState: labelled.filter(l => l.fork).length,
      onTemptingMove: labelled.filter(l => l.hit).length, provedFirstErrors: proved.length, lostTries: losses.length, coverage: round(coverage) },
    B3: { pass: covered ? between(firstErrorMedianShare, THRESHOLDS.B3.min, THRESHOLDS.B3.max) : null, value: round(firstErrorMedianShare) },
    B4: { pass: covered && delayMedian != null ? delayMedian <= THRESHOLDS.B4.max : null, value: delayMedian },
    B5: { pass: lateSqueezeShare == null ? null : lateSqueezeShare <= THRESHOLDS.B5.max, value: round(lateSqueezeShare), lateTrayLosses: late },
    B6: { pass: B6pass, value: round(postClockShare), postClockLosses: post.length, secondAct, postClockErrorMedianShare: round(postForkShare) },
    B7: { value: round(repeatShare), repeats, lossesTries6to20: lateTries.length, inflated: repeatShare != null && repeatShare > THRESHOLDS.B7.inflated,
      maxTarget: repeatShare != null && repeatShare > THRESHOLDS.B7.inflated ? THRESHOLDS.B7.maxTarget : null },
  };
  const decided = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].map(k => gates[k].pass);
  const pass = decided.includes(false) ? false : decided.includes(null) ? null : true;

  // Examples: first-try losses first, then others; trap and non-trap errors both shown.
  const ex = l => ({ campaign: l.x.campaign, attempt: l.x.attempt, errorAtRemoval: l.e.removalMove, errorShare: round(l.e.removalMove / n, 2), move: l.e.move, kind: l.e.kind,
    atForkState: l.fork, temptingStep: l.hit ? l.hit.step : null, delay: l.e.actualDelayToTerminal, lossWhy: l.x.why, phase: l.x.phase, left: leftOf(l.x),
    repeated: !!l.e.repeatedSameLosingMove, depth: l.e.depth,
    text: `Try ${l.x.attempt} of campaign ${l.x.campaign + 1}: the first losing move (${l.e.kind}, tile ${JSON.stringify(l.e.move)}) was removal ${l.e.removalMove} of ${n}` +
      `${l.fork || l.hit ? ', at a designed trap' : ', away from any designed trap'}; the loss (${l.x.why}) showed ${l.e.actualDelayToTerminal} removals later.` });
  const order = [...labelled].sort((p, q) => (p.x.attempt === 1 ? 0 : 1) - (q.x.attempt === 1 ? 0 : 1) || p.x.campaign - q.x.campaign || p.x.attempt - q.x.attempt);
  const half = Math.ceil(maxExamples / 2), trapEx = order.filter(l => l.trap).slice(0, half), otherEx = order.filter(l => !l.trap).slice(0, maxExamples - Math.min(half, trapEx.length));
  const examples = trapEx.concat(otherEx).slice(0, maxExamples).map(ex);

  return { spare, minimum: at.minimum ?? null, tiles: n, campaigns: raw.result.results.length, bot: raw.bot ?? null, botVersion: raw.botVersion ?? botVersion, seed,
    D: raw.result.expectedTries ?? null, wonOn: raw.result.results.map(c => c.wonOn), valid: raw.result.valid ?? null,
    ...gates, pass, calibrated: false,
    biteShare: round(biteShare), lossesAtTrapShare: round(lossesAtTrapShare), firstErrorMedianShare: round(firstErrorMedianShare), delayMedian,
    lateSqueezeShare: round(lateSqueezeShare), postClockShare: round(postClockShare), repeatShare: round(repeatShare),
    counts: { attempts: tries.length, losses: losses.length, provedFirstErrors: proved.length, unknownChosen: tr.profile.unknownChosen, engineMismatches: tr.profile.engineMismatches,
      recoveries: tr.profile.recoveries, engineStates: a.records.length, forkStates: forks.keys.size, temptingMoves: forks.tempting.length, forkStatesUnmapped: forks.unmapped },
    errorKinds: tr.profile.errorKinds, lossKinds: tr.profile.lossKinds, examples, ms: { capture: raw.ms ?? captureMs, analyze: analyzeMs },
    thresholds: THRESHOLDS, budget };
}

// ---------- C1-C3 ----------
// C1 tolerance: max(2, 25% of the key-memory D), the key-memory bot being the pinned ruler.
// C2/C3 run the pinned reference planner (better of route and plain) at plannerSpare (default 2, where S is defined).
// Face-up = design.down = []: the bots read `down` through public_board_input.js, and an empty list leaves every tile face up.
function counterfactuals(input, opts = {}) {
  const { spare = null, plannerSpare = 2, runs = 40, seeds = 1, seed = DEFAULT_SEED, plannerSettings = {}, skip = [] } = opts;
  const out = { spare, plannerSpare }, t = Date.now();
  if (!skip.includes('C1')) {
    const at = atSpare(input, spare);
    if (at.fail) out.C1 = { fail: at.fail };
    else {
      const km = opts.kmMeter || M.createMeter({ botVersion: 'family-key-memory-v1' }), ref = opts.refMeter || M.createMeter();
      const settings = { setting: 'family', runs, seeds, seed }, a = km.measure(at.design, settings), b = ref.measure(at.design, settings);
      const keyMemory = a.expectedTries, reference = b.expectedTries, diff = reference - keyMemory, tolerance = Math.max(2, 0.25 * keyMemory);
      out.C1 = { pass: Number.isFinite(diff) ? Math.abs(diff) <= tolerance : null, keyMemory, reference, diff: round(diff, 2), tolerance: round(tolerance, 2),
        valid: a.valid === true && b.valid === true, settings, fingerprints: { keyMemory: km.fingerprint, reference: ref.fingerprint } };
    }
  }
  if (!skip.includes('C2')) {
    const at = atSpare(input, plannerSpare);
    if (at.fail) out.C2 = out.C3 = { fail: at.fail };
    else {
      const pm = opts.plannerMeter || M.createMeter(), settings = { setting: 'planner', ...plannerSettings };
      const faceUpDesign = { ...at.design, down: [] };
      const a = pm.measure(at.design, settings), b = pm.measure(faceUpDesign, settings), asIs = a.expectedTries, faceUp = b.expectedTries;
      out.C2 = { pass: Number.isFinite(asIs) && Number.isFinite(faceUp) ? faceUp <= asIs + 2 : null, asIs, faceUp, diff: round(faceUp - asIs, 2),
        faceDownTiles: (at.design.down || []).length, styles: { asIs: a.plannerStyles ?? null, faceUp: b.plannerStyles ?? null }, valid: a.valid === true && b.valid === true,
        settings, fingerprint: pm.fingerprint, skilledCredit: !(faceUp > asIs + 2) };
      const ratio = asIs > 0 ? faceUp / asIs : null;
      out.C3 = { report: true, pass: ratio == null ? null : ratio >= 0.5, value: round(ratio) };
    }
  }
  out.ms = Date.now() - t;
  return out;
}

module.exports = { traceGates, counterfactuals, captureFamily, defaultForks, forkIndex, sameish, atSpare, THRESHOLDS, BUDGET, DEFAULT_SEED };

if (require.main === module) {
  const [file, which, spareArg, campArg] = process.argv.slice(2), cf = process.argv.includes('--cf');
  const text = fs.readFileSync(path.resolve(file), 'utf8').trim();
  const rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').map(l => JSON.parse(l));
  const row = /^\d+$/.test(which) ? rows[+which] : rows.find(r => r.id === which);
  const spare = spareArg === 'asis' ? null : +spareArg, campaigns = +(campArg || 40);
  const t = Date.now(), g = traceGates(row, { spare, campaigns }), wall = Date.now() - t;
  const brief = { id: row.id, spare, wallMs: wall, ...g, thresholds: undefined, budget: undefined };
  if (cf) brief.counterfactuals = counterfactuals(row, { spare: spare ?? undefined });
  console.log(JSON.stringify(brief, null, 1));
}
