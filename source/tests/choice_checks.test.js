'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { findOpeningChoices, findOpeningSweep, findFinishPair } = require('../tools/builder/bank/choice_checks');
const { design: better } = require('../analysis/builder/bank/earned-tray/clock.json');
const { design: easy } = require('../analysis/builder/bank/earned-tray/keys.json');
const { design: live324 } = require('../analysis/builder/bank/repeat-pressure-300/level-324.json');
const { design: live327 } = require('../analysis/builder/bank/repeat-pressure-300/level-327.json');

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
