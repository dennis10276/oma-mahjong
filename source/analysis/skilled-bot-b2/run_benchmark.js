'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const baseMeasure = require('../../tools/sim/refit/human_planner_measure_fast.js');
const b1Measure = require('../skilled-bot-b1/candidate_measure.js');
const b2Measure = require('./candidate_measure.js');

const MANIFEST_FILE = path.join(__dirname, 'benchmark_manifest.json');
const OUT_DIR = path.join(__dirname, 'results');
const OUT_FILE = path.join(OUT_DIR, 'b2_benchmark_results.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

function poolCampaigns(campaigns, maxAttempts = 20) {
  const N = campaigns.length;
  if (N === 0) return { expectedTries: 0, firstTryRate: 0, firstTryWins: 0, uncleared: 0, censored: 0, cleared: 0 };
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
    firstTryRate,
    firstTryWins: firstWins,
    cleared: N - unclearedCount,
    uncleared: unclearedCount,
    censored: censoredCount,
    totalCampaigns: N,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const suiteFilter = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;
  const boardFilter = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
  const resume = args.includes('--resume');

  console.log('=== Task B2: Comprehensive Skilled Benchmark Execution ===');
  console.log(`Baseline Bot:  ${baseMeasure.VERSION || 'planner-fast-v1'}`);
  console.log(`B1 Candidate:  ${b1Measure.VERSION || 'skilled-b1-candidate-v1'}`);
  console.log(`B2 Candidate:  ${b2Measure.VERSION}`);
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

  // Load existing results if resuming
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

  console.log('---------------------------------------------------------------------------------------------------------------------------------');
  console.log(
    'Suite / Name'.padEnd(24) +
    'Dennis'.padEnd(16) +
    'Base S (1st/unc)'.padEnd(18) +
    'B1 S (1st/unc)'.padEnd(18) +
    'B2 S (1st/unc)'.padEnd(18) +
    'ΔS(B2-Base)'.padEnd(14) +
    'B2 Styles'.padEnd(14) +
    'Time(s)'
  );
  console.log('---------------------------------------------------------------------------------------------------------------------------------');

  const records = [];

  for (let idx = 0; idx < boards.length; idx++) {
    const item = boards[idx];
    if (resultsMap[item.id]) {
      const rec = resultsMap[item.id];
      records.push(rec);
      const dennisStr = item.dennis?.tries !== null && item.dennis?.tries !== undefined
        ? `${item.dennis.tries}t (${item.dennis.verdict ?? ''})`.slice(0, 14) : '-';
      const baseStr = `${rec.baseline.pooled.expectedTries} (${(rec.baseline.pooled.firstTryRate * 100).toFixed(0)}%/${rec.baseline.pooled.uncleared})`;
      const b1Str = `${rec.b1.pooled.expectedTries} (${(rec.b1.pooled.firstTryRate * 100).toFixed(0)}%/${rec.b1.pooled.uncleared})`;
      const b2Str = `${rec.b2.pooled.expectedTries} (${(rec.b2.pooled.firstTryRate * 100).toFixed(0)}%/${rec.b2.pooled.uncleared})`;
      const deltaS = (rec.b2.pooled.expectedTries - rec.baseline.pooled.expectedTries).toFixed(2);
      const b2Styles = `${rec.b2.seeds[0].styles.route}/${rec.b2.seeds[0].styles.plain}`;

      console.log(
        `[CACHED] ${item.name}`.padEnd(24).slice(0, 24) +
        dennisStr.padEnd(16) +
        baseStr.padEnd(18) +
        b1Str.padEnd(18) +
        b2Str.padEnd(18) +
        (deltaS > 0 ? `+${deltaS}` : deltaS).padEnd(14) +
        b2Styles.padEnd(14) +
        rec.elapsedSeconds.toFixed(1)
      );
      continue;
    }

    const t0 = performance.now();
    const boardSeeds = item.seeds || manifest.standardSeeds;

    const baseSeedResults = [];
    const b1SeedResults = [];
    const b2SeedResults = [];

    let b2AllCampaigns = [];

    for (const s of boardSeeds) {
      // 1. Baseline
      const baseRes = baseMeasure.measureHuman(item.board, {
        runs: 20,
        seeds: 2,
        seed: s,
        setting: 'planner',
        maxAttempts: 20,
        allResults: true,
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
        runs: 20,
        seeds: 2,
        seed: s,
        setting: 'planner',
        maxAttempts: 20,
        allResults: true,
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
        runs: 20,
        seeds: 2,
        seed: s,
        setting: 'planner',
        maxAttempts: 20,
        allResults: true,
      });

      if (b2Res.plannerCampaigns) {
        const bestStyle = b2Res.plannerStyles.route <= b2Res.plannerStyles.plain ? 'route' : 'plain';
        const bestCampaigns = b2Res.plannerCampaigns[bestStyle] || [];
        b2AllCampaigns = b2AllCampaigns.concat(bestCampaigns);
      } else if (b2Res.results) {
        b2AllCampaigns = b2AllCampaigns.concat(b2Res.results);
      }

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

    // Multi-seed pooled summaries
    const basePooled = {
      expectedTries: Number((baseSeedResults.reduce((a, b) => a + b.expectedTries, 0) / baseSeedResults.length).toFixed(2)),
      firstTryWins: baseSeedResults.reduce((a, b) => a + b.firstTryWins, 0),
      firstTryRate: baseSeedResults.reduce((a, b) => a + b.firstTryWins, 0) / (baseSeedResults.length * 40),
      uncleared: baseSeedResults.reduce((a, b) => a + b.uncleared, 0),
      censored: baseSeedResults.reduce((a, b) => a + b.censored, 0),
      cleared: baseSeedResults.reduce((a, b) => a + b.cleared, 0),
      totalCampaigns: baseSeedResults.length * 40,
    };

    const b1Pooled = {
      expectedTries: Number((b1SeedResults.reduce((a, b) => a + b.expectedTries, 0) / b1SeedResults.length).toFixed(2)),
      firstTryWins: b1SeedResults.reduce((a, b) => a + b.firstTryWins, 0),
      firstTryRate: b1SeedResults.reduce((a, b) => a + b.firstTryWins, 0) / (b1SeedResults.length * 40),
      uncleared: b1SeedResults.reduce((a, b) => a + b.uncleared, 0),
      censored: b1SeedResults.reduce((a, b) => a + b.censored, 0),
      cleared: b1SeedResults.reduce((a, b) => a + b.cleared, 0),
      totalCampaigns: b1SeedResults.length * 40,
    };

    const b2Pooled = b2AllCampaigns.length > 0 ? poolCampaigns(b2AllCampaigns, 20) : {
      expectedTries: Number((b2SeedResults.reduce((a, b) => a + b.expectedTries, 0) / b2SeedResults.length).toFixed(2)),
      firstTryWins: b2SeedResults.reduce((a, b) => a + b.firstTryWins, 0),
      firstTryRate: b2SeedResults.reduce((a, b) => a + b.firstTryWins, 0) / (b2SeedResults.length * 40),
      uncleared: b2SeedResults.reduce((a, b) => a + b.uncleared, 0),
      censored: b2SeedResults.reduce((a, b) => a + b.censored, 0),
      cleared: b2SeedResults.reduce((a, b) => a + b.cleared, 0),
      totalCampaigns: b2SeedResults.length * 40,
    };

    const elapsed = (performance.now() - t0) / 1000;
    const deltaS = (b2Pooled.expectedTries - basePooled.expectedTries).toFixed(2);

    const dennisStr = item.dennis?.tries !== null && item.dennis?.tries !== undefined
      ? `${item.dennis.tries}t (${item.dennis.verdict ?? ''})`.slice(0, 14) : '-';
    const baseStr = `${basePooled.expectedTries} (${(basePooled.firstTryRate * 100).toFixed(0)}%/${basePooled.uncleared})`;
    const b1Str = `${b1Pooled.expectedTries} (${(b1Pooled.firstTryRate * 100).toFixed(0)}%/${b1Pooled.uncleared})`;
    const b2Str = `${b2Pooled.expectedTries} (${(b2Pooled.firstTryRate * 100).toFixed(0)}%/${b2Pooled.uncleared})`;
    const b2Styles = `${b2SeedResults[0].styles.route}/${b2SeedResults[0].styles.plain}`;

    console.log(
      item.name.padEnd(24).slice(0, 24) +
      dennisStr.padEnd(16) +
      baseStr.padEnd(18) +
      b1Str.padEnd(18) +
      b2Str.padEnd(18) +
      (deltaS > 0 ? `+${deltaS}` : deltaS).padEnd(14) +
      b2Styles.padEnd(14) +
      elapsed.toFixed(1)
    );

    const rec = {
      id: item.id,
      name: item.name,
      suite: item.suite,
      category: item.category,
      level: item.level,
      shape: item.shape,
      target: item.target,
      boardHash: item.boardHash,
      dennis: item.dennis,
      baseline: {
        pooled: basePooled,
        seeds: baseSeedResults,
      },
      b1: {
        pooled: b1Pooled,
        seeds: b1SeedResults,
      },
      b2: {
        pooled: b2Pooled,
        seeds: b2SeedResults,
      },
      deltaS: Number(deltaS),
      elapsedSeconds: Number(elapsed.toFixed(2)),
    };

    records.push(rec);
    resultsMap[item.id] = rec;

    // Checkpoint after every board
    const outPayload = {
      schema: 'skilled-b2-benchmark-results-v1',
      updatedAt: new Date().toISOString(),
      baselineBot: baseMeasure.VERSION || 'planner-fast-v1',
      b1Bot: b1Measure.VERSION || 'skilled-b1-candidate-v1',
      b2Bot: b2Measure.VERSION,
      records: Object.values(resultsMap),
    };
    fs.writeFileSync(OUT_FILE, JSON.stringify(outPayload, null, 2), 'utf8');
  }

  console.log('---------------------------------------------------------------------------------------------------------------------------------');
  console.log('All evaluations completed.');
  console.log(`Saved benchmark results to: ${OUT_FILE}`);
}

main().catch(err => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
