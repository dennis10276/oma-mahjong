'use strict';
const clock = require('./known_clock_strategy.js');
const tray = require('./known_tray_plan_bits.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { intentFactory } = require('./personal_clock_intents_choice.js');
const { trayIntentFactory, PARAMETERS: TRAY_PARAMETERS } = require('./personal_tray_intents_choice.js');
const PARAMETERS = { clock: clock.PARAMETERS, tray: TRAY_PARAMETERS };

function planFeatures(game, state, actions) {
  const clockResult = clock.featuresOf(game, state, actions, clock.PARAMETERS);
  const trayResult = tray.featuresOf(game, state, actions, TRAY_PARAMETERS);
  return { features: actions.map((action, index) => [...clockResult.features[index], ...trayResult.features[index]]),
    nodes: clockResult.nodes + trayResult.nodes, boundaries: clockResult.boundaries + trayResult.boundaries };
}

function splitDecision(decision) {
  if (!Array.isArray(decision.knownPlan) || decision.knownPlan.length !== decision.F.length
    || decision.knownPlan.some(parts => !Array.isArray(parts) || parts.length !== clock.FEATURES.length + tray.FEATURES.length
      || parts.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw new Error('Invalid combined public intent features');
  const split = { ...decision, knownPlan: decision.knownPlan.map(parts => parts.slice(0, clock.FEATURES.length)),
    trayPlan: decision.knownPlan.map(parts => parts.slice(clock.FEATURES.length)) };
  if (!Array.isArray(split.kindContext) || split.kindContext.length !== 26
    || split.kindContext[11] > 0 && split.trayPlan.some(parts => parts.some(value => value !== 0))
    || split.kindContext[11] === 0 && split.knownPlan.some(parts => parts.some(value => value !== 0))) throw new Error('Combined intent phase disagrees with public clock state');
  return split;
}

function jointIntentFactory(actor, clockModel, trayModel, initialNew = true, trayEnabled = true) {
  const clockSelector = intentFactory(actor, clockModel, initialNew), traySelector = trayIntentFactory(actor, trayModel, initialNew, trayEnabled);
  const selectorOf = decision => decision.kindContext[11] > 0 ? clockSelector : traySelector;
  const choose = (decision, draw) => {
    const split = splitDecision(decision);
    return selectorOf(split)(split, draw);
  };
  choose.probabilities = decision => {
    const split = splitDecision(decision);
    return selectorOf(split).probabilities(split);
  };
  choose.observe = (decision, selected) => {
    const split = splitDecision(decision);
    selectorOf(split).observe(split, selected);
  };
  choose.posterior = () => ({ clock: clockSelector.posterior(), tray: traySelector.posterior() });
  choose.physicalTrayPlanning = planningCache(PARAMETERS, 4096, planFeatures);
  return choose;
}

function jointIntentAttemptFactory(actor, clockModel, trayModel, initialNew = true, trayEnabled = true) {
  const factory = ({ attempt }) => jointIntentFactory(actor, clockModel, trayModel, initialNew && attempt === 1, trayEnabled);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, planFeatures);
  return factory;
}

module.exports = { PARAMETERS, planFeatures, splitDecision, jointIntentFactory, jointIntentAttemptFactory };
