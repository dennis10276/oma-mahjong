'use strict';
/**
 * Task G3 — Zero-drift verification (60 boards) and speed benchmark (1 core & 6 workers)
 * for family-key-memory-v1-fast vs family-key-memory-v1.
 *
 * Modes:
 *   node source/tools/factory/verify_km_fast_rating.js --mode verify [--workers 6] [--out path.json]
 *   node source/tools/factory/verify_km_fast_rating.js --mode bench  [--workers 6] [--out path.json]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { Worker, isMainThread, parentPort } = require('node:worker_threads');

const slowBot = require('../sim/refit/human_bot_key_memory_v1.js');
const fastBot = require('../sim/refit/human_bot_key_memory_v1_fast.js');
const { createMeter, boardKey } = require('./meter.js');
const task11Keys = require('../builder/task11_keys.js');

const MAX_WORKERS = 6;

if (!isMainThread) {
  parentPort.on('message', msg => {
    if (msg.kind === 'stop') {
      process.exit(0);
    }
    if (msg.kind === 'verify') {
      const { index, id, source, keysShownAtStart, keyCount, design, runs, seeds, seed } = msg;
      const summary = {
        index,
        id,
        source,
        tiles: design.tiles.length,
        keyCount,
        keysShownAtStart,
        familyMoves: 0,
        plannerMoves: 0,
        familyVerifiedTaps: 0,
        plannerVerifiedTaps: 0,
        slowFamilyMs: 0,
        fastFamilyMs: 0,
        slowPlannerMs: 0,
        fastPlannerMs: 0,
        diffs: [],
      };

      for (const setting of ['family-key-memory-v1', 'planner-reference-v1']) {
        const isFamily = setting === 'family-key-memory-v1';
        const opts = { runs, seeds, seed, setting, capture: 'tail' };

        const tSlow0 = performance.now();
        const ref = slowBot.measureHuman(design, opts);
        const slowMs = performance.now() - tSlow0;

        const tFast0 = performance.now();
        const fast = fastBot.measureHuman(design, opts); // keeps default 1% random audit (auditRate = 0.01)
        const fastMs = performance.now() - tFast0;

        if (isFamily) {
          summary.slowFamilyMs = slowMs;
          summary.fastFamilyMs = fastMs;
          summary.familyVerifiedTaps = fast.verifiedTaps;
        } else {
          summary.slowPlannerMs = slowMs;
          summary.fastPlannerMs = fastMs;
          summary.plannerVerifiedTaps = fast.verifiedTaps;
        }

        if (!Object.is(fast.expectedTries, ref.expectedTries)) {
          summary.diffs.push(`${setting}: expectedTries ${fast.expectedTries} !== ${ref.expectedTries}`);
        }
        if (!Object.is(fast.firstTryRate, ref.firstTryRate)) {
          summary.diffs.push(`${setting}: firstTryRate ${fast.firstTryRate} !== ${ref.firstTryRate}`);
        }
        if (!Object.is(fast.averageTries, ref.averageTries)) {
          summary.diffs.push(`${setting}: averageTries ${fast.averageTries} !== ${ref.averageTries}`);
        }
        if (fast.version !== ref.version) {
          summary.diffs.push(`${setting}: version ${fast.version} !== ${ref.version}`);
        }
        if (fast.calibrationStatus !== ref.calibrationStatus) {
          summary.diffs.push(`${setting}: calibrationStatus ${fast.calibrationStatus} !== ${ref.calibrationStatus}`);
        }
        if (fast.profileName !== ref.profileName) {
          summary.diffs.push(`${setting}: profileName ${fast.profileName} !== ${ref.profileName}`);
        }
        if (!Object.is(fast.valid, ref.valid)) {
          summary.diffs.push(`${setting}: valid ${fast.valid} !== ${ref.valid} (slowestMove fast=${fast.slowestMove.toFixed(1)} ref=${ref.slowestMove.toFixed(1)})`);
        }
        if (!isFamily) {
          if (JSON.stringify(fast.plannerStyles) !== JSON.stringify(ref.plannerStyles)) {
            summary.diffs.push(`plannerStyles ${JSON.stringify(fast.plannerStyles)} !== ${JSON.stringify(ref.plannerStyles)}`);
          }
        }
        if (fast.results.length !== ref.results.length) {
          summary.diffs.push(`${setting}: results.length ${fast.results.length} !== ${ref.results.length}`);
        } else {
          let moveCount = 0;
          for (let r = 0; r < ref.results.length; r++) {
            const rr = ref.results[r], fr = fast.results[r];
            if (fr.wonOn !== rr.wonOn || fr.attempts.length !== rr.attempts.length) {
              summary.diffs.push(`${setting} run ${r}: wonOn/attempts mismatch (${fr.wonOn}/${fr.attempts.length} vs ${rr.wonOn}/${rr.attempts.length})`);
              break;
            }
            for (let a = 0; a < rr.attempts.length; a++) {
              const ra = rr.attempts[a], fa = fr.attempts[a];
              moveCount += fa.actions.length;
              if (fa.actions.length !== ra.actions.length || fa.actions.some((v, k) => v !== ra.actions[k])) {
                summary.diffs.push(`${setting} run ${r} attempt ${a}: move sequence mismatch`);
                break;
              }
              if (fa.win !== ra.win || fa.why !== ra.why || fa.censored !== ra.censored || fa.phase !== ra.phase || fa.clockLeft !== ra.clockLeft || fa.left !== ra.left) {
                summary.diffs.push(`${setting} run ${r} attempt ${a}: terminal metadata mismatch`);
                break;
              }
              if (JSON.stringify(fa.decisions) !== JSON.stringify(ra.decisions)) {
                summary.diffs.push(`${setting} run ${r} attempt ${a}: tail decisions mismatch`);
                break;
              }
            }
          }
          if (isFamily) summary.familyMoves = moveCount;
          else summary.plannerMoves = moveCount;
        }
        if (isFamily) {
          summary.familyExpectedTries = fast.expectedTries;
          summary.familyFirstTryRate = fast.firstTryRate;
        } else {
          summary.plannerExpectedTries = fast.expectedTries;
          summary.plannerFirstTryRate = fast.firstTryRate;
        }
      }
      parentPort.postMessage(summary);
    } else if (msg.kind === 'bench') {
      const { id, source, tiles, design, setting, fast, runs, seeds, seed, warmup } = msg;
      const fn = fast ? fastBot.measureHuman : slowBot.measureHuman;
      if (warmup) {
        fn(design, { runs: 2, seeds: 1, seed, setting });
        parentPort.postMessage({ warmup: true });
        return;
      }
      const t0 = performance.now();
      const res = fn(design, { runs, seeds, seed, setting });
      const ms = performance.now() - t0;
      parentPort.postMessage({
        id,
        source,
        tiles,
        ms,
        expectedTries: res.expectedTries,
        firstTryRate: res.firstTryRate,
        verifiedTaps: res.verifiedTaps,
      });
    }
  });
  return;
}

function parseArgs(argv) {
  const args = {
    mode: 'verify',
    workers: MAX_WORKERS,
    runs: 20,
    seeds: 2,
    seed: 4711,
    out: null,
    checkpoint: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i];
    else if (a === '--workers') args.workers = Number(argv[++i]);
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--seeds') args.seeds = Number(argv[++i]);
    else if (a === '--seed') args.seed = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--checkpoint') args.checkpoint = argv[++i];
  }
  assert(Number.isInteger(args.workers) && args.workers >= 1 && args.workers <= MAX_WORKERS, `Workers must be between 1 and ${MAX_WORKERS}`);
  return args;
}

function selectStratified(candidates, targetCount, storyFn) {
  const byStory = new Map();
  for (const item of candidates) {
    const s = storyFn(item) || 'unknown';
    if (!byStory.has(s)) byStory.set(s, []);
    byStory.get(s).push(item);
  }
  const stories = [...byStory.keys()].sort();
  const picked = [];
  let cursor = 0;
  while (picked.length < targetCount) {
    let added = false;
    for (const s of stories) {
      const list = byStory.get(s);
      if (cursor < list.length && picked.length < targetCount) {
        picked.push(list[cursor]);
        added = true;
      }
    }
    if (!added) break;
    cursor++;
  }
  return picked;
}

function load60Boards() {
  const root = path.resolve(__dirname, '../..');
  const seenKeys = new Set();
  const selected = [];

  const pushBoard = (id, source, design, story) => {
    const key = boardKey(design);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    const keyCount = design.obst?.keys?.length || 0;
    const feat = keyCount > 0 && Array.isArray(design.solution) ? task11Keys.features(design) : null;
    selected.push({
      id,
      source,
      story: story || 'unknown',
      key,
      keyCount,
      keysShownAtStart: feat ? feat.keysShownAtStart : null,
      design,
    });
    return true;
  };

  // 1. All rows from analysis/builder/data/qualified-200-225.jsonl (18 rows total in file).
  const qualPath = path.join(root, 'analysis/builder/data/qualified-200-225.jsonl');
  const qualRows = fs.readFileSync(qualPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  for (const row of qualRows) {
    pushBoard(`qualified-L${row.level}-${row.id}`, 'qualified-200-225', row.design, row.story || row.recipe?.[0] || 'qualified');
  }
  const qualCount = selected.length;

  // 2. Hidden-key boards from analysis/builder/knobs-v1/boards.json (keysShownAtStart === 0, stratified across stories).
  const knobsPath = path.join(root, 'analysis/builder/knobs-v1/boards.json');
  const knobsRows = JSON.parse(fs.readFileSync(knobsPath, 'utf8'))
    .filter(b => !b.fail && b.design && (b.design.obst?.keys?.length || 0) > 0)
    .filter(b => !seenKeys.has(boardKey(b.design)))
    .filter(b => task11Keys.features(b.design).keysShownAtStart === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const knobsTarget = 20 + Math.max(0, Math.ceil((20 - qualCount) / 2)); // 21 when qualCount = 18
  const pickedKnobs = selectStratified(knobsRows, knobsTarget + 5, b => b.brief?.story || b.stage);
  let addedKnobs = 0;
  for (const b of pickedKnobs) {
    if (addedKnobs >= knobsTarget) break;
    if (pushBoard(b.id, 'knobs-v1-hidden-keys', b.design, b.brief?.story)) addedKnobs++;
  }

  // 3. Codex's v3 ladder boards from analysis/builder/why-hard-v1/v3-reference/ladder/plan.json (stratified across story+spare).
  const ladderPath = path.join(root, 'analysis/builder/why-hard-v1/v3-reference/ladder/plan.json');
  const ladderPlan = JSON.parse(fs.readFileSync(ladderPath, 'utf8'));
  const ladderRows = ladderPlan.boards
    .filter(b => !b.fail && b.design && !seenKeys.has(boardKey(b.design)))
    .sort((a, b) => a.id.localeCompare(b.id));
  const ladderTarget = 60 - selected.length; // 21 when qualCount = 18 and addedKnobs = 21
  const pickedLadder = selectStratified(ladderRows, ladderTarget + 10, b => `${b.cell?.story || b.brief?.story}-p${b.cell?.spare || 1}`);
  let addedLadder = 0;
  for (const b of pickedLadder) {
    if (addedLadder >= ladderTarget) break;
    if (pushBoard(b.id, 'v3-ladder', b.design, b.cell?.story || b.brief?.story)) addedLadder++;
  }

  assert.equal(selected.length, 60, `Expected 60 distinct boards, got ${selected.length}`);
  return {
    boards: selected,
    counts: {
      qualified200_225: qualCount,
      knobsV1HiddenKeys: addedKnobs,
      v3Ladder: addedLadder,
      total: selected.length,
    },
  };
}

function runWorkerPool(workerCount, tasks, onResult) {
  return new Promise((resolve, reject) => {
    const n = Math.min(workerCount, Math.max(1, tasks.length));
    const workers = [];
    let cursor = 0;
    let completed = 0;
    let failed = false;

    const dispatch = w => {
      if (failed) return;
      if (cursor < tasks.length) {
        w.postMessage(tasks[cursor++]);
      } else {
        w.postMessage({ kind: 'stop' });
      }
    };

    for (let i = 0; i < n; i++) {
      const w = new Worker(__filename);
      workers.push(w);
      w.on('message', res => {
        if (res.warmup) {
          completed++;
          if (completed === tasks.length) {
            for (const wk of workers) wk.postMessage({ kind: 'stop' });
            resolve();
          } else {
            dispatch(w);
          }
          return;
        }
        onResult(res);
        completed++;
        if (completed === tasks.length) {
          for (const wk of workers) wk.postMessage({ kind: 'stop' });
          resolve();
        } else {
          dispatch(w);
        }
      });
      w.on('error', err => {
        if (failed) return;
        failed = true;
        for (const wk of workers) wk.terminate();
        reject(err);
      });
      dispatch(w);
    }
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function summarizeTimes(msList, wallMs, workers) {
  const sec = msList.map(x => x / 1000).sort((a, b) => a - b);
  const sumSec = sec.reduce((a, b) => a + b, 0);
  const wallSec = wallMs / 1000;
  return {
    boards: msList.length,
    workers,
    wallSec: Number(wallSec.toFixed(3)),
    effectiveSecPerBoard: Number((wallSec / msList.length).toFixed(3)),
    boardsPerMin: Number(((msList.length / wallSec) * 60).toFixed(2)),
    workerMeanSecPerBoard: Number((sumSec / msList.length).toFixed(3)),
    workerMedianSecPerBoard: Number(percentile(sec, 0.5).toFixed(3)),
    workerMinSecPerBoard: Number(sec[0].toFixed(3)),
    workerMaxSecPerBoard: Number(sec.at(-1).toFixed(3)),
  };
}

async function runVerify(args) {
  const { boards, counts } = load60Boards();
  const slowKmFp = createMeter({ botVersion: 'family-key-memory-v1', cacheDir: false }).fingerprint;
  const fastKmFp = createMeter({ botVersion: 'family-key-memory-v1-fast', cacheDir: false }).fingerprint;
  const refFp = createMeter({ cacheDir: false }).fingerprint;

  const doneByIndex = new Map();
  if (args.checkpoint && fs.existsSync(args.checkpoint)) {
    const saved = JSON.parse(fs.readFileSync(args.checkpoint, 'utf8'));
    if (Array.isArray(saved.results)) {
      for (const r of saved.results) {
        if (r.diffs && r.diffs.length === 0) doneByIndex.set(r.index, r);
      }
    }
    console.log(`Resumed ${doneByIndex.size}/60 verified boards from checkpoint.`);
  }

  const tasks = boards
    .map((b, index) => ({
      kind: 'verify',
      index,
      id: b.id,
      source: b.source,
      keyCount: b.keyCount,
      keysShownAtStart: b.keysShownAtStart,
      design: b.design,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
    }))
    .filter(t => !doneByIndex.has(t.index));

  console.log(`Running zero-drift verification on ${tasks.length} remaining boards (${boards.length} total, ${args.workers} workers, runs=${args.runs}, seeds=${args.seeds})...`);
  const t0 = performance.now();
  await runWorkerPool(args.workers, tasks, res => {
    doneByIndex.set(res.index, res);
    if (args.checkpoint) {
      fs.mkdirSync(path.dirname(args.checkpoint), { recursive: true });
      fs.writeFileSync(args.checkpoint, JSON.stringify({ results: [...doneByIndex.values()] }));
    }
    const status = res.diffs.length === 0 ? 'OK' : `DRIFT(${res.diffs.length})`;
    console.log(
      `[${doneByIndex.size}/${boards.length}] ${status} #${res.index} ${res.source}:${res.id} ` +
      `family=${res.familyExpectedTries} (${(res.slowFamilyMs / 1000).toFixed(2)}s -> ${(res.fastFamilyMs / 1000).toFixed(2)}s) ` +
      `planner=${res.plannerExpectedTries} (${(res.slowPlannerMs / 1000).toFixed(2)}s -> ${(res.fastPlannerMs / 1000).toFixed(2)}s)`
    );
  });
  const wallSec = (performance.now() - t0) / 1000;

  const ordered = [...doneByIndex.values()].sort((a, b) => a.index - b.index);
  const driftBoards = ordered.filter(r => r.diffs.length > 0);
  const totalFamilyMoves = ordered.reduce((s, r) => s + r.familyMoves, 0);
  const totalPlannerMoves = ordered.reduce((s, r) => s + r.plannerMoves, 0);
  const totalFamilyAuditedTaps = ordered.reduce((s, r) => s + r.familyVerifiedTaps, 0);
  const totalPlannerAuditedTaps = ordered.reduce((s, r) => s + r.plannerVerifiedTaps, 0);

  const report = {
    schema: 'km-fast-zero-drift-v1',
    created: new Date().toISOString(),
    fingerprints: {
      referenceDefaultFast: refFp,
      slowKeyMemory: slowKmFp,
      fastKeyMemory: fastKmFp,
      preG2SlowKeyMemory: 'd362e85fba3d61523c54bc53a92745458e4467fb4a59624aad1312e9d9003ae3',
    },
    protocol: {
      workers: args.workers,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      settings: ['family-key-memory-v1', 'planner-reference-v1'],
      auditRate: 0.01,
      boardCounts: counts,
    },
    wallSec: Number(wallSec.toFixed(2)),
    driftCount: driftBoards.length,
    totalBoards: ordered.length,
    totalFamilyMoves,
    totalPlannerMoves,
    totalMovesChecked: totalFamilyMoves + totalPlannerMoves,
    totalFamilyAuditedTaps,
    totalPlannerAuditedTaps,
    driftBoards,
    results: ordered,
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(report, null, 2) + '\n');
  }

  console.log(`\nZero-drift summary: driftCount=${report.driftCount}/${report.totalBoards}, familyMoves=${totalFamilyMoves}, plannerMoves=${totalPlannerMoves}, auditedTaps=${totalFamilyAuditedTaps + totalPlannerAuditedTaps}`);
  if (report.driftCount > 0) {
    console.error('DRIFT DETECTED:', JSON.stringify(driftBoards, null, 2));
    process.exitCode = 1;
  }
}

async function runBench(args) {
  const { boards } = load60Boards();
  // Balanced 18-board benchmark subset: 6 qualified-200-225 + 6 knobs-v1 hidden-key + 6 v3-ladder.
  const pick6 = src => boards.filter(b => b.source === src).filter((_, i) => i % 3 === 0).slice(0, 6);
  const bench18 = [...pick6('qualified-200-225'), ...pick6('knobs-v1-hidden-keys'), ...pick6('v3-ladder')];
  assert.equal(bench18.length, 18);
  // Balanced 6-board subset for planner benchmark (2 from each source).
  const bench6Planner = [bench18[0], bench18[3], bench18[6], bench18[11], bench18[12], bench18[15]];

  async function measureSuite(subset, setting, fast, workers) {
    // Warm up each worker in the pool so module load / V8 JIT compile doesn't skew timings.
    const warmTasks = Array.from({ length: workers }, () => ({
      kind: 'bench',
      id: subset[0].id,
      source: subset[0].source,
      tiles: subset[0].design.tiles.length,
      design: subset[0].design,
      setting,
      fast,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      warmup: true,
    }));
    await runWorkerPool(workers, warmTasks, () => {});

    const items = [];
    const tasks = subset.map(b => ({
      kind: 'bench',
      id: b.id,
      source: b.source,
      tiles: b.design.tiles.length,
      design: b.design,
      setting,
      fast,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      warmup: false,
    }));
    const t0 = performance.now();
    await runWorkerPool(workers, tasks, res => items.push(res));
    const wallMs = performance.now() - t0;
    const summary = summarizeTimes(items.map(x => x.ms), wallMs, workers);
    console.log(
      `[bench] setting=${setting} mode=${fast ? 'fast' : 'slow'} workers=${workers} n=${subset.length}: ` +
      `effective=${summary.effectiveSecPerBoard}s/board (workerMean=${summary.workerMeanSecPerBoard}s, wall=${summary.wallSec}s)`
    );
    return { summary, boards: items };
  }

  console.log(`Running Task G3 speed benchmark (1 core vs ${args.workers} workers, runs=${args.runs}, seeds=${args.seeds})...`);

  const family1Slow = await measureSuite(bench18, 'family-key-memory-v1', false, 1);
  const family1Fast = await measureSuite(bench18, 'family-key-memory-v1', true, 1);
  const family6Slow = await measureSuite(bench18, 'family-key-memory-v1', false, args.workers);
  const family6Fast = await measureSuite(bench18, 'family-key-memory-v1', true, args.workers);

  const planner1Slow = await measureSuite(bench6Planner, 'planner-reference-v1', false, 1);
  const planner1Fast = await measureSuite(bench6Planner, 'planner-reference-v1', true, 1);
  const planner6Slow = await measureSuite(bench6Planner, 'planner-reference-v1', false, args.workers);
  const planner6Fast = await measureSuite(bench6Planner, 'planner-reference-v1', true, args.workers);

  // Verify ratings matched identically between slow and fast during the benchmark too!
  const checkSame = (slowRun, fastRun, label) => {
    const byIdSlow = new Map(slowRun.boards.map(x => [x.id, x]));
    for (const f of fastRun.boards) {
      const s = byIdSlow.get(f.id);
      assert.equal(f.expectedTries, s.expectedTries, `${label} bench expectedTries mismatch on ${f.id}`);
      assert.equal(f.firstTryRate, s.firstTryRate, `${label} bench firstTryRate mismatch on ${f.id}`);
    }
  };
  checkSame(family1Slow, family1Fast, 'family-1core');
  checkSame(family6Slow, family6Fast, 'family-6workers');
  checkSame(planner1Slow, planner1Fast, 'planner-1core');
  checkSame(planner6Slow, planner6Fast, 'planner-6workers');

  const report = {
    schema: 'km-fast-benchmarks-v1',
    created: new Date().toISOString(),
    protocol: {
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      auditRate: 0.01,
      familyBoards: bench18.length,
      plannerBoards: bench6Planner.length,
      parallelWorkers: args.workers,
    },
    familyKeyMemoryV1: {
      oneCore: {
        slow: family1Slow.summary,
        fast: family1Fast.summary,
        speedupX: Number((family1Slow.summary.effectiveSecPerBoard / family1Fast.summary.effectiveSecPerBoard).toFixed(2)),
      },
      sixWorkers: {
        slow: family6Slow.summary,
        fast: family6Fast.summary,
        speedupVsSlowSixWorkersX: Number((family6Slow.summary.effectiveSecPerBoard / family6Fast.summary.effectiveSecPerBoard).toFixed(2)),
        speedupVsSlowOneCoreX: Number((family1Slow.summary.effectiveSecPerBoard / family6Fast.summary.effectiveSecPerBoard).toFixed(2)),
      },
      perBoardOneCore: bench18.map(b => {
        const s = family1Slow.boards.find(x => x.id === b.id);
        const f = family1Fast.boards.find(x => x.id === b.id);
        return {
          id: b.id,
          source: b.source,
          tiles: b.design.tiles.length,
          expectedTries: f.expectedTries,
          slowSec: Number((s.ms / 1000).toFixed(3)),
          fastSec: Number((f.ms / 1000).toFixed(3)),
          speedupX: Number((s.ms / f.ms).toFixed(2)),
        };
      }),
    },
    plannerReferenceV1: {
      oneCore: {
        slow: planner1Slow.summary,
        fast: planner1Fast.summary,
        speedupX: Number((planner1Slow.summary.effectiveSecPerBoard / planner1Fast.summary.effectiveSecPerBoard).toFixed(2)),
      },
      sixWorkers: {
        slow: planner6Slow.summary,
        fast: planner6Fast.summary,
        speedupVsSlowSixWorkersX: Number((planner6Slow.summary.effectiveSecPerBoard / planner6Fast.summary.effectiveSecPerBoard).toFixed(2)),
        speedupVsSlowOneCoreX: Number((planner1Slow.summary.effectiveSecPerBoard / planner6Fast.summary.effectiveSecPerBoard).toFixed(2)),
      },
    },
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(report, null, 2) + '\n');
  }

  console.log('\nBenchmark summary:', JSON.stringify({
    familyKeyMemoryV1: {
      oneCoreSlowSec: report.familyKeyMemoryV1.oneCore.slow.effectiveSecPerBoard,
      oneCoreFastSec: report.familyKeyMemoryV1.oneCore.fast.effectiveSecPerBoard,
      oneCoreSpeedupX: report.familyKeyMemoryV1.oneCore.speedupX,
      sixWorkersSlowSec: report.familyKeyMemoryV1.sixWorkers.slow.effectiveSecPerBoard,
      sixWorkersFastSec: report.familyKeyMemoryV1.sixWorkers.fast.effectiveSecPerBoard,
      sixWorkersSpeedupX: report.familyKeyMemoryV1.sixWorkers.speedupVsSlowSixWorkersX,
      sixWorkersFastVsOneCoreSlowX: report.familyKeyMemoryV1.sixWorkers.speedupVsSlowOneCoreX,
    },
    plannerReferenceV1: {
      oneCoreSlowSec: report.plannerReferenceV1.oneCore.slow.effectiveSecPerBoard,
      oneCoreFastSec: report.plannerReferenceV1.oneCore.fast.effectiveSecPerBoard,
      oneCoreSpeedupX: report.plannerReferenceV1.oneCore.speedupX,
      sixWorkersSlowSec: report.plannerReferenceV1.sixWorkers.slow.effectiveSecPerBoard,
      sixWorkersFastSec: report.plannerReferenceV1.sixWorkers.fast.effectiveSecPerBoard,
      sixWorkersSpeedupX: report.plannerReferenceV1.sixWorkers.speedupVsSlowSixWorkersX,
    },
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.mode === 'verify') await runVerify(args);
  else if (args.mode === 'bench') await runBench(args);
  else throw new Error(`Unknown --mode ${args.mode}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
