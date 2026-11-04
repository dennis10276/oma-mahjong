'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { readRows } = require('./run_file.js');
const { createMeter, boardKey } = require('./meter.js');
const { validatePiles } = require('./build.js');
const I = require('../lab/ideas.js');
const { roomProfile } = require('./design_traps.js');
const { assertOriginalBatch, previousBoards } = require('./originality.js');
const { evaluate } = require('./batch_evaluate.js');
function verify(planFile, batchFile) {
  const plan = JSON.parse(fs.readFileSync(planFile)), rows = readRows(batchFile), meter = createMeter();
  assert.deepEqual(rows.map(r => r.level), plan.levels.map(r => r.level));
  assert.equal(new Set(rows.map(r => boardKey(r.design))).size, rows.length);
  if (plan.originality?.required) assertOriginalBatch(rows, previousBoards(plan.levels,
    path.resolve(path.dirname(planFile), plan.levelTable)), plan.originality);
  validatePiles(plan.levels, rows.map(r => ({ level: r.level, shape: r.shape, tiles: r.design.tiles })), {
    bigLevels: plan.bigLevels, levelTable: path.resolve(path.dirname(planFile), plan.levelTable) });
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k], s = plan.levels[k], d = r.design;
    assert(r.origin?.intendedLevel == null || r.origin.intendedLevel === r.level);
    assert(I.valid(d), 'Stored solution must obey every rule at ' + r.level);
    assert.equal(boardKey(d), r.boardHash); assert.equal(d.level, r.level);
    assert.equal(meter.fingerprint, r.bot, 'Meter changed');
    const options = { runs: 20, seeds: 2, seed: 4711, setting: 'family' };
    const m = meter.measure(d, { ...options, capture: 'tail' }), v = meter.measure(d, { ...options, seed: 18427 });
    assert(m.valid && v.valid); assert.equal(m.expectedTries, r.family.search); assert.equal(v.expectedTries, r.family.validation);
    const score = (m.expectedTries + v.expectedTries) / 2;
    assert(Math.abs(score - s.target) <= plan.tolerance + 1e-9, 'Family score off curve at ' + r.level);
    assert(Math.abs(m.expectedTries - v.expectedTries) <= plan.maxSeedGap);
    const skilled = meter.measure(d, { ...options, setting: 'planner' });
    assert(skilled.valid && skilled.expectedTries <= plan.skilledMax); assert.equal(skilled.expectedTries, r.skilled);
    const room = roomProfile(d); assert(room.ok && room.unrelieved <= plan.unrelievedMax);
    const quality = evaluate({ ...r, forcePlanner: true }, 'quality', meter);
    assert(quality.eligible, 'Puzzle quality failed at ' + r.level);
    assert.equal(r.atTrap, quality.atTrap); assert.deepEqual(r.specials, quality.special);
    if (k) assert(rows[k - 1].family.exp <= r.family.exp + (plan.maxReverseStep ?? 0.25) + 0.001, 'Large reverse step at ' + r.level);
  }
  console.log(rows.length, 'levels verified against cached full bot measurements;', meter.stats.calls, 'new calls,', meter.stats.hits, 'cache hits');
  return rows;
}
module.exports = { verify };
if (require.main === module) verify(process.argv[2], process.argv[3]);
