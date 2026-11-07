'use strict';
const path = require('path'), { parentPort } = require('worker_threads'), M = require('../factory/meter.js');
// The executed entry point must match the entry point used by the fingerprint.
const entry = process.env.HUMAN_BOT ? path.resolve(process.env.HUMAN_BOT) : require.resolve('../sim/refit/human_bot.js');
const { measureHuman } = require(entry);
const bot = M.createMeter().fingerprint;
parentPort.on('message', job => {
  try {
    if (job.bot !== bot) throw Error('Trace bot changed');
    const t = Date.now(), style = job.profile.split('-')[1], options = { runs: job.runs || 2, seeds: 1, seed: 4711, maxAttempts: 20, capture: true,
      setting: job.profile === 'family' ? 'family' : 'planner', ...(style ? { plannerStyle: style } : {}) };
    const result = measureHuman(M.boardOf(job.design), options);
    parentPort.postMessage({ task: job.task, board: job.board, boardKey: M.boardKey(job.design), profile: job.profile, bot, options, ms: Date.now() - t, result });
  } catch (e) { parentPort.postMessage({ error: e.stack }); }
});
