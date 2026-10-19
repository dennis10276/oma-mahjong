'use strict';
const { attentionFactory } = require('./personal_attention_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, planFeatures } = require('./personal_joint_planning_fast.js');

function attentionAttemptFactory(actor, base, model, temperature, initialNew = true) {
  const factory = ({ attempt }) => attentionFactory(actor, base, model, temperature, initialNew && attempt === 1);
  factory.physicalTrayPlanning = planningCache(PARAMETERS, 4096, planFeatures);
  return factory;
}

module.exports = { attentionAttemptFactory };
