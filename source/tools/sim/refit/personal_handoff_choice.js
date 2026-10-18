'use strict';
const { CONTEXT, descriptorOf, cueOf, contextOf, shiftGroup } = require('./personal_handoff_cues.js');
const { jointIntentFactory, jointIntentAttemptFactory } = require('./personal_joint_intents_choice.js');

function handoffFactory(actor, baseModel, model, initialNew = true, enabled = true) {
  if (model.type !== 'personalConditionalHandoff-v1' || model.actorId !== actor.id || model.name !== actor.name
    || JSON.stringify(model.features) !== JSON.stringify(CONTEXT) || !Array.isArray(model.weights)
    || model.weights.length !== CONTEXT.length || model.weights.some(value => !Number.isFinite(value) || Math.abs(value) > 4)
    || !Number.isInteger(model.trainingSamples) || model.trainingSamples < 0 || !Number.isInteger(model.trainingClockSamples)
    || model.trainingClockSamples < 0 || model.trainingClockSamples > model.trainingSamples || typeof enabled !== 'boolean') throw new Error('Invalid independently fitted handoff model');
  const base = jointIntentFactory(actor, baseModel.clockIntents, baseModel.trayIntents, initialNew);
  const weights = model.weights.slice(), sampleCount = model.trainingSamples, clockSamples = model.trainingClockSamples;
  let previous = null;
  const probabilities = decision => {
    const values = base.probabilities(decision), cue = cueOf(decision, previous);
    if (!enabled || !cue || sampleCount === 0 || decision.kindContext[11] > 0 && clockSamples === 0) return values;
    const delta = contextOf(decision, cue).reduce((sum, value, index) => sum + value * weights[index], 0);
    return shiftGroup(values, cue.indices, delta);
  };
  const observe = (decision, selected) => {
    base.observe(decision, selected);
    previous = descriptorOf(decision, selected);
  };
  const choose = (decision, draw) => {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Invalid handoff draw');
    if (!enabled) {
      const selected = base(decision, draw);
      previous = descriptorOf(decision, selected);
      return selected;
    }
    const values = probabilities(decision);
    let selected = 0;
    while (selected < values.length - 1 && (values[selected] === 0 || (draw -= values[selected]) > 0)) selected++;
    observe(decision, selected); return selected;
  };
  choose.probabilities = probabilities;
  choose.observe = observe;
  choose.posterior = base.posterior;
  choose.previous = () => previous ? { ...previous, position: previous.position.slice() } : null;
  choose.physicalTrayPlanning = base.physicalTrayPlanning;
  return choose;
}

function handoffAttemptFactory(actor, baseModel, model, initialNew = true, enabled = true) {
  const factory = ({ attempt }) => handoffFactory(actor, baseModel, model, initialNew && attempt === 1, enabled);
  factory.physicalTrayPlanning = jointIntentAttemptFactory(actor, baseModel.clockIntents, baseModel.trayIntents, initialNew).physicalTrayPlanning;
  return factory;
}

module.exports = { handoffFactory, handoffAttemptFactory };
