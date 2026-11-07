'use strict';

/**
 * Node client for the persistent GPU batch pre-screen worker (`prescreen_gpu.py --server`).
 *
 * Usage:
 *   const { proxyRate, closeProxyWorker } = require('../gpu-probe/proxy_rate.js');
 *   const scores = await proxyRate(candidateDesigns); // number[] (predicted family expectedTries, 1..20)
 *   // Keep top 30% closest to the 10-13 target band:
 *   const ranked = candidateDesigns
 *     .map((design, i) => ({ design, score: scores[i], dist: Math.abs(scores[i] - 11.5) }))
 *     .sort((a, b) => a.dist - b.dist);
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const { packScreenBatch } = require('./board_pack.js');

const DEFAULT_PYTHON = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
const FALLBACK_PYTHON = 'python';
const SERVER_SCRIPT = path.join(__dirname, 'prescreen_gpu.py');

let workerState = null;
let nextReqId = 1;

function resolvePythonBin(customPython) {
  if (customPython) return customPython;
  if (process.env.OMA_GPU_PYTHON) return process.env.OMA_GPU_PYTHON;
  if (fs.existsSync(DEFAULT_PYTHON)) return DEFAULT_PYTHON;
  return FALLBACK_PYTHON;
}

function setWorkerRef(ws, active) {
  if (!ws || !ws.proc) return;
  if (active) {
    ws.proc.ref();
    ws.proc.stdin?.ref?.();
    ws.proc.stdout?.ref?.();
    ws.proc.stderr?.ref?.();
  } else {
    ws.proc.unref();
    ws.proc.stdin?.unref?.();
    ws.proc.stdout?.unref?.();
    ws.proc.stderr?.unref?.();
  }
}

function ensureWorker(options = {}) {
  if (workerState && workerState.proc && !workerState.closed) {
    return workerState.readyPromise;
  }

  const pythonBin = resolvePythonBin(options.pythonBin);
  const proc = spawn(pythonBin, [SERVER_SCRIPT, '--server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const ws = {
    proc,
    closed: false,
    readyInfo: null,
    stderrBuf: '',
    stdoutBuf: '',
    pending: new Map(),
    readyPromise: null,
  };
  workerState = ws;

  ws.readyPromise = new Promise((resolve, reject) => {
    let settledReady = false;

    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', chunk => {
      ws.stderrBuf = (ws.stderrBuf + chunk).slice(-8192);
    });

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', chunk => {
      ws.stdoutBuf += chunk;
      let nl;
      while ((nl = ws.stdoutBuf.indexOf('\n')) >= 0) {
        const line = ws.stdoutBuf.slice(0, nl).trim();
        ws.stdoutBuf = ws.stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch (err) {
          continue;
        }
        if (!settledReady && msg.ready) {
          settledReady = true;
          ws.readyInfo = msg;
          if (ws.pending.size === 0) setWorkerRef(ws, false);
          resolve(ws);
          continue;
        }
        const id = msg.id;
        const entry = ws.pending.get(id);
        if (entry) {
          ws.pending.delete(id);
          if (ws.pending.size === 0) setWorkerRef(ws, false);
          if (msg.error) entry.reject(new Error(`GPU proxy worker error: ${msg.error}`));
          else entry.resolve(msg);
        }
      }
    });

    const onExit = (code, signal) => {
      ws.closed = true;
      if (workerState === ws) workerState = null;
      const err = new Error(
        `GPU proxy worker exited (code=${code}, signal=${signal})${ws.stderrBuf ? ': ' + ws.stderrBuf.trim() : ''}`
      );
      if (!settledReady) {
        settledReady = true;
        reject(err);
      }
      for (const [, entry] of ws.pending) {
        entry.reject(err);
      }
      ws.pending.clear();
    };

    proc.once('error', err => {
      ws.closed = true;
      if (workerState === ws) workerState = null;
      if (!settledReady) {
        settledReady = true;
        reject(err);
      }
      for (const [, entry] of ws.pending) {
        entry.reject(err);
      }
      ws.pending.clear();
    });

    proc.once('exit', onExit);
  });

  return ws.readyPromise;
}

function sendWorkerRequest(ws, payload) {
  return new Promise((resolve, reject) => {
    const id = nextReqId++;
    ws.pending.set(id, { resolve, reject });
    setWorkerRef(ws, true);
    ws.proc.stdin.write(JSON.stringify({ ...payload, id }) + '\n', err => {
      if (err) {
        ws.pending.delete(id);
        if (ws.pending.size === 0) setWorkerRef(ws, false);
        reject(err);
      }
    });
  });
}

/**
 * Scores a batch of candidate board designs on the GPU in a single kernel launch.
 *
 * @param {Array<object>} designs - Array of board design objects (or `{ design }` wrappers).
 * @param {object} [options]
 * @param {number} [options.campaigns=64] - Sequential 20-try campaigns per board (<= 256).
 * @param {number} [options.maxTries=20] - Try cap per campaign.
 * @param {number} [options.seed=4711] - Deterministic RNG base seed.
 * @param {boolean} [options.detailed=false] - If true, returns per-board detail objects instead of `number[]`.
 * @param {object} [options.routeOpts] - Budget options `{ nodes, ms }` passed to `engine.js` `clockShortest`.
 * @param {object|Array<number>} [options.params] - Optional override for proxy policy parameters.
 * @returns {Promise<Array<number>|Array<object>>} Calibrated difficulty score per design (`1..20`, ranking like `family`).
 *   When `detailed` is false, the returned `number[]` also carries `.details` and `.timing` non-index properties.
 */
async function proxyRate(designs, options = {}) {
  if (!Array.isArray(designs)) {
    throw new TypeError('proxyRate(designs): designs must be an Array');
  }
  if (designs.length === 0) {
    const empty = [];
    if (!options.detailed) {
      Object.defineProperties(empty, {
        details: { value: [], enumerable: false },
        timing: { value: { packMs: 0, kernelMs: 0, totalMs: 0 }, enumerable: false },
      });
    }
    return empty;
  }

  const t0 = performance.now();
  // Start/warm GPU worker concurrently with CPU route + bitmask packing
  const workerPromise = ensureWorker(options);
  const tPack0 = performance.now();
  const packedBytes = packScreenBatch(designs, options.routeOpts || {});
  const boardsB64 = Buffer.from(packedBytes.buffer, packedBytes.byteOffset, packedBytes.byteLength).toString('base64');
  const packMs = performance.now() - tPack0;

  const ws = await workerPromise;
  const req = {
    cmd: 'rate',
    numBoards: designs.length,
    boardsB64,
    seed: options.seed ?? 4711,
  };
  if (options.campaigns != null) req.campaigns = options.campaigns;
  if (options.maxTries != null) req.maxTries = options.maxTries;
  if (options.params != null) req.params = options.params;

  const resp = await sendWorkerRequest(ws, req);
  const totalMs = performance.now() - t0;

  const details = resp.scores.map((score, i) => ({
    score,
    bandDistance: resp.bandDistance[i],
    expectedTries: resp.expectedTries[i],
    firstTryRate: resp.firstTryRate[i],
    clearRate: resp.clearRate[i],
    clockLossRate: resp.clockLossRate[i],
  }));

  const timing = {
    packMs: Number(packMs.toFixed(2)),
    kernelMs: resp.kernelMs,
    totalGpuMs: resp.totalGpuMs,
    totalMs: Number(totalMs.toFixed(2)),
    device: ws.readyInfo?.device || 'CUDA GPU',
  };

  if (options.detailed) {
    Object.defineProperty(details, 'timing', { value: timing, enumerable: false });
    return details;
  }

  const scores = resp.scores.slice();
  Object.defineProperties(scores, {
    details: { value: details, enumerable: false },
    timing: { value: timing, enumerable: false },
  });
  return scores;
}

/**
 * Reloads `calibrated_params.json` in the running persistent worker (if active).
 */
async function reloadProxyConfig() {
  if (!workerState || workerState.closed) return;
  const ws = await workerState.readyPromise;
  await sendWorkerRequest(ws, { cmd: 'reload' });
}

/**
 * Cleanly shuts down the persistent Python/CuPy GPU worker process.
 */
async function closeProxyWorker() {
  if (!workerState || workerState.closed) return;
  const ws = workerState;
  workerState = null;
  try {
    const readyWs = await ws.readyPromise;
    await sendWorkerRequest(readyWs, { cmd: 'shutdown' });
  } catch (_) {
    // Ignore shutdown errors if already exiting
  } finally {
    ws.closed = true;
    try { ws.proc.kill(); } catch (_) {}
  }
}

module.exports = {
  proxyRate,
  reloadProxyConfig,
  closeProxyWorker,
};
