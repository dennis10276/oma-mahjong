'use strict';
const { jointIntentFactory } = require('./personal_joint_intents_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, planFeatures } = require('./personal_joint_planning_fast.js');

function tempered(values, temperature) {
  if (!Number.isFinite(temperature) || temperature < .25 || temperature > 2
    || !Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value) || value < 0)
    || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-12) throw new Error('Invalid personal policy temperature');
  if (temperature === 1) return values.slice();
  const scores = values.map(value => value > 0 ? Math.log(value) / temperature : -Infinity), maximum = Math.max(...scores);
  const mass = scores.map(value => Math.exp(value - maximum)), total = mass.reduce((sum, value) => sum + value, 0);
  return mass.map(value => value / total);
}

function temperSelector(base, temperature) {
  tempered([1], temperature);
  const probabilities = decision => tempered(base.probabilities(decision), temperature);
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid tempered personal draw');
    if (temperature === 1) return base(decision, draw);
    const values = probabilities(decision);
    let selected = 0;
    while (selected < values.length - 1 && (values[selected] === 0 || (draw -= values[selected]) > 0)) selected++;
    base.observe(decision, selected); return selected;
  };
  choose.probabilities = probabilities;
  choose.observe = base.observe;
  choose.posterior = base.posterior;
  choose.physicalTrayPlanning = base.physicalTrayPlanning;
  return choose;
}

function temperedFactory(actor, baseModel, temperature, initialNew = true) {
  if (actor.id !== baseModel.id || actor.name !== baseModel.name) throw new Error('Personal temperature requires that person’s own joint model');
  return temperSelector(jointIntentFactory(actor, baseModel.clockIntents, baseModel.trayIntents, initialNew), temperature);
}

function temperedAttemptFactory(actor, baseModel, temperature, initialNew = true) {
  const factory = ({ attempt }) => temperedFactory(actor, baseModel, temperature, initialNew && attempt === 1);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, planFeatures);
  return factory;
}

module.exports = { tempered, temperSelector, temperedFactory, temperedAttemptFactory };
