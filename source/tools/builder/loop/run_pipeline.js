#!/usr/bin/env node
'use strict';
// The library pipeline, steps 2-8 of process-design-synthesis.md section 6 (step 9 is assign_levels.js).
//
//   node source/tools/builder/loop/heavy.js --label pipeline -- node source/tools/builder/loop/run_pipeline.js --n 200 --start auto
//   node source/tools/builder/loop/run_pipeline.js --dry-run --n 20     (fake bots, fake static gates; writes to a temp folder)
//
// Per candidate, cheapest first; a board stops at the first gate it fails:
//   build     builder.js build() on a briefs-v1.json brief (stories frozenGuards and chainReaction are left out);
//             candidate i uses brief i mod m and seed seedBase + floor(i / m). Briefs and seeds vary only to get
//             different puzzles; nothing is tuned toward a number. A failed build has no board and is only counted.
//   dedupe    library.contentKey (the board without its clock budget or witness). A board already in library.jsonl
//             or rejects.jsonl is skipped: a rerun resumes where it stopped and pays no bot time for old boards.
//   static    static_gates.js A1-A9 (engine only; A1 is gate.js checkDesign without brief targets), stopEarly.
//             A failure while the hang guard fired (warning 'wallClock', load-dependent) is not written to rejects:
//             the board is retried next run.
//   screen    screen.js screenBoard: family ruler, SCREEN block at spare 1 then 3; keep if D(1) >= lo - 1,
//             D(3) <= hi + 1 and D(1) < 18.5, [lo, hi] = the open targets (--targets lo,hi).
//   planner   rate each statically eligible spare; keep only settings in the explicit skilled band (normally 2.5-6).
//   curve     dial_curve.js measureCurve, CURVE block at spares 0-3. The spares that may go on are those the curve
//             can ship AND at which A4 holds (static gates detail.okSpares). Spare 1 on a fast opening clock (A8) is
//             removed from the eligible spares. None left -> reject.
//   traces    traces.js traceGates B1-B7 at each of those spares: a spare whose trace gates fail (pass === false) is
//             dropped; undecided (null) spares stay and are noted. B7 gives the spare its maxTarget.
//   C1        counterfactual.js c1 at each remaining spare: a spare that fails is dropped.
//   C2        counterfactual.js c2c3 once (spare 2): a failure marks S untrusted (no skilled credit); never a reject.
//   library   library.js makeEntry + add (append-only).
// Every candidate's outcome goes to stderr; the run summary (yield, CPU and wall seconds per step) is appended to
// library/pipeline-runs.jsonl. --max-minutes (default 18) stops between candidates, so a heavy job stays under 20 min.
// Without --dry-run it refuses to start unless heavy.js launched it (or --no-heavy-check).
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const Lb = require('./library.js');
const Policy = require('./policy.js');
const GP = require('./gate_profile.js');

const VERSION = 'pipeline-v4-skilled-spares';
const ROOT = path.resolve(__dirname, '../../../..');
const BRIEFS = path.resolve(__dirname, '../briefs-v1.json');
const EXCLUDED_STORIES = ['frozenGuards', 'chainReaction'];
const STEPS = ['build', 'dedupe', 'static', 'screen', 'planner', 'curve', 'traces', 'C1', 'C2', 'library'];
const DEFAULTS = Object.freeze({
  n: 50, start: 0, seedBase: 1, maxMinutes: 18,
  targets: [10, 13],          // approved opening curve, levels 250-275
  skilledFloor: 2.5, plannerMargin: 0, plannerSpare: 2,
  curveSpares: [0, 1, 2, 3], traceCampaigns: 40,
  staticOptions: { stopEarly: true },
  gateProfile: 'e5-v1',
  mode: null,
});
function pipelineVersion(optsIn) {
  const opts = { ...DEFAULTS, ...optsIn };
  const identity = GP.digest({ profile: GP.loadProfile(opts.gateProfile).fingerprint, targets: opts.targets,
    plannerSpare: opts.plannerSpare, curveSpares: opts.curveSpares, traceCampaigns: opts.traceCampaigns,
    staticOptions: opts.staticOptions, pins: require('./yardstick.js').loadPins(), ...(opts.mode ? { mode: opts.mode, construction: codeFingerprints()['visible_choice.js'] } : {}) });
  return VERSION + '-' + identity.slice(0, 12) + (opts.skilledFloor < Policy.SKILLED.lo ? '-fallback-' + opts.skilledFloor : '') + (opts.mode ? '-' + opts.mode : '');
}

// ---------- candidates ----------
const candidateBriefs = briefs => briefs.filter(b => !EXCLUDED_STORIES.includes(b.story));
function candidateAt(list, i, seedBase) {
  const b = list[i % list.length];
  return { index: i, brief: { ...b, seed: seedBase + Math.floor(i / list.length) } };
}

// ---------- accounting ----------
const newStats = () => Object.fromEntries(STEPS.map(s => [s, { in: 0, pass: 0, fail: 0, unresolved: 0, cpuS: 0, wallS: 0 }]));
function timer() {
  const c0 = process.cpuUsage(), w0 = Date.now();
  return () => { const c = process.cpuUsage(c0); return { cpuS: (c.user + c.system) / 1e6, wallS: (Date.now() - w0) / 1000 }; };
}
const r3 = x => x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 1000) / 1000;
const failedGates = sg => Object.entries(sg.gates || {}).filter(([, g]) => g && g.pass === false).map(([a]) => a);

// ---------- one candidate ----------
function processCandidate(cand, ctx) {
  const { deps, opts, stats, lib, run, pipeline, profile } = ctx, ys = deps.ys;
  const brief = cand.brief, tag = { briefId: brief.id, story: brief.story, layout: brief.layout ?? null, shape: brief.shape ?? null, seed: brief.seed, index: cand.index };
  const cpu = {};
  const step = (name, fn) => {
    const t = timer(); stats[name].in++;
    try { return fn(); } finally { const d = t(); stats[name].cpuS += d.cpuS; stats[name].wallS += d.wallS; cpu[name] = r3(d.cpuS); }
  };

  // build
  const built = step('build', () => deps.build(brief));
  if (!built || built.fail || !built.design) { stats.build.fail++; return { outcome: 'buildFail', why: built?.fail ?? 'noDesign' }; }
  stats.build.pass++;
  const design = built.design, tiles = design.tiles.length;

  // dedupe (resume)
  const key = step('dedupe', () => Lb.contentKey(design));
  const seen = lib.has(key, { pipeline });
  if (seen) { stats.dedupe.fail++; return { outcome: 'skip', key, seen }; }
  stats.dedupe.pass++;
  const reject = (gate, reason, extra = {}) => {
    stats[gate].fail++;
    lib.reject({ key, ...tag, gate, reason: String(reason).slice(0, 500), run, pipeline, tiles, ...extra });
    return { outcome: 'reject', key, gate, reason };
  };

  // static gates A1-A9
  const sg = step('static', () => GP.applyStatic(deps.staticGates(design, { ...opts.staticOptions, story: brief.story }), profile));
  const failed = failedGates(sg);
  if (!sg.pass) {
    if ((sg.warnings || []).some(w => /^wallClock/.test(w))) { stats.static.unresolved++; return { outcome: 'unresolved', key, gate: 'static', why: 'wallClock: ' + failed.join(',') }; }
    for (const a of failed) (stats.static.byGate ||= {})[a] = (stats.static.byGate[a] || 0) + 1;
    const why = failed.length ? failed.join(',') : 'no shippable spare after A4/A8';
    return reject('static', why, { k: sg.k ?? null, failed: Object.fromEntries(failed.map(a => [a, sg.gates[a].detail?.why ?? null])) });
  }
  stats.static.pass++;
  const k = sg.k, a4Spares = sg.gates?.A4?.detail?.okSpares || sg.shipSpares || [];

  // family screen
  const [lo, hi] = opts.targets;
  const scr = step('screen', () => deps.screenBoard(design, ys, { lo, hi }));
  const scrSummary = { keep: scr.keep, reasons: scr.reasons, points: Object.fromEntries(Object.entries(scr.points || {}).map(([s, p]) => [s, { D: r3(p.D), n: p.n, valid: p.valid, stoppedAt: p.stoppedAt ?? null, source: p.source ?? null, fail: p.fail }])),
    botCampaigns: scr.botCampaigns ?? null };
  if (!scr.keep) return reject('screen', (scr.reasons || []).join(', ') || 'not kept', { screen: scrSummary });
  stats.screen.pass++;

  // Skilled difficulty belongs to a clock setting, not to the puzzle independent of its clock.
  const plBySpare = {}, plannerWhy = {};
  const plPin = ys.pins?.planner?.fingerprint;
  const staticSpares = a4Spares.filter(s => (sg.shipSpares || a4Spares).includes(s) && !(sg.gates?.A8?.flag && s < 2));
  step('planner', () => {
    for (const s of staticSpares) {
      const p = ys.planner(design, { spare: s }); plBySpare[s] = p;
      plannerWhy[s] = !p || p.valid !== true || !Number.isFinite(p.S) ? 'no valid planner rating'
        : plPin && p.fingerprint !== plPin ? 'planner fingerprint mismatch'
        : p.S < opts.skilledFloor || p.S > Policy.SKILLED.hi ? `S ${r3(p.S)} outside ${opts.skilledFloor}-6` : null;
    }
  });
  const skilledSpares = staticSpares.filter(s => plannerWhy[s] === null);
  if (!skilledSpares.length) return reject('planner', Object.entries(plannerWhy).map(([s, why]) => `s${s}: ${why}`).join('; ') || 'no statically eligible spare', { plannerBySpare: plBySpare });
  stats.planner.pass++;

  // dial curve
  const curve = step('curve', () => deps.measureCurve(design, ys, { spares: opts.curveSpares }));
  const spareNotes = {};
  for (const s of curve.shippable || []) if (!a4Spares.includes(s)) spareNotes[s] = 'A4 fails at this spare';
  for (const s of staticSpares) if (plannerWhy[s]) spareNotes[s] = plannerWhy[s];
  let ship = (curve.shippable || []).filter(s => skilledSpares.includes(s));
  if (!ship.length) {
    const why = Object.values(curve.verdicts || {}).filter(v => v.reasons?.length).map(v => `s${v.spare}: ${v.reasons.join('+')}`).join('; ');
    return reject('curve', `no spare could ship (curve ${JSON.stringify(curve.shippable || [])}, A4 ${JSON.stringify(a4Spares)})` + (why ? ': ' + why : ''), { D: (curve.points || []).map(p => r3(p.D)) });
  }
  stats.curve.pass++;

  // traces at each spare that could ship
  const traces = {};
  step('traces', () => {
    for (const s of ship) {
      const t = deps.traceGates(design, GP.traceOptions({ spare: s, ys, campaigns: opts.traceCampaigns, secondAct: !!brief.secondAct }, profile));
      traces[s] = t;
      if (t.fail) spareNotes[s] = 'traces: ' + t.fail;
      else if (t.pass === false) spareNotes[s] = 'traces fail: ' + ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].filter(b => t[b]?.pass === false).join(',');
      else if (t.pass === null) spareNotes[s] = 'traces undecided (kept): ' + ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].filter(b => t[b]?.pass === null).join(',');
    }
  });
  ship = ship.filter(s => traces[s] && !traces[s].fail && traces[s].pass !== false);
  if (!ship.length) return reject('traces', Object.entries(spareNotes).map(([s, v]) => `s${s} ${v}`).join('; '));
  stats.traces.pass++;

  // C1 at each remaining spare
  const cf = { C1: {} };
  step('C1', () => {
    for (const s of ship) {
      const r = deps.c1(design, { spare: s, ys });
      cf.C1[s] = r;
      if (r?.pass === false) spareNotes[s] = (spareNotes[s] ? spareNotes[s] + '; ' : '') + `C1 fail: reference ${r.reference} vs key memory ${r.keyMemory} (tolerance ${r.tolerance})`;
    }
  });
  ship = ship.filter(s => cf.C1[s]?.pass !== false);
  if (!ship.length) return reject('C1', Object.entries(spareNotes).map(([s, v]) => `s${s} ${v}`).join('; '));
  stats.C1.pass++;

  // Trust and face-up sanity also belong to the same clock setting.
  cf.bySpare = {};
  step('C2', () => { for (const s of ship) cf.bySpare[s] = deps.c2c3(design, { ys, plannerSpare: s }); });
  stats.C2.pass++;
  const primarySpare = ship.includes(opts.plannerSpare) ? opts.plannerSpare : ship[0], pl = plBySpare[primarySpare];
  cf.C2 = cf.bySpare[primarySpare]?.C2 ?? null; cf.C3 = cf.bySpare[primarySpare]?.C3 ?? null;
  const trusted = cf.C2?.pass === true;   // a missing or unknown C2 is NOT trusted
  const skilledBySpare = Object.fromEntries(ship.map(s => [s, { S: plBySpare[s].S, valid: true, trusted: cf.bySpare[s]?.C2?.pass === true,
    fallback: plBySpare[s].S < Policy.SKILLED.lo, spare: s, styles: plBySpare[s].styles ?? null, fingerprint: plBySpare[s].fingerprint ?? null,
    faceUp: cf.bySpare[s]?.C2?.faceUp ?? null }]));

  // library entry
  const best = ship.map(s => traces[s]).filter(t => t && t.lossesAtTrapShare != null).sort((a, b) => b.lossesAtTrapShare - a.lossesAtTrapShare)[0];
  const card = (sg.card || '') + (best ? ` The family bot's first error was at the trap in ${Math.round(100 * best.lossesAtTrapShare)}% of lost tries (spare ${best.spare}).` : '');
  const res = step('library', () => {
    const e = Lb.makeEntry({ design, k, run, story: brief.story, layout: brief.layout ?? null, shape: built.card?.shape ?? brief.shape ?? null, briefId: brief.id, seed: brief.seed,
      secondAct: !!brief.secondAct, curve, shipSpares: ship,
      S: { ...skilledBySpare[primarySpare], bySpare: skilledBySpare },
      gates: { static: sg, screen: scrSummary, traces, counterfactuals: cf, spareNotes },
      card, fingerprints: ctx.fingerprints, gateProfile: profile, cpu });
    if (e.key !== key) throw Error('content key changed while freezing the design');
    return lib.add(e);
  });
  if (!res.added) { stats.library.fail++; return { outcome: 'skip', key, seen: res.reason }; }
  stats.library.pass++;
  return { outcome: 'library', key, ship, S: pl.S, trusted };
}

// ---------- the run ----------
function codeFingerprints() {
  const files = ['../builder.js', '../engine.js', '../gate.js', '../knobs.js', './static_gates.js', './obvious.js', './detour.js', './publicfork.js', './screen.js', './dial_curve.js',
    './traces.js', './counterfactual.js', './yardstick.js', './library.js', './run_pipeline.js', './gate_profile.js', './policy.js', '../visible_choice.js'];
  const out = {};
  for (const f of files) { try { out[path.basename(f)] = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, f))).digest('hex').slice(0, 16); } catch (e) { out[path.basename(f)] = null; } }
  return out;
}

function runPipeline(optsIn = {}, deps) {
  const opts = { ...DEFAULTS, ...optsIn };
  Policy.assertSkilledOptions({ lo: opts.skilledFloor });
  if (opts.mode != null && opts.mode !== 'visibleChoice') throw Error('Unknown builder mode: ' + opts.mode);
  if (opts.plannerMargin !== 0) throw Error('Every level requires an explicit skilled minimum; hidden screening margins are not supported');
  const pipeline = pipelineVersion(opts);
  const profile = GP.loadProfile(opts.gateProfile);
  const lib = deps.library;
  const log = deps.log || (s => process.stderr.write(s + '\n'));
  const now = deps.now || Date.now;
  const list = candidateBriefs(deps.briefs);
  if (!list.length) throw Error('no briefs left after excluding ' + EXCLUDED_STORIES.join(', '));
  const run = optsIn.run || new Date(now()).toISOString().replace(/[:.]/g, '-') + (opts.dryRun ? '-dry' : '');
  const stats = newStats(), outcomes = {}, t0 = now(), tAll = timer();
  const fingerprints = { family: deps.ys.fingerprint ?? null, reference: deps.ys.referenceFingerprint ?? null, planner: deps.ys.pins?.planner?.fingerprint ?? null,
    familyBot: deps.ys.pins?.family?.botVersion ?? null, code: deps.code ?? null, pipeline, gateProfile: profile.fingerprint };
  const ctx = { deps, opts, stats, lib, run, fingerprints, pipeline, profile };
  let done = 0, stopped = null;
  const errors = [];
  for (let i = opts.start; i < opts.start + opts.n; i++) {
    if (now() - t0 > opts.maxMinutes * 60000) { stopped = `time budget of ${opts.maxMinutes} min reached`; break; }
    const cand = candidateAt(list, i, opts.seedBase);
    let r;
    try { r = processCandidate(cand, ctx); }
    catch (e) {
      // a crash is not the board's fault: nothing is written for it, and a rerun tries it again
      r = { outcome: 'error', why: String(e && e.message || e).slice(0, 300) };
      errors.push({ index: i, briefId: cand.brief.id, seed: cand.brief.seed, error: r.why });
    }
    outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;
    done++;
    log(`[pipeline] ${i} ${cand.brief.id} seed ${cand.brief.seed}: ${r.outcome}${r.gate ? ' at ' + r.gate : ''}${r.reason ? ' (' + r.reason + ')' : r.why ? ' (' + r.why + ')' : ''}${r.ship ? ' ships ' + r.ship.join(',') : ''}`);
  }
  const total = tAll();
  const summary = {
    schema: 'pipeline-run-v1', run, pipeline, dryRun: !!opts.dryRun, at: new Date(now()).toISOString(),
    range: [opts.start, opts.start + done - 1], next: opts.start + done, requested: opts.n, done, stopped,
    options: { targets: opts.targets, skilledFloor: opts.skilledFloor, plannerMargin: opts.plannerMargin, seedBase: opts.seedBase, curveSpares: opts.curveSpares, traceCampaigns: opts.traceCampaigns, gateProfile: profile.id, mode: opts.mode },
    gateProfile: profile,
    briefs: list.length, excludedStories: EXCLUDED_STORIES, outcomes,
    steps: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { ...v, cpuS: r3(v.cpuS), wallS: r3(v.wallS), cpuPerIn: v.in ? r3(v.cpuS / v.in) : null }])),
    cpuS: r3(total.cpuS), wallS: r3(total.wallS), errors, fingerprints, library: lib.dir,
    cpuNote: 'CPU seconds are this process only (process.cpuUsage); bot work runs in this process (no workers).',
  };
  summary.text = summaryText(summary);
  if (opts.writeRunLog !== false) { fs.mkdirSync(lib.dir, { recursive: true }); fs.appendFileSync(path.join(lib.dir, 'pipeline-runs.jsonl'), JSON.stringify(summary) + '\n'); }
  return summary;
}

function summaryText(s) {
  const L = [`Pipeline run ${s.run}${s.dryRun ? ' (DRY RUN: fake bots and fake static gates; the numbers mean nothing)' : ''}: candidates ${s.range[0]}-${s.range[1]} (${s.done} of ${s.requested}${s.stopped ? '; stopped: ' + s.stopped : ''}).`];
  L.push(`Outcomes: ${Object.entries(s.outcomes).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. CPU ${s.cpuS} s, wall ${s.wallS} s.`);
  L.push('step       in  pass  fail  unres   CPU s  CPU s/in');
  for (const [k, v] of Object.entries(s.steps)) if (v.in) L.push(`${k.padEnd(8)} ${String(v.in).padStart(4)} ${String(v.pass).padStart(5)} ${String(v.fail).padStart(5)} ${String(v.unresolved).padStart(6)} ${String(v.cpuS).padStart(7)}  ${v.cpuPerIn}`);
  if (s.steps.static.byGate) L.push('static failures by gate: ' + Object.entries(s.steps.static.byGate).map(([a, n]) => `${a} ${n}`).join(', '));
  if (s.errors.length) L.push(`Errors (nothing written for them; retried next run): ${s.errors.length}; first: ${s.errors[0].briefId} seed ${s.errors[0].seed}: ${s.errors[0].error}`);
  L.push(`Next start: --start ${s.next}`);
  return L.join('\n');
}

// ---------- fakes (dry run and tests) ----------
const hashUnit = (str, salt = '') => parseInt(crypto.createHash('sha256').update(salt + str).digest('hex').slice(0, 8), 16) / 4294967296;
// A fake meter for the yardstick: geometric tries with a per-board base; a looser clock gives more wins.
function fakeMeasure() {
  return (board, settings) => {
    const key = Lb.contentKey(board), u = hashUnit(key, 'base');
    if (settings.setting === 'planner') return { expectedTries: 1.5 + 6 * hashUnit(key + (board.down || []).length, 'S'), firstTryRate: 0.3, valid: true, plannerStyles: { route: 3, plain: 4 } };
    const n = board.clock.n, p = Math.min(0.95, 0.04 + 0.12 * u + 0.008 * n);
    const results = [], seeds = settings.seeds || 1, runs = settings.runs;
    let sum = 0;
    for (let s = 0; s < seeds; s++) for (let r = 0; r < runs; r++) {
      const v = hashUnit(key + ':' + settings.seed + ':' + s + ':' + r, 'c');
      const tries = Math.ceil(Math.log(1 - v) / Math.log(1 - p)) || 1, c = tries <= 20 ? { wonOn: tries, attempts: Array(tries).fill({}) } : { wonOn: null, attempts: Array(20).fill({}) };
      sum += c.wonOn ?? 20; if (s === 0) results.push(c);
    }
    return { expectedTries: sum / (seeds * runs), firstTryRate: 0, valid: true, results };
  };
}
// Dry run: the real screen.js, dial_curve.js and counterfactual.js (and their engine calls) on a yardstick with a
// fake meter; fake static gates and fake traces (a trace needs a real bot capture).
function fakeDeps(over = {}) {
  const Y = require('./yardstick.js'), CF = require('./counterfactual.js');
  const ys = over.ys || Y.createYardstick({ measure: fakeMeasure(), allowNewFingerprint: true, cacheDir: false, ledgerFile: false });
  return {
    ys,
    staticGates: d => {
      const E = require('../engine.js'), cs = E.clockShortest(E.game(JSON.parse(JSON.stringify(d))), { nodes: 400000, ms: 5000 }), k = cs ? cs.k : null;
      const pass = k != null && hashUnit(Lb.contentKey(d), 'static') < 0.7, ok = k == null ? [] : [1, 2, 3].filter(s => k + s <= 19);
      return { pass, k, strictK: k, shipSpares: ok, archetype: 'free-pair relief', card: 'Fake card (dry run).', warnings: [],
        gates: { ...Object.fromEntries(['A1', 'A2', 'A3', 'A5', 'A6', 'A7', 'A9'].map(g => [g, { pass }])), A4: { pass, detail: { okSpares: ok } }, A8: { pass: true, flag: k != null && k <= 6 ? 'spare>=2 only' : null } } };
    },
    screenBoard: require('./screen.js').screenBoard,
    measureCurve: require('./dial_curve.js').measureCurve,
    traceGates: (d, o) => ({ spare: o.spare, pass: hashUnit(Lb.contentKey(d) + o.spare, 'tr') < 0.8, lossesAtTrapShare: 0.6, B7: { maxTarget: null } }),
    c1: (d, o) => CF.c1(d, o),
    c2c3: (d, o) => CF.c2c3(d, { ...o, engineCheck: false }),
    ...over,
  };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    a[k] = v;
  }
  return a;
}
function underHeavy() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'source', 'build', 'heavy.lock', 'owner.json'), 'utf8')).pid === process.ppid; } catch (e) { return false; }
}
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 31).join('\n') +
    '\nOptions: --n 50 --start <i|auto> --seed-base 1 --targets lo,hi --skilled-floor 2.5 --gate-profile e5-v1|strict-v1 --mode visibleChoice --max-minutes 18 --lib <dir> --briefs <file> --dry-run --no-heavy-check'); return; }
  const dry = !!a['dry-run'];
  const libDir = a.lib || (dry ? path.join(os.tmpdir(), 'oma-pipeline-dry-' + process.pid) : Lb.LIB_DIR);
  const lib = Lb.createLibrary({ dir: libDir });
  const seedBase = +(a['seed-base'] ?? DEFAULTS.seedBase);
  let start = a.start === undefined ? 0 : a.start;
  if (start === 'auto') {
    const floor = +(a['skilled-floor'] ?? DEFAULTS.skilledFloor), targets = a.targets ? String(a.targets).split(',').map(Number) : DEFAULTS.targets;
    const runs = Lb.readJsonl(path.join(libDir, 'pipeline-runs.jsonl')).filter(r => !!r.dryRun === dry && (r.options?.seedBase ?? 1) === seedBase
      && r.pipeline === pipelineVersion({ skilledFloor: floor, targets, gateProfile: a['gate-profile'] || DEFAULTS.gateProfile,
    mode: a.mode || (a['visible-choice'] ? 'visibleChoice' : DEFAULTS.mode) }) && JSON.stringify(r.options?.targets) === JSON.stringify(targets));
    start = runs.length ? Math.max(...runs.map(r => r.next)) : 0;
  }
  const opts = {
    n: +(a.n ?? DEFAULTS.n), start: +start, seedBase, maxMinutes: +(a['max-minutes'] ?? DEFAULTS.maxMinutes), dryRun: dry,
    targets: a.targets ? String(a.targets).split(',').map(Number) : DEFAULTS.targets,
    skilledFloor: +(a['skilled-floor'] ?? DEFAULTS.skilledFloor),
    gateProfile: a['gate-profile'] || DEFAULTS.gateProfile,
    mode: a.mode || (a['visible-choice'] ? 'visibleChoice' : DEFAULTS.mode),
  };
  const B = require('../builder.js');
  let deps;
  if (dry) deps = fakeDeps();
  else {
    if (!underHeavy() && !a['no-heavy-check']) {
      console.error('run_pipeline.js rates boards with bots: launch it through heavy.js\n  node source/tools/builder/loop/heavy.js --label pipeline -- node source/tools/builder/loop/run_pipeline.js ...\nor pass --dry-run.');
      process.exit(65);
    }
    const CF = require('./counterfactual.js');
    const ys = CF.rulerYardstick();   // the pinned ruler; the fast key-memory bot stands in for its zero-drift slow predecessor
    if (ys.rulerNote) console.error('[pipeline] ' + ys.rulerNote);
    deps = {
      ys,
      staticGates: require('./static_gates.js').staticGates,
      screenBoard: require('./screen.js').screenBoard,
      measureCurve: require('./dial_curve.js').measureCurve,
      traceGates: require('./traces.js').traceGates,
      c1: CF.c1, c2c3: CF.c2c3,
    };
  }
  deps.build = brief => B.build(opts.mode ? { ...brief, mode: opts.mode } : brief, opts.mode ? { mode: opts.mode } : {});
  deps.briefs = JSON.parse(fs.readFileSync(a.briefs || BRIEFS, 'utf8'));
  deps.library = lib; deps.code = codeFingerprints();
  const s = runPipeline(opts, deps);
  console.log(s.text);
  console.log(`Library: ${lib.files.library} (${lib.entries().length} entries); rejects: ${lib.rejects().length}; run log: ${path.join(libDir, 'pipeline-runs.jsonl')}`);
}
if (require.main === module) main();

module.exports = { runPipeline, processCandidate, candidateBriefs, candidateAt, fakeDeps, fakeMeasure, summaryText, newStats, codeFingerprints, EXCLUDED_STORIES, STEPS, VERSION, DEFAULTS };
