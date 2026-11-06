'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { readRows } = require('./run_file.js');
const { createMeter, boardKey } = require('./meter.js');
const { validatePiles } = require('./build.js');
const I = require('../lab/ideas.js');
const { roomProfile } = require('./design_traps.js');
const { assertOriginalBatch, previousBoards } = require('./originality.js');
const { evaluate } = require('./batch_evaluate.js');
const Final = require('./final_seed.js');
// The real spare (Claude, 2026-11-06): the stored solution and I.valid follow the strict rules, which do not know the
// game's PEEK PAIR (a turned-over face-down tile and its free twin go together without a tray slot). With it the
// fewest way to the clock is 1-2 moves shorter on 5 of the 18 qualified boards, so their clock is that much looser
// than `clockSpare` says. The bots already play peek pairs, so the ratings are right; this only reports it.
function realSpare(d) {
  let E; try { E = require('../builder/engine.js'); } catch (e) { return null; }
  const r = E.clockShortest(E.game(d), { nodes: 400000, ms: 20000 });
  return r && !r.unsure ? d.clock.n - r.k : null;
}
function verify(planFile, batchFile, options = {}) {
  const plan = JSON.parse(fs.readFileSync(planFile)), rows = readRows(batchFile), meter = createMeter();
  const actualScores=new Map();
  if (!options.partial) assert.deepEqual(rows.map(r => r.level), plan.levels.map(r => r.level));
  else assert(rows.every((r, k) => plan.levels.some(s => s.level === r.level) && (!k || rows[k - 1].level < r.level)));
  assert.equal(new Set(rows.map(r => boardKey(r.design))).size, rows.length);
  if (plan.originality?.required) assertOriginalBatch(rows, previousBoards(plan.levels,
    path.resolve(path.dirname(planFile), plan.levelTable)), plan.originality);
  validatePiles(plan.levels.filter(s => rows.some(r => r.level === s.level)), rows.map(r => ({ level: r.level, shape: r.shape, tiles: r.design.tiles })), {
    contextLevels: plan.levels, minTiles: plan.minTiles, bigLevels: plan.bigLevels, levelTable: path.resolve(path.dirname(planFile), plan.levelTable) });
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k], s = plan.levels.find(s => s.level === r.level), d = r.design;
    if(s.keepId)assert.equal(r.id,s.keepId,'Approved board replaced at '+r.level);
    if(s.keepPattern)assert.equal(require('./placement_score.js').patternKey(d),s.keepPattern,'Approved board pattern replaced at '+r.level);
    assert(r.origin?.intendedLevel == null || r.origin.intendedLevel === r.level);
    assert(I.valid(d), 'Stored solution must obey every rule at ' + r.level);
    assert.equal(r.clockSpare, d.clock.n - (d.solution.indexOf(d.clock.i) + 1));
    assert(r.clockSpare >= 1 && r.clockSpare <= 3, 'Clock spare outside 1–3 at ' + r.level);
    const real = realSpare(d);
    if (real != null && real !== r.clockSpare) console.log(`level ${r.level}: real clock spare ${real} (strict ${r.clockSpare}; peek pairs make the way shorter)`);
    assert.equal(boardKey(d), r.boardHash); assert.equal(d.level, r.level);
    assert.equal(meter.fingerprint, r.bot, 'Meter changed');
    const options = { runs: 20, seeds: 2, seed: 4711, setting: 'family' };
    const m = meter.measure(d, { ...options, capture: 'tail' }), v = meter.measure(d, { ...options, seed: 18427 });
    assert(m.valid && v.valid); assert.equal(m.expectedTries, r.family.search); assert.equal(v.expectedTries, r.family.validation);
    const score = (m.expectedTries + v.expectedTries) / 2;
    assert(Math.abs(score-r.family.exp)<1e-9,'Recorded pooled score differs at '+r.level);actualScores.set(r.level,score);
    assert(Math.abs(score - s.target) <= plan.tolerance + 1e-9, 'Family score off curve at ' + r.level);
    assert(Math.abs(m.expectedTries - v.expectedTries) <= plan.maxSeedGap);
    if (Final.tuned(r)) {
      const f = meter.measure(d, { ...options, seed: Final.SEED });
      assert.equal(r.family.freshSeed, Final.SEED); assert.equal(r.family.fresh, f.expectedTries);
      assert(Final.qualifies(r, { train: { exp: m.expectedTries }, validation: { exp: v.expectedTries } },
        { fresh: { exp: f.expectedTries, valid: f.valid, seed: Final.SEED } }, s, plan), 'Independent seed failed at ' + r.level);
    }
    const skilled = meter.measure(d, { ...options, setting: 'planner' });
    const effective = require('./skilled_evidence.js').rating(r, skilled.expectedTries, skilled.valid);
    assert(effective.valid && effective.exp <= plan.skilledMax && effective.exp >= (plan.skilledMin ?? 0)); assert.equal(effective.exp, r.skilled);
    if(r.botSkilled !== undefined)assert.equal(r.botSkilled,skilled.expectedTries);
    assert.deepEqual(r.skilledEvidence ?? null,effective.evidence ?? null,'Human skill evidence must match the exact approved board');
    const room = roomProfile(d); assert(room.ok && room.unrelieved <= plan.unrelievedMax);
    const quality = evaluate({ ...r, forcePlanner: true }, 'quality', meter);
    assert(quality.eligible, 'Puzzle quality failed at ' + r.level);
    assert.equal(r.atTrap, quality.atTrap); assert.deepEqual(r.specials, quality.special);
    assert.deepEqual(r.supports || {}, quality.supports || {}, 'Support ablations differ at ' + r.level);
    if (r.placementScore) assert.deepEqual(r.placementScore, require('./placement_score.js').score(d, r.recipe, r.shape), 'Placement score differs at ' + r.level);
    if (r.playerFeedback) assert(require('./placement_score.js').readable(d), 'Blind objective route at ' + r.level);
    if (k && rows[k - 1].level + 1 === r.level) assert(rows[k - 1].family.exp <= r.family.exp + (plan.maxReverseStep ?? 0.25) + 0.001, 'Large reverse step at ' + r.level);
  }
  assert(require('./curve_policy.js').accepts(plan,actualScores),'Five-level mean off curve');
  console.log(rows.length, 'levels verified against cached full bot measurements;', meter.stats.calls, 'new calls,', meter.stats.hits, 'cache hits');
  return rows;
}
module.exports = { verify, realSpare };
if (require.main === module) verify(process.argv[2], process.argv[3], { partial: process.argv.includes('--partial') });
