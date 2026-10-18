'use strict';
const crypto = require('crypto');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { CONFIG } = require('./personal_model.js');

function retryMemory(history, target, mode, size) {
  if (!['configured', 'full'].includes(mode)) throw new Error('Unknown retry-memory assumption');
  if (!Number.isFinite(target.t) || target.t <= 0) throw new Error('Invalid retry opening time');
  const memory = new Uint8Array(size), sources = [];
  if (target.campaign === undefined) return { memory, sources };
  for (const previous of history) {
    if (previous.campaign !== target.campaign || previous.board !== target.board) continue;
    if (previous.seen.length !== size || !Number.isFinite(previous.availableAt) || previous.availableAt <= 0
      || !Number.isFinite(previous.t) || previous.t <= 0) throw new Error('Invalid prior observed retry source');
    if (previous.t >= target.t || previous.availableAt >= target.t) continue;
    const seed = crypto.createHash('sha256').update([target.name, target.campaign, previous.aid, mode].join('|')).digest().readUInt32LE(0);
    const remembered = Hard.remembered(previous.seen, previous.moves, mode === 'full' ? 1 : CONFIG.memory, L.rng(seed));
    for (let index = 0; index < size; index++) memory[index] |= remembered[index];
    sources.push({ aid: previous.aid, availableAt: previous.availableAt });
  }
  return { memory, sources };
}

module.exports = { retryMemory };
