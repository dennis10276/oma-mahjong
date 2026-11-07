'use strict';
// The pinned ruler (process-design-synthesis.md sections 2 and 6 step 0e).
//
//   const ys = createYardstick();                 // loads library/yardstick.json, refuses a changed bot
//   ys.rate(design, { block: 'CURVE' })           // -> { D, pHat, se, n, perCampaign, fingerprint, ... }
//   ys.rate(design, { block: 'ACCEPT', campaigns: 160, startBlock: 0 })
//   ys.rate(design, { bot: 'reference' })         // counterfactual reference family bot (gate C1)
//   ys.planner(design, { spare: 2 })              // -> { S, styles, valid, fingerprint }
//   ys.accept(design, target, tol)                // sequential acceptance on fresh ACCEPT blocks
//
// D is the meter's expectedTries (an unwon campaign counts as all 20 tries it was allowed), pooled
// over the block's meter calls with equal weights, exactly as production pooled 4711 and 18427.
// The meter returns per-campaign results only for the first sub-block of each call, so the SE is
// the sample SD of the visible campaigns divided by sqrt(all campaigns in the block).
const fs = require('fs'), path = require('path');
const M = require('../../factory/meter.js');
const K = require('../knobs.js');

const PINS_FILE = path.resolve(__dirname, '../../../analysis/builder/library/yardstick.json');
const CACHE_DIR = path.resolve(__dirname, '../../../build/factory-cache');

const loadPins = (file = PINS_FILE) => JSON.parse(fs.readFileSync(file, 'utf8'));
const tolerance = (T, pins) => {
  const t = pins?.tolerance?.level || { abs: 1, rel: 0.10 };
  return Math.max(t.abs, t.rel * T);
};

// The meter calls that make up a block. ACCEPT block j uses its own seed and is never shared.
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

const triesOf = r => r.wonOn ?? r.attempts.length;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
function sampleSd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

// Summarise the meter results of one block.
function summarize(measurements, calls, cap = 20) {
  const n = calls.reduce((s, c) => s + c.runs * c.seeds, 0);
  const perCampaign = [], visible = [];
  for (const m of measurements) for (const r of m.results || []) { perCampaign.push(Math.min(cap, triesOf(r))); visible.push(r); }
  const D = mean(measurements.map(m => m.expectedTries));
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

function createYardstick(opts = {}) {
  const pins = opts.pins || loadPins(opts.pinsFile);
  const cacheDir = opts.cacheDir === false ? null : path.resolve(opts.cacheDir || CACHE_DIR);
  let meters;
  if (opts.measure) {
    // Injected measure(board, settings, botName) for tests; fingerprints default to the pins.
    const fp = opts.fingerprints || {};
    meters = {
      family: { measure: (b, s) => opts.measure(b, s, 'family'), fingerprint: fp.family ?? pins.family.fingerprint },
      reference: { measure: (b, s) => opts.measure(b, s, 'reference'), fingerprint: fp.reference ?? pins.reference.fingerprint }
    };
  } else {
    const meterOpts = { ...(cacheDir ? { cacheDir } : { cacheDir: false }) };
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
  const reusePrior = opts.reusePrior ?? pins.family.reusePrior === true;
  const stats = { measured: 0, cachedVariant: 0, priorReused: 0 };

  const onDisk = (fingerprint, design, settings) => cacheDir &&
    fs.existsSync(path.join(cacheDir, M.digest({ fingerprint, input: M.boardOf(design), settings }) + '.json'));
  // The meter's own migration chain (reference bot only) is honoured by meter.measure itself.
  const chain = (bot, fingerprint) => [fingerprint, ...(bot === 'reference' ? M.FAMILY_CACHE_MIGRATIONS[fingerprint] || [] : [])];

  // One meter call. Looks for production's cache variants (capture is part of the cache key, not
  // of the rating) before measuring with the pinned settings.
  function call(bot, design, settings, alternatives = []) {
    const meter = meters[bot];
    if (cacheDir && !opts.measure) {
      for (const variant of [settings, ...alternatives.map(a => ({ ...settings, ...a }))]) {
        if (chain(bot, meter.fingerprint).some(fp => onDisk(fp, design, variant))) {
          if (variant !== settings) stats.cachedVariant++;
          return meter.measure(design, variant);
        }
        if (bot === 'family' && reusePrior) for (const prior of pins.family.priorFingerprints || []) {
          const file = path.join(cacheDir, M.digest({ fingerprint: prior, input: M.boardOf(design), settings: variant }) + '.json');
          if (!fs.existsSync(file)) continue;
          const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (saved.valid === true) { stats.priorReused++; return saved; }
        }
      }
    }
    stats.measured++;
    return meter.measure(design, settings);
  }

  function rate(design, { block = 'CURVE', campaigns, startBlock = 0, bot = 'family', runs } = {}) {
    if (!['family', 'reference'].includes(bot)) throw Error('Unknown bot ' + bot);
    const calls = blockCalls(pins, block, { campaigns, startBlock, runs });
    const alternatives = pins.blocks[block].cacheAlternatives || [];
    const measurements = calls.map(c => call(bot, design, { setting: 'family', ...c }, alternatives));
    return { block, bot, startBlock: block === 'ACCEPT' ? startBlock : undefined, ...summarize(measurements, calls, pins.cap),
      fingerprint: meters[bot].fingerprint, ...(mismatch.length ? { fingerprintMismatch: mismatch } : {}) };
  }

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
  // 2.5 tol, otherwise go to 320 and accept only within tol. Blocks [startBlock, nextBlock) are used up.
  function accept(design, target, tol, { startBlock = 0, runs } = {}) {
    const a = pins.acceptance;
    tol = tol ?? tolerance(target, pins);
    const history = [];
    const look = campaigns => {
      const r = rate(design, { block: 'ACCEPT', campaigns, startBlock, runs });
      const gap = Math.abs(r.D - target);
      history.push({ n: r.n, D: r.D, se: r.se, gap, valid: r.valid });
      return { r, gap };
    };
    let { r, gap } = look(a.startCampaigns), decision, stage = 1;
    if (!r.valid) decision = 'invalid';
    else if (gap <= a.acceptGap * tol) decision = 'accept';
    else if (gap > a.refuseGap * tol) decision = 'refuse';
    else {
      stage = 2;
      ({ r, gap } = look(a.maxCampaigns));
      decision = !r.valid ? 'invalid' : gap <= a.finalGap * tol ? 'accept' : 'refuse';
    }
    return { decision, stage, target, tol, D: r.D, se: r.se, pHat: r.pHat, n: r.n, gap, history,
      blocks: [startBlock, startBlock + r.calls.length], nextBlock: startBlock + r.calls.length,
      fingerprint: r.fingerprint };
  }

  return { pins, fingerprint: meters.family.fingerprint, referenceFingerprint: meters.reference.fingerprint,
    mismatch, rate, planner, accept, tolerance: T => tolerance(T, pins), stats, meters };
}

module.exports = { createYardstick, loadPins, blockCalls, summarize, tolerance, triesOf, sampleSd, PINS_FILE, CACHE_DIR };
