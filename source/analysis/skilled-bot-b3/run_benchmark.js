'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const baseMeasure = require('../../tools/sim/refit/human_planner_measure_fast.js');
const b1Measure = require('../skilled-bot-b1/candidate_measure.js');
const b2Measure = require('../skilled-bot-b2/candidate_measure.js');
const b3Measure = require('./candidate_measure.js');

const MANIFEST_FILE = path.join(__dirname, 'benchmark_manifest.json');
const OUT_DIR = path.join(__dirname, 'results');
const OUT_FILE = path.join(OUT_DIR, 'b3_benchmark_results.json');
const B2_PRIOR_FILE = path.join(__dirname, '..', 'skilled-bot-b2', 'results', 'b2_benchmark_results.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

function poolCampaigns(campaigns, maxAttempts = 20) {
  const N = campaigns.length;
  if (N === 0) return { expectedTries: 0, firstTryRate: 0, firstTryWins: 0, uncleared: 0, censored: 0, cleared: 0, totalCampaigns: 0 };
  let clearedSum = 0, unclearedCount = 0, unclearedAttempts = 0, censoredCount = 0;
  for (const c of campaigns) {
    if (c.attempts && c.attempts.some(a => a.censored)) {
      censoredCount++;
    }
    if (c.wonOn !== null && c.wonOn !== undefined) {
      clearedSum += c.wonOn;
    } else {
      unclearedCount++;
      unclearedAttempts += (c.attempts ? c.attempts.length : maxAttempts);
    }
  }
  const firstWins = campaigns.filter(c => c.wonOn === 1).length;
  const firstTryRate = firstWins / N;
  const exp = unclearedCount === 0 ? clearedSum / N : (clearedSum + unclearedAttempts) / N;
  const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 4.8 ? 'right' : 'hard';
  return {
    expectedTries: Number(exp.toFixed(2)),
    label,
    firstTryRate: Number(firstTryRate.toFixed(4)),
    firstTryWins: firstWins,
    cleared: N - unclearedCount,
    uncleared: unclearedCount,
    censored: censoredCount,
    totalCampaigns: N,
  };
}

function poolSimpleResults(results, maxAttempts = 20) {
  const N = results.length;
  if (N === 0) return { expectedTries: 0, firstTryRate: 0, firstTryWins: 0, uncleared: 0, censored: 0, cleared: 0, totalCampaigns: 0 };
  let clearedSum = 0, unclearedCount = 0, unclearedAttempts = 0;
  for (const r of results) {
    if (r.wonOn !== null && r.wonOn !== undefined) {
      clearedSum += r.wonOn;
    } else {
      unclearedCount++;
      unclearedAttempts += (r.tries ?? maxAttempts);
    }
  }
  const firstWins = results.filter(r => r.wonOn === 1).length;
  const firstTryRate = firstWins / N;
  const exp = unclearedCount === 0 ? clearedSum / N : (clearedSum + unclearedAttempts) / N;
  const label = (exp <= 2.2 && firstTryRate >= 0.25) || firstTryRate >= 0.45 ? 'easy' : exp <= 4.8 ? 'right' : 'hard';
  return {
    expectedTries: Number(exp.toFixed(2)),
    label,
    firstTryRate: Number(firstTryRate.toFixed(4)),
    firstTryWins: firstWins,
    cleared: N - unclearedCount,
    uncleared: unclearedCount,
    censored: 0,
    totalCampaigns: N,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const suiteFilter = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;
  const boardFilter = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
  const resume = args.includes('--resume');

  console.log('=== Task B3: Comprehensive Skilled Benchmark Execution ===');
  console.log(`Baseline Bot:  ${baseMeasure.VERSION || 'planner-fast-v1'}`);
  console.log(`B1 Candidate:  ${b1Measure.VERSION || 'skilled-b1-candidate-v1'}`);
  console.log(`B2 Candidate:  ${b2Measure.VERSION}`);
  console.log(`B3 Candidate:  ${b3Measure.VERSION}`);
  console.log(`Manifest:      ${MANIFEST_FILE}`);
  console.log(`Results:       ${OUT_FILE}`);

  if (!fs.existsSync(MANIFEST_FILE)) {
    throw new Error(`Manifest not found: ${MANIFEST_FILE}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  let boards = manifest.boards;
  if (suiteFilter) boards = boards.filter(b => b.suite === suiteFilter);
  if (boardFilter) boards = boards.filter(b => b.id === boardFilter || b.name === boardFilter);

  console.log(`Selected ${boards.length} boards to benchmark.`);

  // Load prior B2 benchmark records for existing 44 boards
  let b2PriorMap = {};
  if (fs.existsSync(B2_PRIOR_FILE)) {
    try {
      const priorData = JSON.parse(fs.readFileSync(B2_PRIOR_FILE, 'utf8'));
      if (Array.isArray(priorData.records)) {
        for (const rec of priorData.records) b2PriorMap[rec.id] = rec;
      }
      console.log(`Loaded ${Object.keys(b2PriorMap).length} prior records from B2 benchmark.`);
    } catch (e) {
      console.warn('Could not load B2 prior results:', e.message);
    }
  }

  // Load existing B3 results if resuming
  let resultsMap = {};
  if (resume && fs.existsSync(OUT_FILE)) {
    try {
      const prior = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
      if (Array.isArray(prior.records)) {
        for (const rec of prior.records) resultsMap[rec.id] = rec;
      }
      console.log(`Resumed with ${Object.keys(resultsMap).length} previously completed records.`);
    } catch (e) {
      console.warn('Could not parse prior results for resume:', e.message);
    }
  }

  console.log('------------------------------------------------------------------------------------------------------------------------------------------------');
  console.log(
    'Suite / ID'.padEnd(28) +
    'Dennis'.padEnd(14) +
    'Base S (1st/unc)'.padEnd(18) +
    'B1 S (1st/unc)'.padEnd(18) +
    'B2 S (1st/unc)'.padEnd(18) +
    'B3 S (1st/unc)'.padEnd(18) +
    'ΔS(B3-Base)'.padEnd(14) +
    'Time(s)'
  );
  console.log('------------------------------------------------------------------------------------------------------------------------------------------------');

  const records = [];

  for (let idx = 0; idx < boards.length; idx++) {
    const item = boards[idx];
    if (resultsMap[item.id]) {
      const rec = resultsMap[item.id];
      records.push(rec);
      const dennisStr = item.dennis?.tries !== null && item.dennis?.tries !== undefined
        ? `${item.dennis.tries}t (${item.dennis.verdict ?? ''})`.slice(0, 12) : '-';
      const baseStr = `${rec.baseline.pooled.expectedTries} (${(rec.baseline.pooled.firstTryRate * 100).toFixed(0)}%/${rec.baseline.pooled.uncleared})`;
      const b1Str = `${rec.b1.pooled.expectedTries} (${(rec.b1.pooled.firstTryRate * 100).toFixed(0)}%/${rec.b1.pooled.uncleared})`;
      const b2Str = `${rec.b2.pooled.expectedTries} (${(rec.b2.pooled.firstTryRate * 100).toFixed(0)}%/${rec.b2.pooled.uncleared})`;
      const b3Str = `${rec.b3.pooled.expectedTries} (${(rec.b3.pooled.firstTryRate * 100).toFixed(0)}%/${rec.b3.pooled.uncleared})`;
      const deltaS = (rec.b3.pooled.expectedTries - rec.baseline.pooled.expectedTries).toFixed(2);

      console.log(
        `[CACHED] ${item.id}`.padEnd(28).slice(0, 28) +
        dennisStr.padEnd(14) +
        baseStr.padEnd(18) +
        b1Str.padEnd(18) +
        b2Str.padEnd(18) +
        b3Str.padEnd(18) +
        (deltaS > 0 ? `+${deltaS}` : deltaS).padEnd(14) +
        rec.elapsedSeconds.toFixed(1)
      );
      continue;
    }

    const t0 = performance.now();
    const boardSeeds = item.seeds || manifest.standardSeeds;

    let baseSeedResults = [];
    let b1SeedResults = [];
    let b2SeedResults = [];
    let basePooled = null;
    let b1Pooled = null;
    let b2Pooled = null;

    const priorRec = b2PriorMap[item.id];
    if (priorRec && priorRec.baseline && priorRec.b1 && priorRec.b2) {
      // Reuse existing baseline, b1, b2 results from B2 benchmark
      baseSeedResults = priorRec.baseline.seeds;
      b1SeedResults = priorRec.b1.seeds;
      b2SeedResults = priorRec.b2.seeds;

      // Accurately pool baseline campaigns across all seeds
      const baseCampaigns = [];
      for (const s of baseSeedResults) {
        if (s.results) baseCampaigns.push(...s.results);
      }
      basePooled = baseCampaigns.length > 0 ? poolSimpleResults(baseCampaigns, 20) : priorRec.baseline.pooled;

      // Accurately pool B1 campaigns across all seeds
      const b1Campaigns = [];
      for (const s of b1SeedResults) {
        if (s.results) b1Campaigns.push(...s.results);
      }
      b1Pooled = b1Campaigns.length > 0 ? poolSimpleResults(b1Campaigns, 20) : priorRec.b1.pooled;

      // Accurately pool B2 campaigns across all seeds
      const b2Campaigns = [];
      for (const s of b2SeedResults) {
        if (s.resultsBySeed) {
          const bestStyle = s.styles.route <= s.styles.plain ? 'route' : 'plain';
          const sub = s.resultsBySeed[bestStyle] || [];
          for (const block of sub) {
            if (block.runs) b2Campaigns.push(...block.runs);
          }
        }
      }
      b2Pooled = b2Campaigns.length > 0 ? poolSimpleResults(b2Campaigns, 20) : priorRec.b2.pooled;
    } else {
      // New board: evaluate baseline, B1, and B2
      for (const s of boardSeeds) {
        // 1. Baseline
        const baseRes = baseMeasure.measureHuman(item.board, {
          runs: 20, seeds: 2, seed: s, setting: 'planner', maxAttempts: 20, allResults: true,
        });
        baseSeedResults.push({
          seed: s,
          expectedTries: baseRes.expectedTries,
          firstTryRate: baseRes.firstTryRate,
          firstTryWins: baseRes.firstTryWins,
          uncleared: baseRes.unclearedAtAttemptLimit,
          censored: baseRes.censoredCampaigns,
          cleared: baseRes.cleared,
          styles: baseRes.plannerStyles,
          valid: baseRes.valid,
          slowestMoveMs: baseRes.slowestMove,
          minutes: baseRes.minutes,
          results: baseRes.results ? baseRes.results.map(r => ({ wonOn: r.wonOn, tries: r.wonOn ?? r.attempts.length })) : [],
        });

        // 2. B1
        const b1Res = b1Measure.measureHuman(item.board, {
          runs: 20, seeds: 2, seed: s, setting: 'planner', maxAttempts: 20, allResults: true,
        });
        b1SeedResults.push({
          seed: s,
          expectedTries: b1Res.expectedTries,
          firstTryRate: b1Res.firstTryRate,
          firstTryWins: b1Res.firstTryWins,
          uncleared: b1Res.unclearedAtAttemptLimit,
          censored: b1Res.censoredCampaigns,
          cleared: b1Res.cleared,
          styles: b1Res.plannerStyles,
          valid: b1Res.valid,
          slowestMoveMs: b1Res.slowestMove,
          minutes: b1Res.minutes,
          results: b1Res.results ? b1Res.results.map(r => ({ wonOn: r.wonOn, tries: r.wonOn ?? r.attempts.length })) : [],
        });

        // 3. B2
        const b2Res = b2Measure.measureHuman(item.board, {
          runs: 20, seeds: 2, seed: s, setting: 'planner', maxAttempts: 20, allResults: true,
        });
        b2SeedResults.push({
          seed: s,
          expectedTries: b2Res.expectedTries,
          firstTryRate: b2Res.firstTryRate,
          firstTryWins: b2Res.firstTryWins,
          uncleared: b2Res.unclearedAtAttemptLimit,
          censored: b2Res.censoredCampaigns,
          cleared: b2Res.cleared,
          styles: b2Res.plannerStyles,
          timing: b2Res.plannerTiming,
          valid: b2Res.valid,
          slowestMoveMs: b2Res.slowestMove,
          minutes: b2Res.minutes,
          resultsBySeed: b2Res.plannerResultsBySeed,
        });
      }

      const allBaseRuns = [];
      for (const s of baseSeedResults) if (s.results) allBaseRuns.push(...s.results);
      basePooled = poolSimpleResults(allBaseRuns, 20);

      const allB1Runs = [];
      for (const s of b1SeedResults) if (s.results) allB1Runs.push(...s.results);
      b1Pooled = poolSimpleResults(allB1Runs, 20);

      const allB2Runs = [];
      for (const s of b2SeedResults) {
        if (s.resultsBySeed) {
          const bestStyle = s.styles.route <= s.styles.plain ? 'route' : 'plain';
          const sub = s.resultsBySeed[bestStyle] || [];
          for (const block of sub) {
            if (block.runs) allB2Runs.push(...block.runs);
          }
        }
      }
      b2Pooled = poolSimpleResults(allB2Runs, 20);
    }

    // Now evaluate B3 candidate on this board
    const b3SeedResults = [];
    let b3AllCampaigns = [];

    for (const s of boardSeeds) {
      const b3Res = b3Measure.measureHuman(item.board, {
        runs: 20,
        seeds: 2,
        seed: s,
        setting: 'planner',
        maxAttempts: 20,
        allResults: true,
      });

      if (b3Res.plannerCampaigns) {
        const bestStyle = b3Res.plannerStyles.route <= b3Res.plannerStyles.plain ? 'route' : 'plain';
        const bestCampaigns = b3Res.plannerCampaigns[bestStyle] || [];
        b3AllCampaigns = b3AllCampaigns.concat(bestCampaigns);
      } else if (b3Res.results) {
        b3AllCampaigns = b3AllCampaigns.concat(b3Res.results);
      }

      b3SeedResults.push({
        seed: s,
        expectedTries: b3Res.expectedTries,
        firstTryRate: b3Res.firstTryRate,
        firstTryWins: b3Res.firstTryWins,
        uncleared: b3Res.unclearedAtAttemptLimit,
        censored: b3Res.censoredCampaigns,
        cleared: b3Res.cleared,
        styles: b3Res.plannerStyles,
        timing: b3Res.plannerTiming,
        valid: b3Res.valid,
        slowestMoveMs: b3Res.slowestMove,
        minutes: b3Res.minutes,
        resultsBySeed: b3Res.plannerResultsBySeed,
      });
    }

    const b3Pooled = b3AllCampaigns.length > 0
      ? poolCampaigns(b3AllCampaigns, 20)
      : {
          expectedTries: Number((b3SeedResults.reduce((a, b) => a + b.expectedTries, 0) / b3SeedResults.length).toFixed(2)),
          firstTryWins: b3SeedResults.reduce((a, b) => a + b.firstTryWins, 0),
          firstTryRate: b3SeedResults.reduce((a, b) => a + b.firstTryWins, 0) / (b3SeedResults.length * 40),
          uncleared: b3SeedResults.reduce((a, b) => a + b.uncleared, 0),
          censored: b3SeedResults.reduce((a, b) => a + b.censored, 0),
          cleared: b3SeedResults.reduce((a, b) => a + b.cleared, 0),
          totalCampaigns: b3SeedResults.length * 40,
        };

    const elapsed = (performance.now() - t0) / 1000;
    const deltaS = (b3Pooled.expectedTries - basePooled.expectedTries).toFixed(2);

    const rec = {
      id: item.id,
      name: item.name,
      suite: item.suite,
      category: item.category,
      level: item.level,
      boardHash: item.boardHash,
      dennis: item.dennis,
      baseline: { pooled: basePooled, seeds: baseSeedResults },
      b1: { pooled: b1Pooled, seeds: b1SeedResults },
      b2: { pooled: b2Pooled, seeds: b2SeedResults },
      b3: {
        pooled: b3Pooled,
        seeds: b3SeedResults,
        version: b3Measure.VERSION,
      },
      deltaS_b3_base: Number(deltaS),
      deltaS_b3_b2: Number((b3Pooled.expectedTries - b2Pooled.expectedTries).toFixed(2)),
      elapsedSeconds: Number(elapsed.toFixed(1)),
    };

    records.push(rec);
    resultsMap[item.id] = rec;

    // Save progressively to file
    fs.writeFileSync(OUT_FILE, JSON.stringify({
      schema: 'skilled-b3-benchmark-results-v1',
      updatedAt: new Date().toISOString(),
      version: b3Measure.VERSION,
      totalBoards: boards.length,
      completedBoards: records.length,
      records,
    }, null, 2));

    const dennisStr = item.dennis?.tries !== null && item.dennis?.tries !== undefined
      ? `${item.dennis.tries}t (${item.dennis.verdict ?? ''})`.slice(0, 12) : '-';
    const baseStr = `${basePooled.expectedTries} (${(basePooled.firstTryRate * 100).toFixed(0)}%/${basePooled.uncleared})`;
    const b1Str = `${b1Pooled.expectedTries} (${(b1Pooled.firstTryRate * 100).toFixed(0)}%/${b1Pooled.uncleared})`;
    const b2Str = `${b2Pooled.expectedTries} (${(b2Pooled.firstTryRate * 100).toFixed(0)}%/${b2Pooled.uncleared})`;
    const b3Str = `${b3Pooled.expectedTries} (${(b3Pooled.firstTryRate * 100).toFixed(0)}%/${b3Pooled.uncleared})`;

    console.log(
      item.id.padEnd(28).slice(0, 28) +
      dennisStr.padEnd(14) +
      baseStr.padEnd(18) +
      b1Str.padEnd(18) +
      b2Str.padEnd(18) +
      b3Str.padEnd(18) +
      (deltaS > 0 ? `+${deltaS}` : deltaS).padEnd(14) +
      elapsed.toFixed(1)
    );
  }

  console.log('------------------------------------------------------------------------------------------------------------------------------------------------');
  console.log(`Benchmark execution completed. ${records.length} boards saved to ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
