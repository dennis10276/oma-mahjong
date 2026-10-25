'use strict';
const assert = require('assert/strict');
const { chooseRange } = require('./human_redeal_dispatch.js');

function test() {
  const levels = [{ level: 17, scheduledThrough: 100 }, { level: 18, scheduledThrough: 0 }];
  const capRecords = Array.from({ length: 100 }, () => ({ status: 'node_cap', nodes: 200000 }));
  const progress = new Map([[17, { complete: false, wins: 9, observedWins: 9, records: capRecords }],
    [18, { complete: false, wins: 0, observedWins: 0, records: [] }]]);
  const before = JSON.stringify(levels), first = chooseRange(levels, progress, []);
  assert.equal(first.level, 17); assert.equal(first.start, 101); assert.equal(first.end, 108);
  assert.equal(JSON.stringify(levels), before);
  const next = chooseRange(levels, progress, [{ kind: 'pool', level: 17 }]);
  assert.equal(next.level, 18); assert.equal(next.start, 1); assert.equal(next.end, 128);
  progress.set(17, { complete: false, wins: 9, observedWins: 10, records: capRecords });
  assert.equal(chooseRange([levels[0]], progress, []), null);
  progress.set(18, { complete: true, wins: 10, observedWins: 10, records: [] });
  assert.equal(chooseRange(levels, progress, []), null);
  console.log('PASS dispatcher prioritizes uncovered boards, uses short capped near-target ranges, leaves reservations immutable and waits for prefix gaps when ten wins are already observed');
}

if (require.main === module) test();
module.exports = test;
