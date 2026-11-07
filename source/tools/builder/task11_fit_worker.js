'use strict';
const { parentPort } = require('worker_threads'), M = require('../factory/meter.js');
const meters = { reference: M.createMeter(), candidate: M.createMeter({ bot: require.resolve('../sim/refit/human_bot_key_memory_v1.js') }) };
parentPort.on('message', job => { try {
  const meter = meters[job.version]; if (meter.fingerprint !== job.bot) throw Error('Fit implementation changed');
  const before = { ...meter.stats }, t = Date.now(), result = meter.measure(job.design, { setting: job.setting, seed: 4711, runs: 20, seeds: 2 });
  parentPort.postMessage({ task: job.task, version: job.version, bot: meter.fingerprint, boardKey: M.boardKey(job.design), setting: job.setting,
    valid: result.valid, exp: result.expectedTries, first: result.firstTryRate, plannerStyles: result.plannerStyles || null,
    calls: meter.stats.calls - before.calls, hits: meter.stats.hits - before.hits, ms: Date.now() - t });
} catch (e) { parentPort.postMessage({ error: e.stack }); } });
