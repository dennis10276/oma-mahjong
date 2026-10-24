'use strict';
const assert = require('assert/strict');
const { rankInformationActions } = require('./public_information_sampling.js');

function test() {
  for (const schedule of ['sequential', 'interleaved']) for (const unseenCount of [0, 1, 7, 8, 9]) {
    const aliveCounts = unseenCount ? [unseenCount, unseenCount + 1, unseenCount * 2, unseenCount * 4] : [1];
    for (const aliveCount of aliveCounts) {
      let exactCalls = 0;
      const exactHypotheses = [], physics = {
        prepare: () => true,
        evaluateInformation: () => ({ kind: 'informationEvaluation', status: 'unresolved', progress: 0.1 }),
        createInformationEvaluation() {
          return { next: () => ({ done: true, value: this.evaluateInformation() }), snapshot: this.evaluateInformation };
        },
        evaluate(request) {
          exactCalls++;
          assert.equal(request.nodeLimit, 4096);
          exactHypotheses.push(request.hypothesis);
          return { kind: 'hypothesisEvaluation', status: 'unresolved', nodes: 4096 };
        },
      };
      const problem = { rememberedPictures: [...Array(48).fill(0), ...Array(16).fill(null)], actions: [0, 1],
        fallbackIndex: 0, unseenCount, unseenFraction: unseenCount / aliveCount };
      const original = JSON.stringify(problem);
      const report = rankInformationActions(problem, { physics, random: () => 0.5, now: () => 0, deadline: 1000,
        maximumWorlds: 2, schedule, scoreMode: 'progress', confidenceSE: 2 });
      assert.equal(exactCalls, unseenCount <= 8 ? 4 : 0,
        schedule + ': exact search must depend on alive unseen count, including when every survivor is unseen');
      assert.equal(report.nodes, exactCalls * 4096);
      assert.equal(report.completeWorlds, 2);
      assert.equal(report.index, 0);
      assert.equal(report.knownWin, false); assert.equal(report.knownDead, false); assert.equal(report.observedFact, false);
      assert.equal(report.informationWeight <= 0.75, unseenCount <= 8);
      for (let offset = 0; offset < exactHypotheses.length; offset += 2) {
        assert.deepEqual(exactHypotheses[offset], exactHypotheses[offset + 1]);
      }
      assert.equal(JSON.stringify(problem), original);
    }
  }
  console.log('PASS both schedules reserve exact-search weight and a 4096-node cap at <=8 alive unseen pictures across all remaining-board fractions; >8 stays honest-only, identical fillings remain paired and unresolved searches preserve the primary');
}

if (require.main === module) test();
module.exports = test;
