'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { auditOpeningTrace, auditRefundFork, findOpeningChoices, findOpeningSweep, findFinishPair } = require('../tools/builder/bank/choice_checks');
const { design: better } = require('../analysis/builder/bank/earned-tray/clock.json');
const { design: easy } = require('../analysis/builder/bank/earned-tray/keys.json');
const { design: live324 } = require('../analysis/builder/bank/repeat-pressure-300/level-324.json');
const { design: live323 } = require('../analysis/builder/bank/repeat-pressure-300/level-323.json');
const { design: live327 } = require('../analysis/builder/bank/repeat-pressure-300/level-327.json');
const { design: cover } = require('../analysis/builder/hand/round999/a-center-cover.json');
const { design: plainRefund } = require('../analysis/builder/bank/procedural-trays/pairedFalseMelt-L1038-s367-p1.json');
const { design: reserve } = require('../analysis/builder/bank/chained-v2/far-end/lookalikeCoverThaw-L18-s4-p1.json');

test('proves the five visible causal takes that bypassed the intended choice on the easy deal', () => {
  assert.deepEqual(findOpeningSweep(easy), [69, 58, 57, 56, 55]);
  assert.equal(findOpeningSweep(better), null);
});

test('finds a winning clock arrival with a visible pair that becomes a delayed loss', () => {
  const result = findFinishPair(live324);
  assert.ok(result);
  assert.deepEqual(result.pair, [52, 62]);
  assert.equal(result.at, 12);
  assert.ok(result.runway >= 30);
  assert.equal(result.runwayExact, false);
  assert.equal(findFinishPair(easy), null);
});

test('distinguishes two opening goals seen in the live 327 replays', () => {
  const choices = findOpeningChoices(live327);
  const key = choices.find(choice => choice.tile === 71);
  const dig = choices.find(choice => choice.tile === 41);
  assert.equal(key?.goal, 'key');
  assert.equal(dig?.goal, 'clock');
  assert.equal(key?.relaxed, 'lose');
  assert.ok(dig?.runway >= 5 && key?.runway >= 5);
  assert.ok(!choices.some(choice => choice.tile === 78), 'a cover toward the key is part of the same key plan');
});

test('sees the clock cover and exposed key behind two recoverable tray losses', () => {
  const clock = auditOpeningTrace(cover, [59, 63, 61, 37]);
  assert.equal(clock.result, 'overflow');
  assert.equal(clock.overflow.from, 'win');
  assert.deepEqual(clock.overflow.goals, [{ kind: 'clock', tile: 15 }]);
  const key = auditOpeningTrace(cover, [66, 59, 63, 61, 70, 54]);
  assert.equal(key.overflow.from, 'win');
  assert.deepEqual(key.overflow.goals, [{ kind: 'key', tile: 54 }]);
});

test('records an easy visible refund run and separates an earlier locked-in loss', () => {
  const clean = auditOpeningTrace(plainRefund, [69, 70, 68, 47, 39, 0, 54, 42, 56, 27]);
  assert.equal(clean.result, 'clock');
  assert.equal(clean.clockContinuation, 'win');
  assert.deepEqual(clean.fullTray.map(s => s.faceUpMatches), [[47], [0], [42], [27]]);
  const alreadyLost = auditOpeningTrace(reserve, [67, 51, 61, { pair: [39, 60] }, 45]);
  assert.equal(alreadyLost.result, 'overflow');
  assert.equal(alreadyLost.overflow.from, 'lose');
  assert.ok(alreadyLost.overflow.goals.some(goal => goal.kind === 'ice' && goal.tile === 45));
});

test('rejects malformed peek actions without entering the engine', () => {
  const small = {
    tiles: [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0]],
    faces: [1, 0, 0, 1], down: [2], clock: { i: 3, n: 3 },
  };
  assert.equal(auditOpeningTrace(small, [{ pair: '12' }]).result, 'illegal');
  assert.equal(auditOpeningTrace(small, [{ pair: [1, 2] }, 3]).result, 'clock');
});

test('prices two useful copies of the same match after the tray fills', () => {
  const { build } = require('../tools/builder/bank/earned_tray');
  const { design: d } = build({ variant: 'reserve', seed: 454, tries: 1 });
  const prefix = [69, 49, 48, 70, 58];
  assert.equal(auditRefundFork(d, prefix, 53, 59), null);
  const design = { ...d, faces: d.faces.map(face => face === d.faces[59] ? d.faces[53] : face) };
  const fork = auditRefundFork(design, prefix, 53, 59);
  assert.equal(fork?.waiting, 69);
  assert.deepEqual(fork?.intendedGoal, { kind: 'ice', tile: 53 });
  assert.deepEqual(fork?.decoyGoal, { kind: 'ice', tile: 54 });
  assert.equal(fork?.decoyClock, 19);
  assert.ok(fork?.runway >= 5);
  assert.equal(auditRefundFork(design, prefix, 59, 53), null);
});

test('proves a three-take release while a second useful park loses', () => {
  const { auditTrayRelease } = require('../tools/builder/bank/choice_checks');
  const prefix = live323.solution.slice(0, 21);
  const release = auditTrayRelease(live323, prefix, [67, 49, 22]);
  assert.equal(release?.waiting, 71);
  assert.ok(release.decoys.some(move => move.take === 51 && move.pair.includes(12) && move.runway >= 5));
  assert.ok(!release.decoys.some(move => move.take === 45), 'a loose losing tile does not advance an observable match');
  assert.equal(auditTrayRelease(live323, prefix, [49, 67, 22]), null);
  assert.equal(auditTrayRelease(live323, live323.solution.slice(0, 9), [67, 49, 22]), null);
});
