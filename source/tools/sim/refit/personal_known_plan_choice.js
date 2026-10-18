'use strict';
const { FEATURES } = require('./known_tray_plan.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { choiceFactory } = require('./personal_context_choice.js');

function knownPlanFactory(actor, model, scale = 1) {
  if (model.type !== 'personalKnownTrayPlan-v1' || JSON.stringify(model.features) !== JSON.stringify(FEATURES)
    || !Array.isArray(model.weights) || model.weights.length !== FEATURES.length
    || model.weights.some(weight => !Number.isFinite(weight) || Math.abs(weight) > 4) || model.weights.at(-1) !== 0
    || JSON.stringify(model.parameters) !== JSON.stringify({ taps: 6, nodes: 256, progress: 4 })
    || !Number.isFinite(scale) || scale < 0 || scale > 1) throw new Error('Invalid own-person known-plan model');
  const base = choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
  const distribution = decision => {
    const values = base.probabilities(decision);
    if (!Array.isArray(decision.knownPlan) || decision.knownPlan.length !== values.length
      || decision.knownPlan.some(row => !Array.isArray(row) || row.length !== FEATURES.length
        || row.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw new Error('Invalid public known-plan decision');
    const scores = values.map((value, index) => Math.log(Math.max(1e-300, value)) + decision.knownPlan[index]
      .reduce((sum, feature, part) => sum + feature * model.weights[part] * scale, 0));
    const maximum = Math.max(...scores), mass = scores.map(value => Math.exp(value - maximum));
    const total = mass.reduce((sum, value) => sum + value, 0);
    return mass.map(value => value / total);
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid personal known-plan draw');
    const values = distribution(decision);
    let index = 0;
    while (index < values.length - 1 && (draw -= values[index]) > 0) index++;
    return index;
  };
  choose.probabilities = distribution;
  choose.physicalTrayPlanning = planningCache(model.parameters);
  return choose;
}

module.exports = { knownPlanFactory };
