'use strict';
const { strategyFactory, checkedFeatures } = require('./personal_clock_strategy_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, featuresOf } = require('./known_clock_strategy.js');

function cueMask(decision) {
  const matrix = checkedFeatures(decision);
  const forecastCrowded = matrix.some(parts => parts[0] > 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0.25);
  return matrix.map((parts, index) => !!((decision.kindContext[3] || forecastCrowded)
    && (decision.F[index][14] > 0 || decision.F[index][64] > 0 || decision.F[index][66] > 0)
    && (parts[1] > 0 || parts[2] > 0)));
}

function adjust(values, mask, counts, strength = 1) {
  if (!Array.isArray(values) || values.some(value => !Number.isFinite(value) || value < 0)
    || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-12
    || !Array.isArray(mask) || mask.length !== values.length || !Array.isArray(counts) || counts.length !== 2
    || counts.some(value => !Number.isFinite(value) || value < 0) || !Number.isFinite(strength) || strength <= 0) throw new Error('Invalid personal crowding correction');
  const mass = values.reduce((sum, value, index) => sum + (mask[index] ? value : 0), 0);
  if (!mask.some(Boolean) || mask.every(Boolean) || !(mass > 0 && mass < 1) || counts[0] + counts[1] === 0) return values.slice();
  const probability = (strength * mass + counts[0]) / (strength + counts[0] + counts[1]);
  return values.map((value, index) => value * (mask[index] ? probability / mass : (1 - probability) / (1 - mass)));
}

function crowdingFactory(actor, model, initialNew = true, enabled = true) {
  if (model.type !== 'personalClockCrowdingCue-v1' || !Array.isArray(model.counts) || model.counts.length !== 2
    || model.counts.some(row => !Array.isArray(row) || row.length !== 2 || row.some(value => !Number.isFinite(value) || value < 0))
    || model.priorStrength !== 1 || typeof enabled !== 'boolean') throw new Error('Invalid personal crowding-cue model');
  const base = strategyFactory(actor, model.baseStrategy, initialNew), counts = model.counts[initialNew ? 0 : 1];
  const distribution = decision => {
    const values = base.probabilities(decision);
    return enabled ? adjust(values, cueMask(decision), counts, model.priorStrength) : values;
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid crowding-cue draw');
    const values = distribution(decision);
    let selected = 0;
    while (selected < values.length - 1 && (draw -= values[selected]) > 0) selected++;
    base.observe(decision, selected);
    return selected;
  };
  choose.probabilities = distribution;
  choose.observe = (decision, selected) => base.observe(decision, selected);
  choose.posterior = base.posterior;
  choose.physicalTrayPlanning = base.physicalTrayPlanning;
  return choose;
}

function crowdingAttemptFactory(actor, model, initialNew = true, enabled = true) {
  const factory = ({ attempt }) => crowdingFactory(actor, model, initialNew && attempt === 1, enabled);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, featuresOf);
  return factory;
}

module.exports = { cueMask, adjust, crowdingFactory, crowdingAttemptFactory };
