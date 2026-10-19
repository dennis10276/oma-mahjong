'use strict';
const { jointIntentFactory } = require('./personal_joint_intents_choice.js');
const { temperSelector } = require('./personal_tempered_choice.js');
const FEATURES = ['repeatKnownInspection', 'repeatKnownInspection.clock'];

function attentionState(strengthLimit = 3) {
  if (strengthLimit !== null && (!Number.isFinite(strengthLimit) || strengthLimit <= 0)) throw new Error('Invalid attention strength limit');
  let remaining = null, inspected = new Map();
  const keyOf = feature => JSON.stringify([feature[21], feature[22], feature[26]]);
  const features = decision => decision.F.map(feature => {
    const count = remaining === decision.kindContext[9] ? inspected.get(keyOf(feature)) || 0 : 0;
    const raw = feature[19] > 0 && feature[65] > 0 && feature[64] === 0 && feature[66] === 0 ? Math.log1p(count) : 0;
    const strength = strengthLimit === null ? raw : Math.min(strengthLimit, raw);
    return [strength, strength * decision.kindContext[11]];
  });
  const observe = (decision, selected) => {
    if (remaining !== decision.kindContext[9]) inspected = new Map();
    remaining = decision.kindContext[9];
    const feature = decision.F[selected];
    if (feature[19] > 0) inspected.set(keyOf(feature), (inspected.get(keyOf(feature)) || 0) + 1);
  };
  return { features, observe };
}

function attentionSelector(base, model) {
  const isLog = model.type === 'personalInspectionAttentionLog-v2';
  if ((!isLog && model.type !== 'personalInspectionAttention-v1') || JSON.stringify(model.features) !== JSON.stringify(FEATURES)
    || (isLog ? model.strengthLimit !== null : model.strengthLimit !== undefined && model.strengthLimit !== 3)
    || !Array.isArray(model.weights) || model.weights.length !== FEATURES.length
    || model.weights.some(value => !Number.isFinite(value) || Math.abs(value) > 4)) throw new Error('Invalid own inspection-attention model');
  const state = attentionState(isLog ? null : 3), weights = model.weights.slice(), disabled = weights.every(value => value === 0);
  const probabilities = decision => {
    const values = base.probabilities(decision);
    if (disabled) return values.slice();
    const features = state.features(decision), scores = values.map((value, index) => value > 0
      ? Math.log(value) + features[index].reduce((sum, feature, position) => sum + feature * weights[position], 0) : -Infinity);
    const maximum = Math.max(...scores), mass = scores.map(value => Math.exp(value - maximum)), total = mass.reduce((sum, value) => sum + value, 0);
    return mass.map(value => value / total);
  };
  const observe = (decision, selected) => { base.observe(decision, selected); state.observe(decision, selected); };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid attention draw');
    if (disabled) {
      const selected = base(decision, draw); state.observe(decision, selected); return selected;
    }
    const values = probabilities(decision);
    let selected = 0;
    while (selected < values.length - 1 && (values[selected] === 0 || (draw -= values[selected]) > 0)) selected++;
    observe(decision, selected); return selected;
  };
  choose.probabilities = probabilities;
  choose.observe = observe;
  choose.posterior = base.posterior;
  choose.physicalTrayPlanning = base.physicalTrayPlanning;
  return choose;
}

function attentionFactory(actor, base, model, temperature = 1, initialNew = true) {
  if (actor.id !== base.id || actor.name !== base.name || actor.id !== model.id || actor.name !== model.name) throw new Error('Attention requires that person’s own current actor');
  return temperSelector(attentionSelector(jointIntentFactory(actor, base.clockIntents, base.trayIntents, initialNew), model.attention), temperature);
}

module.exports = { FEATURES, attentionState, attentionSelector, attentionFactory };
