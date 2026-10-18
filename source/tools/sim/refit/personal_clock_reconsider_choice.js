'use strict';
const { strategyFactory, checkedFeatures } = require('./personal_clock_strategy_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, featuresOf } = require('./known_clock_strategy.js');

function masksOf(decision) {
  const matrix = checkedFeatures(decision);
  const recipients = matrix.map((parts, index) => !!((decision.F[index][14] > 0 || decision.F[index][64] > 0 || decision.F[index][66] > 0)
    && (parts[1] > 0 || parts[2] > 0)));
  const donors = matrix.map((parts, index) => !recipients[index] && !!((parts[0] > 0 && parts[1] === 0 && parts[2] === 0 && parts[3] === 0.25)
    || (decision.kindContext[3] > 0 && parts[4] > 0)));
  return { donors, recipients };
}

function transfer(values, donors, recipients, rate) {
  if (!Array.isArray(values) || values.some(value => !Number.isFinite(value) || value < 0)
    || Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 1e-12
    || !Array.isArray(donors) || !Array.isArray(recipients) || donors.length !== values.length || recipients.length !== values.length
    || donors.some((value, index) => value && recipients[index]) || !Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('Invalid selective clock transfer');
  const donorMass = values.reduce((sum, value, index) => sum + (donors[index] ? value : 0), 0);
  const recipientMass = values.reduce((sum, value, index) => sum + (recipients[index] ? value : 0), 0);
  if (donorMass === 0 || recipientMass === 0 || rate === 0) return values.slice();
  return values.map((value, index) => donors[index] ? value * (1 - rate)
    : recipients[index] ? value * (1 + rate * donorMass / recipientMass) : value);
}

function reconsiderFactory(actor, model, initialNew = true, enabled = true) {
  if (model.type !== 'personalClockReconsideration-v1' || !Array.isArray(model.rates) || model.rates.length !== 2
    || model.rates.some(value => !Number.isFinite(value) || value < 0 || value > 1) || typeof enabled !== 'boolean') throw new Error('Invalid personal clock reconsideration model');
  const base = strategyFactory(actor, model.baseStrategy, initialNew), rate = enabled ? model.rates[initialNew ? 0 : 1] : 0;
  const distribution = decision => {
    const { donors, recipients } = masksOf(decision);
    return transfer(base.probabilities(decision), donors, recipients, rate);
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid selective clock draw');
    if (rate === 0) return base(decision, draw);
    const values = distribution(decision);
    let selected = 0;
    while (selected < values.length - 1 && (values[selected] === 0 || (draw -= values[selected]) > 0)) selected++;
    base.observe(decision, selected);
    return selected;
  };
  choose.probabilities = distribution;
  choose.observe = (decision, selected) => base.observe(decision, selected);
  choose.posterior = base.posterior;
  choose.physicalTrayPlanning = base.physicalTrayPlanning;
  return choose;
}

function reconsiderAttemptFactory(actor, model, initialNew = true, enabled = true) {
  const factory = ({ attempt }) => reconsiderFactory(actor, model, initialNew && attempt === 1, enabled);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, featuresOf);
  return factory;
}

module.exports = { masksOf, transfer, reconsiderFactory, reconsiderAttemptFactory };
