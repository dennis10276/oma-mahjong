'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const { normalizeBoard } = require('../../tools/sim/refit/public_board_input.js');
const { campaign } = require('../../tools/sim/refit/human_style_environment.js');
const defaults = require('../../tools/sim/refit/human_style_profiles.json');
const { createCandidatePlannerController } = require('./candidate_controller.js');

const VERSION = 'skilled-b2-candidate-v1';

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function estimateDifficulty(campaigns, capFallback = 20) {
  const N = campaigns.length;
  let clearedSum = 0, unclearedCount = 0, unclearedAttempts = 0;
  for (const c of campaigns) {
    if (c.wonOn !== null && c.wonOn !== undefined) {
      clearedSum += c.wonOn;
    } else {
      unclearedCount++;
      unclearedAttempts += (c.attempts ? c.attempts.length : capFallback);
    }
  }
  const firstWins = campaigns.filter(c => c.wonOn === 1).length;
  const firstTryRate = firstWins / N;
  if (unclearedCount === 0) {
    const exp = clearedSum / N;
    const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 4.8 ? 'right' : 'hard';
    return { expectedTries: Number(exp.toFixed(2)), label };
  }
  const exp = (clearedSum + unclearedAttempts) / N;
  const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 5.0 ? 'right' : 'hard';
  return { expectedTries: Number(exp.toFixed(2)), label };
}

function measureHuman(board, options = {}) {
  const setting = options.setting ?? 'planner';
  if (setting !== 'planner' || options.plannerStyle !== undefined) {
    return measureOne(board, { ...options, setting });
  }

  const seed = options.seed ?? crypto.randomBytes(4).readUInt32LE();
  const startBoth = performance.now();
  const route = measureOne(board, { ...options, seed, setting, plannerStyle: 'route' });
  const plain = measureOne(board, { ...options, seed, setting, plannerStyle: 'plain' });
  const totalBothMinutes = (performance.now() - startBoth) / 60000;

  const best = route.expectedTries <= plain.expectedTries ? route : plain;
  return {
    ...best,
    plannerStyles: { route: route.expectedTries, plain: plain.expectedTries },
    plannerTiming: {
      routeMinutes: route.minutes,
      plainMinutes: plain.minutes,
      totalMinutes: totalBothMinutes,
    },
    valid: route.valid && plain.valid,
    plannerResultsBySeed: { route: route.resultsBySeed, plain: plain.resultsBySeed },
    ...(options.allResults ? {
      plannerCampaigns: {
        route: route.results,
        plain: plain.results,
      }
    } : {}),
  };
}

function measureOne(board, options = {}) {
  assert(Object.keys(options).every(key =>
    ['runs', 'seed', 'maxAttempts', 'profiles', 'capture', 'choiceLimit', 'setting', 'seeds', 'plannerStyle', 'fast', 'auditRate', 'allResults', 'kLim', 'trayDepth', 'lookDepth'].includes(key)
  ));
  const {
    runs = 20, maxAttempts = 20, profiles = defaults, capture = false,
    choiceLimit = 1024, seeds = 2, fast = true, auditRate = 0.01, allResults = false,
  } = options;
  const seed = options.seed ?? crypto.randomBytes(4).readUInt32LE();
  assert(Number.isInteger(runs) && runs > 0 && runs <= 1000 && Number.isInteger(seed));
  assert(Number.isInteger(maxAttempts) && maxAttempts > 0 && maxAttempts <= 40);
  assert(Number.isInteger(choiceLimit) && choiceLimit > 0);
  assert(Number.isInteger(seeds) && seeds >= 1 && seeds <= 10);
  assert(typeof fast === 'boolean' && typeof allResults === 'boolean' && Number.isFinite(auditRate) && auditRate >= 0 && auditRate <= 1);

  const setting = options.setting ?? 'planner';
  assert(['dennis', 'family', 'planner'].includes(setting));

  const CANDIDATE_PLANNER = {
    spotPenalty: 200, lookDepth: options.lookDepth ?? 2, lookPenalty: 150, lookFrom: 1, pairFirst: 100,
    freePeekBonus: 70, clockNeedFull: 1, routePlan: 300, routeBeam: 300,
    routeNeed: 1, routeNeedTray: 2, routeNeedSlack: 99,
    kLim: options.kLim ?? 16,
    trayDepth: options.trayDepth ?? 4,
  };

  const pick = setting === 'family' ? 'family' : 'Dennis';
  const encoded = normalizeBoard(board);
  const start = performance.now();
  const settings = {};

  const release = require('../../tools/sim/refit/human_release.js');
  const releasedProfiles = release.profiles;
  const selectedProfiles = options.setting && !options.profiles ? releasedProfiles : profiles;

  const campaignOpts = {
    maxAttempts,
    capture,
    choiceLimit,
    fast,
    auditRate,
    controllerFactory: createCandidatePlannerController,
  };

  for (let [name, profile] of Object.entries(selectedProfiles)) {
    if (name !== pick) continue;
    if (setting === 'planner') {
      profile = {
        ...profile,
        ...CANDIDATE_PLANNER,
        ...(options.plannerStyle === 'plain' ? { routeNeed: 0 } : {}),
      };
    }
    const started = performance.now();
    const subBlocks = [];
    const pooled = [];

    for (let s = 0; s < seeds; s++) {
      const seedS = (seed + s * 7919) | 0;
      const block = [];
      for (let run = 0; run < runs; run++) {
        const c = campaign(encoded, profile, (seedS + Math.imul(run + 1, 0x9e3779b9)) | 0, campaignOpts);
        block.push(c);
        pooled.push(c);
      }
      subBlocks.push(block);
    }

    const totalCampaigns = pooled.length;
    const phases = { clock: 0, mid: 0, late: 0 };
    const timingCounts = { beforeClock: 0, clockContact: 0, mid: 0, late: 0 };
    for (const r of pooled) {
      for (const a of r.attempts) {
        if (a.phase) phases[a.phase]++;
        if (a.clockTiming) timingCounts[a.clockTiming]++;
      }
    }
    const losses = Object.values(phases).reduce((a, b) => a + b, 0);

    const cleared = pooled.filter(r => r.wonOn !== null);
    const firstTryWins = pooled.filter(r => r.wonOn === 1).length;
    const censoredCampaigns = pooled.filter(r => r.attempts.some(a => a.censored)).length;
    const unclearedAtAttemptLimit = pooled.filter(r => r.wonOn === null && !r.attempts.some(a => a.censored)).length;
    const slowestMove = Math.max(...pooled.map(r => r.slowestMove));
    const verifiedTaps = pooled.reduce((a, r) => a + r.verifiedTaps, 0);
    const diff = estimateDifficulty(pooled, maxAttempts);

    settings[name] = {
      firstTryRate: censoredCampaigns ? null : firstTryWins / totalCampaigns,
      firstTryWins,
      censoredCampaigns,
      totalCampaigns,
      runsPerBlock: runs,
      seedBlocks: seeds,
      averageTries: cleared.length === totalCampaigns ? cleared.reduce((a, r) => a + r.wonOn, 0) / totalCampaigns : null,
      averageTriesAmongCleared: cleared.length ? cleared.reduce((a, r) => a + r.wonOn, 0) / cleared.length : null,
      expectedTries: diff.expectedTries,
      label: diff.label,
      cleared: cleared.length,
      unclearedAtAttemptLimit,
      lossTiming: {
        counts: timingCounts,
        shares: Object.fromEntries(Object.entries(timingCounts).map(([k, n]) => [k, losses ? n / losses : null])),
        clockContactMaxRemovedTiles: 2
      },
      lossCounts: phases,
      lossShares: Object.fromEntries(Object.entries(phases).map(([key, n]) => [key, losses ? n / losses : null])),
      slowestMove,
      verifiedTaps,
      minutesPerBoard: (performance.now() - started) / 60000,
      results: allResults ? pooled : pooled.slice(0, runs),
      resultsBySeed: subBlocks.map((blk, sIdx) => {
        const blkSeed = (seed + sIdx * 7919) | 0;
        const blkCleared = blk.filter(r => r.wonOn !== null).length;
        const blkFirstWins = blk.filter(r => r.wonOn === 1).length;
        const blkUncleared = blk.filter(r => r.wonOn === null).length;
        return {
          seed: blkSeed,
          firstTryWins: blkFirstWins,
          cleared: blkCleared,
          uncleared: blkUncleared,
          runs: blk.map(r => ({ wonOn: r.wonOn, tries: r.wonOn ?? r.attempts.length })),
        };
      }),
      effectiveProfile: profile,
      effectiveProfileHash: hash(profile),
    };
  }

  const r = settings[pick];
  return {
    firstTryRate: r.firstTryRate,
    firstTryWins: r.firstTryWins,
    averageTries: r.averageTries,
    expectedTries: r.expectedTries,
    label: r.label,
    lossPhase: { beforeClock: r.lossShares.clock, mid: r.lossShares.mid, late: r.lossShares.late },
    totalCampaigns: r.totalCampaigns,
    runsPerBlock: r.runsPerBlock,
    seedBlocks: r.seedBlocks,
    cleared: r.cleared,
    unclearedAtAttemptLimit: r.unclearedAtAttemptLimit,
    censoredCampaigns: r.censoredCampaigns,
    slowestMove: r.slowestMove,
    minutes: r.minutesPerBoard,
    version: VERSION,
    calibrationStatus: 'candidate-experimental-b2',
    valid: r.slowestMove < 2000 && r.censoredCampaigns === 0,
    seed,
    boardHash: hash(encoded),
    profileHash: r.effectiveProfileHash,
    effectiveProfile: r.effectiveProfile,
    ...r,
  };
}

module.exports = { measureHuman, estimateDifficulty, VERSION };

if (require.main === module) {
  const fs = require('fs');
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  process.stdout.write(JSON.stringify(measureHuman(input, {
    runs: Number(process.argv[3] ?? 20),
    setting: process.argv[4] ?? 'planner',
  }), null, 2) + '\n');
}
