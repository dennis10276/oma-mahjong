'use strict';
/**
 * Task G2 Part A — Zero-drift verification (100 boards) and CPU speedup benchmark.
 *
 * Modes:
 *   node source/tools/factory/verify_fast_rating.js --mode verify [--workers N] [--runs 20] [--seeds 2]
 *   node source/tools/factory/verify_fast_rating.js --mode bench  [--workers N] [--batch 20]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { Worker, isMainThread, parentPort } = require('node:worker_threads');

const { measureHuman, measureHumanFast } = require('../sim/refit/human_bot.js');
const { createMeter, boardKey } = require('./meter.js');

const CURRENT_BOT = 'f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561';

if (!isMainThread) {
  parentPort.on('message', msg => {
    if (msg.kind === 'stop') {
      process.exit(0);
    }
    if (msg.kind === 'verify') {
      const { index, id, source, design, runs, seeds, seed } = msg;
      const summary = { index, id, source, tiles: design.tiles.length, familyMoves: 0, plannerMoves: 0, diffs: [] };
      for (const setting of ['family', 'planner']) {
        const opts = { runs, seeds, seed, setting, capture: 'tail' };
        const ref = measureHuman(design, opts);
        const fast = measureHumanFast(design, opts);

        if (!Object.is(fast.expectedTries, ref.expectedTries)) {
          summary.diffs.push(`${setting}: expectedTries ${fast.expectedTries} !== ${ref.expectedTries}`);
        }
        if (!Object.is(fast.firstTryRate, ref.firstTryRate)) {
          summary.diffs.push(`${setting}: firstTryRate ${fast.firstTryRate} !== ${ref.firstTryRate}`);
        }
        if (!Object.is(fast.valid, ref.valid)) {
          summary.diffs.push(`${setting}: valid ${fast.valid} !== ${ref.valid}`);
        }
        if (setting === 'planner') {
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
              summary.diffs.push(`${setting} run ${r}: wonOn/attempts mismatch`);
              break;
            }
            for (let a = 0; a < rr.attempts.length; a++) {
              const ra = rr.attempts[a], fa = fr.attempts[a];
              moveCount += fa.actions.length;
              if (fa.actions.length !== ra.actions.length || fa.actions.some((v, k) => v !== ra.actions[k])) {
                summary.diffs.push(`${setting} run ${r} attempt ${a}: move sequence mismatch`);
                break;
              }
              if (fa.win !== ra.win || fa.why !== ra.why || fa.clockLeft !== ra.clockLeft || fa.left !== ra.left) {
                summary.diffs.push(`${setting} run ${r} attempt ${a}: terminal metadata mismatch`);
                break;
              }
              if (JSON.stringify(fa.decisions) !== JSON.stringify(ra.decisions)) {
                summary.diffs.push(`${setting} run ${r} attempt ${a}: tail decisions mismatch`);
                break;
              }
            }
          }
          if (setting === 'family') summary.familyMoves = moveCount;
          else summary.plannerMoves = moveCount;
        }
        if (setting === 'family') {
          summary.familyExpectedTries = fast.expectedTries;
          summary.familyFirstTryRate = fast.firstTryRate;
        } else {
          summary.plannerExpectedTries = fast.expectedTries;
          summary.plannerFirstTryRate = fast.firstTryRate;
        }
      }
      parentPort.postMessage(summary);
    } else if (msg.kind === 'bench') {
      const { design, setting, fast, seed } = msg;
      const fn = fast ? measureHumanFast : measureHuman;
      const t0 = performance.now();
      const res = fn(design, { runs: 20, seeds: 2, seed, setting, capture: 'tail' });
      const ms = performance.now() - t0;
      parentPort.postMessage({ ms, expectedTries: res.expectedTries, firstTryRate: res.firstTryRate });
    }
  });
  return;
}

function parseArgs(argv) {
  const args = {
    mode: 'verify',
    workers: Math.max(1, os.cpus().length),
    runs: 20,
    seeds: 2,
    seed: 4711,
    batch: os.cpus().length,
    out: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i];
    else if (a === '--workers') args.workers = Number(argv[++i]);
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--seeds') args.seeds = Number(argv[++i]);
    else if (a === '--batch') args.batch = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

function runPool(tasks, numWorkers, onItemDone = null) {
  if (tasks.length === 0) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const results = new Array(tasks.length);
    let nextIdx = 0, completed = 0;
    const workers = [];
    const count = Math.min(numWorkers, tasks.length);
    for (let w = 0; w < count; w++) {
      const worker = new Worker(__filename);
      workers.push(worker);
      let currentTaskIdx = -1;
      const sendNext = () => {
        if (nextIdx < tasks.length) {
          const cur = nextIdx++;
          currentTaskIdx = cur;
          worker.postMessage(tasks[cur]);
        } else {
          currentTaskIdx = -1;
          worker.postMessage({ kind: 'stop' });
        }
      };
      worker.on('message', res => {
        const doneIdx = currentTaskIdx;
        results[doneIdx] = res;
        completed++;
        if (onItemDone) onItemDone(res, doneIdx, completed, tasks.length);
        if (completed === tasks.length) {
          for (const wk of workers) wk.postMessage({ kind: 'stop' });
          resolve(results);
        } else {
          sendNext();
        }
      });
      worker.on('error', err => {
        for (const wk of workers) wk.terminate();
        reject(err);
      });
      sendNext();
    }
  });
}

function select100Boards() {
  const root = path.resolve(__dirname, '../..');
  const qualRows = fs.readFileSync(path.join(root, 'analysis/builder/data/qualified-200-225.jsonl'), 'utf8')
    .trim().split('\n').map(JSON.parse);
  const trainRows = JSON.parse(fs.readFileSync(path.join(root, 'analysis/builder/data/training-data.json'), 'utf8'))
    .filter(r => r.design && r.family?.valid && (r.kind !== 'historical' || r.family.bot === CURRENT_BOT));
  const knobRows = JSON.parse(fs.readFileSync(path.join(root, 'analysis/builder/knobs-v1/boards.json'), 'utf8'))
    .filter(r => r.design && r.family && !r.fail);

  const seen = new Set();
  const picked = [];
  const addFrom = (rows, source, limit) => {
    let added = 0;
    const stride = Math.max(1, Math.floor(rows.length / limit));
    for (let idx = 0; idx < rows.length && added < limit; idx += stride) {
      const r = rows[idx];
      const k = boardKey(r.design);
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push({ id: r.id || k.slice(0, 16), source, design: r.design });
      added++;
    }
    for (let idx = 0; idx < rows.length && added < limit; idx++) {
      const r = rows[idx];
      const k = boardKey(r.design);
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push({ id: r.id || k.slice(0, 16), source, design: r.design });
      added++;
    }
  };

  // All 18 qualified-200-225 boards + 41 training-data boards + 41 knobs-v1 boards = 100 boards
  addFrom(qualRows, 'qualified-200-225', qualRows.length);
  addFrom(trainRows, 'training-data', 41);
  addFrom(knobRows, 'knobs-v1', 100 - picked.length);
  assert.equal(picked.length, 100, `Expected 100 boards, got ${picked.length}`);
  return picked;
}

async function runVerify(args) {
  const root = path.resolve(__dirname, '../..');
  const ckptPath = path.join(root, 'build', `verify-100-${args.runs}x${args.seeds}-${args.seed}.ckpt.json`);
  fs.mkdirSync(path.dirname(ckptPath), { recursive: true });

  const boards = select100Boards();
  const bySource = {};
  for (const b of boards) bySource[b.source] = (bySource[b.source] || 0) + 1;

  let cachedByIndex = {};
  if (fs.existsSync(ckptPath)) {
    try {
      cachedByIndex = JSON.parse(fs.readFileSync(ckptPath, 'utf8'));
    } catch (_) {
      cachedByIndex = {};
    }
  }

  const pendingTasks = [];
  for (let index = 0; index < boards.length; index++) {
    const b = boards[index];
    if (cachedByIndex[index] && cachedByIndex[index].id === b.id && cachedByIndex[index].diffs.length === 0) continue;
    pendingTasks.push({
      kind: 'verify',
      index,
      id: b.id,
      source: b.source,
      design: b.design,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
    });
  }

  console.log(
    `Verifying zero drift on ${boards.length} boards (${JSON.stringify(bySource)}), ` +
    `${pendingTasks.length} remaining, using ${args.workers} workers...`
  );
  const t0 = performance.now();
  await runPool(pendingTasks, args.workers, (res, _doneIdx, doneCount, totalPending) => {
    cachedByIndex[res.index] = res;
    fs.writeFileSync(ckptPath, JSON.stringify(cachedByIndex));
    if (doneCount % 10 === 0 || doneCount === totalPending || res.diffs.length > 0) {
      console.log(`[${Object.keys(cachedByIndex).length}/${boards.length}] last=${res.id} diffs=${res.diffs.length}`);
    }
  });

  const elapsedSec = (performance.now() - t0) / 1000;
  const results = boards.map((_, idx) => cachedByIndex[idx]);
  const totalDiffs = results.flatMap(r => r.diffs.map(d => `${r.id}: ${d}`));
  const totalFamilyMoves = results.reduce((s, r) => s + r.familyMoves, 0);
  const totalPlannerMoves = results.reduce((s, r) => s + r.plannerMoves, 0);

  const report = {
    boardsChecked: results.length,
    bySource,
    settings: { runs: args.runs, seeds: args.seeds, seed: args.seed },
    workers: args.workers,
    elapsedSec: Number(elapsedSec.toFixed(2)),
    totalFamilyMovesChecked: totalFamilyMoves,
    totalPlannerMovesChecked: totalPlannerMoves,
    driftCount: totalDiffs.length,
    diffs: totalDiffs,
    fingerprint: createMeter({ cacheDir: false }).fingerprint,
  };
  console.log(JSON.stringify(report, null, 2));
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify({ ...report, perBoard: results }, null, 2));
  }
  assert.equal(totalDiffs.length, 0, `Zero-drift check failed with ${totalDiffs.length} differences!`);
}

async function runBench(args) {
  const root = path.resolve(__dirname, '../..');
  const qualRows = fs.readFileSync(path.join(root, 'analysis/builder/data/qualified-200-225.jsonl'), 'utf8')
    .trim().split('\n').map(JSON.parse);
  const targetIds = ['ebe4a48640ad0101', 'ec63a46d1a4e6eef', '97f6bf020e56366b'];
  const targets = targetIds.map(id => {
    const found = qualRows.find(r => r.id.startsWith(id));
    assert(found, `Missing benchmark board ${id}`);
    return { id, tiles: found.design.tiles.length, design: found.design };
  });

  // Warm up V8 JIT on both paths with 1 run
  measureHuman(targets[0].design, { runs: 1, seeds: 1, seed: 4711, setting: 'family' });
  measureHumanFast(targets[0].design, { runs: 1, seeds: 1, seed: 4711, setting: 'family' });
  measureHuman(targets[0].design, { runs: 1, seeds: 1, seed: 4711, setting: 'planner' });
  measureHumanFast(targets[0].design, { runs: 1, seeds: 1, seed: 4711, setting: 'planner' });

  const benchResults = [];
  for (const b of targets) {
    for (const setting of ['family', 'planner']) {
      console.log(`Benchmarking ${b.id} (${b.tiles} tiles) [${setting}] single-core...`);
      const tSlow0 = performance.now();
      const ref = measureHuman(b.design, { runs: 20, seeds: 2, seed: 4711, setting, capture: 'tail' });
      const slowSingleMs = performance.now() - tSlow0;

      const tFast0 = performance.now();
      const fast = measureHumanFast(b.design, { runs: 20, seeds: 2, seed: 4711, setting, capture: 'tail' });
      const fastSingleMs = performance.now() - tFast0;

      assert.equal(fast.expectedTries, ref.expectedTries);
      assert.equal(fast.firstTryRate, ref.firstTryRate);

      const batchSize = args.batch;
      console.log(`Benchmarking ${b.id} (${b.tiles} tiles) [${setting}] all-cores (${args.workers} workers, batch=${batchSize})...`);
      const slowTasks = Array.from({ length: batchSize }, (_, k) => ({
        kind: 'bench', design: b.design, setting, fast: false, seed: 4711 + k * 97,
      }));
      const fastTasks = Array.from({ length: batchSize }, (_, k) => ({
        kind: 'bench', design: b.design, setting, fast: true, seed: 4711 + k * 97,
      }));

      const tAllSlow0 = performance.now();
      await runPool(slowTasks, args.workers);
      const slowBatchWallMs = performance.now() - tAllSlow0;
      const slowAllCoresPerBoardMs = slowBatchWallMs / batchSize;

      const tAllFast0 = performance.now();
      await runPool(fastTasks, args.workers);
      const fastBatchWallMs = performance.now() - tAllFast0;
      const fastAllCoresPerBoardMs = fastBatchWallMs / batchSize;

      const row = {
        boardId: b.id,
        tiles: b.tiles,
        bot: setting,
        expectedTries: fast.expectedTries,
        firstTryRate: fast.firstTryRate,
        singleCoreCurrentMs: Number(slowSingleMs.toFixed(1)),
        singleCoreFastMs: Number(fastSingleMs.toFixed(1)),
        singleCoreSpeedup: Number((slowSingleMs / fastSingleMs).toFixed(2)),
        allCoresWorkers: args.workers,
        allCoresBatchSize: batchSize,
        allCoresCurrentMsPerBoard: Number(slowAllCoresPerBoardMs.toFixed(1)),
        allCoresFastMsPerBoard: Number(fastAllCoresPerBoardMs.toFixed(1)),
        allCoresSpeedup: Number((slowAllCoresPerBoardMs / fastAllCoresPerBoardMs).toFixed(2)),
        allCoresVsSingleCurrentSpeedup: Number((slowSingleMs / fastAllCoresPerBoardMs).toFixed(2)),
      };
      console.log(JSON.stringify(row));
      benchResults.push(row);
    }
  }

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify({
      generatedAt: new Date().toISOString(),
      cpu: os.cpus()[0]?.model,
      logicalCores: os.cpus().length,
      workers: args.workers,
      benchmarks: benchResults,
    }, null, 2));
  }
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  (args.mode === 'bench' ? runBench(args) : runVerify(args)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
