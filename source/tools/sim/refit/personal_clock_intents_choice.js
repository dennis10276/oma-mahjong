'use strict';
const { FEATURES, PARAMETERS, featuresOf } = require('./known_clock_strategy.js');
const { CONTEXT, checkedFeatures, contextOf, observationOf } = require('./personal_clock_strategy_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { choiceFactory } = require('./personal_context_choice.js');
const MODES = ['ordinary', 'dig', 'pairFirst'];
const softmax = scores => {
  const maximum = Math.max(...scores), values = scores.map(value => Math.exp(value - maximum));
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map(value => value / total);
};

function masksOf(decision) {
  const matrix = checkedFeatures(decision);
  const goodExit = matrix.map(parts => parts[1] > 0 || parts[2] > 0);
  const hasGoodExit = goodExit.some(Boolean);
  const dig = matrix.map((parts, index) => (parts[7] > 0 || parts[8] > 0) && parts[4] === 0 && (!hasGoodExit || goodExit[index]));
  const pair = matrix.map((parts, index) => parts[6] > 0
    && (decision.F[index][14] > 0 || decision.F[index][64] > 0 || decision.F[index][66] > 0));
  return [matrix.map(() => true), dig, pair];
}

function componentsOf(values, masks) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value) || value < 0)
    || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-12
    || masks.length !== MODES.length || masks.some(mask => mask.length !== values.length)) throw new Error('Invalid personal clock intent emissions');
  return masks.map(mask => {
    const total = values.reduce((sum, value, index) => sum + (mask[index] ? value : 0), 0);
    return total > 0 ? values.map((value, index) => mask[index] ? value / total : 0) : values.slice();
  });
}

function transitionsOf(context, weights) {
  return weights.map(row => softmax(row.map(parameter => parameter.reduce((sum, value, index) => sum + value * context[index], 0))));
}

function intentFactory(actor, model, initialNew = true, enabled = true) {
  const validPrior = row => Array.isArray(row) && row.length === MODES.length
    && row.every(value => Number.isFinite(value) && value >= 0) && Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 1e-12;
  if (model.type !== 'personalPersistentClockIntents-v1' || JSON.stringify(model.modes) !== JSON.stringify(MODES)
    || JSON.stringify(model.features) !== JSON.stringify(FEATURES) || JSON.stringify(model.context) !== JSON.stringify(CONTEXT)
    || JSON.stringify(model.parameters) !== JSON.stringify(PARAMETERS) || !Array.isArray(model.priors)
    || model.priors.length !== 2 || !model.priors.every(validPrior)
    || !Array.isArray(model.switchWeights) || model.switchWeights.length !== MODES.length
    || model.switchWeights.some(row => !Array.isArray(row) || row.length !== MODES.length || row.some(parameter => !Array.isArray(parameter)
      || parameter.length !== CONTEXT.length || parameter.some(value => !Number.isFinite(value) || Math.abs(value) > 4)))
    || !Number.isInteger(model.trainingClockChoices) || model.trainingClockChoices < 0
    || typeof initialNew !== 'boolean' || typeof enabled !== 'boolean') throw new Error('Invalid own persistent clock intents');
  const base = choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
  let posterior = model.priors[initialNew ? 0 : 1].slice(), previous = null, started = false;
  const evaluate = decision => {
    const matrix = checkedFeatures(decision), active = enabled && model.trainingClockChoices > 0 && matrix.some(parts => parts.some(value => value !== 0));
    let prior = posterior.slice();
    if (active && started) {
      const transitions = transitionsOf(contextOf(decision, previous), model.switchWeights);
      prior = MODES.map((mode, index) => posterior.reduce((sum, value, previousMode) => sum + value * transitions[previousMode][index], 0));
    }
    const baseline = base.probabilities(decision), components = componentsOf(baseline, masksOf(decision));
    const values = active ? baseline.map((value, index) => prior.reduce((sum, probability, mode) => sum + probability * components[mode][index], 0)) : baseline;
    return { active, prior, components, values };
  };
  const observe = (decision, selected, evaluated = evaluate(decision)) => {
    if (!Number.isInteger(selected) || selected < 0 || selected >= decision.F.length) throw new Error('Invalid clock intent observation');
    if (!evaluated.active) return;
    posterior = evaluated.prior.map((probability, mode) => probability * evaluated.components[mode][selected]);
    const total = posterior.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new Error('Observed action has zero personal clock intent support');
    posterior = posterior.map(value => value / total);
    previous = observationOf(decision, selected); started = true;
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid personal intent draw');
    const evaluated = evaluate(decision);
    let selected = 0;
    while (selected < evaluated.values.length - 1 && (evaluated.values[selected] === 0 || (draw -= evaluated.values[selected]) > 0)) selected++;
    observe(decision, selected, evaluated);
    return selected;
  };
  choose.probabilities = decision => evaluate(decision).values.slice();
  choose.observe = observe;
  choose.posterior = () => posterior.slice();
  choose.physicalTrayPlanning = planningCache(PARAMETERS, 4096, featuresOf);
  return choose;
}

function intentAttemptFactory(actor, model, initialNew = true, enabled = true) {
  const factory = ({ attempt }) => intentFactory(actor, model, initialNew && attempt === 1, enabled);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, featuresOf);
  return factory;
}

module.exports = { MODES, masksOf, componentsOf, transitionsOf, intentFactory, intentAttemptFactory };
