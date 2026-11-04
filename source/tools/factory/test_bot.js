'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { measureHuman, VERSION } = require('../sim/refit/human_bot.js');
const rows = fs.readFileSync(path.join(__dirname, '../../analysis/factory/fallback-g61.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);

test('bundled g6.2 preserves decisions and ratings with compact capture', () => {
  assert.equal(VERSION, 'human-g6.2');
  for (const setting of ['family', 'planner']) {
    const board = rows[0].design, options = { runs: 2, seeds: 1, seed: 4711, setting };
    const full = measureHuman(board, { ...options, capture: true });
    const tail = measureHuman(board, { ...options, capture: 'tail' });
    assert.equal(full.valid, true); assert.equal(tail.valid, true);
    assert.equal(tail.expectedTries, full.expectedTries);
    for (let r = 0; r < full.results.length; r++) {
      assert.equal(tail.results[r].wonOn, full.results[r].wonOn);
      for (let a = 0; a < full.results[r].attempts.length; a++) {
        const x = full.results[r].attempts[a], y = tail.results[r].attempts[a];
        assert.deepEqual(y.actions, x.actions, 'every physical tap stays identical');
        assert.deepEqual(y.decisions.map(d => [d.index, d.state.tray]), x.decisions.slice(-5).map(d => [d.index, d.state.tray]));
      }
    }
  }
});
