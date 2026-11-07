'use strict';
// The pinned ruler (process-design-synthesis.md sections 2 and 6 step 0e).
//
//   const ys = createYardstick();                 // loads library/yardstick.json, refuses a changed bot
//   ys.rate(design, { block: 'CURVE' })           // -> { D, pHat, se, n, perCampaign, fingerprint, ... }
//   ys.rate(design, { bot: 'reference' })         // counterfactual reference family bot (gate C1)
//   ys.rateCalls(design, calls, { bot })          // any explicit list of meter calls (screen.js chunks)
//   ys.planner(design, { spare: 2 })              // -> { S, styles, valid, fingerprint }
//   ys.accept(design, target, tol)                // sequential acceptance on fresh ACCEPT blocks (ledgered)
//
// Family ruler: createMeter({botVersion:'family-key-memory-v1-fast'}). Old ratings of the slow bot
// (5372bd4e...) and Codex's d362e85f... are reused by meter.measure itself (FAMILY_CACHE_MIGRATIONS).
//
// D is the meter's expectedTries (a campaign not won in 20 tries counts as 20), pooled over the
// block's meter calls with equal weights, exactly as production pooled 4711 and 18427
// (batch_evaluate.js: {setting:'family', runs:20, seeds:2, seed}). The meter returns per-campaign
// results only for the first sub-block of each call, so the SE is the sample SD of the visible
// campaigns divided by sqrt(all campaigns in the block).
const fs = require('fs'), path = require('path');
const M = require('../../factory/meter.js');
const K = require('../knobs.js');

const PINS_FILE = path.resolve(__dirname, '../../../analysis/builder/library/yardstick.json');
const LEDGER_FILE = path.resolve(__dirname, '../../../analysis/builder/library/accept-ledger.json');
const CACHE_DIR = path.resolve(__dirname, '../../../build/factory-cache');
const PHI = 0x9e3779b9; // the bots' per-run seed stride: campaign r of a call uses (seed + imul(r + 1, PHI)) | 0

const loadPins = (file = PINS_FILE) => JSON.parse(fs.readFileSync(file, 'utf8'));
const tolerance = (T, pins) => {
  const t = pins?.tolerance?.level || { abs: 1, rel: 0.10 };
  return Math.max(t.abs, t.rel * T);
};

// The meter calls that make up a block. ACCEPT block j is its own call and is never shared.
function blockCalls(pins, block, { campaigns, startBlock = 0, runs } = {}) {
  const b = pins.blocks[block];
  if (!b) throw Error('Unknown block ' + block);
  let calls;
  if (block === 'ACCEPT') {
    const per = b.blockCampaigns, count = campaigns === undefined ? 1 : campaigns / per;
    if (!Number.isInteger(count) || count < 1) throw Error(`ACCEPT campaigns must be a multiple of ${per}`);
    calls = Array.from({ length: count }, (_, i) => ({ runs: b.runs, seeds: b.seeds, seed: b.firstSeed + b.seedStep * (startBlock + i) }));
  } else {
    calls = b.calls.map(c => ({ ...c }));
    if (campaigns !== undefined) {
      const kept = [];
      let n = 0;
      for (const c of calls) { if (n >= campaigns) break; kept.push(c); n += c.runs * c.seeds; }
      if (n !== campaigns) throw Error(`${block} campaigns must be a prefix of its calls (${calls.map(c => c.runs * c.seeds).join(' + ')})`);
      calls = kept;
    }
  }
  // runs override: smoke tests only; never a value of record.
  if (runs !== undefined) calls = calls.map(c => ({ ...c, runs }));
  return calls;
}

// Split a one-seed call {runs, seeds:1, seed} into calls of `chunk` campaigns that play exactly the
// same campaigns: campaign c of chunk j is campaign j*chunk + c of the whole call.
function splitCall(call, chunk) {
  if (call.seeds !== 1) throw Error('splitCall needs seeds: 1 (the second sub-block seed is not a run shift)');
  if (!Number.isInteger(chunk) || chunk < 1 || call.runs % chunk) throw Error('chunk must divide runs');
  return Array.from({ length: call.runs / chunk }, (_, j) => ({ ...call, runs: chunk, seed: (call.seed + Math.imul(j * chunk, PHI)) | 0 }));
}

const triesOf = r => r.wonOn ?? r.attempts.length;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
function sampleSd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

// Summarise the meter results of one block. An unwon campaign counts as the cap (also a campaign the
// bot stopped early: the meter then marks the whole rating invalid, which callers must respect).
function summarize(measurements, calls, cap = 20) {
  const n = calls.reduce((s, c) => s + c.runs * c.seeds, 0);
  const perCampaign = [], visible = [];
  for (const m of measurements) for (const r of m.results || []) { perCampaign.push(r.wonOn == null ? cap : Math.min(cap, r.wonOn)); visible.push(r); }
  // Equal weights per call (all calls of one block have the same size).
  const D = Math.min(cap, mean(measurements.map(m => m.expectedTries)));
  const wins = visible.filter(r => r.wonOn != null).length, attempts = visible.reduce((s, r) => s + triesOf(r), 0);
  const phases = measurements.map(m => m.lossPhase).filter(Boolean);
  const lossPhase = phases.length ? Object.fromEntries(['beforeClock', 'mid', 'late'].map(k => {
    const v = phases.map(p => p[k]).filter(x => x != null);
    return [k, v.length ? mean(v) : null];
  })) : null;
  return {
    D, pHat: attempts ? wins / attempts : null,
    se: sampleSd(perCampaign) / Math.sqrt(n), seGeometric: Math.sqrt(Math.max(0, D * (D - 1)) / n),
    n, nVisible: perCampaign.length, perCampaign,
    uncleared: visible.filter(r => r.wonOn == null).length,
    valid: measurements.every(m => m.valid === true),
    lossPhase,
    calls: measurements.map((m, i) => ({ ...calls[i], exp: m.expectedTries, first: m.firstTryRate, valid: m.valid }))
  };
}

// Puzzle identity for the ACCEPT ledger: the board without its clock budget (all spares of one puzzle).
const puzzleKey = d => { const b = M.boardOf(d); return M.digest({ ...b, clock: b.clock ? { ...b.clock, n: null } : null }); };

function createLedger(file) {
  const empty = () => ({ schema: 'accept-ledger-v1', note: 'ACCEPT blocks used per puzzle (yardstick.js accept). A block listed here is never measured again for that puzzle.', puzzles: {} });
  const read = () => file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : empty();
  let mem = empty();
  const load = () => (file ? read() : mem);
  const save = v => { if (file) M.atomicJson(file, v); else mem = v; };
  const used = key => (load().puzzles[key]?.entries || []).map(e => e.reserved);
  const nextBlock = key => used(key).reduce((m, [, b]) => Math.max(m, b), 0);
  function reserve(key, from, to, info) {
    const v = load(), p = v.puzzles[key] || (v.puzzles[key] = { entries: [] });
    for (const [a, b] of p.entries.map(e => e.reserved)) if (from < b && a < to) throw Error(`ACCEPT blocks [${from}, ${to}) overlap used blocks [${a}, ${b}) of puzzle ${key.slice(0, 12)}; fresh blocks are never reused`);
    const entry = { id: require('crypto').randomUUID(), reserved: [from, to], status: 'reserved', at: new Date().toISOString(), ...info };
    p.entries.push(entry); save(v);
    return entry.id;
  }
  function finish(key, id, result) {
    const v = load(), e = v.puzzles[key]?.entries.find(x => x.id === id);
    if (!e) throw Error('ledger entry vanished for puzzle ' + key.slice(0, 12));
    Object.assign(e, result, { status: 'done' }); save(v);
  }
  return { file, load, used, nextBlock, reserve, finish };
}

function createYardstick(opts = {}) {
  const pins = opts.pins || loadPins(opts.pinsFile);
  // An injected measure() has no disk cache unless one is named.
  const cacheDir = opts.cacheDir === false || (opts.measure && opts.cacheDir === undefined) ? null : path.resolve(opts.cacheDir || CACHE_DIR);
  let meters;
  if (opts.measure) {
    // Injected measure(board, settings, botName) for tests; fingerprints default to the pins.
    const fp = opts.fingerprints || {};
    meters = {
      family: { measure: (b, s) => opts.measure(b, s, 'family'), fingerprint: fp.family ?? pins.family.fingerprint },
      reference: { measure: (b, s) => opts.measure(b, s, 'reference'), fingerprint: fp.reference ?? pins.reference.fingerprint }
    };
  } else {
    const meterOpts = { cacheDir: cacheDir || false };
    meters = opts.meters || {
      family: M.createMeter({ ...meterOpts, botVersion: pins.family.botVersion }),
      reference: M.createMeter({ ...meterOpts, ...(pins.reference.fast === false ? { fast: false } : {}) })
    };
  }
  const mismatch = [];
  if (meters.family.fingerprint !== pins.family.fingerprint) mismatch.push(`family ${meters.family.fingerprint} != pin ${pins.family.fingerprint}`);
  if (meters.reference.fingerprint !== pins.reference.fingerprint) mismatch.push(`reference ${meters.reference.fingerprint} != pin ${pins.reference.fingerprint}`);
  if (meters.reference.fingerprint !== pins.planner.fingerprint) mismatch.push(`planner ${meters.reference.fingerprint} != pin ${pins.planner.fingerprint}`);
  if (mismatch.length && !opts.allowNewFingerprint)
    throw Error('Yardstick refuses a changed bot (pass allowNewFingerprint to measure anyway; numbers will not be comparable): ' + mismatch.join('; '));
  // ledgerFile: path, or false for an in-memory ledger (tests). Injected meters default to in-memory.
  const ledger = createLedger(opts.ledgerFile === false || (opts.ledgerFile === undefined && (opts.measure || opts.meters)) ? null
    : path.resolve(opts.ledgerFile || LEDGER_FILE));
  const stats = { calls: 0, cachedVariant: 0 };

  // Is there a rating on disk the meter will return for these settings (its own key, or an approved
  // migration source with valid === true; the meter applies migrations for setting 'family' only)?
  function onDisk(bot, design, settings) {
    if (!cacheDir) return false;
    const fp = meters[bot].fingerprint, input = M.boardOf(design);
    const file = f => path.join(cacheDir, M.digest({ fingerprint: f, input, settings }) + '.json');
    if (fs.existsSync(file(fp))) return true;
    if (settings.setting !== 'family') return false;
    return (M.FAMILY_CACHE_MIGRATIONS[fp] || []).some(prior => {
      if (!fs.existsSync(file(prior))) return false;
      try { return JSON.parse(fs.readFileSync(file(prior), 'utf8')).valid === true; } catch { return false; }
    });
  }

  // One meter call. Production rated some calls with capture:'tail' (part of the cache key, not of
  // the rating); such a cached variant is used instead of measuring again.
  function call(bot, design, settings, alternatives = []) {
    stats.calls++;
    if (cacheDir && !opts.measure) {
      for (const a of alternatives) {
        const variant = { ...settings, ...a };
        if (!onDisk(bot, design, settings) && onDisk(bot, design, variant)) { stats.cachedVariant++; return meters[bot].measure(design, variant); }
      }
    }
    return meters[bot].measure(design, settings);
  }

  function rateCalls(design, calls, { bot = 'family', block = 'custom', alternatives = [] } = {}) {
    if (!['family', 'reference'].includes(bot)) throw Error('Unknown bot ' + bot);
    const measurements = calls.map(c => call(bot, design, { setting: 'family', ...c }, alternatives));
    return { block, bot, ...summarize(measurements, calls, pins.cap), measurements,
      fingerprint: meters[bot].fingerprint, ...(mismatch.length ? { fingerprintMismatch: mismatch } : {}) };
  }

  function rate(design, { block = 'CURVE', campaigns, startBlock = 0, bot = 'family', runs } = {}) {
    const calls = blockCalls(pins, block, { campaigns, startBlock, runs });
    const r = rateCalls(design, calls, { bot, block, alternatives: pins.blocks[block].cacheAlternatives || [] });
    delete r.measurements;
    return { ...r, startBlock: block === 'ACCEPT' ? startBlock : undefined };
  }

  // Whether a block's ratings (or an explicit list of calls) are all cached (no bot time needed).
  const cached = (design, block = 'CURVE', bot = 'family') => {
    const calls = Array.isArray(block) ? block : blockCalls(pins, block);
    const alts = Array.isArray(block) ? pins.blocks.CURVE.cacheAlternatives || [] : pins.blocks[block].cacheAlternatives || [];
    return calls.every(c => { const s = { setting: 'family', ...c }; return onDisk(bot, design, s) || alts.some(a => onDisk(bot, design, { ...s, ...a })); });
  };

  function planner(design, { spare = null } = {}) {
    let d = design;
    if (spare !== null) {
      const t = K.clockSpare(design, spare);
      if (t.fail) return { S: null, valid: false, fail: t.fail, spare };
      d = t.design;
    }
    const m = call('reference', d, { ...pins.planner.settings });
    return { S: m.expectedTries, styles: m.plannerStyles || null, valid: m.valid === true, firstTryRate: m.firstTryRate,
      spare, clockN: d.clock?.n ?? null, settings: pins.planner.settings, fingerprint: meters.reference.fingerprint };
  }

  // Sequential acceptance (section 2): 160 fresh campaigns; accept within 0.6 tol, refuse beyond
  // 2.5 tol, otherwise add 160 more and accept only within tol. The ledger reserves all blocks the
  // decision may need before the first rating, so a crash can never lead to a reused block.
  function accept(design, target, tol, { startBlock, runs, note } = {}) {
    const a = pins.acceptance, per = pins.blocks.ACCEPT.blockCampaigns;
    tol = tol ?? tolerance(target, pins);
    const key = puzzleKey(design), first = a.startCampaigns / per, all = a.maxCampaigns / per;
    if (startBlock === undefined) startBlock = ledger.nextBlock(key);
    const ledgerId = ledger.reserve(key, startBlock, startBlock + all, { clockN: design.clock?.n ?? null, target, tol,
      fingerprint: meters.family.fingerprint, ...(runs !== undefined ? { runsOverride: runs } : {}), ...(note ? { note } : {}) });
    const history = [], measurements = [], calls = [];
    const look = (from, count) => {
      const c = blockCalls(pins, 'ACCEPT', { campaigns: count * per, startBlock: from, runs });
      const r = rateCalls(design, c, { block: 'ACCEPT' });
      measurements.push(...r.measurements); calls.push(...c);
      const s = summarize(measurements, calls, pins.cap), gap = Math.abs(s.D - target);
      history.push({ n: s.n, D: s.D, se: s.se, gap, valid: s.valid });
      return { s, gap };
    };
    let { s, gap } = look(startBlock, first), decision, stage = 1;
    if (!s.valid) decision = 'invalid';
    else if (gap <= a.acceptGap * tol) decision = 'accept';
    else if (gap > a.refuseGap * tol) decision = 'refuse';
    else {
      stage = 2;
      ({ s, gap } = look(startBlock + first, all - first));
      decision = !s.valid ? 'invalid' : gap <= a.finalGap * tol ? 'accept' : 'refuse';
    }
    const used = [startBlock, startBlock + calls.length];
    const out = { decision, stage, target, tol, D: s.D, se: s.se, pHat: s.pHat, n: s.n, gap, history,
      blocks: used, reserved: [startBlock, startBlock + all], nextBlock: startBlock + all, puzzleKey: key,
      fingerprint: meters.family.fingerprint };
    ledger.finish(key, ledgerId, { decision, stage, D: s.D, se: s.se, n: s.n, measured: used });
    return out;
  }

  return { pins, fingerprint: meters.family.fingerprint, referenceFingerprint: meters.reference.fingerprint,
    mismatch, rate, rateCalls, cached, planner, accept, tolerance: T => tolerance(T, pins), stats, meters, ledger };
}

module.exports = { createYardstick, createLedger, loadPins, blockCalls, splitCall, summarize, tolerance, triesOf, sampleSd, puzzleKey,
  PINS_FILE, LEDGER_FILE, CACHE_DIR, PHI };
