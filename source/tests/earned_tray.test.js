'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { build } = require('../tools/builder/bank/earned_tray');
const E = require('../tools/builder/engine');
const { fullTrayFailure } = require('../tools/builder/builder');
const { closeTwins } = require('../tools/builder/bank/separate');

for (const [variant, seed, minimum] of [['clock', 147, 13], ['keys', 17, 17]]) {
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
    assert.ok(finishPressure >= 3 && finishPressure <= 5);
    if (variant === 'keys') assert.ok(secondWrongTurn);
  });
}
