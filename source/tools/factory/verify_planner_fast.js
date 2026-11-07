'use strict';
/**
 * Task G4 — Zero-drift verification (70 board-ratings: 60 standard + 10 face-up down:[])
 * and speed benchmark (1 core & 6 workers) for planner-fast-v1 vs slow reference & G2 fast.
 *
 * Modes:
 *   node source/tools/factory/verify_planner_fast.js --mode verify [--workers 6] [--out path.json] [--checkpoint path.json]
 *   node source/tools/factory/verify_planner_fast.js --mode bench  [--workers 6] [--out path.json]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { Worker, isMainThread, parentPort } = require('node:worker_threads');

const refBot = require('../sim/refit/human_bot.js');
const fastBot = require('../sim/refit/human_bot_planner_fast.js');
const { boardKey } = require('./meter.js');
const task11Keys = require('../builder/task11_keys.js');

const MAX_WORKERS = 6;

function compareCampaignLists(refList, fastList, label, diffs) {
  if (fastList.length !== refList.length) {
    diffs.push(`${label}: campaign count ${fastList.length} !== ${refList.length}`);
    return 0;
  }
  let moves = 0;
  for (let r = 0; r < refList.length; r++) {
    const rr = refList[r], fr = fastList[r];
    if (fr.wonOn !== rr.wonOn || fr.attempts.length !== rr.attempts.length) {
      diffs.push(`${label} run ${r}: wonOn/attempts mismatch (${fr.wonOn}/${fr.attempts.length} vs ${rr.wonOn}/${rr.attempts.length})`);
      break;
    }
    for (let a = 0; a < rr.attempts.length; a++) {
      const ra = rr.attempts[a], fa = fr.attempts[a];
      moves += fa.actions.length;
      if (fa.actions.length !== ra.actions.length || fa.actions.some((v, k) => v !== ra.actions[k])) {
        diffs.push(`${label} run ${r} attempt ${a}: move sequence mismatch`);
        break;
      }
      if (
        fa.win !== ra.win || fa.why !== ra.why || fa.censored !== ra.censored ||
        fa.phase !== ra.phase || fa.clockLeft !== ra.clockLeft || fa.left !== ra.left
      ) {
        diffs.push(`${label} run ${r} attempt ${a}: terminal metadata mismatch`);
        break;
      }
      if (JSON.stringify(fa.decisions) !== JSON.stringify(ra.decisions)) {
        diffs.push(`${label} run ${r} attempt ${a}: tail decisions mismatch`);
        break;
      }
    }
  }
  return moves;
}

if (!isMainThread) {
  parentPort.on('message', msg => {
    if (msg.kind === 'stop') process.exit(0);

    if (msg.kind === 'verify') {
      const { index, id, source, faceUp, keysShownAtStart, keyCount, design, runs, seeds, seed } = msg;
      const summary = {
        index,
        id,
        source,
        faceUp: Boolean(faceUp),
        tiles: design.tiles.length,
        downCount: (design.down || []).length,
        keyCount,
        keysShownAtStart,
        routeMoves: 0,
        plainMoves: 0,
        totalMoves: 0,
        verifiedTaps: 0,
        slowMs: 0,
        fastMs: 0,
        expectedTries: null,
        firstTryRate: null,
        plannerStyles: null,
        diffs: [],
      };

      // 1. Run all sub-blocks of BOTH styles ('route' and 'plain') on the slow reference path (fast: false)
      // so we verify every single move of all 80 campaigns (40 route + 40 plain) with zero skipped sub-blocks!
      const tSlow0 = performance.now();
      const slowRouteSubs = [];
      const slowPlainSubs = [];
      for (let s = 0; s < seeds; s++) {
        const seedS = (seed + s * 7919) | 0;
        slowRouteSubs.push(refBot.measureHuman(design, {
          setting: 'planner', plannerStyle: 'route', runs, seeds: 1, seed: seedS, fast: false, capture: 'tail',
        }));
        slowPlainSubs.push(refBot.measureHuman(design, {
          setting: 'planner', plannerStyle: 'plain', runs, seeds: 1, seed: seedS, fast: false, capture: 'tail',
        }));
      }
      summary.slowMs = performance.now() - tSlow0;

      // Also verify top-level refBot.measureHuman({ setting: 'planner', fast: false }) directly on first 5 boards
      let topRef = null;
      if (index < 5) {
        topRef = refBot.measureHuman(design, { setting: 'planner', runs, seeds, seed, fast: false, capture: 'tail' });
      }

      // 2. Run fast planner (with default 1% random audit active: auditRate = 0.01)
      const tFast0 = performance.now();
      const fastTop = fastBot.measureHuman(design, { setting: 'planner', runs, seeds, seed, capture: 'tail' });
      summary.fastMs = performance.now() - tFast0;
      summary.verifiedTaps = fastTop.verifiedTaps;

      // Also collect all 40 route + 40 plain campaigns from fastBot via allResults: true to verify all 80 campaigns' moves
      const fastRouteAll = fastBot.measureHuman(design, {
        setting: 'planner', plannerStyle: 'route', runs, seeds, seed, capture: 'tail', allResults: true,
      });
      const fastPlainAll = fastBot.measureHuman(design, {
        setting: 'planner', plannerStyle: 'plain', runs, seeds, seed, capture: 'tail', allResults: true,
      });

      const slowRoutePooled = slowRouteSubs.flatMap(sub => sub.results);
      const slowPlainPooled = slowPlainSubs.flatMap(sub => sub.results);

      // Reconstruct exact reference top-level expectedTries & styles from slow sub-blocks
      const calcExp = list => {
        let sum = 0;
        for (const c of list) sum += c.wonOn !== null ? c.wonOn : c.attempts.length;
        return Number((sum / list.length).toFixed(2));
      };
      const refRouteExp = calcExp(slowRoutePooled);
      const refPlainExp = calcExp(slowPlainPooled);
      const refBestSub0 = refRouteExp <= refPlainExp ? slowRouteSubs[0] : slowPlainSubs[0];
      const refExpectedTries = Math.min(refRouteExp, refPlainExp);
      const refValid = slowRouteSubs[0].valid && slowPlainSubs[0].valid;

      if (topRef) {
        assert.equal(topRef.expectedTries, refExpectedTries);
        assert.deepEqual(topRef.plannerStyles, { route: refRouteExp, plain: refPlainExp });
      }

      if (!Object.is(fastTop.expectedTries, refExpectedTries)) {
        summary.diffs.push(`expectedTries ${fastTop.expectedTries} !== ${refExpectedTries}`);
      }
      if (!Object.is(fastTop.firstTryRate, refBestSub0.firstTryRate)) {
        summary.diffs.push(`firstTryRate ${fastTop.firstTryRate} !== ${refBestSub0.firstTryRate}`);
      }
      if (!Object.is(fastTop.averageTries, refBestSub0.averageTries)) {
        summary.diffs.push(`averageTries ${fastTop.averageTries} !== ${refBestSub0.averageTries}`);
      }
      if (fastTop.version !== refBestSub0.version) {
        summary.diffs.push(`version ${fastTop.version} !== ${refBestSub0.version}`);
      }
      if (fastTop.calibrationStatus !== refBestSub0.calibrationStatus) {
        summary.diffs.push(`calibrationStatus ${fastTop.calibrationStatus} !== ${refBestSub0.calibrationStatus}`);
      }
      if (!Object.is(fastTop.valid, refValid)) {
        summary.diffs.push(`valid ${fastTop.valid} !== ${refValid} (slowestMove=${fastTop.slowestMove.toFixed(1)})`);
      }
      if (!Object.is(fastTop.plannerStyles?.route, refRouteExp) || !Object.is(fastTop.plannerStyles?.plain, refPlainExp)) {
        summary.diffs.push(`plannerStyles ${JSON.stringify(fastTop.plannerStyles)} !== ${JSON.stringify({ route: refRouteExp, plain: refPlainExp })}`);
      }
      if (JSON.stringify(fastTop.lossPhase) !== JSON.stringify(refBestSub0.lossPhase)) {
        summary.diffs.push(`lossPhase ${JSON.stringify(fastTop.lossPhase)} !== ${JSON.stringify(refBestSub0.lossPhase)}`);
      }

      // Compare every move of top-level winning first sub-block (20 campaigns)
      compareCampaignLists(refBestSub0.results, fastTop.results, 'planner-best-s0', summary.diffs);
      // Compare every move of ALL 40 route campaigns AND ALL 40 plain campaigns (80 campaigns total!)
      summary.routeMoves = compareCampaignLists(slowRoutePooled, fastRouteAll.results, 'planner-route-all40', summary.diffs);
      summary.plainMoves = compareCampaignLists(slowPlainPooled, fastPlainAll.results, 'planner-plain-all40', summary.diffs);
      summary.totalMoves = summary.routeMoves + summary.plainMoves;

      summary.expectedTries = fastTop.expectedTries;
      summary.firstTryRate = fastTop.firstTryRate;
      summary.plannerStyles = fastTop.plannerStyles;
      parentPort.postMessage(summary);
    } else if (msg.kind === 'bench') {
      const { id, source, faceUp, tiles, design, impl, runs, seeds, seed, warmup } = msg;
      const runOne = (b, r, s) => {
        if (impl === 'slow') return refBot.measureHuman(b, { setting: 'planner', runs: r, seeds: s, seed, fast: false });
        if (impl === 'g2-fast') return refBot.measureHumanFast(b, { setting: 'planner', runs: r, seeds: s, seed });
        if (impl === 'g4-fast') return fastBot.measureHumanFast(b, { setting: 'planner', runs: r, seeds: s, seed });
        throw new Error(`Unknown impl: ${impl}`);
      };
      if (warmup) {
        runOne(design, 2, 1);
        parentPort.postMessage({ warmup: true });
        return;
      }
      const t0 = performance.now();
      const res = runOne(design, runs, seeds);
      const ms = performance.now() - t0;
      parentPort.postMessage({
        id,
        source,
        faceUp: Boolean(faceUp),
        tiles,
        ms,
        expectedTries: res.expectedTries,
        firstTryRate: res.firstTryRate,
        plannerStyles: res.plannerStyles,
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
  assert(Number.isInteger(args.workers) && args.workers >= 1 && args.workers <= MAX_WORKERS, `Workers must be 1..${MAX_WORKERS}`);
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

function load70Boards() {
  const root = path.resolve(__dirname, '../..');
  const seenKeys = new Set();
  const selected60 = [];

  const pushBoard = (id, source, design, story) => {
    const key = boardKey(design);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    const keyCount = design.obst?.keys?.length || 0;
    const feat = keyCount > 0 && Array.isArray(design.solution) ? task11Keys.features(design) : null;
    selected60.push({
      id,
      source,
      faceUp: false,
      story: story || 'unknown',
      key,
      keyCount,
      keysShownAtStart: feat ? feat.keysShownAtStart : null,
      design,
    });
    return true;
  };

  // 1. All 18 rows from analysis/builder/data/qualified-200-225.jsonl
  const qualPath = path.join(root, 'analysis/builder/data/qualified-200-225.jsonl');
  const qualRows = fs.readFileSync(qualPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  for (const row of qualRows) {
    pushBoard(`qualified-L${row.level}-${row.id}`, 'qualified-200-225', row.design, row.story || row.recipe?.[0] || 'qualified');
  }
  const qualCount = selected60.length;

  // 2. 21 hidden-key boards from analysis/builder/knobs-v1/boards.json
  const knobsPath = path.join(root, 'analysis/builder/knobs-v1/boards.json');
  const knobsRows = JSON.parse(fs.readFileSync(knobsPath, 'utf8'))
    .filter(b => !b.fail && b.design && (b.design.obst?.keys?.length || 0) > 0)
    .filter(b => !seenKeys.has(boardKey(b.design)))
    .filter(b => task11Keys.features(b.design).keysShownAtStart === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const knobsTarget = 20 + Math.max(0, Math.ceil((20 - qualCount) / 2));
  const pickedKnobs = selectStratified(knobsRows, knobsTarget + 5, b => b.brief?.story || b.stage);
  let addedKnobs = 0;
  for (const b of pickedKnobs) {
    if (addedKnobs >= knobsTarget) break;
    if (pushBoard(b.id, 'knobs-v1-hidden-keys', b.design, b.brief?.story)) addedKnobs++;
  }

  // 3. 21 Codex v3 ladder boards from analysis/builder/why-hard-v1/v3-reference/ladder/plan.json
  const ladderPath = path.join(root, 'analysis/builder/why-hard-v1/v3-reference/ladder/plan.json');
  const ladderPlan = JSON.parse(fs.readFileSync(ladderPath, 'utf8'));
  const ladderRows = ladderPlan.boards
    .filter(b => !b.fail && b.design && !seenKeys.has(boardKey(b.design)))
    .sort((a, b) => a.id.localeCompare(b.id));
  const ladderTarget = 60 - selected60.length;
  const pickedLadder = selectStratified(ladderRows, ladderTarget + 10, b => `${b.cell?.story || b.brief?.story}-p${b.cell?.spare || 1}`);
  let addedLadder = 0;
  for (const b of pickedLadder) {
    if (addedLadder >= ladderTarget) break;
    if (pushBoard(b.id, 'v3-ladder', b.design, b.cell?.story || b.brief?.story)) addedLadder++;
  }
  assert.equal(selected60.length, 60, `Expected 60 standard boards, got ${selected60.length}`);

  // 4. Plus 10 counterfactual face-up (`down: []`, gate C2) boards stratified across the 3 sources (4 + 3 + 3)
  const qBoards = selected60.filter(b => b.source === 'qualified-200-225');
  const kBoards = selected60.filter(b => b.source === 'knobs-v1-hidden-keys');
  const lBoards = selected60.filter(b => b.source === 'v3-ladder');
  const faceUpPicks = [
    qBoards[0], qBoards[5], qBoards[10], qBoards[15],
    kBoards[0], kBoards[7], kBoards[14],
    lBoards[0], lBoards[7], lBoards[14],
  ];
  const faceUp10 = faceUpPicks.map(b => {
    const design = { ...b.design, down: [] };
    return {
      id: `${b.id}-faceup`,
      source: `${b.source}-faceup`,
      baseSource: b.source,
      faceUp: true,
      story: b.story,
      key: boardKey(design),
      keyCount: b.keyCount,
      keysShownAtStart: b.keyCount,
      design,
    };
  });
  assert.equal(faceUp10.length, 10);

  const boards = [...selected60, ...faceUp10];
  return {
    boards,
    standard60: selected60,
    faceUp10,
    counts: {
      qualified200_225: qualCount,
      knobsV1HiddenKeys: addedKnobs,
      v3Ladder: addedLadder,
      faceUpGateC2: faceUp10.length,
      total: boards.length,
    },
  };
}

function runWorkerPool(workerCount, tasks, onResult) {
  return new Promise((resolve, reject) => {
    if (tasks.length === 0) { resolve(); return; }
    const nWorkers = Math.min(workerCount, tasks.length, MAX_WORKERS);
    const workers = [];
    let cursor = 0, completed = 0, settled = false;

    const cleanup = () => {
      for (const w of workers) {
        try { w.postMessage({ kind: 'stop' }); } catch {}
      }
    };

    for (let i = 0; i < nWorkers; i++) {
      const w = new Worker(__filename);
      workers.push(w);
      w.on('message', res => {
        if (settled) return;
        onResult(res);
        completed++;
        if (completed === tasks.length) {
          settled = true;
          cleanup();
          resolve();
        } else if (cursor < tasks.length) {
          w.postMessage(tasks[cursor++]);
        }
      });
      w.on('error', err => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });
      w.on('exit', code => {
        if (!settled && code !== 0) {
          settled = true;
          cleanup();
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
      w.postMessage(tasks[cursor++]);
    }
  });
}

function summarizeTimes(msList, wallMs, workers) {
  const sorted = [...msList].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const meanMs = sum / sorted.length;
  const medianMs = sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const p90Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  const maxMs = sorted[sorted.length - 1];
  return {
    boards: sorted.length,
    workers,
    wallSec: Number((wallMs / 1000).toFixed(2)),
    effectiveSecPerBoard: Number((wallMs / 1000 / sorted.length).toFixed(3)),
    workerMeanSecPerBoard: Number((meanMs / 1000).toFixed(3)),
    workerMedianSecPerBoard: Number((medianMs / 1000).toFixed(3)),
    workerP90SecPerBoard: Number((p90Ms / 1000).toFixed(3)),
    workerMaxSecPerBoard: Number((maxMs / 1000).toFixed(3)),
  };
}

async function runVerify(args) {
  const { boards, counts } = load70Boards();
  const completedById = new Map();
  if (args.checkpoint && fs.existsSync(args.checkpoint)) {
    const saved = JSON.parse(fs.readFileSync(args.checkpoint, 'utf8'));
    for (const item of saved.results || []) completedById.set(item.id, item);
    console.log(`Resumed ${completedById.size}/${boards.length} verified boards from checkpoint.`);
  }

  const pending = boards
    .map((b, index) => ({
      kind: 'verify',
      index,
      id: b.id,
      source: b.source,
      faceUp: b.faceUp,
      keysShownAtStart: b.keysShownAtStart,
      keyCount: b.keyCount,
      design: b.design,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
    }))
    .filter(t => !completedById.has(t.id));

  console.log(`Verifying ${pending.length} remaining boards (total ${boards.length}: 60 standard + 10 face-up) on ${args.workers} workers...`);
  const t0 = performance.now();
  await runWorkerPool(args.workers, pending, res => {
    completedById.set(res.id, res);
    const tag = res.diffs.length === 0 ? 'OK' : `DRIFT(${res.diffs.length})`;
    console.log(
      `[${completedById.size}/${boards.length}] ${tag} ${res.id} (${res.source}) ` +
      `exp=${res.expectedTries} styles=${JSON.stringify(res.plannerStyles)} ` +
      `moves=${res.totalMoves} slow=${(res.slowMs / 1000).toFixed(2)}s fast=${(res.fastMs / 1000).toFixed(2)}s`
    );
    if (args.checkpoint) {
      fs.mkdirSync(path.dirname(path.resolve(args.checkpoint)), { recursive: true });
      fs.writeFileSync(path.resolve(args.checkpoint), JSON.stringify({ results: [...completedById.values()] }, null, 2));
    }
  });
  const wallSec = (performance.now() - t0) / 1000;

  const ordered = boards.map(b => completedById.get(b.id));
  const driftBoards = ordered.filter(r => r.diffs.length > 0);
  const totalRouteMoves = ordered.reduce((s, r) => s + r.routeMoves, 0);
  const totalPlainMoves = ordered.reduce((s, r) => s + r.plainMoves, 0);
  const totalMovesChecked = totalRouteMoves + totalPlainMoves;
  const totalAuditedTaps = ordered.reduce((s, r) => s + r.verifiedTaps, 0);

  const report = {
    schema: 'planner-fast-zero-drift-v1',
    created: new Date().toISOString(),
    protocol: {
      workers: args.workers,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      setting: 'planner',
      stylesVerified: ['route', 'plain'],
      campaignsVerifiedPerBoard: args.runs * args.seeds * 2,
      auditRate: 0.01,
      boardCounts: counts,
    },
    wallSec: Number(wallSec.toFixed(2)),
    driftCount: driftBoards.length,
    totalBoards: ordered.length,
    standardBoards: counts.total - counts.faceUpGateC2,
    faceUpBoards: counts.faceUpGateC2,
    totalCampaignsChecked: ordered.length * args.runs * args.seeds * 2,
    totalRouteMoves,
    totalPlainMoves,
    totalMovesChecked,
    totalAuditedTaps,
    driftBoards,
    results: ordered,
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(report, null, 2) + '\n');
  }

  console.log(
    `\nZero-drift summary: driftCount=${report.driftCount}/${report.totalBoards} ` +
    `(${report.totalCampaignsChecked} campaigns, ${totalMovesChecked} moves, ${totalAuditedTaps} audited taps)`
  );
  if (report.driftCount > 0) {
    console.error('DRIFT DETECTED:', JSON.stringify(driftBoards, null, 2));
    process.exitCode = 1;
  }
}

async function runBench(args) {
  const { standard60, faceUp10 } = load70Boards();
  // Exact same balanced 18-board standard subset as G3 (6 qualified + 6 knobs hidden-keys + 6 v3-ladder)
  const pick6 = src => standard60.filter(b => b.source === src).filter((_, i) => i % 3 === 0).slice(0, 6);
  const bench18Standard = [...pick6('qualified-200-225'), ...pick6('knobs-v1-hidden-keys'), ...pick6('v3-ladder')];
  assert.equal(bench18Standard.length, 18);

  // Plus 6 face-up (`down: []`, gate C2) boards (2 from each source)
  const bench6FaceUp = [faceUp10[0], faceUp10[2], faceUp10[4], faceUp10[5], faceUp10[7], faceUp10[8]];
  assert.equal(bench6FaceUp.length, 6);

  const bench24 = [...bench18Standard, ...bench6FaceUp];

  async function measureSuite(subset, impl, workers) {
    const warmTasks = Array.from({ length: workers }, () => ({
      kind: 'bench',
      id: subset[0].id,
      source: subset[0].source,
      faceUp: subset[0].faceUp,
      tiles: subset[0].design.tiles.length,
      design: subset[0].design,
      impl,
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
      faceUp: b.faceUp,
      tiles: b.design.tiles.length,
      design: b.design,
      impl,
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      warmup: false,
    }));
    const t0 = performance.now();
    await runWorkerPool(workers, tasks, res => items.push(res));
    const wallMs = performance.now() - t0;
    const summaryAll = summarizeTimes(items.map(x => x.ms), wallMs, workers);
    const stdItems = items.filter(x => !x.faceUp);
    const fuItems = items.filter(x => x.faceUp);
    const stdSum = stdItems.reduce((s, x) => s + x.ms, 0);
    const fuSum = fuItems.reduce((s, x) => s + x.ms, 0);
    const summaryStd = summarizeTimes(stdItems.map(x => x.ms), workers === 1 ? stdSum : wallMs * (stdSum / (stdSum + fuSum)), workers);
    const summaryFaceUp = summarizeTimes(fuItems.map(x => x.ms), workers === 1 ? fuSum : wallMs * (fuSum / (stdSum + fuSum)), workers);
    console.log(
      `[bench] impl=${impl} workers=${workers} n=${subset.length}: ` +
      `all=${summaryAll.effectiveSecPerBoard}s/b  std18=${summaryStd.workerMeanSecPerBoard}s/b  faceup6=${summaryFaceUp.workerMeanSecPerBoard}s/b  wall=${summaryAll.wallSec}s`
    );
    return { summaryAll, summaryStd, summaryFaceUp, boards: items };
  }

  console.log(`Running Task G4 planner speed benchmark (24 boards: 18 standard + 6 face-up, 1 core vs ${args.workers} workers)...`);
  const oneCoreSlow = await measureSuite(bench24, 'slow', 1);
  const oneCoreG2 = await measureSuite(bench24, 'g2-fast', 1);
  const oneCoreG4 = await measureSuite(bench24, 'g4-fast', 1);

  const sixSlow = await measureSuite(bench24, 'slow', args.workers);
  const sixG2 = await measureSuite(bench24, 'g2-fast', args.workers);
  const sixG4 = await measureSuite(bench24, 'g4-fast', args.workers);

  const checkSame = (refRun, otherRun, label) => {
    const byId = new Map(refRun.boards.map(x => [x.id, x]));
    for (const o of otherRun.boards) {
      const r = byId.get(o.id);
      assert.equal(o.expectedTries, r.expectedTries, `${label} expectedTries mismatch on ${o.id}`);
      assert.equal(o.firstTryRate, r.firstTryRate, `${label} firstTryRate mismatch on ${o.id}`);
      assert.deepEqual(o.plannerStyles, r.plannerStyles, `${label} plannerStyles mismatch on ${o.id}`);
    }
  };
  checkSame(oneCoreSlow, oneCoreG2, '1core-g2');
  checkSame(oneCoreSlow, oneCoreG4, '1core-g4');
  checkSame(sixSlow, sixG4, '6workers-g4');

  const perBoardOneCore = bench24.map(b => {
    const s = oneCoreSlow.boards.find(x => x.id === b.id);
    const g2 = oneCoreG2.boards.find(x => x.id === b.id);
    const g4 = oneCoreG4.boards.find(x => x.id === b.id);
    return {
      id: b.id,
      source: b.source,
      faceUp: b.faceUp,
      tiles: b.design.tiles.length,
      expectedTries: g4.expectedTries,
      plannerStyles: g4.plannerStyles,
      slowSec: Number((s.ms / 1000).toFixed(3)),
      g2FastSec: Number((g2.ms / 1000).toFixed(3)),
      g4FastSec: Number((g4.ms / 1000).toFixed(3)),
      speedupG4OverSlowX: Number((s.ms / g4.ms).toFixed(2)),
      speedupG4OverG2X: Number((g2.ms / g4.ms).toFixed(2)),
    };
  });

  const report = {
    schema: 'planner-fast-benchmarks-v1',
    created: new Date().toISOString(),
    protocol: {
      runs: args.runs,
      seeds: args.seeds,
      seed: args.seed,
      setting: 'planner',
      auditRate: 0.01,
      standardBoards: bench18Standard.length,
      faceUpBoards: bench6FaceUp.length,
      totalBoards: bench24.length,
      parallelWorkers: args.workers,
    },
    all24Boards: {
      oneCore: {
        slow: oneCoreSlow.summaryAll,
        g2Fast: oneCoreG2.summaryAll,
        g4Fast: oneCoreG4.summaryAll,
        speedupG2OverSlowX: Number((oneCoreSlow.summaryAll.effectiveSecPerBoard / oneCoreG2.summaryAll.effectiveSecPerBoard).toFixed(2)),
        speedupG4OverSlowX: Number((oneCoreSlow.summaryAll.effectiveSecPerBoard / oneCoreG4.summaryAll.effectiveSecPerBoard).toFixed(2)),
        speedupG4OverG2X: Number((oneCoreG2.summaryAll.effectiveSecPerBoard / oneCoreG4.summaryAll.effectiveSecPerBoard).toFixed(2)),
      },
      sixWorkers: {
        slow: sixSlow.summaryAll,
        g2Fast: sixG2.summaryAll,
        g4Fast: sixG4.summaryAll,
        speedupG4OverSlowSixWorkersX: Number((sixSlow.summaryAll.effectiveSecPerBoard / sixG4.summaryAll.effectiveSecPerBoard).toFixed(2)),
        speedupG4OverG2SixWorkersX: Number((sixG2.summaryAll.effectiveSecPerBoard / sixG4.summaryAll.effectiveSecPerBoard).toFixed(2)),
        speedupG4SixWorkersOverOneCoreSlowX: Number((oneCoreSlow.summaryAll.effectiveSecPerBoard / sixG4.summaryAll.effectiveSecPerBoard).toFixed(2)),
      },
    },
    standard18Boards: {
      oneCore: {
        slowSecPerBoard: oneCoreSlow.summaryStd.workerMeanSecPerBoard,
        g2FastSecPerBoard: oneCoreG2.summaryStd.workerMeanSecPerBoard,
        g4FastSecPerBoard: oneCoreG4.summaryStd.workerMeanSecPerBoard,
        speedupG4OverSlowX: Number((oneCoreSlow.summaryStd.workerMeanSecPerBoard / oneCoreG4.summaryStd.workerMeanSecPerBoard).toFixed(2)),
        speedupG4OverG2X: Number((oneCoreG2.summaryStd.workerMeanSecPerBoard / oneCoreG4.summaryStd.workerMeanSecPerBoard).toFixed(2)),
      },
      sixWorkers: {
        slowEffectiveSecPerBoard: sixSlow.summaryStd.effectiveSecPerBoard,
        g2FastEffectiveSecPerBoard: sixG2.summaryStd.effectiveSecPerBoard,
        g4FastEffectiveSecPerBoard: sixG4.summaryStd.effectiveSecPerBoard,
        speedupG4OverSlowSixWorkersX: Number((sixSlow.summaryStd.effectiveSecPerBoard / sixG4.summaryStd.effectiveSecPerBoard).toFixed(2)),
      },
    },
    faceUp6BoardsGateC2: {
      oneCore: {
        slowSecPerBoard: oneCoreSlow.summaryFaceUp.workerMeanSecPerBoard,
        g2FastSecPerBoard: oneCoreG2.summaryFaceUp.workerMeanSecPerBoard,
        g4FastSecPerBoard: oneCoreG4.summaryFaceUp.workerMeanSecPerBoard,
        speedupG4OverSlowX: Number((oneCoreSlow.summaryFaceUp.workerMeanSecPerBoard / oneCoreG4.summaryFaceUp.workerMeanSecPerBoard).toFixed(2)),
        speedupG4OverG2X: Number((oneCoreG2.summaryFaceUp.workerMeanSecPerBoard / oneCoreG4.summaryFaceUp.workerMeanSecPerBoard).toFixed(2)),
      },
    },
    perBoardOneCore,
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(report, null, 2) + '\n');
  }

  console.log('\nBenchmark summary:', JSON.stringify({
    all24: {
      oneCoreSlow: report.all24Boards.oneCore.slow.effectiveSecPerBoard,
      oneCoreG2: report.all24Boards.oneCore.g2Fast.effectiveSecPerBoard,
      oneCoreG4: report.all24Boards.oneCore.g4Fast.effectiveSecPerBoard,
      speedupOverSlowX: report.all24Boards.oneCore.speedupG4OverSlowX,
      speedupOverG2X: report.all24Boards.oneCore.speedupG4OverG2X,
      sixWorkersG4: report.all24Boards.sixWorkers.g4Fast.effectiveSecPerBoard,
      sixWorkersSpeedupOverSlowSixX: report.all24Boards.sixWorkers.speedupG4OverSlowSixWorkersX,
    },
    standard18: report.standard18Boards.oneCore,
    faceUp6GateC2: report.faceUp6BoardsGateC2.oneCore,
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
