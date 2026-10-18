'use strict';
const { FEATURES } = require('./known_tray_plan.js');
const { componentsOf, transitionsOf } = require('./personal_clock_intents_choice.js');
const { choiceFactory } = require('./personal_context_choice.js');
const MODES = ['ordinary', 'knownMatch', 'recover'];
const CONTEXT = ['bias', 'tray1', 'tray2', 'tray3', 'knownMatch', 'knownClear', 'information', 'boundary', 'previousMatch', 'previousRecovery'];
const PARAMETERS = { taps: 6, nodes: 256, progress: 4 };

function checkedFeatures(decision) {
  if (!Array.isArray(decision.trayPlan) || decision.trayPlan.length !== decision.F.length
    || decision.trayPlan.some(parts => !Array.isArray(parts) || parts.length !== FEATURES.length
      || parts.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw new Error('Invalid public tray intent features');
  return decision.trayPlan;
}

function masksOf(decision) {
  const matrix = checkedFeatures(decision), hasClear = matrix.some(parts => parts[1] > 0);
  const match = matrix.map((parts, index) => parts[2] === 0
    && (decision.F[index][14] > 0 || decision.F[index][64] > 0 || decision.F[index][66] > 0));
  const recover = matrix.map((parts, index) => parts[2] === 0
    && (decision.F[index][19] === 0 || decision.F[index][65] === 0 || decision.F[index][67] > 0)
    && (hasClear ? parts[1] > 0 : parts[3] > 0 && decision.F[index][19] > 0 && decision.F[index][65] === 0
      || parts[0] > 0 && decision.F[index][67] > 0));
  return [matrix.map(() => true), match, recover];
}

function contextOf(decision, previous = null) {
  const matrix = checkedFeatures(decision), masks = masksOf(decision);
  if (!Array.isArray(decision.kindContext) || decision.kindContext.length !== 26) throw new Error('Invalid tray intent context');
  return [1, ...decision.kindContext.slice(1, 4), +masks[1].some(Boolean), +matrix.some(parts => parts[1] > 0),
    +matrix.some(parts => parts[3] > 0), +matrix.some(parts => parts[4] > 0), previous?.match || 0, previous?.recover || 0];
}

function observationOf(decision, selected) {
  const masks = masksOf(decision);
  return { match: +masks[1][selected], recover: +masks[2][selected] };
}

function trayIntentFactory(actor, model, initialNew = true, enabled = true) {
  const validPrior = row => Array.isArray(row) && row.length === MODES.length && row.every(value => Number.isFinite(value) && value >= 0)
    && Math.abs(row.reduce((sum, value) => sum + value, 0) - 1) < 1e-12;
  if (model.type !== 'personalPersistentTrayIntents-v1' || JSON.stringify(model.modes) !== JSON.stringify(MODES)
    || JSON.stringify(model.features) !== JSON.stringify(FEATURES) || JSON.stringify(model.context) !== JSON.stringify(CONTEXT)
    || JSON.stringify(model.parameters) !== JSON.stringify(PARAMETERS) || !Array.isArray(model.priors)
    || model.priors.length !== 2 || !model.priors.every(validPrior) || !Array.isArray(model.switchWeights)
    || model.switchWeights.length !== MODES.length || model.switchWeights.some(row => !Array.isArray(row) || row.length !== MODES.length
      || row.some(parameter => !Array.isArray(parameter) || parameter.length !== CONTEXT.length
        || parameter.some(value => !Number.isFinite(value) || Math.abs(value) > 4)))
    || !Number.isInteger(model.trainingChoices) || model.trainingChoices < 0
    || typeof initialNew !== 'boolean' || typeof enabled !== 'boolean') throw new Error('Invalid own persistent tray intents');
  const base = choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
  let posterior = model.priors[initialNew ? 0 : 1].slice(), previous = null, started = false;
  const evaluate = decision => {
    const active = enabled && model.trainingChoices > 0 && checkedFeatures(decision).some(parts => parts.some(value => value !== 0));
    let prior = posterior.slice();
    if (active && started) {
      const transitions = transitionsOf(contextOf(decision, previous), model.switchWeights);
      prior = MODES.map((mode, index) => posterior.reduce((sum, value, before) => sum + value * transitions[before][index], 0));
    }
    const baseline = base.probabilities(decision), components = componentsOf(baseline, masksOf(decision));
    const values = active ? baseline.map((value, index) => prior.reduce((sum, probability, mode) => sum + probability * components[mode][index], 0)) : baseline;
    return { active, prior, components, values };
  };
  const observe = (decision, selected, evaluated = evaluate(decision)) => {
    if (!Number.isInteger(selected) || selected < 0 || selected >= decision.F.length) throw new Error('Invalid tray intent observation');
    if (!evaluated.active) return;
    posterior = evaluated.prior.map((probability, mode) => probability * evaluated.components[mode][selected]);
    const total = posterior.reduce((sum, value) => sum + value, 0);
    if (!(total > 0)) throw new Error('Observed action has zero own tray intent support');
    posterior = posterior.map(value => value / total);
    previous = observationOf(decision, selected); started = true;
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid tray intent draw');
    const evaluated = evaluate(decision);
    let selected = 0;
    while (selected < evaluated.values.length - 1 && (evaluated.values[selected] === 0 || (draw -= evaluated.values[selected]) > 0)) selected++;
    observe(decision, selected, evaluated); return selected;
  };
  choose.probabilities = decision => evaluate(decision).values.slice();
  choose.observe = observe;
  choose.posterior = () => posterior.slice();
  return choose;
}

module.exports = { MODES, CONTEXT, PARAMETERS, checkedFeatures, masksOf, contextOf, observationOf, trayIntentFactory };
