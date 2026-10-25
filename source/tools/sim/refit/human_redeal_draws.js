'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const protocol = require('./human_redeal_winnable_protocol.json');

function drawSeed(level, split, draw) {
  assert(Number.isInteger(level) && level > 0 && ['development', 'luck'].includes(split));
  assert(Number.isInteger(draw) && draw > 0);
  const bytes = crypto.createHash('sha256').update(protocol.prefix + '/' + split + '/' + level + '/' + draw).digest();
  return ((bytes.readUInt32LE(0) & 0x7fffffff) + (split === 'luck' ? 0x80000000 : 0)) >>> 0;
}

module.exports = { drawSeed, protocol };
