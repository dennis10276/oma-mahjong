'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { findThawTrap } = require('../tools/builder/bank/thaw_trap');
const { design: reserve } = require('../analysis/builder/bank/chained-v2/far-end/lookalikeCoverThaw-L18-s4-p1.json');
const { design: easyThaw } = require('../analysis/builder/bank/procedural-trays/pairedFalseMelt-L1038-s367-p1.json');

test('finds a genuine thaw that strands the tray even with the clock relaxed', () => {
  const evidence = findThawTrap(reserve);
  assert.ok(evidence);
  assert.equal(evidence.ice, 45);
  assert.equal(evidence.refund, 68);
  assert.ok(evidence.wrongThaw.length >= 3);
});

test('an immediately accessible melt and a clock-only bait cannot prove a stranded thaw', () => {
  assert.equal(findThawTrap(easyThaw), null);
});
