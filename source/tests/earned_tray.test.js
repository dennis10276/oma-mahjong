'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { build } = require('../tools/builder/bank/earned_tray');
const E = require('../tools/builder/engine');
const { build: buildBoard, fullTrayFailure } = require('../tools/builder/builder');
const { closeTwins } = require('../tools/builder/bank/separate');
const { findOpeningSweep, findFinishPair } = require('../tools/builder/bank/choice_checks');

for (const [variant, seed, minimum] of [['clock', 282, 14], ['keys', 19, 17]]) {
  test(`builds the ${variant} variant with a short exact clock and a real tray trap`, () => {
    const result = build({ variant, seed, tries: 1 });
    const { design, proof, secondWrongTurn, finishPressure } = result;
    assert.ok(design, result.fail);
    assert.equal(result.minimum, minimum);
    assert.equal(design.clock.n, minimum + 1);
    assert.ok(E.replay(design, design.solution).ok);
    assert.ok(!fullTrayFailure(design));
    assert.equal(closeTwins(design).visible, 0);
    assert.equal(proof.wrongThaw.length, 3);
    assert.equal(findOpeningSweep(design), null);
    assert.ok(finishPressure >= 3 && finishPressure <= 5);
    assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
    if (variant === 'keys') assert.ok(secondWrongTurn);
  });
}

test('builds a standard-rule second chain with a believable wrong finish pair', () => {
  const result = buildBoard({ mode: 'earnedTray', variant: 'reserve', seed: 454 }, { tries: 1 });
  const { design, finishPair } = result;
  assert.ok(design, result.fail);
  assert.ok(E.replay(design, design.solution).ok);
  assert.deepEqual(finishPair, findFinishPair(design));
  assert.ok(finishPair.runway >= 5);
  assert.ok(finishPair.runway <= 18 && finishPair.runwayExact);
  assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
});

test('builds separate tempting key and clock goals like the live opening traces', () => {
  const result = build({ variant: 'competing', seed: 642, tries: 1 });
  assert.ok(result.design, result.fail);
  assert.ok(E.replay(result.design, result.design.solution).ok);
  assert.ok(result.openingChoices.some(choice => choice.goal === 'key' && choice.relaxed === 'lose'));
  assert.ok(result.openingChoices.some(choice => choice.goal === 'clock' && choice.runway >= 5));
  assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
});
