'use strict';
const { FEATURES, PARAMETERS, featuresOf } = require('./known_clock_strategy.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { choiceFactory } = require('./personal_context_choice.js');
const CONTEXT = ['intercept', 'trayTwo', 'trayThree', 'exitTwoFound', 'exitThreeMatchFound', 'information',
  'urgency', 'previousDig', 'previousPair', 'routeLost'];
const softmax = scores => {
  const maximum = Math.max(...scores), mass = scores.map(value => Math.exp(value - maximum));
  const total = mass.reduce((sum, value) => sum + value, 0);
  return mass.map(value => value / total);
};
const logistic = value => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));

function checkedFeatures(decision) {
  if (!Array.isArray(decision.knownPlan) || decision.knownPlan.length !== decision.F.length
    || decision.knownPlan.some(parts => !Array.isArray(parts) || parts.length !== FEATURES.length
      || parts.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw new Error('Invalid adaptive clock features');
  return decision.knownPlan;
}

function contextOf(decision, previous = null) {
  const matrix = checkedFeatures(decision), last = previous || { dig: 0, pair: 0, route: 0 };
  if (!Array.isArray(decision.kindContext) || decision.kindContext.length !== 26) throw new Error('Invalid public adaptive clock context');
  const route = +matrix.some(parts => parts[0] > 0);
  return [1, decision.kindContext[2], decision.kindContext[3], +matrix.some(parts => parts[1] > 0),
    +matrix.some(parts => parts[2] > 0), +matrix.some(parts => parts[5] > 0), Math.max(...matrix.map(parts => parts[9])),
    last.dig, last.pair, +(last.route > route)];
}

function observationOf(decision, selected) {
  const matrix = checkedFeatures(decision), feature = matrix[selected];
  return { dig: +(feature[7] > 0 || feature[8] > 0), pair: decision.immediate?.[selected]?.[14] ?? decision.F[selected][14],
    route: +matrix.some(parts => parts[0] > 0) };
}

function strategyFactory(actor, model, initialNew = true, scale = 1) {
  const boundedRows = (rows, width) => Array.isArray(rows) && rows.length === 2
    && rows.every(row => Array.isArray(row) && row.length === width && row.every(value => Number.isFinite(value) && Math.abs(value) <= 4));
  if (model.type !== 'personalAdaptiveClock-v1' || JSON.stringify(model.features) !== JSON.stringify(FEATURES)
    || JSON.stringify(model.context) !== JSON.stringify(CONTEXT) || JSON.stringify(model.parameters) !== JSON.stringify(PARAMETERS)
    || !boundedRows(model.weights, FEATURES.length) || model.weights.some(row => row.at(-1) !== 0)
    || !boundedRows(model.switchWeights, CONTEXT.length) || !Array.isArray(model.priors) || model.priors.length !== 2
    || model.priors.some(row => !Array.isArray(row) || row.length !== 2 || row.some(value => !Number.isFinite(value) || value <= 0)
      || Math.abs(row[0] + row[1] - 1) > 1e-12) || typeof initialNew !== 'boolean'
    || !Number.isFinite(scale) || scale < 0 || scale > 1) throw new Error('Invalid adaptive personal clock model');
  const base = choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
  let posterior = model.priors[initialNew ? 0 : 1].slice(), previous = null, started = false;
  const evaluate = decision => {
    const matrix = checkedFeatures(decision), active = matrix.some(parts => parts.some(value => value !== 0));
    let prior = posterior.slice();
    if (active && started) {
      const context = contextOf(decision, previous);
      const toOne = model.switchWeights.map(row => logistic(row.reduce((sum, value, index) => sum + value * context[index], 0)));
      const massOne = prior[0] * toOne[0] + prior[1] * toOne[1];
      prior = [1 - massOne, massOne];
    }
    const baseline = base.probabilities(decision);
    const components = model.weights.map(weights => softmax(baseline.map((value, index) => Math.log(Math.max(1e-300, value))
      + matrix[index].reduce((sum, feature, part) => sum + feature * weights[part] * scale, 0))));
    const values = scale === 0 || !active ? baseline : baseline.map((_, index) => prior[0] * components[0][index] + prior[1] * components[1][index]);
    return { active, prior, components, values };
  };
  const observe = (decision, selected, evaluated = evaluate(decision)) => {
    if (!Number.isInteger(selected) || selected < 0 || selected >= decision.F.length) throw new Error('Invalid adaptive clock observation');
    if (!evaluated.active) return;
    posterior = evaluated.prior.map((value, mode) => value * evaluated.components[mode][selected]);
    const total = posterior[0] + posterior[1];
    posterior = posterior.map(value => value / total);
    previous = observationOf(decision, selected); started = true;
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid adaptive clock draw');
    const evaluated = evaluate(decision);
    let selected = 0;
    while (selected < evaluated.values.length - 1 && (draw -= evaluated.values[selected]) > 0) selected++;
    observe(decision, selected, evaluated);
    return selected;
  };
  choose.probabilities = decision => evaluate(decision).values.slice();
  choose.observe = observe;
  choose.posterior = () => posterior.slice();
  choose.physicalTrayPlanning = planningCache(PARAMETERS, 4096, featuresOf);
  return choose;
}

function strategyAttemptFactory(actor, model, initialNew = true, scale = 1) {
  const factory = ({ attempt }) => strategyFactory(actor, model, initialNew && attempt === 1, scale);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, featuresOf);
  return factory;
}

module.exports = { CONTEXT, checkedFeatures, contextOf, observationOf, strategyFactory, strategyAttemptFactory };
