'use strict';
const { parentPort } = require('worker_threads'), E = require('./engine.js'), F = require('./task11_physics.js'), M = require('../factory/meter.js');
parentPort.on('message', job => { try {
  const t = Date.now(), g = E.game(job.board.design), options = E.classify(g, E.start(g), job.budget);
  parentPort.postMessage({ id: job.task, plan: job.plan, boardKey: M.boardKey(job.board.design), family: job.board.family.exp, skilled: job.board.skilled.exp,
    ...F.classifySummary(options), options, ms: Date.now() - t });
} catch (e) { parentPort.postMessage({ error: e.stack }); } });
