'use strict';
const assert = require('assert/strict');
const { encodeGame } = require('./personal_game_io.js');
const crypto = require('crypto');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function ranks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const result = new Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    for (let index = start; index < end; index++) result[sorted[index].index] = (start + 1 + end) / 2;
    start = end;
  }
  return result;
}

function spearman(pairs) {
  if (pairs.length < 2) return null;
  assert(pairs.every(pair => pair.length === 2 && pair.every(Number.isFinite)));
  const left = ranks(pairs.map(pair => pair[0])), right = ranks(pairs.map(pair => pair[1]));
  const average = (pairs.length + 1) / 2;
  let covariance = 0, leftVariance = 0, rightVariance = 0;
  for (let index = 0; index < pairs.length; index++) {
    covariance += (left[index] - average) * (right[index] - average);
    leftVariance += (left[index] - average) ** 2;
    rightVariance += (right[index] - average) ** 2;
  }
  return leftVariance && rightVariance ? covariance / Math.sqrt(leftVariance * rightVariance) : null;
}

function evaluate(entries, records) {
  assert(entries.length > 0 && entries.length === records.length);
  const indexed = new Map(records.map(record => [record.level, record.measurement]));
  assert.equal(indexed.size, entries.length);
  const salts = records[0].measurement.salts;
  const profileHash = records[0].measurement.profileHash, sourceHash = records[0].measurement.sourceHash;
  const rows = entries.map(entry => {
    const level = entry.lv ?? entry.level, dennis = entry.wonOn ?? entry.human, result = indexed.get(level);
    assert(result && Number.isInteger(dennis) && dennis > 0);
    assert.deepEqual(result.salts, salts);
    assert.equal(result.maxTries, 12);
    assert.equal(result.profileHash, profileHash);
    assert.equal(result.sourceHash, sourceHash);
    assert.equal(result.boardHash, digest(encodeGame(entry.game)));
    assert.equal(result.triesPerSalt.length, salts.length);
    assert(result.triesPerSalt.every(tries => tries === null || Number.isInteger(tries) && tries > 0 && tries <= 12));
    const cleared = result.triesPerSalt.every(tries => tries !== null);
    const average = cleared ? result.triesPerSalt.reduce((sum, tries) => sum + tries, 0) / salts.length : null;
    assert.equal(result.averageTries, average);
    return { level, kind: entry.kind ?? (entry.boardSource === 'levelLab' ? 'lab' : 'natural'), dennis, boardHash: result.boardHash,
      tries: result.triesPerSalt, average, cleared, valid: result.valid, withinDennisPlusOne: cleared
        && result.triesPerSalt.every(tries => tries <= dennis + 1),
      mismatch: average === null ? null : Math.abs(average - dennis) * (average < dennis ? 2 : 1),
      boardSource: entry.boardSource, historicalBoardExact: entry.historicalBoardExact ?? null,
      slowestMove: result.slowestMove, minutesPerBoard: result.minutesPerBoard, lossTypes: result.lossTypes };
  });
  const clearedAll = rows.every(row => row.cleared), valid = rows.every(row => row.valid && row.slowestMove < 2000);
  const difficultyRows = rows.filter(row => row.average !== null && (row.dennis >= 2 || row.average > 1));
  const diagnosticCorrelation = spearman(difficultyRows.map(row => [row.dennis, row.average]));
  const dennisTotal = rows.reduce((sum, row) => sum + row.dennis, 0);
  const botTotalsPerSalt = salts.map((salt, index) => rows.every(row => row.tries[index] !== null)
    ? rows.reduce((sum, row) => sum + row.tries[index], 0) : null);
  const botMeanTotal = clearedAll ? rows.reduce((sum, row) => sum + row.average, 0) : null;
  const correlation = clearedAll ? diagnosticCorrelation : null;
  const gates = { clearance: valid && clearedAll, dennisPlusOne: valid && rows.every(row => row.withinDennisPlusOne),
    totalTries: valid && botMeanTotal !== null && botMeanTotal <= dennisTotal,
    difficulty: valid && correlation !== null && correlation >= 0.6 };
  return { schema: 'human-level-design-evaluation-v1', salts, profileHash, sourceHash, valid, rows,
    dennisTotal, botTotalsPerSalt, botMeanTotal, correlation, clearedOnlyCorrelation: diagnosticCorrelation,
    difficultySampleSize: difficultyRows.length, gates, passed: Object.values(gates).every(Boolean),
    openFailures: rows.filter(row => !row.valid || !row.withinDennisPlusOne),
    biggestMismatches: rows.slice().sort((left, right) => +!right.cleared - +!left.cleared
      || (right.mismatch ?? 0) - (left.mismatch ?? 0) || left.level - right.level).slice(0, 10),
    slowestMove: Math.max(...rows.map(row => row.slowestMove)),
    minutesPerBoard: rows.reduce((sum, row) => sum + row.minutesPerBoard, 0) / rows.length };
}

function compare(baseline, candidate) {
  assert(baseline.valid && candidate.valid);
  assert.deepEqual(baseline.salts, candidate.salts);
  const previous = new Map(baseline.rows.map(row => [row.level, row]));
  assert.equal(previous.size, candidate.rows.length);
  const fixes = [], regressions = [];
  for (const row of candidate.rows) {
    const earlier = previous.get(row.level);
    assert(earlier && earlier.dennis === row.dennis && earlier.kind === row.kind);
    assert.equal(earlier.boardHash, row.boardHash, 'Adoption must compare the identical real board');
    const before = earlier.valid && earlier.withinDennisPlusOne, after = row.valid && row.withinDennisPlusOne;
    if (!before && after) fixes.push(row.level);
    if (before && !after) regressions.push(row.level);
  }
  return { fixes, regressions, adopted: fixes.length > 0 && regressions.length === 0,
    note: 'Adoption requires a repaired failing level and no formerly passing level broken on the same real boards and salts.' };
}

module.exports = { evaluate, compare, ranks, spearman };
