'use strict';
const L = require('../../../www/layouts.js');
const { choiceFactory } = require('./personal_context_choice.js');
const FEATURES = ['sideX', 'sideY', 'height', 'pair', 'trayMatch', 'peekMatch', 'inspection', 'reopen',
  'pairPreparation', 'keyProgress', 'clockProgress', 'urgentClockProgress', 'mateDepth', 'trayThree', 'freeOptions', 'expectedReveal'];
const EMPTY = { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] };
const finite = values => Array.isArray(values) && values.every(Number.isFinite);
const validPrior = prior => finite(prior) && prior.length === 2 && prior.every(value => value > 0) && Math.abs(prior[0] + prior[1] - 1) < 1e-12;
const softmax = scores => {
  if (!finite(scores) || !scores.length) throw new Error('Invalid personal episode scores');
  const maximum = Math.max(...scores), mass = scores.map(value => Math.exp(value - maximum));
  const total = mass.reduce((sum, value) => sum + value, 0);
  return mass.map(value => value / total);
};
const sample = (probabilities, draw) => {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid personal episode draw');
  for (let index = 0; index < probabilities.length - 1; index++) {
    if (draw < probabilities[index]) return index;
    draw -= probabilities[index];
  }
  return probabilities.length - 1;
};

function planFeatures(decision) {
  if (!Array.isArray(decision.F) || !Array.isArray(decision.immediate) || decision.F.length !== decision.immediate.length) throw new Error('Invalid personal plan feature arrays');
  return decision.F.map((feature, index) => {
    const actual = decision.immediate[index];
    if (!finite(feature) || feature.length !== 76 || !finite(actual) || actual.length !== 29) throw new Error('Invalid actual personal plan features');
    return [feature[21] - 0.5, feature[22] - 0.5, feature[26], actual[14], feature[64], feature[66], actual[19],
      feature[65], feature[67], actual[22], actual[25], actual[26], Math.min(20, Math.max(0, actual[3])) / 20,
      actual[2], Math.log1p(Math.max(0, actual[6])) / 5, Math.min(4, Math.max(0, actual[13])) / 4];
  });
}

function planEvaluator(actor, model) {
  if (model.type !== 'personalEpisodeStyles-v1' || JSON.stringify(model.features) !== JSON.stringify(FEATURES)
    || !Array.isArray(model.weights) || model.weights.length !== 2 || model.weights.some(row => !finite(row) || row.length !== FEATURES.length)
    || !validPrior(model.prior) || !validPrior(model.initialPrior)
    || ['any', 'clock', 'tray', 'restart', 'other'].some(reason => !Array.isArray(model.transitions?.[reason]) || model.transitions[reason].length !== 2 || model.transitions[reason].some(row => !validPrior(row)))) throw new Error('Invalid personal episode model');
  const base = choiceFactory(actor, EMPTY), weights = model.weights.map(row => row.slice());
  const components = decision => {
    const initial = base.probabilities(decision), features = planFeatures(decision);
    return weights.map(parameter => softmax(features.map((feature, index) => feature.reduce((sum, value, position) => sum + value * parameter[position], Math.log(Math.max(1e-300, initial[index]))))));
  };
  const choose = (prior, component = null) => {
    if (!validPrior(prior) || (component !== null && component !== 0 && component !== 1)) throw new Error('Invalid personal episode selection');
    const mixture = prior.slice();
    const distribution = decision => {
      const values = components(decision);
      return component === null ? values[0].map((value, index) => mixture[0] * value + mixture[1] * values[1][index]) : values[component];
    };
    const selector = (decision, draw) => sample(distribution(decision), draw);
    selector.probabilities = distribution;
    Object.defineProperty(selector, 'component', { value: component });
    selector.prior = Object.freeze(mixture.slice());
    return selector;
  };
  return { base, components, choose };
}

function planAttemptFactory(actor, model, mode = 'episode', initialNew = true) {
  if (!['base', 'step', 'episode', 'adaptive'].includes(mode) || typeof initialNew !== 'boolean') throw new Error('Invalid personal episode mode');
  const evaluator = planEvaluator(actor, model), previous = new Map();
  const priors = { initial: model.initialPrior.slice(), retry: model.prior.slice() };
  const transitions = Object.fromEntries(Object.entries(model.transitions).map(([reason, matrix]) => [reason, matrix.map(row => row.slice())]));
  return metadata => {
    if (!Number.isInteger(metadata.run) || metadata.run < 0 || !Number.isInteger(metadata.attempt) || metadata.attempt < 1
      || !Number.isSafeInteger(metadata.seed) || (metadata.previousFailure !== null && typeof metadata.previousFailure !== 'string')) throw new Error('Invalid personal episode metadata');
    if (metadata.attempt === 1) previous.delete(metadata.run);
    if (mode === 'base') return evaluator.base;
    let prior = metadata.attempt === 1 && initialNew ? priors.initial : priors.retry;
    if (mode === 'adaptive' && metadata.attempt > 1 && metadata.previousFailure && metadata.previousFailure !== 'contextChoiceLimit' && previous.has(metadata.run)) {
      const reason = transitions[metadata.previousFailure] ? metadata.previousFailure : 'any';
      prior = transitions[reason][previous.get(metadata.run)];
    }
    if (mode === 'step') return evaluator.choose(prior);
    const component = sample(prior, L.rng(metadata.seed * 31 + 20261018)());
    previous.set(metadata.run, component);
    return evaluator.choose(prior, component);
  };
}

function scoreSequence(game, evaluator, prior) {
  if (!validPrior(prior)) throw new Error('Invalid personal episode scoring prior');
  let posterior = prior.slice(), loss = 0, stepLoss = 0, hits = 0, stepHits = 0, decisions = 0;
  for (const decision of game.decisions) {
    if (decision.k < 0) continue;
    const values = evaluator.components(decision);
    const predictive = values[0].map((value, index) => posterior[0] * value + posterior[1] * values[1][index]);
    const independent = values[0].map((value, index) => prior[0] * value + prior[1] * values[1][index]);
    loss -= Math.log(Math.max(1e-300, predictive[decision.k]));
    stepLoss -= Math.log(Math.max(1e-300, independent[decision.k]));
    const hit = probabilities => {
      const maximum = Math.max(...probabilities), ties = probabilities.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
      return +ties[decision.k] / ties.filter(Boolean).length;
    };
    hits += hit(predictive);
    stepHits += hit(independent);
    posterior = softmax(posterior.map((value, component) => Math.log(Math.max(1e-300, value)) + Math.log(Math.max(1e-300, values[component][decision.k]))));
    decisions++;
  }
  return { decisions, jointLogLoss: decisions ? loss / decisions : null, topActionAccuracy: decisions ? hits / decisions : null,
    stepLogLoss: decisions ? stepLoss / decisions : null, stepTopActionAccuracy: decisions ? stepHits / decisions : null, posterior };
}

module.exports = { FEATURES, planFeatures, planEvaluator, planAttemptFactory, scoreSequence };
