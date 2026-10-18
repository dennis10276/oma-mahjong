'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { FEATURES, planEvaluator, planAttemptFactory } = require('./personal_plan_choice.js');
const encoded = { withinWeights: new Array(76).fill(0), kindModel: { weights: Object.fromEntries(['flip', 'pair', 'single', 'fatal'].map(kind => [kind, new Array(26).fill(0)])) } };
const model = { type: 'personalEpisodeStyles-v1', features: FEATURES, weights: [new Array(16).fill(0), new Array(16).fill(0)],
  prior: [0.5, 0.5], initialPrior: [0.99999999, 0.00000001], transitions: Object.fromEntries(['any', 'clock', 'tray', 'restart', 'other'].map(reason => [reason, [[0.00000001, 0.99999999], [0.99999999, 0.00000001]]])) };
model.weights[0][0] = 2; model.weights[1][0] = -2;
const decision = { F: [new Array(76).fill(0), new Array(76).fill(0)], immediate: [new Array(29).fill(0), new Array(29).fill(0)], kindContext: new Array(26).fill(0) };
decision.F[1][21] = 1;
const metadata = (run, attempt, previousFailure = null) => ({ run, attempt, seed: 7919 + run * 104729 + (attempt - 1) * 15485863, previousFailure });
const adaptive = planAttemptFactory(encoded, model, 'adaptive');
const first = adaptive(metadata(0, 1));
assert.equal(first.component, 0);
assert(first.probabilities(decision)[1] > 0.8);
first(decision, 0.1); first(decision, 0.9);
assert.equal(first.component, 0);
const second = adaptive(metadata(0, 2, 'tray'));
assert.equal(second.component, 1);
assert(second.probabilities(decision)[0] > 0.8);
assert.equal(adaptive(metadata(1, 1)).component, 0);
assert.equal(adaptive(metadata(0, 1)).component, 0);
const step = planAttemptFactory(encoded, model, 'step')(metadata(0, 1));
assert.equal(step.component, null);
const ordinaryPrior = { ...model, initialPrior: [0.3, 0.7] };
const sampler = planAttemptFactory(encoded, ordinaryPrior, 'episode');
let componentZero = 0;
for (let run = 0; run < 1000; run++) if (sampler(metadata(run, 1)).component === 0) componentZero++;
assert(componentZero > 240 && componentZero < 360, 'Dedicated component draws should reproduce the declared initial mixture');
assert.throws(() => adaptive({ ...metadata(0, 1), seed: Infinity }));
assert.throws(() => planEvaluator(encoded, { ...model, prior: [0, 1] }));
assert.throws(() => planAttemptFactory(encoded, model, 'invalid'));
const make = (faces, down = faces.map(() => 0)) => {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return { tiles, nb: L.neighbors(tiles), faces, down };
};
const actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false,
  kindModel: encoded.kindModel, w: encoded.withinWeights.slice(0, 21), spatial: encoded.withinWeights.slice(21, 68), goalWeights: encoded.withinWeights.slice(68) };
const events = [], simple = make([0, 1, 2, 3]);
const callback = planEvaluator(encoded, model).base;
const plain = Hard.rateChain(simple, 2, 1, { ...actor, physicalChoice: callback }, 0, 3);
const resolved = Hard.rateChain(simple, 2, 1, { ...actor, physicalChoiceForAttempt: info => {
  assert.deepEqual(Object.keys(info), ['run', 'attempt', 'seed', 'previousFailure']);
  assert(Object.isFrozen(info));
  events.push(info);
  return callback;
} }, 0, 3);
assert.deepEqual(resolved, plain);
assert.equal(events.length, 6);
assert.equal(events[0].previousFailure, null);
assert.equal(events[1].previousFailure, 'tray');
assert.equal(events[3].previousFailure, null);
assert.deepEqual(events.map(info => info.attempt), [1, 2, 3, 1, 2, 3]);
const censoredEvents = [], looping = make([0, 1, 2, 0, 1, 2], [1, 1, 1, 1, 1, 1]);
const censored = Hard.rateChain(looping, 1, 1, { ...actor, physicalChoiceLimit: 4, physicalChoiceForAttempt: info => {
  censoredEvents.push(info);
  let position = 0;
  return features => {
    const wanted = position++ % 2 ? 0.2 : 0;
    return features.F.findIndex(feature => feature[19] && Math.abs(feature[21] - wanted) < 1e-12);
  };
} }, 0, 2);
assert.equal(censored.computationCensored, 2);
assert.equal(censoredEvents[1].previousFailure, null);
assert.throws(() => Hard.play(simple, { ...actor, physicalChoiceForAttempt: adaptive }, 1));
assert.throws(() => Hard.rateChain(simple, 1, 1, { ...actor, physicalChoiceForAttempt: () => null }, 0, 1));
const followed = { ...simple, follow: [0], log: [], policyLog: [], physicalLog: [] }, followedPlain = structuredClone(followed);
assert.deepEqual(Hard.play(followed, { ...actor, physicalChoiceForAttempt: () => { throw new Error('Follow must not initialize a plan'); } }, 1), Hard.play(followedPlain, actor, 1));
assert.deepEqual(followed.physicalLog, followedPlain.physicalLog);
const pinned = path.resolve(__dirname, '../../../analysis/archive/personal-bots/experiments/personal-context-full-2026-10-18T05-17-41-214Z');
const manifest = JSON.parse(fs.readFileSync(path.join(pinned, 'manifest.json')));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(pinned, 'www/hard.js'))).digest('hex'), manifest.files['www/hard.js']);
const previous = require(path.join(pinned, 'www/hard.js'));
for (const seed of [1, 7, 19]) for (const game of [simple, make([0, 1, 0, 1], [1, 1, 1, 1])]) {
  assert.deepEqual(Hard.rateChain(game, 4, seed, actor, 0.75, 4), previous.rateChain(game, 4, seed, actor, 0.75, 4));
}
const firstFeatures = [[0, 1, 2, 0, 1, 2], [0, 2, 1, 0, 1, 2]].map(faces => {
  let initial = null;
  const factory = planAttemptFactory(encoded, model, 'episode');
  Hard.rateChain(make(faces, [0, 1, 1, 0, 0, 0]), 1, 1, { ...actor, physicalChoiceForAttempt: info => {
    const choose = factory(info);
    return (features, draw) => { if (!initial) initial = structuredClone(features); return choose(features, draw); };
  } }, 0, 1);
  assert(initial);
  return initial;
});
assert.deepEqual(firstFeatures[0], firstFeatures[1]);
console.log('PASS episode runtime: once-per-attempt seeded components, natural-failure transitions, run resets, untouched controls/follow, metadata isolation and hidden-picture invariance');
