'use strict';
const L = require('../../../www/layouts.js');
const { choiceFactory } = require('./personal_context_choice.js');
const { FEATURES: PLAN_FEATURES, planFeatures } = require('./personal_plan_choice.js');
const KINDS = ['flip', 'pair', 'single', 'fatal'];
const FEATURES = [...PLAN_FEATURES, ...KINDS.flatMap(kind => ['intercept', 'trayTwo', 'trayThree'].map(context => kind + '.' + context))];
const EMPTY = { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] };
const finite = values => Array.isArray(values) && values.every(Number.isFinite);
const validPrior = values => finite(values) && values.length === 2 && values.every(value => value > 0)
  && Math.abs(values[0] + values[1] - 1) < 1e-12;
const softmax = scores => {
  if (!finite(scores) || !scores.length) throw new Error('Invalid outcome-style scores');
  const maximum = Math.max(...scores), mass = scores.map(value => Math.exp(value - maximum));
  const total = mass.reduce((sum, value) => sum + value, 0);
  return mass.map(value => value / total);
};
const sample = (values, draw) => {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid outcome-style draw');
  let selected = 0;
  while (selected < values.length - 1 && (values[selected] === 0 || (draw -= values[selected]) > 0)) selected++;
  return selected;
};

function styleFeatures(decision) {
  const plans = planFeatures(decision);
  if (!finite(decision.kindContext) || decision.kindContext.length !== 26) throw new Error('Invalid outcome-style public context');
  return decision.F.map((feature, index) => {
    const kind = feature[19] ? 'flip' : feature[18] ? 'fatal' : feature[14] ? 'pair' : 'single';
    return [...plans[index], ...KINDS.flatMap(value => value === kind ? [1, decision.kindContext[2], decision.kindContext[3]] : [0, 0, 0])];
  });
}

function styleEvaluator(actor, model) {
  if (model.type !== 'personalOutcomeStyles-v1' || JSON.stringify(model.features) !== JSON.stringify(FEATURES)
    || !Array.isArray(model.weights) || model.weights.length !== 2
    || model.weights.some(row => !finite(row) || row.length !== FEATURES.length)
    || !Array.isArray(model.priors) || model.priors.length !== 2 || model.priors.some(prior => !validPrior(prior))) throw new Error('Invalid personal outcome-style model');
  const base = choiceFactory(actor, EMPTY), weights = model.weights.map(row => row.slice());
  const components = decision => {
    const initial = base.probabilities(decision), features = styleFeatures(decision);
    return weights.map(parameter => softmax(features.map((feature, index) => feature.reduce((sum, value, position) =>
      sum + value * parameter[position], Math.log(Math.max(1e-300, initial[index]))))));
  };
  const choose = component => {
    if (component !== 0 && component !== 1) throw new Error('Invalid outcome-style component');
    const selector = (decision, draw) => sample(components(decision)[component], draw);
    selector.probabilities = decision => components(decision)[component];
    Object.defineProperty(selector, 'component', { value: component });
    return selector;
  };
  return { base, components, choose };
}

function styleAttemptFactory(actor, model, initialNew = true, enabled = true) {
  if (typeof initialNew !== 'boolean' || typeof enabled !== 'boolean') throw new Error('Invalid outcome-style mode');
  const evaluator = styleEvaluator(actor, model), priors = model.priors.map(prior => prior.slice());
  return metadata => {
    if (!Number.isInteger(metadata.run) || metadata.run < 0 || !Number.isInteger(metadata.attempt) || metadata.attempt < 1
      || !Number.isSafeInteger(metadata.seed)) throw new Error('Invalid outcome-style attempt metadata');
    if (!enabled) return evaluator.base;
    const prior = priors[metadata.attempt === 1 && initialNew ? 0 : 1];
    return evaluator.choose(sample(prior, L.rng(metadata.seed * 31 + 20261018)()));
  };
}

function scoreStyles(game, evaluator, priors, enabled = true) {
  if (!Array.isArray(priors) || priors.length !== 2 || priors.some(prior => !validPrior(prior))) throw new Error('Invalid outcome-style scoring priors');
  let posterior = priors[game.initialNewLevel ? 0 : 1].slice(), loss = 0, hits = 0, decisions = 0;
  for (const decision of game.decisions) {
    if (decision.k < 0) continue;
    const emission = enabled ? evaluator.components(decision) : [evaluator.base.probabilities(decision), evaluator.base.probabilities(decision)];
    const values = emission[0].map((value, index) => posterior[0] * value + posterior[1] * emission[1][index]);
    const maximum = Math.max(...values), ties = values.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
    loss -= Math.log(Math.max(1e-300, values[decision.k]));
    hits += +ties[decision.k] / ties.filter(Boolean).length;
    posterior = softmax(posterior.map((value, component) => Math.log(Math.max(1e-300, value))
      + Math.log(Math.max(1e-300, emission[component][decision.k]))));
    decisions++;
  }
  return { decisions, jointLogLoss: decisions ? loss / decisions : null,
    topActionAccuracy: decisions ? hits / decisions : null, posterior };
}

module.exports = { FEATURES, styleFeatures, styleEvaluator, styleAttemptFactory, scoreStyles };
