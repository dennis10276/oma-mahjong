'use strict';

/**
 * Verification suite for Task G1 (source/tools/gpu-probe/test_gpu_probe.js).
 * Checks:
 *   1. Fixed move sequences: GPU CUDA kernel (`replay_fixed_kernel`) and CPU (`stepFixedAction`)
 *      agree step-by-step with `source/tools/builder/engine.js` (`E.step`, `E.legal`, `E.won`)
 *      across all rules (free tiles, 3-slot tray / 4th loses, ice h=1..2, locks+keys, clock
 *      deadline, face-down tiles, peek pairs at tray=3, clock-saving peek pairs, and >96 tiles).
 *   2. Playout traces: 300 seeded games on 6 boards produce identical action sequences on GPU and
 *      CPU, and every single move is accepted by `E.step` with matching terminal win/loss.
 *   3. Win rates across multi-core CPU worker threads and GPU (`thread` and `warp` kernels):
 *      exact match on identical seeds and within Binomial sampling noise (|z| < 3) on independent
 *      seeds across boards with all rules active.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const E = require('../builder/engine.js');
const {
  packBoard,
  computeTakeable,
  stepFixedAction,
  playOneGame,
  CpuWorkerPool,
} = require('./cpu_playout.js');

const PYTHON_BIN = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
const GPU_SCRIPT = path.join(__dirname, 'gpu_playout.py');
const QUAL_PATH = path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'qualified-200-225.jsonl');
const TRAIN_PATH = path.join(__dirname, '..', '..', 'analysis', 'builder', 'data', 'training-data.json');

const encodeAction = act => (act && typeof act === 'object' ? ((act.pair[0] + 1) << 8) | act.pair[1] : act);
const decodeAction = code => (code >= 256 ? { pair: [(code >> 8) - 1, code & 255] } : code);

function aliveArrayToMask4(alive) {
  const m = [0, 0, 0, 0];
  for (let i = 0; i < alive.length; i++) {
    if (alive[i]) m[i >> 5] = (m[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
  }
  return m;
}

function indicesToMask4(indices) {
  const m = [0, 0, 0, 0];
  for (const i of indices) {
    m[i >> 5] = (m[i >> 5] | ((1 << (i & 31)) >>> 0)) >>> 0;
  }
  return m;
}

function trayTilesToFaceMask2(faces, trayTiles) {
  let lo = 0, hi = 0;
  for (const t of trayTiles) {
    const f = faces[t];
    if (f < 32) lo = (lo | ((1 << f) >>> 0)) >>> 0;
    else hi = (hi | ((1 << (f - 32)) >>> 0)) >>> 0;
  }
  return [lo, hi];
}

function engineSnapshotsForSequence(design, actions) {
  const g = E.game(design);
  let s = E.start(g);
  const snaps = [];

  const record = (st, status) => {
    if (status !== 1) {
      snaps.push({ status });
      return;
    }
    const singles = E.legal(g, st).filter(x => typeof x === 'number');
    snaps.push({
      status: 1,
      moves: st.moves,
      trayLen: st.tray.length,
      clockAlive: st.clockTaken ? 0 : 1,
      alive: aliveArrayToMask4(st.alive),
      trayMask: trayTilesToFaceMask2(g.faces, st.tray),
      takeable: indicesToMask4(singles),
    });
  };

  record(s, 1);
  for (const act of actions) {
    let next;
    try {
      next = E.step(g, s, act);
    } catch (_) {
      record(null, 2);
      break;
    }
    if (!next) {
      record(null, 0);
      break;
    }
    s = next;
    record(s, 1);
  }
  return snaps;
}

function cpuSnapshotsForSequence(design, actions) {
  const b = packBoard(design);
  const st = {
    a0: b.initAlive[0], a1: b.initAlive[1], a2: b.initAlive[2], a3: b.initAlive[3],
    left: b.n,
    moves: 0,
    trayLo: 0, trayHi: 0, trayLen: 0,
    clockAlive: b.clockI >= 0 ? 1 : 0,
  };
  const snaps = [];
  const snapNow = () => {
    const tk = new Uint32Array(4);
    computeTakeable(b, st.a0, st.a1, st.a2, st.a3, tk);
    snaps.push({
      status: 1,
      moves: st.moves,
      trayLen: st.trayLen,
      clockAlive: st.clockAlive,
      alive: [st.a0, st.a1, st.a2, st.a3],
      trayMask: [st.trayLo, st.trayHi],
      takeable: [tk[0], tk[1], tk[2], tk[3]],
    });
  };

  snapNow();
  for (const act of actions) {
    let ok;
    try {
      ok = stepFixedAction(b, st, act);
    } catch (_) {
      snaps.push({ status: 2 });
      break;
    }
    if (!ok) {
      snaps.push({ status: 0 });
      break;
    }
    snapNow();
  }
  return snaps;
}

test('GPU, CPU, and engine.js agree on fixed move sequences, full game traces, and win rates', async () => {
  const qualLines = fs.readFileSync(QUAL_PATH, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const trainData = JSON.parse(fs.readFileSync(TRAIN_PATH, 'utf8'));

  const q76 = qualLines[2].design;   // level 202: 76 tiles, ice=2, locks=6, keys=2, down=24, clock
  const q84 = qualLines[4].design;   // level 204: 84 tiles, ice=2, locks=4, keys=2, down=27, clock
  const q96 = qualLines[13].design;  // level 220: 96 tiles, ice=3, down=38, clock

  // Hand-crafted boards for edge-case rules (matching test_engine.js)
  const peekTray3Board = {
    tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [21, 10, 1], [23, 10, 1], [20, 10, 0], [22, 10, 0], [24, 10, 0]],
    faces: [0, 1, 2, 3, 3, 0, 1, 2],
    down: [3],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: null,
  };
  const peekClockBoundaryBoard = {
    ...peekTray3Board,
    clock: { i: 3, n: 4 },
  };
  const trayLossBoard = {
    tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0], [16, 0, 0], [20, 0, 0], [24, 0, 0], [28, 0, 0]],
    faces: [0, 1, 2, 3, 0, 1, 2, 3],
    down: [],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: null,
  };
  const clockLossBoard = {
    tiles: [[0, 0, 0], [0, 0, 1], [6, 0, 0], [10, 0, 0]],
    faces: [0, 1, 0, 1],
    down: [],
    gold: [],
    obst: { ice: {}, locks: [], keys: [] },
    clock: { i: 0, n: 2 },
  };
  // 104-tile synthetic board exercising the 4th 32-bit mask word (tiles 96..103)
  const tiles104 = [];
  const faces104 = [];
  for (let i = 0; i < 104; i++) {
    tiles104.push([(i % 13) * 4, Math.floor(i / 13) * 4, 0]);
    faces104.push(Math.floor(i / 2) % 36);
  }
  const board104 = {
    tiles: tiles104,
    faces: faces104,
    down: [97, 101],
    gold: [],
    obst: { ice: { 2: 1 }, locks: [102, 103], keys: [0, 1] },
    clock: { i: 100, n: 10 },
  };
  // Note tile 2 has no ice neighbors because spacing is 4; make tile 3 adjacent to tile 2 for ice test:
  board104.tiles[3] = [board104.tiles[2][0] + 2, board104.tiles[2][1], 0];

  const fixedReplays = [
    { name: 'q76_solution', design: q76, actions: q76.solution },
    { name: 'q84_solution', design: q84, actions: q84.solution },
    { name: 'q96_solution', design: q96, actions: q96.solution },
    { name: 'peek_pair_at_tray_3', design: peekTray3Board, actions: [0, 1, 2, { pair: [4, 3] }, 5, 6, 7] },
    { name: 'peek_pair_clock_boundary_save', design: peekClockBoundaryBoard, actions: [0, 1, 2, { pair: [4, 3] }, 5, 6, 7] },
    { name: 'fourth_waiting_tile_loses', design: trayLossBoard, actions: [0, 1, 2, 3] },
    { name: 'clock_deadline_loses', design: clockLossBoard, actions: [2, 3, 1] },
    {
      name: 'word4_104_tiles_ice_lock_peek_clock',
      design: board104,
      actions: [0, 1, 3, 2, { pair: [96, 97] }, { pair: [100, 101] }, 102, 103],
    },
  ].map(item => ({ ...item, codes: item.actions.map(encodeAction) }));

  // Positive-win-rate boards for trace + win-rate verification
  const pos76Hist = trainData[1087].design; // Unaltered 76t board with clock & 38 down (~1.1% win rate)
  const pos76AllRules = { ...q76, clock: { i: q76.clock.i, n: q76.tiles.length } }; // ~4.5% win rate, ice+locks+down+clock
  const pos84AllRules = { ...qualLines[5].design, clock: { i: qualLines[5].design.clock.i, n: 84 } }; // ~0.73% win rate, 84t
  const pos96AllRules = { ...q96, clock: { i: q96.clock.i, n: q96.tiles.length } }; // ~5.4% win rate, 96t, ice+down+clock

  const traceChecks = [
    { name: 'q76_unaltered', design: q76, numGames: 50, seed: 777 },
    { name: 'q84_unaltered', design: q84, numGames: 50, seed: 888 },
    { name: 'q96_unaltered', design: q96, numGames: 50, seed: 999 },
    { name: 'pos76_hist', design: pos76Hist, numGames: 150, seed: 111 },
    { name: 'pos76_all_rules', design: pos76AllRules, numGames: 150, seed: 222 },
    { name: 'pos96_all_rules', design: pos96AllRules, numGames: 150, seed: 333 },
  ];

  const winRateChecks = [
    { name: 'board1_76t_unaltered_hist', design: pos76Hist, numGames: 30000, seed: 4242, indepSeed: 91919 },
    { name: 'board2_76t_ice_locks_peek', design: pos76AllRules, numGames: 30000, seed: 4242, indepSeed: 92929 },
    { name: 'board3_84t_locks_peek', design: pos84AllRules, numGames: 30000, seed: 4242, indepSeed: 93939 },
    { name: 'board4_96t_ice_peek', design: pos96AllRules, numGames: 30000, seed: 4242, indepSeed: 94949 },
  ];

  const tmpPayload = path.join(os.tmpdir(), `gpu_probe_verify_${process.pid}.json`);
  fs.writeFileSync(tmpPayload, JSON.stringify({
    fixedReplays: fixedReplays.map(({ name, design, codes }) => ({ name, design, codes })),
    traceChecks,
    winRateChecks,
  }));

  let gpuOut;
  try {
    const stdout = execFileSync(PYTHON_BIN, [GPU_SCRIPT, '--cmd', 'verify', '--input-json', tmpPayload], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    gpuOut = JSON.parse(stdout);
  } finally {
    try { fs.unlinkSync(tmpPayload); } catch (_) {}
  }

  // 1. Verify fixed move sequences step-by-step against engine.js E.step
  for (let idx = 0; idx < fixedReplays.length; idx++) {
    const item = fixedReplays[idx];
    const refSnaps = engineSnapshotsForSequence(item.design, item.actions);
    const cpuSnaps = cpuSnapshotsForSequence(item.design, item.actions);
    const rawGpuSnaps = gpuOut.fixedReplays[idx].snapshots;
    const gpuSnaps = rawGpuSnaps.slice(0, refSnaps.length).map(s =>
      s.status !== 1 ? { status: s.status } : s
    );

    assert.deepEqual(cpuSnaps, refSnaps, `CPU stepFixedAction mismatch vs E.step on ${item.name}`);
    assert.deepEqual(gpuSnaps, refSnaps, `GPU replay_fixed_kernel mismatch vs E.step on ${item.name}`);
  }

  // 2. Verify full seeded game traces: GPU == CPU == valid E.step replay
  let totalVerifiedSteps = 0;
  let totalWinsSeen = 0;
  let totalPeekPairsSeen = 0;
  for (let idx = 0; idx < traceChecks.length; idx++) {
    const item = traceChecks[idx];
    const gpuTraceRes = gpuOut.traceChecks[idx];
    const b = packBoard(item.design);
    const g = E.game(item.design);

    // Thread and Warp kernels must agree identically
    assert.equal(gpuTraceRes.thread.wins, gpuTraceRes.warp.wins, `GPU thread vs warp wins on ${item.name}`);
    assert.equal(gpuTraceRes.thread.totalMoves, gpuTraceRes.warp.totalMoves, `GPU thread vs warp moves on ${item.name}`);

    for (let gid = 0; gid < item.numGames; gid++) {
      const cpuGame = playOneGame(b, item.seed, gid, true);
      const gpuGame = gpuTraceRes.traces[gid];
      const gpuActions = gpuGame.codes.map(decodeAction);

      assert.equal(gpuGame.win, cpuGame.win, `GPU vs CPU win mismatch on ${item.name} gid=${gid}`);
      assert.deepEqual(gpuActions, cpuGame.trace, `GPU vs CPU move trace mismatch on ${item.name} gid=${gid}`);

      // Replay through E.step
      let s = E.start(g);
      for (let k = 0; k < gpuActions.length; k++) {
        const act = gpuActions[k];
        if (act && typeof act === 'object') totalPeekPairsSeen++;
        s = E.step(g, s, act);
        totalVerifiedSteps++;
        if (k < gpuActions.length - 1) {
          assert.ok(s !== null, `E.step returned premature null on ${item.name} gid=${gid} step=${k}`);
        }
      }
      if (gpuGame.win === 1) {
        totalWinsSeen++;
        assert.ok(s !== null && E.won(g, s), `E.step did not confirm win on ${item.name} gid=${gid}`);
      } else {
        assert.ok(s === null || E.legal(g, s).length === 0, `E.step did not confirm loss on ${item.name} gid=${gid}`);
      }
    }
  }
  assert.ok(totalVerifiedSteps > 4000, `Expected >4000 verified steps, got ${totalVerifiedSteps}`);
  assert.ok(totalWinsSeen >= 5, `Expected winning traces among verified games, got ${totalWinsSeen}`);
  assert.ok(totalPeekPairsSeen >= 20, `Expected peek-pair actions in verified traces, got ${totalPeekPairsSeen}`);

  // 3. Verify win rates across multi-core CPU worker pool and GPU (same-seed exact + independent-seed statistical)
  const workerCount = Math.min(8, os.cpus().length);
  const pool = new CpuWorkerPool(workerCount);
  try {
    for (let idx = 0; idx < winRateChecks.length; idx++) {
      const item = winRateChecks[idx];
      const gpuRes = gpuOut.winRateChecks[idx];
      const cpuSame = await pool.runGames(item.design, item.numGames, item.seed);

      // Exact bit-for-bit equality on identical seeds across CPU worker pool, GPU thread kernel, and GPU warp kernel
      assert.equal(gpuRes.thread.wins, cpuSame.wins, `Same-seed GPU thread vs CPU wins on ${item.name}`);
      assert.equal(gpuRes.warp.wins, cpuSame.wins, `Same-seed GPU warp vs CPU wins on ${item.name}`);
      assert.equal(gpuRes.thread.totalMoves, cpuSame.totalMoves, `Same-seed GPU thread vs CPU moves on ${item.name}`);
      assert.equal(gpuRes.warp.totalMoves, cpuSame.totalMoves, `Same-seed GPU warp vs CPU moves on ${item.name}`);

      // Independent seed stream statistical test (Binomial two-proportion z-test)
      const pCpu = cpuSame.winRate;
      const pGpuIndep = gpuRes.indepWarp.winRate;
      const pPool = (cpuSame.wins + gpuRes.indepWarp.wins) / (2 * item.numGames);
      const se = Math.sqrt(pPool * (1 - pPool) * (2 / item.numGames));
      const z = se > 0 ? Math.abs(pCpu - pGpuIndep) / se : 0;
      assert.ok(z < 3.0, `Independent-seed win rate z=${z.toFixed(3)} >= 3.0 on ${item.name} (CPU=${pCpu}, GPU=${pGpuIndep})`);
    }
  } finally {
    await pool.close();
  }
});
