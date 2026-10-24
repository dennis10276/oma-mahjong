'use strict';
const assert = require('assert/strict');
const { rankInformationActions } = require('./public_information_sampling.js');

function test() {
  const problem = { rememberedPictures: [0, 0, null, null], actions: [0, 1], fallbackIndex: 0, unseenFraction: 1 };
  const seen = [], physics = {
    prepare(request) { seen.push(['prepare', request.worldOrdinal]); return true; },
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
  const remembered = rankInformationActions({ ...problem, unseenFraction: 0.05 },
    { physics, random: () => 0, deadline: Date.now() + 1000, maximumWorlds: 1 });
  assert.equal(remembered.index, 0); assert.equal(remembered.nodes, 4000);
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
