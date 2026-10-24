'use strict';
const assert = require('assert/strict');
const { rankInformationActions } = require('./public_information_sampling.js');

function test() {
  const problem = { rememberedPictures: [0, 0, null, null], actions: [0, 1], fallbackIndex: 0, unseenFraction: 1 };
  const seen = [], physics = {
    prepare(request) { seen.push(['prepare', request.worldOrdinal]); return true; },
    createInformationEvaluation(request) {
      const evaluate = this.evaluateInformation.bind(this);
      return { next: () => ({ done: true, value: evaluate(request) }),
        snapshot: () => ({ kind: 'informationEvaluation', status: 'unresolved', progress: 0 }) };
    },
    evaluateInformation(request) {
      seen.push([request.index, request.hypothesis.pictures.slice()]);
      return { kind: 'informationEvaluation', status: request.index === 1 ? 'cleared' : 'lost', progress: 0.5 };
    },
    evaluate(request) {
      assert.equal(request.nodeLimit, 4096);
      return { kind: 'hypothesisEvaluation', status: request.index === 0 ? 'cleared' : 'lost', nodes: 2000 };
    } };
  const honest = rankInformationActions(problem, { physics, random: () => 0, deadline: Date.now() + 1000, maximumWorlds: 1 });
  assert.equal(honest.index, 1); assert.equal(honest.informationWeight, 1); assert.equal(honest.nodes, 0);
  assert.deepEqual(seen[1][1], seen[2][1]); assert.equal(honest.completeWorlds, 1);
  assert.equal(honest.knownWin, false); assert.equal(honest.exactLossShares, false);
  const interleaved = rankInformationActions(problem, { physics, random: () => 0,
    deadline: Date.now() + 1000, maximumWorlds: 1, schedule: 'interleaved' });
  assert.equal(interleaved.index, 1); assert.equal(interleaved.schedule, 'interleaved');
  assert.throws(() => rankInformationActions(problem, { physics, deadline: 1, schedule: 'perLevel' }));
  for (const schedule of ['sequential', 'interleaved']) {
    const fillings = [], diversePhysics = { ...physics,
      evaluateInformation(request) {
        fillings.push(request.hypothesis);
        return physics.evaluateInformation(request);
      } };
    const diverse = rankInformationActions(problem, { physics: diversePhysics, random: () => 0.5,
      deadline: Date.now() + 1000, maximumWorlds: 1, schedule, picturePrior: 'diverse' });
    assert.equal(diverse.index, 1); assert.equal(fillings.length, 2);
    assert.deepEqual(fillings[0], fillings[1]);
    assert.equal(fillings[0].pairPrior, 'diverseRegularPairs');
    assert.equal(fillings[0].observedFact, false); assert.equal(fillings[0].exactPrior, false);
    assert.deepEqual(fillings[0].pictures.slice(0, 2), problem.rememberedPictures.slice(0, 2));
  }
  assert.throws(() => rankInformationActions(problem, { physics, deadline: Date.now() + 1000, picturePrior: 'actualDeck' }));
  for (const schedule of ['sequential', 'interleaved']) {
    const paths = [], optionPhysics = { ...physics,
      evaluateInformation(request) {
        paths.push(request.candidatePath);
        return { kind: 'informationEvaluation', status: request.candidatePath[1] === 1 ? 'cleared' : 'lost', progress: 0 };
      } };
    const options = rankInformationActions({ ...problem, actions: [10, 11], fallbackIndex: 10, actionPaths: [[0, 0], [0, 1]] },
      { physics: optionPhysics, random: () => 0, deadline: Date.now() + 1000, maximumWorlds: 1, schedule });
    assert.equal(options.index, 11); assert.deepEqual(paths, [[0, 0], [0, 1]]);
  }
  const remembered = rankInformationActions({ ...problem, unseenFraction: 0.05 },
    { physics, random: () => 0, deadline: Date.now() + 1000, maximumWorlds: 1 });
  assert.equal(remembered.index, 0); assert.equal(remembered.nodes, 4000);
  for (const schedule of ['sequential', 'interleaved']) {
    const noneClear = { ...physics,
      evaluateInformation: () => ({ kind: 'informationEvaluation', status: 'lost', progress: 0 }),
      evaluate: request => ({ kind: 'hypothesisEvaluation', status: request.index === 0 ? 'unresolved' : 'lost',
        nodes: 2000, progress: request.index === 1 ? 0.9 : 0 }) };
    const mixed = rankInformationActions({ ...problem, unseenFraction: 0.1 }, { physics: noneClear, random: () => 0,
      deadline: Date.now() + 1000, maximumWorlds: 1, schedule });
    assert.equal(mixed.index, 0, 'A losing action cannot outrank an unresolved action just by oracle progress');
    assert(mixed.totals.every(total => total.progress === 0));
    const exhausted = rankInformationActions({ ...problem, unseenFraction: 0.1 }, { physics: { ...noneClear,
      evaluate: request => ({ kind: 'hypothesisEvaluation', status: 'lost', nodes: 2000, progress: request.index === 0 ? 0.2 : 0.9 }) },
    random: () => 0, deadline: Date.now() + 1000, maximumWorlds: 1, schedule });
    assert.equal(exhausted.index, 1, 'Progress may break a tie once every candidate is proved to lose in the filling');
    assert.equal(exhausted.totals[1].progress, 0.9);
  }
  const tied = { ...physics, evaluateInformation: () => ({ kind: 'informationEvaluation', status: 'cleared', progress: 1 }) };
  assert.equal(rankInformationActions(problem, { physics: tied, random: () => 0,
    deadline: Date.now() + 1000, maximumWorlds: 1 }).index, 0);
  let time = 0;
  const slow = { ...physics, evaluateInformation() { time = 100; return { kind: 'informationEvaluation', status: 'cleared', progress: 1 }; } };
  const stopped = rankInformationActions(problem, { physics: slow, now: () => time,
    random: () => 0, deadline: 100, maximumWorlds: 1 });
  assert.equal(stopped.completeWorlds, 0); assert.equal(stopped.index, 0);
  assert(stopped.totals.every(row => row.score === 0));
  console.log('PASS balanced information-aware comparisons override the primary only by score, use identical fillings, weight honest play-outs by unseen information and thousands-node search by memory, preserve ties and discard expired incomplete batches');
}

if (require.main === module) test();
module.exports = test;
