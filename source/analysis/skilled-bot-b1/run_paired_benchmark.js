'use strict';
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const baseMeasure = require('../../tools/sim/refit/human_planner_measure_fast.js');
const candMeasure = require('./candidate_measure.js');

const WORKTREE = path.resolve(__dirname, '../../..');
const EVIDENCE_DIR = path.resolve(__dirname, 'evidence');
const DATA_DIR = path.resolve(WORKTREE, 'source/analysis/builder/data');
const FACTORY_DIR = path.resolve(WORKTREE, 'source/analysis/factory');
const OUT_DIR = path.resolve(__dirname, 'results');

fs.mkdirSync(OUT_DIR, { recursive: true });

function loadBoard(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

async function main() {
  console.log('=== Task B1: Paired Skilled Benchmark Evaluation ===');
  console.log('Baseline Bot: planner-fast-v1 (human_planner_measure_fast.js)');
  console.log('Candidate Bot: skilled-b1-candidate-v1 (candidate_measure.js)');
  console.log('Campaign settings: runs: 20, seeds: 2 (40 campaigns per board), maxAttempts: 20, seed: 4711');
  console.log('');

  const testSuites = [];

  // Suite 1: Focal Boards
  testSuites.push({
    suite: 'focal',
    name: 'G9 Board (e038d9ff...)',
    category: 'G9 starting case (76-tile U geometry, ice, clock deadline 16)',
    board: loadBoard(path.join(EVIDENCE_DIR, 'g9-board.json')),
    dennis: { tries: 1, won: true, verdict: 'easy (3 stars)', note: 'The puzzle itself was quite good. Just weird it didnt have face down and was so easy.' },
  });

  testSuites.push({
    suite: 'focal',
    name: 'Balanced Control Board',
    category: 'Balanced key control board (76-tile U geometry)',
    board: loadBoard(path.join(EVIDENCE_DIR, 'balanced-control-board.json')),
    dennis: { tries: null, won: null, verdict: null, note: 'Synthetic control case' },
  });

  // Suite 2: Dennis Lab Boards from dennis-plays.json
  const dpFile = path.join(FACTORY_DIR, 'dennis-plays.json');
  if (fs.existsSync(dpFile)) {
    const dp = JSON.parse(fs.readFileSync(dpFile, 'utf8'));
    const labKeys = [
      'factory5-177', // Dennis 1 try, "Seems easy. Idk why the strong bot struggled"
      'factory2-192', // Dennis 1 try, "Way too easy"
      'factory1-175', // Dennis 1 try
      'factory1-184', // Dennis 2 tries
      'factory1-189', // Dennis 1 try
      'factory2-175', // Dennis 4 tries
      'factory2-184', // Dennis 1 try
      'factory3-176', // Dennis 1 try
      'factory4-176', // Dennis 2 tries
      'factory4-178', // Dennis 1 try
    ];

    for (const key of labKeys) {
      const entry = dp.boards.find(b => b.key === key);
      if (entry && entry.board) {
        testSuites.push({
          suite: 'lab-dennis',
          name: key,
          category: `Dennis playtest board (Level ${entry.level})`,
          board: entry.board,
          dennis: {
            tries: entry.tries,
            won: entry.results ? entry.results.some(r => r.r === 'win') : true,
            verdict: entry.verdict,
            stars: entry.stars,
            note: entry.note,
          },
        });
      }
    }
  }

  // Suite 3: 18 Qualified Boards (200-225)
  const qFile = path.join(DATA_DIR, 'qualified-200-225.jsonl');
  if (fs.existsSync(qFile)) {
    const qLines = fs.readFileSync(qFile, 'utf8').trim().split('\n');
    for (const line of qLines) {
      const q = JSON.parse(line);
      const ev = q.skilledEvidence || {};
      testSuites.push({
        suite: 'qualified-200-225',
        name: `Level ${q.level} (${q.id.slice(0, 8)})`,
        category: `Qualified Builder board (${q.shape}, target ${q.target})`,
        board: q.design,
        level: q.level,
        id: q.id,
        boardHash: q.boardHash,
        storedSkilled: q.botSkilled ?? q.skilled,
        dennis: {
          tries: ev.tries ?? null,
          won: ev.won ?? null,
          verdict: ev.verdict ?? null,
          stars: ev.stars ?? null,
          note: ev.note ?? null,
        },
      });
    }
  }

  console.log(`Loaded ${testSuites.length} test boards across 3 suites.`);
  console.log('Running paired evaluations (Baseline vs Candidate)...');
  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log(
    'Suite / Name'.padEnd(28) +
    'Dennis'.padEnd(16) +
    'Base S (rt/pl)'.padEnd(20) +
    'Base 1st/Uncl'.padEnd(16) +
    'Cand S (rt/pl)'.padEnd(20) +
    'Cand 1st/Uncl'.padEnd(16) +
    'ΔS'.padEnd(8) +
    'Time (s)'
  );
  console.log('------------------------------------------------------------------------------------------------------------------------');

  const results = [];

  for (let idx = 0; idx < testSuites.length; idx++) {
    const item = testSuites[idx];
    const t0 = performance.now();

    // Baseline evaluation
    const baseRes = baseMeasure.measureHuman(item.board, {
      runs: 20,
      seeds: 2,
      seed: 4711,
      setting: 'planner',
      maxAttempts: 20,
      allResults: true,
    });

    // Candidate evaluation
    const candRes = candMeasure.measureHuman(item.board, {
      runs: 20,
      seeds: 2,
      seed: 4711,
      setting: 'planner',
      maxAttempts: 20,
      allResults: true,
    });

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    const deltaS = (candRes.expectedTries - baseRes.expectedTries).toFixed(2);

    const dennisStr = item.dennis.tries !== null ? `${item.dennis.tries} try (${item.dennis.verdict ?? ''})`.slice(0, 14) : '-';
    const baseStyles = `${baseRes.expectedTries} (${baseRes.plannerStyles.route}/${baseRes.plannerStyles.plain})`;
    const baseWinUncl = `${(baseRes.firstTryRate * 100).toFixed(0)}% / ${baseRes.unclearedAtAttemptLimit}`;
    const candStyles = `${candRes.expectedTries} (${candRes.plannerStyles.route}/${candRes.plannerStyles.plain})`;
    const candWinUncl = `${(candRes.firstTryRate * 100).toFixed(0)}% / ${candRes.unclearedAtAttemptLimit}`;

    console.log(
      item.name.padEnd(28) +
      dennisStr.padEnd(16) +
      baseStyles.padEnd(20) +
      baseWinUncl.padEnd(16) +
      candStyles.padEnd(20) +
      candWinUncl.padEnd(16) +
      (deltaS > 0 ? `+${deltaS}` : deltaS).padEnd(8) +
      elapsed
    );

    results.push({
      suite: item.suite,
      name: item.name,
      category: item.category,
      level: item.level,
      boardHash: item.boardHash,
      dennis: item.dennis,
      baseline: {
        expectedTries: baseRes.expectedTries,
        plannerStyles: baseRes.plannerStyles,
        firstTryRate: baseRes.firstTryRate,
        uncleared: baseRes.unclearedAtAttemptLimit,
        cleared: baseRes.cleared,
        label: baseRes.label,
        lossPhase: baseRes.lossPhase,
        valid: baseRes.valid,
        slowestMoveMs: baseRes.slowestMove,
        minutes: baseRes.minutes,
      },
      candidate: {
        expectedTries: candRes.expectedTries,
        plannerStyles: candRes.plannerStyles,
        firstTryRate: candRes.firstTryRate,
        uncleared: candRes.unclearedAtAttemptLimit,
        cleared: candRes.cleared,
        label: candRes.label,
        lossPhase: candRes.lossPhase,
        valid: candRes.valid,
        slowestMoveMs: candRes.slowestMove,
        minutes: candRes.minutes,
      },
      deltaS: Number(deltaS),
      elapsedSeconds: Number(elapsed),
    });
  }

  console.log('------------------------------------------------------------------------------------------------------------------------');
  console.log('Evaluations completed.');

  // Save JSON results
  const outJson = path.join(OUT_DIR, 'paired_benchmark_results.json');
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Wrote full paired results to: ${outJson}`);
}

main().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
