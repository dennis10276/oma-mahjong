'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { build } = require('../tools/builder/bank/earned_tray');
const E = require('../tools/builder/engine');
const { build: buildBoard, fullTrayFailure, winningFullTrayFailure } = require('../tools/builder/builder');
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

test('builds an exposed clock that looks won early and still needs a full tray to win', () => {
  const result = buildBoard({ mode: 'earnedTray', variant: 'early-clock', seed: 10 }, { tries: 1 });
  const { design, proof, openingChoices } = result;
  assert.ok(design, result.fail);
  assert.equal(result.minimum, 11);
  assert.equal(design.clock.n, 12);
  assert.ok(E.replay(design, design.solution).ok);
  assert.equal(fullTrayFailure(design), 'lowPressureClockRoute');
  assert.equal(winningFullTrayFailure(design), null);
  assert.ok(proof.wrongThaw.length >= 3);
  assert.ok(openingChoices.some(c => c.tile === design.clock.i && c.runway >= 5 && c.relaxed === 'lose'));
  assert.ok(result.finishPressure >= 3 && result.finishPressure <= 5);
  assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
});

test('building a covered clock keeps the useful cover safe and makes the premature clock lose', () => {
  const result = buildBoard({ mode: 'earnedTray', variant: 'covered-clock', seed: 18 }, { tries: 1 });
  const { design, proof, clockCover } = result;
  assert.ok(design, result.fail);
  assert.equal(design.clock.n, result.minimum);
  assert.ok(result.minimum >= 10);
  assert.equal(winningFullTrayFailure(design), null);
  assert.ok(E.replay(design, design.solution).ok);

  const game = E.game(design);
  const start = E.start(game);
  assert.equal(E.legal(game, start).includes(design.clock.i), false);
  const cover = E.step(game, start, clockCover.cover);
  assert.equal(E.winnable(game, cover).result, 'win');
  const hurry = E.step(game, cover, design.clock.i);
  assert.equal(hurry.clockTaken, true);
  assert.equal(hurry.tray.length, 2);
  assert.equal(E.winnable(game, hurry).result, 'lose');
  assert.ok(clockCover.runway >= 5);
  assert.ok(clockCover.winningClockMove > hurry.moves);
  assert.ok(result.finishPressure >= 3 && result.finishPressure <= 5);
  assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
  assert.ok(!proof.wrongThaw.includes(clockCover.cover));
});

test('an explicitly new idea must finish at two pressure parks in both samples', () => {
  const brief = { mode: 'earnedTray', variant: 'pair-context', seed: 5 };
  const result = buildBoard({ ...brief, idea: 'new' }, { tries: 1 });
  assert.ok(result.design, result.fail);
  assert.ok(result.finishContext);
  assert.equal(result.finishPressure, 2);
  assert.equal(result.independentFinishPressure, 2);
  assert.equal(buildBoard(brief, { tries: 1 }).design, undefined);
});

test('builds separate tempting key and clock goals like the live opening traces', () => {
  const result = build({ variant: 'competing', seed: 642, tries: 1 });
  assert.ok(result.design, result.fail);
  assert.ok(E.replay(result.design, result.design.solution).ok);
  assert.ok(result.openingChoices.some(choice => choice.goal === 'key' && choice.relaxed === 'lose'));
  assert.ok(result.openingChoices.some(choice => choice.goal === 'clock' && choice.runway >= 5));
  assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
});

test('builds a supported shelf with rival matches that help different ice goals', () => {
  const result = buildBoard({ mode: 'earnedTray', variant: 'refund', seed: 102 }, { tries: 1 });
  assert.ok(result.design, result.fail);
  assert.equal(result.design.tiles.length, 72);
  assert.ok(E.replay(result.design, result.design.solution).ok);
  const { prefix, intendedGoal, decoyGoal, decoyClock, runway } = result.refundFork;
  assert.equal(prefix.length, 5);
  assert.equal(intendedGoal.kind, 'ice');
  assert.equal(decoyGoal.kind, 'ice');
  assert.notEqual(intendedGoal.tile, decoyGoal.tile);
  assert.ok(decoyClock > result.design.clock.n && runway >= 5);
  assert.ok(result.finishPair?.runway >= 5);
  assert.ok(result.independentFinishPressure >= 3 && result.independentFinishPressure <= 5);
  const { auditRefundFork } = require('../tools/builder/bank/choice_checks');
  const { design } = result;
  const { intended, decoy } = result.refundFork;
  const stale = { ...design, obst: { ...design.obst, ice: { ...design.obst.ice, [intended]: 1 } } };
  assert.deepEqual(auditRefundFork(stale, prefix, intended, decoy)?.intendedGoal, { kind: 'key', tile: 23 });
});

test('builds a finish with two useful losing parks and a visible three-take release', () => {
  const { design, finishRelease, minimum, independentFinishPressure, fail } = buildBoard(
    { mode: 'earnedTray', variant: 'release', seed: 63 }, { tries: 1 },
  );
  assert.ok(design, fail);
  assert.equal(design.clock.n, minimum + 1);
  assert.ok(E.replay(design, design.solution).ok);
  assert.equal(finishRelease.route.length, 3);
  const seen = new Set(finishRelease.decoys.map(move => move.pair.slice().sort().join(',')));
  assert.ok(seen.size >= 2);
  assert.ok(finishRelease.decoys.every(move => move.runway >= 5));
  assert.ok(independentFinishPressure >= 3 && independentFinishPressure <= 5);
  const { forcesReleaseAfterClock } = require('../tools/builder/bank/choice_checks');
  assert.ok(forcesReleaseAfterClock(design, finishRelease));
  assert.equal(forcesReleaseAfterClock({ ...design, clock: { ...design.clock, n: 26 } }, finishRelease), false);
});

test('separates the filler twins without weakening the release traps', () => {
  const { design, finishRelease, fail } = buildBoard({ mode: 'earnedTray', variant: 'release', seed: 463 }, { tries: 1 });
  assert.ok(design, fail);
  assert.ok(closeTwins(design).meets);
  assert.ok(E.replay(design, design.solution).ok);
  assert.ok(finishRelease.decoys.length >= 2);
});

test('adds two alternative roofs with playable matches to the release finish', () => {
  const { design, finishRelease, fail } = buildBoard(
    { mode: 'earnedTray', variant: 'release-roofs', seed: 1259 }, { tries: 1 },
  );
  assert.ok(design, fail);
  const roofs = finishRelease.decoys.filter(move => design.tiles[move.take][2] === 2);
  assert.equal(roofs.length, 2);
  assert.notDeepEqual(roofs[0].pair, roofs[1].pair);
  assert.ok(E.replay(design, design.solution).ok);
});

test('builds a key-directed opening with a trapped release on the opposite shelf', () => {
  const { design, finishRelease, openingChoices, minimum, finishPressure, independentFinishPressure, fail } = buildBoard(
    { mode: 'earnedTray', variant: 'release-keys', seed: 108 }, { tries: 1 },
  );
  assert.ok(design, fail);
  assert.equal(minimum, 17);
  assert.equal(design.clock.n, minimum);
  assert.equal(finishRelease.at, minimum);
  assert.deepEqual(new Set(openingChoices.map(choice => choice.goal)), new Set(['clock', 'key']));
  assert.ok(openingChoices.every(choice => choice.runway >= 5));
  const pairs = new Set(finishRelease.decoys.map(move => move.pair.slice().sort().join(',')));
  assert.ok(pairs.size >= 2);
  assert.ok(finishRelease.decoys.every(move => move.runway >= 5));
  assert.ok([finishPressure, independentFinishPressure].every(parks => parks >= 3 && parks <= 5));
  assert.equal(fullTrayFailure(design), null);
  const { forcesReleaseAfterClock } = require('../tools/builder/bank/choice_checks');
  assert.ok(forcesReleaseAfterClock(design, finishRelease));
  assert.equal(forcesReleaseAfterClock({ ...design, clock: { ...design.clock, n: 18 } }, finishRelease), false);
  assert.ok(E.replay(design, design.solution).ok);
});

test('builds the same visible finish pair with a win and a delayed loss after spending a slot', () => {
  const { design, finishContext, finishPressure, independentFinishPressure, fail } = buildBoard(
    { mode: 'earnedTray', variant: 'pair-context', seed: 11 }, { tries: 1 },
  );
  assert.ok(design, fail);
  assert.ok(E.replay(design, design.solution).ok);
  assert.equal(finishContext.before.outcome, 'win');
  assert.equal(finishContext.after.outcome, 'lose');
  assert.equal(finishContext.after.at, finishContext.before.at + 1);
  assert.ok(finishContext.after.runway >= 5);
  assert.equal(finishContext.sidePair.length, 2);
  const { auditPairContext } = require('../tools/builder/bank/choice_checks');
  const prefix = design.solution.slice(0, finishContext.before.at);
  assert.equal(auditPairContext(design, prefix, finishContext.pair, finishContext.park,
    { roofs: finishContext.pair, hidden: [] }), null);
  assert.equal(finishContext.coveredPair.length, 2);
  assert.ok(finishContext.coveredPair.every(tile => design.down.includes(tile)));
  assert.deepEqual(finishContext.sideRoute.filter(move => move.pair).map(move => move.pair),
    finishContext.pair.map((tile, i) => [tile, finishContext.coveredPair[i]]));
  assert.ok([finishPressure, independentFinishPressure].every(p => p >= 3 && p <= 5));
});
