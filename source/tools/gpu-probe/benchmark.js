'use strict';

/**
 * Task G1 Benchmark & Real-Bot Profiler (source/tools/gpu-probe/benchmark.js).
 *
 * Collects all quantitative measurements required by TASK-G1-gpu-probe.md:
 *   1. Hardware & driver/runtime inventory (RTX 3070, CUDA/CuPy NVRTC, Node WebGPU Dawn D3D12, CPU).
 *   2. Step 3 win-rate agreement table (CPU worker pool vs GPU thread & warp kernels).
 *   3. Step 4 games/sec matrix on 76-, 84-, and 96-tile boards at 1k, 10k, and 100k games
 *      (including cold startup, warm board pack + H2D/D2H copy, and pure kernel time),
 *      evaluated on both unaltered qualified-200-225.jsonl boards and full-depth variants.
 *   4. Step 5 empirical baseline & phase breakdown of the real `family` and `planner` bots
 *      (`human_style_measure.js` / `human_factory_controller.js`) on the same 3 test boards,
 *      without modifying any files outside `source/tools/gpu-probe/`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { performance } = require('perf_hooks');

const {
  packBoard,
  runRangeSync,
  CpuWorkerPool,
  runCpuColdWithWorkers,
} = require('./cpu_playout.js');

const PYTHON_BIN = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
const GPU_SCRIPT = path.join(__dirname, 'gpu_playout.py');
const QUAL_PATH = path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'qualified-200-225.jsonl');
const TRAIN_PATH = path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'training-data.json');
const DEFAULT_OUT = path.resolve(__dirname, '..', '..', '..', '..', 'gemini-tasks', 'results', 'gpu-probe', 'measurements.json');

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function probeNodeWebGpu() {
  const builtinWebGpu = typeof globalThis.navigator !== 'undefined' && !!globalThis.navigator.gpu;
  let dawn = { available: false };
  try {
    const t0 = performance.now();
    const webgpu = require('webgpu');
    const { GPUBufferUsage, GPUMapMode } = webgpu.globals;
    const instance = webgpu.create([]);
    const adapter = await instance.requestAdapter({ powerPreference: 'high-performance' });
    const device = await adapter.requestDevice();
    const initMs = performance.now() - t0;

    // Measure a tiny 8.5 KB H2D + compute dispatch + 8 B readback round-trip in Dawn D3D12
    const shader = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read> inp: array<u32>;
        @group(0) @binding(1) var<storage, read_write> out: array<atomic<u32>>;
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
          if (gid.x < arrayLength(&inp)) {
            atomicAdd(&out[0], inp[gid.x] & 1u);
          }
        }
      `,
    });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' },
    });
    const inBuf = device.createBuffer({ size: 8528, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const outBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const readBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuf } },
        { binding: 1, resource: { buffer: outBuf } },
      ],
    });

    const payload = new Uint8Array(8528);
    const rtTrials = [];
    for (let k = 0; k < 5; k++) {
      const ts = performance.now();
      device.queue.writeBuffer(inBuf, 0, payload);
      const enc = device.createCommandEncoder();
      enc.clearBuffer(outBuf);
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(34);
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, 16);
      device.queue.submit([enc.finish()]);
      await readBuf.mapAsync(GPUMapMode.READ);
      readBuf.unmap();
      rtTrials.push(performance.now() - ts);
    }
    const info = adapter.info || {};
    device.destroy();
    dawn = {
      available: true,
      package: 'webgpu@0.6.2 (Dawn native bindings)',
      vendor: info.vendor || 'nvidia',
      architecture: info.architecture || 'ampere',
      device: info.device || 'NVIDIA GeForce RTX 3070',
      description: info.description || '',
      backendType: info.backendType || 'd3d12',
      initMs: Number(initMs.toFixed(2)),
      medianRoundTripMs: Number(median(rtTrials).toFixed(3)),
    };
  } catch (err) {
    dawn = { available: false, error: String(err && err.message || err) };
  }
  return { builtinNavigatorGpu: builtinWebGpu, dawnWebGpu: dawn };
}

function measureGpuColdSpawns(qualPath) {
  // 1. Measure uncached NVRTC compile startup once using an isolated CUPY_CACHE_DIR
  const tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), 'cupy_uncached_'));
  let uncachedColdMs = null;
  let uncachedInitMs = null;
  try {
    const out = JSON.parse(execFileSync(
      PYTHON_BIN,
      [GPU_SCRIPT, '--cmd', 'run', '--input-json', qualPath, '--board-idx', '2', '--games', '1000', '--mode', 'warp'],
      { encoding: 'utf8', env: { ...process.env, CUPY_CACHE_DIR: tmpCache } }
    ));
    uncachedColdMs = Number(out.coldStartupMs.toFixed(2));
    uncachedInitMs = Number(out.engineInitMs.toFixed(2));
  } finally {
    try { fs.rmSync(tmpCache, { recursive: true, force: true }); } catch (_) {}
  }

  // 2. Measure 3 cached subprocess startups (standard CUPY_CACHE_DIR)
  const cachedStartups = [];
  const cachedInits = [];
  for (let i = 0; i < 3; i++) {
    const out = JSON.parse(execFileSync(
      PYTHON_BIN,
      [GPU_SCRIPT, '--cmd', 'run', '--input-json', qualPath, '--board-idx', '2', '--games', '1000', '--mode', 'warp'],
      { encoding: 'utf8' }
    ));
    cachedStartups.push(out.coldStartupMs);
    cachedInits.push(out.engineInitMs);
  }
  return {
    uncachedColdStartupMs: uncachedColdMs,
    uncachedEngineInitMs: uncachedInitMs,
    cachedColdStartupMedianMs: Number(median(cachedStartups).toFixed(2)),
    cachedEngineInitMedianMs: Number(median(cachedInits).toFixed(2)),
  };
}

function runGpuBenchSuite(cases, repeats = 7) {
  const tmpPayload = path.join(os.tmpdir(), `gpu_bench_${process.pid}.json`);
  fs.writeFileSync(tmpPayload, JSON.stringify({ repeats, cases }));
  try {
    const stdout = execFileSync(
      PYTHON_BIN,
      [GPU_SCRIPT, '--cmd', 'bench', '--input-json', tmpPayload],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    return JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmpPayload); } catch (_) {}
  }
}

async function runCpuBenchSuite(cases, numWorkers, repeats = 7) {
  // Measure cold worker-pool creation overhead (median of 3 spawns)
  const poolInitSamples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const p = new CpuWorkerPool(numWorkers);
    await p.runGames(cases[0].design, 200, 1);
    const total = performance.now() - t0;
    await p.close();
    poolInitSamples.push(total);
  }
  const medianPoolColdOverheadMs = median(poolInitSamples);

  const pool = new CpuWorkerPool(numWorkers);
  // Warm up V8 JIT across all workers
  await pool.runGames(cases[0].design, 20000, 1);
  packBoard(cases[0].design);
  runRangeSync(packBoard(cases[0].design), 1, 0, 2000);

  const runs = [];
  try {
    for (const c of cases) {
      for (const numGames of c.counts) {
        // Warm multi-core worker pool
        const warmTrials = [];
        let lastRes = null;
        for (let r = 0; r < repeats; r++) {
          const res = await pool.runGames(c.design, numGames, 42 + r * 1000);
          warmTrials.push(res.elapsedMs);
          if (r === 0) lastRes = res;
        }
        const medWarmMs = median(warmTrials);

        // Actual cold worker-pool run for 1 repeat on 1k/10k/100k + modeled median cold
        const coldSample = await runCpuColdWithWorkers(c.design, numGames, 42, numWorkers);

        // Single-core baseline (3 repeats on 1k/10k, 1 repeat on 100k to keep CPU burst tiny)
        const scRepeats = numGames >= 100000 ? 1 : 3;
        const scTrials = [];
        const scPackTrials = [];
        for (let r = 0; r < scRepeats; r++) {
          const ts = performance.now();
          const pb = packBoard(c.design);
          const tp = performance.now();
          runRangeSync(pb, 42 + r * 1000, 0, numGames);
          const te = performance.now();
          scPackTrials.push(tp - ts);
          scTrials.push(te - ts);
        }
        const medScMs = median(scTrials);

        runs.push({
          label: c.label,
          id: c.id,
          tiles: c.design.tiles.length,
          numGames,
          numWorkers,
          wins: lastRes.wins,
          winRate: lastRes.winRate,
          avgMoves: lastRes.avgMoves,
          singleCorePackMs: Number(median(scPackTrials).toFixed(3)),
          singleCoreTotalMs: Number(medScMs.toFixed(3)),
          singleCoreGamesPerSec: Math.round((numGames / medScMs) * 1000),
          warmWorkersTotalMs: Number(medWarmMs.toFixed(3)),
          warmWorkersGamesPerSec: Math.round((numGames / medWarmMs) * 1000),
          coldWorkersMeasuredMs: Number(coldSample.totalMs.toFixed(3)),
          coldWorkersGamesPerSec: Math.round(coldSample.coldGamesPerSec),
        });
      }
    }
  } finally {
    await pool.close();
  }

  return {
    numWorkers,
    medianPoolColdInitMs: Number(medianPoolColdOverheadMs.toFixed(2)),
    runs,
  };
}

function profileRealBots(boards) {
  const { normalizeBoard } = require('../sim/refit/public_board_input.js');
  const { campaign } = require('../sim/refit/human_style_environment.js');
  const { createFactoryController } = require('../sim/refit/human_factory_controller.js');
  const release = require('../sim/refit/human_release.js');

  const PLANNER_OVERRIDES = {
    spotPenalty: 200,
    lookDepth: 2,
    lookPenalty: 150,
    lookFrom: 1,
    pairFirst: 100,
    freePeekBonus: 70,
    clockNeedFull: 1,
    routePlan: 300,
    routeBeam: 300,
    routeNeed: 1,
    routeNeedTray: 2,
    routeNeedSlack: 99,
  };

  const results = [];
  const sampleCampaigns = 4; // Small fast burst on 1 core (~3-5s total across all boards)

  for (const b of boards) {
    const encoded = normalizeBoard(b.design);
    for (const mode of ['family', 'planner_route', 'planner_plain']) {
      const baseProfile = mode === 'family' ? release.profiles.family : release.profiles.Dennis;
      const profile = mode === 'family'
        ? baseProfile
        : mode === 'planner_route'
          ? { ...baseProfile, ...PLANNER_OVERRIDES }
          : { ...baseProfile, ...PLANNER_OVERRIDES, routeNeed: 0 };

      let decideMs = 0;
      let observeCtrlMs = 0;
      let ctrlInitMs = 0;
      let totalDecisions = 0;
      let totalAttempts = 0;
      let wins = 0;

      const timedControllerFactory = (tiles, prof, seed) => {
        const t0 = performance.now();
        const inner = createFactoryController(tiles, prof, seed);
        ctrlInitMs += performance.now() - t0;
        return {
          beginAttempt() {
            const ts = performance.now();
            const r = inner.beginAttempt();
            observeCtrlMs += performance.now() - ts;
            return r;
          },
          observe(state, obs) {
            const ts = performance.now();
            const r = inner.observe(state, obs);
            observeCtrlMs += performance.now() - ts;
            return r;
          },
          decide() {
            const ts = performance.now();
            const r = inner.decide();
            decideMs += performance.now() - ts;
            totalDecisions++;
            return r;
          },
          endAttempt(phase, tray) {
            if (!inner.endAttempt) return;
            const ts = performance.now();
            const r = inner.endAttempt(phase, tray);
            observeCtrlMs += performance.now() - ts;
            return r;
          },
          remembered() {
            return inner.remembered ? inner.remembered() : null;
          },
        };
      };

      const tStart = performance.now();
      for (let run = 0; run < sampleCampaigns; run++) {
        const seed = (4711 + Math.imul(run + 1, 0x9e3779b9)) | 0;
        const c = campaign(encoded, profile, seed, {
          maxAttempts: 20,
          capture: 'tail',
          choiceLimit: 1024,
          controllerFactory: timedControllerFactory,
        });
        totalAttempts += c.attempts.length;
        if (c.wonOn !== null) wins++;
      }
      const totalWallMs = performance.now() - tStart;
      const envSessionVerifyVisMs = Math.max(0, totalWallMs - decideMs - observeCtrlMs - ctrlInitMs);

      const msPerCampaign = totalWallMs / sampleCampaigns;
      const msPerAttempt = totalWallMs / totalAttempts;
      const usPerMoveTotal = (totalWallMs * 1000) / Math.max(1, totalDecisions);
      const usPerMoveDecide = (decideMs * 1000) / Math.max(1, totalDecisions);

      results.push({
        id: b.id,
        tiles: b.design.tiles.length,
        mode,
        sampleCampaigns,
        winsInSample: wins,
        avgAttemptsPerCampaign: Number((totalAttempts / sampleCampaigns).toFixed(2)),
        avgMovesPerAttempt: Number((totalDecisions / totalAttempts).toFixed(2)),
        totalWallMs: Number(totalWallMs.toFixed(2)),
        msPerCampaign: Number(msPerCampaign.toFixed(2)),
        msPerAttempt: Number(msPerAttempt.toFixed(3)),
        usPerMoveTotal: Number(usPerMoveTotal.toFixed(1)),
        usPerMoveDecideOnly: Number(usPerMoveDecide.toFixed(1)),
        shareDecidePct: Number(((decideMs / totalWallMs) * 100).toFixed(1)),
        shareCtrlMemoryPct: Number(((observeCtrlMs / totalWallMs) * 100).toFixed(1)),
        shareEnvSessionVerifyVisibilityPct: Number(((envSessionVerifyVisMs / totalWallMs) * 100).toFixed(1)),
        // Projected single-core & 20-thread wall time for standard builder ratings
        estSingleCore80CampaignsSec: Number(((msPerCampaign * 80) / 1000).toFixed(2)),
        estSingleCore160CampaignsSec: Number(((msPerCampaign * 160) / 1000).toFixed(2)),
      });
    }
  }
  return results;
}

async function main() {
  const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  console.log('[1/5] Probing PC hardware, Dawn WebGPU, and CuPy cold startup...');
  const cpus = os.cpus();
  const webgpuInfo = await probeNodeWebGpu();
  const coldGpuStats = measureGpuColdSpawns(QUAL_PATH);

  const qualLines = fs.readFileSync(QUAL_PATH, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const trainData = JSON.parse(fs.readFileSync(TRAIN_PATH, 'utf8'));

  const q76Row = qualLines[2];   // ebe4a48640ad0101 (76 tiles, level 202)
  const q84Row = qualLines[4];   // ec63a46d1a4e6eef (84 tiles, level 204)
  const q96Row = qualLines[13];  // 97f6bf020e56366b (96 tiles, level 220)

  const counts = [1000, 10000, 100000];
  const benchCases = [
    {
      label: 'qualified_76t',
      id: q76Row.id,
      level: q76Row.level,
      variant: 'unaltered',
      design: q76Row.design,
      counts,
    },
    {
      label: 'qualified_84t',
      id: q84Row.id,
      level: q84Row.level,
      variant: 'unaltered',
      design: q84Row.design,
      counts,
    },
    {
      label: 'qualified_96t',
      id: q96Row.id,
      level: q96Row.id,
      levelNum: q96Row.level,
      variant: 'unaltered',
      design: q96Row.design,
      counts,
    },
    {
      label: 'fulldepth_76t',
      id: q76Row.id + ':clock=76',
      level: q76Row.level,
      variant: 'full_depth_clock_n',
      design: { ...q76Row.design, clock: { i: q76Row.design.clock.i, n: q76Row.design.tiles.length } },
      counts,
    },
    {
      label: 'fulldepth_84t',
      id: qualLines[5].id + ':clock=84',
      level: qualLines[5].level,
      variant: 'full_depth_clock_n',
      design: { ...qualLines[5].design, clock: { i: qualLines[5].design.clock.i, n: qualLines[5].design.tiles.length } },
      counts,
    },
    {
      label: 'fulldepth_96t',
      id: q96Row.id + ':clock=96',
      level: q96Row.level,
      variant: 'full_depth_clock_n',
      design: { ...q96Row.design, clock: { i: q96Row.design.clock.i, n: q96Row.design.tiles.length } },
      counts,
    },
  ];

  console.log('[2/5] Running Step 3 win-rate agreement check (50,000 games x 4 positive-win boards)...');
  const winRateBoards = [
    { name: 'hist_76t_unaltered', tiles: 76, design: trainData[1087].design, numGames: 50000, seed: 4242, indepSeed: 91919 },
    { name: 'qual_76t_fulldepth', tiles: 76, design: benchCases[3].design, numGames: 50000, seed: 4242, indepSeed: 92929 },
    { name: 'qual_84t_fulldepth', tiles: 84, design: benchCases[4].design, numGames: 50000, seed: 4242, indepSeed: 93939 },
    { name: 'qual_96t_fulldepth', tiles: 96, design: benchCases[5].design, numGames: 50000, seed: 4242, indepSeed: 94949 },
  ];
  const tmpVerify = path.join(os.tmpdir(), `gpu_wr_${process.pid}.json`);
  fs.writeFileSync(tmpVerify, JSON.stringify({ fixedReplays: [], traceChecks: [], winRateChecks: winRateBoards }));
  let wrGpu;
  try {
    wrGpu = JSON.parse(execFileSync(PYTHON_BIN, [GPU_SCRIPT, '--cmd', 'verify', '--input-json', tmpVerify], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }));
  } finally {
    try { fs.unlinkSync(tmpVerify); } catch (_) {}
  }

  const wrPool = new CpuWorkerPool(os.cpus().length);
  const winRateSummary = [];
  try {
    for (let i = 0; i < winRateBoards.length; i++) {
      const wb = winRateBoards[i];
      const cpuSame = await wrPool.runGames(wb.design, wb.numGames, wb.seed);
      const g = wrGpu.winRateChecks[i];
      const pPool = (cpuSame.wins + g.indepWarp.wins) / (2 * wb.numGames);
      const se = Math.sqrt(pPool * (1 - pPool) * (2 / wb.numGames));
      const z = se > 0 ? Math.abs(cpuSame.winRate - g.indepWarp.winRate) / se : 0;
      winRateSummary.push({
        name: wb.name,
        tiles: wb.tiles,
        numGames: wb.numGames,
        cpuWins: cpuSame.wins,
        gpuThreadSameSeedWins: g.thread.wins,
        gpuWarpSameSeedWins: g.warp.wins,
        gpuWarpIndepSeedWins: g.indepWarp.wins,
        cpuWinRatePct: Number((cpuSame.winRate * 100).toFixed(3)),
        gpuIndepWinRatePct: Number((g.indepWarp.winRate * 100).toFixed(3)),
        absDiffPct: Number((Math.abs(cpuSame.winRate - g.indepWarp.winRate) * 100).toFixed(3)),
        zScore: Number(z.toFixed(3)),
        avgMoves: Number(cpuSame.avgMoves.toFixed(2)),
      });
    }
  } finally {
    await wrPool.close();
  }

  console.log('[3/5] Running Step 4 GPU benchmarks (1k, 10k, 100k on 76, 84, 96 tiles)...');
  const gpuBench = runGpuBenchSuite(benchCases, 7);
  // Adjust coldGamesPerSec to also report using median cached cold startup
  for (const r of gpuBench.runs) {
    r.cachedColdTotalMs = Number((coldGpuStats.cachedColdStartupMedianMs + r.medianWarmTotalMs).toFixed(3));
    r.cachedColdGamesPerSec = Math.round((r.numGames / r.cachedColdTotalMs) * 1000);
    r.uncachedColdTotalMs = Number((coldGpuStats.uncachedColdStartupMs + r.medianWarmTotalMs).toFixed(3));
    r.uncachedColdGamesPerSec = Math.round((r.numGames / r.uncachedColdTotalMs) * 1000);
    r.warmGamesPerSec = Math.round(r.warmGamesPerSec);
    r.kernelGamesPerSec = Math.round(r.kernelGamesPerSec);
    r.medianPackMs = Number(r.medianPackMs.toFixed(3));
    r.medianCopyAndLaunchMs = Number(r.medianCopyAndLaunchMs.toFixed(3));
    r.medianKernelMs = Number(r.medianKernelMs.toFixed(3));
    r.medianWarmTotalMs = Number(r.medianWarmTotalMs.toFixed(3));
  }

  console.log('[4/5] Running Step 4 CPU worker_threads benchmarks (20 logical threads + 1-core)...');
  const cpuBench = await runCpuBenchSuite(benchCases, cpus.length, 7);

  console.log('[5/5] Profiling real family & planner bots on 76-, 84-, and 96-tile boards...');
  const realBotProfile = profileRealBots([
    { id: q76Row.id, design: q76Row.design },
    { id: q84Row.id, design: q84Row.design },
    { id: q96Row.id, design: q96Row.design },
  ]);

  const output = {
    generatedAt: new Date().toISOString(),
    system: {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpuModel: cpus[0].model.trim(),
      logicalThreads: cpus.length,
      physicalCoresNote: '12 physical cores (8 Performance + 4 Efficient), 20 logical threads',
      nodeVersion: process.version,
      gpuModel: gpuBench.device,
      gpuSmCount: gpuBench.smCount,
      gpuCudaCores: 5888,
      gpuVramMiB: 8192,
      nvidiaDriver: '610.88 (CUDA 13.3 UMD)',
      pythonGpuStack: 'Python 3.11.15 + cupy-cuda12x 14.2.0 + nvidia-cuda-nvrtc-cu12 12.9.86',
      nodeWebGpu: webgpuInfo,
      gpuStartupOverhead: coldGpuStats,
    },
    winRateVerification: winRateSummary,
    gpuBenchmarks: gpuBench.runs,
    cpuBenchmarks: cpuBench,
    realBotProfile,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`Saved full measurements to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
