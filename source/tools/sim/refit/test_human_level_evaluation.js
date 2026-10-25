'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { ranks, spearman, evaluate, evaluateTrackA, projectRecordsToSalts, compare } = require('./human_level_evaluation.js');

function test() {
  assert.deepEqual(ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.equal(spearman([[1, 3], [2, 2], [2, 2], [3, 1]]), -1);
  assert.equal(spearman([[1, 1], [1, 2]]), null);
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [1, 1], down: [0, 0], rules: null, clock: null });
  const boardHash = crypto.createHash('sha256').update(JSON.stringify(game)).digest('hex');
  const entries = [1, 2, 5].map((wonOn, index) => ({ lv: index + 1, wonOn, game, boardSource: 'recordedOpening' }));
  function records(counts) {
    return counts.map((triesPerSalt, index) => ({ level: index + 1, measurement: { salts: [1, 2, 3], maxTries: 12,
      profileHash: 'fixed-profile', sourceHash: 'fixed-source', boardHash, triesPerSalt,
      averageTries: triesPerSalt.includes(null) ? null : triesPerSalt.reduce((sum, value) => sum + value, 0) / 3,
      valid: true, slowestMove: 1, minutesPerBoard: 1, lossTypes: {} } }));
  }
  const passing = evaluate(entries, records([[1, 1, 1], [2, 2, 2], [4, 4, 4]]));
  assert(passing.passed);
  assert.equal(passing.dennisTotal, 8);
  assert.equal(passing.botMeanTotal, 7);
  assert.deepEqual(passing.botTotalsPerSalt, [7, 7, 7]);
  assert.equal(passing.correlation, 1);
  const trackAExtraTries = evaluateTrackA(entries, records([[2, 2, 2], [3, 3, 3], [6, 6, 6]]));
  assert(trackAExtraTries.passed && !trackAExtraTries.historicalDiagnosticGates.totalTries);
  const trackALowCorrelation = evaluateTrackA(entries, records([[2, 2, 2], [1, 1, 1], [1, 1, 1]]));
  assert(trackALowCorrelation.passed && !trackALowCorrelation.historicalDiagnosticGates.difficulty);
  assert.deepEqual(Object.keys(trackALowCorrelation.gates), ['clearance', 'dennisPlusOne']);
  const frozen = records([[1, 2, 3]])[0];
  frozen.measurement.runs = [1, 2, 3].map(salt => ({ salt, tries: salt, valid: true, slowestMove: salt * 10,
    minutes: salt, attempts: [{ lossType: salt === 1 ? null : 'tray' }] }));
  const frozenBefore = JSON.stringify(frozen), projected = projectRecordsToSalts([frozen], [1])[0];
  assert.deepEqual(projected.measurement.triesPerSalt, [1]); assert.equal(projected.measurement.averageTries, 1);
  assert.deepEqual(projected.measurement.lossTypes, {}); assert.equal(projected.measurement.slowestMove, 10);
  assert.equal(projected.measurement.minutesPerBoard, 1); assert.equal(projected.measurement.sourceHash, 'fixed-source');
  assert.equal(JSON.stringify(frozen), frozenBefore);
  assert.throws(() => projectRecordsToSalts([frozen], [4])); assert.throws(() => projectRecordsToSalts([frozen], [1, 1]));
  const censoredFrozen = structuredClone(frozen);
  censoredFrozen.measurement.runs[0].tries = null;
  assert.equal(projectRecordsToSalts([censoredFrozen], [1])[0].measurement.averageTries, null);
  const oneBadSalt = evaluate(entries, records([[1, 1, 3], [2, 2, 2], [4, 4, 4]]));
  assert(!oneBadSalt.gates.dennisPlusOne, 'A passing average cannot conceal a salt above Dennis+1');
  const precisionEntries = Array.from({ length: 30 }, (unused, index) => ({ ...entries[0], lv: index + 1, wonOn: 2 }));
  const precisionCounts = Array.from({ length: 30 }, (unused, index) => index < 10 ? [1, 1, 2] : [2, 2, 3]);
  const precision = evaluate(precisionEntries, records(precisionCounts));
  assert.equal(precision.botMeanTotal, 60);
  assert(precision.gates.totalTries, 'Integer salt totals must preserve an exact equality with Dennis');
  const baseline = evaluate(entries, records([[1, 1, 1], [2, null, 2], [4, 4, 4]]));
  assert(!baseline.gates.clearance && baseline.botMeanTotal === null && baseline.correlation === null);
  assert.deepEqual(compare(baseline, passing).fixes, [2]);
  assert(compare(baseline, passing).adopted);
  const broken = evaluate(entries, records([[3, 3, 3], [2, 2, 2], [4, 4, 4]]));
  assert.deepEqual(compare(baseline, broken).regressions, [1]);
  assert(!compare(baseline, broken).adopted);
  const underestimated = evaluate(entries, records([[3, 3, 3], [2, 2, 2], [1, 1, 1]]));
  assert.equal(underestimated.biggestMismatches[0].level, 3);
  assert.equal(underestimated.biggestMismatches[0].mismatch, 8);
  const swapped = structuredClone(entries);
  swapped[0].game.faces = [2, 2];
  assert.throws(() => evaluate(swapped, records([[1, 1, 1], [2, 2, 2], [4, 4, 4]])));
  console.log('PASS all salts count toward clearance/Dennis+1, totals use comparable units, tied Spearman excludes trivial pairs only, censored outcomes stay unresolved, underestimates count double, and adoption protects passing levels');
}
if (require.main === module) test();
module.exports = test;
