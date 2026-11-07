'use strict';
const assert = require('assert/strict'), crypto = require('crypto'), { performance } = require('perf_hooks');
const { normalizeBoard } = require('./public_board_input.js');
const { campaign } = require('./human_style_environment.js');
const defaults = require('./human_style_profiles.json');
const { createFactoryController: createRefFactoryController } = require('./human_factory_controller.js');
const { createFastPlannerController } = require('./human_planner_controller_fast.js');
const release = require('./human_release.js');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function estimateDifficulty(campaigns) {
  const N = campaigns.length;
  let clearedSum = 0, unclearedCount = 0;
  for (const c of campaigns) {
    if (c.wonOn !== null) { clearedSum += c.wonOn; }
    else { unclearedCount++; }
  }
  const firstWins = campaigns.filter(c => c.wonOn === 1).length, firstTryRate = firstWins / N;
  if (unclearedCount === 0) {
    const exp = clearedSum / N;
    const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 4.8 ? 'right' : 'hard';
    return { expectedTries: Number(exp.toFixed(2)), label };
  }
  const exp = (clearedSum + campaigns.filter(c => c.wonOn === null).reduce((t, c) => t + c.attempts.length, 0)) / N;
  const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 5.0 ? 'right' : 'hard';
  return { expectedTries: Number(exp.toFixed(2)), label };
}

function measureHuman(board, options = {}) {
  if (options.setting !== 'planner' || options.plannerStyle !== undefined) return measureOne(board, options);
  const seed = options.seed ?? crypto.randomBytes(4).readUInt32LE();
  const route = measureOne(board, { ...options, seed, plannerStyle: 'route' });
  const plain = measureOne(board, { ...options, seed, plannerStyle: 'plain' });
  const best = route.expectedTries <= plain.expectedTries ? route : plain;
  return {
    ...best,
    plannerStyles: { route: route.expectedTries, plain: plain.expectedTries },
    valid: route.valid && plain.valid,
    ...(options.allResults ? { plannerResultsBySeed: { route: route.resultsBySeed, plain: plain.resultsBySeed } } : {}),
  };
}

function measureOne(board, options = {}) {
  assert(Object.keys(options).every(key => ['runs', 'seed', 'maxAttempts', 'profiles', 'capture', 'choiceLimit', 'setting', 'seeds', 'plannerStyle', 'fast', 'auditRate', 'allResults'].includes(key)));
  const { runs = 20, maxAttempts = 20, profiles = defaults, capture = false, choiceLimit = 1024, seeds = 2, fast = true, auditRate = 0.01, allResults = false } = options;
  const seed = options.seed ?? crypto.randomBytes(4).readUInt32LE();
  assert(Number.isInteger(runs) && runs > 0 && runs <= 1000 && Number.isInteger(seed));
  assert(Number.isInteger(maxAttempts) && maxAttempts > 0 && maxAttempts <= 40);
  assert(Number.isInteger(choiceLimit) && choiceLimit > 0);
  assert(Number.isInteger(seeds) && seeds >= 1 && seeds <= 10);
  assert(typeof fast === 'boolean' && typeof allResults === 'boolean' && Number.isFinite(auditRate) && auditRate >= 0 && auditRate <= 1);
  assert.deepEqual(Object.keys(profiles).sort(), ['Dennis', 'family']);
  assert(options.setting === undefined || ['dennis', 'family', 'planner'].includes(options.setting));

  const PLANNER = {
    spotPenalty: 200, lookDepth: 2, lookPenalty: 150, lookFrom: 1, pairFirst: 100,
    freePeekBonus: 70, clockNeedFull: 1, routePlan: 300, routeBeam: 300,
    routeNeed: 1, routeNeedTray: 2, routeNeedSlack: 99,
  };
  const pick = options.setting === 'family' ? 'family' : 'Dennis';
  const encoded = normalizeBoard(board), start = performance.now(), settings = {};
  const releasedProfiles = release.profiles;
  const selectedProfiles = options.setting && !options.profiles ? releasedProfiles : profiles;
  const isReleased = Object.entries(releasedProfiles).every(([name, reference]) => Object.keys(selectedProfiles[name]).length === Object.keys(reference).length && Object.entries(reference).every(([key, value]) => selectedProfiles[name][key] === value));
  const campaignOpts = {
    maxAttempts,
    capture,
    choiceLimit,
    fast,
    auditRate,
    ...(options.setting ? { controllerFactory: fast ? createFastPlannerController : createRefFactoryController } : {}),
  };

  for (let [name, profile] of Object.entries(selectedProfiles)) {
    if (options.setting && name !== pick) continue;
    if (options.setting === 'planner') profile = { ...profile, ...PLANNER, ...(options.plannerStyle === 'plain' ? { routeNeed: 0 } : {}) };
    const started = performance.now(), firstBlock = [], pooled = [], subBlocks = [];
    for (let run = 0; run < runs; run++) firstBlock.push(campaign(encoded, profile, (seed + Math.imul(run + 1, 0x9e3779b9)) | 0, campaignOpts));
    pooled.push(...firstBlock);
    subBlocks.push(firstBlock);
    for (let s = 1; s < seeds; s++) {
      const seedS = (seed + s * 7919) | 0;
      const block = [];
      for (let run = 0; run < runs; run++) {
        const c = campaign(encoded, profile, (seedS + Math.imul(run + 1, 0x9e3779b9)) | 0, campaignOpts);
        block.push(c);
        pooled.push(c);
      }
      subBlocks.push(block);
    }
    const phases = { clock: 0, mid: 0, late: 0 }, firstTryWins = firstBlock.filter(r => r.wonOn === 1).length;
    const firstTryCensored = firstBlock.filter(r => r.attempts[0].censored).length;
    for (const r of firstBlock) for (const a of r.attempts) if (a.phase) phases[a.phase]++;
    const timingCounts = { beforeClock: 0, clockContact: 0, mid: 0, late: 0 };
    for (const r of firstBlock) for (const a of r.attempts) if (a.clockTiming) timingCounts[a.clockTiming]++;
    const losses = Object.values(phases).reduce((a, b) => a + b, 0), cleared = firstBlock.filter(r => r.wonOn !== null);
    const diff = estimateDifficulty(pooled);
    settings[name] = {
      firstTryRate: firstTryCensored ? null : firstTryWins / runs, firstTryWins, firstTryCensored, runs,
      averageTries: cleared.length === runs ? cleared.reduce((a, r) => a + r.wonOn, 0) / runs : null,
      averageTriesAmongCleared: cleared.length ? cleared.reduce((a, r) => a + r.wonOn, 0) / cleared.length : null,
      expectedTries: diff.expectedTries, label: diff.label,
      cleared: cleared.length, censoredCampaigns: firstBlock.filter(r => r.attempts.some(a => a.censored)).length,
      unclearedAtAttemptLimit: firstBlock.filter(r => r.wonOn === null && !r.attempts.some(a => a.censored)).length,
      lossTiming: { counts: timingCounts, shares: Object.fromEntries(Object.entries(timingCounts).map(([k, n]) => [k, losses ? n / losses : null])), clockContactMaxRemovedTiles: 2 },
      lossCounts: phases, lossShares: Object.fromEntries(Object.entries(phases).map(([key, n]) => [key, losses ? n / losses : null])),
      slowestMove: Math.max(...firstBlock.map(r => r.slowestMove)), verifiedTaps: firstBlock.reduce((a, r) => a + r.verifiedTaps, 0),
      minutesPerBoard: (performance.now() - started) / 60000,
      results: allResults ? pooled : firstBlock,
      ...(allResults ? { resultsBySeed: subBlocks.map(blk => blk.map(r => ({ wonOn: r.wonOn, tries: r.wonOn ?? r.attempts.length }))) } : {}),
    };
  }
  if (options.setting) {
    const r = settings[pick];
    return {
      firstTryRate: r.firstTryRate, averageTries: r.averageTries, expectedTries: r.expectedTries, label: r.label,
      lossPhase: { beforeClock: r.lossShares.clock, mid: r.lossShares.mid, late: r.lossShares.late },
      runs, slowestMove: r.slowestMove, minutes: r.minutesPerBoard,
      version: isReleased ? release.version : 'human-v1-development',
      calibrationStatus: isReleased ? release.calibrationStatus : 'experimental-not-calibrated',
      valid: r.slowestMove < 2000 && r.censoredCampaigns === 0,
      seed, boardHash: hash(encoded), profileHash: hash(selectedProfiles), ...r,
    };
  }
  return {
    schema: 'human-style-measure-v1', calibrationStatus: 'experimental-not-calibrated',
    seed, runs, maxAttempts, boardHash: hash(encoded), profileHash: hash(profiles),
    lateDefinition: 'after clock, at most 10 tiles remaining', settings,
    minutesPerBoard: (performance.now() - start) / 60000,
    valid: Object.values(settings).every(s => s.slowestMove < 2000 && s.censoredCampaigns === 0),
  };
}

module.exports = { measureHuman, estimateDifficulty };
if (require.main === module) {
  const fs = require('fs'), input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  process.stdout.write(JSON.stringify(measureHuman(input, { runs: Number(process.argv[3] ?? 20), setting: process.argv[4] ?? 'planner' }), null, 2) + '\n');
}
