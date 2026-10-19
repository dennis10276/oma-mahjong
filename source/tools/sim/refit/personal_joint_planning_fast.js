'use strict';
const clock = require('./known_clock_strategy_fast.js');
const tray = require('./known_tray_plan_bits.js');
const { PARAMETERS } = require('./personal_joint_intents_choice.js');

function planFeatures(game, state, actions) {
  const clockResult = clock.featuresOf(game, state, actions, PARAMETERS.clock);
  const trayResult = tray.featuresOf(game, state, actions, PARAMETERS.tray);
  return { features: actions.map((action, index) => [...clockResult.features[index], ...trayResult.features[index]]),
    nodes: clockResult.nodes + trayResult.nodes, boundaries: clockResult.boundaries + trayResult.boundaries };
}

module.exports = { PARAMETERS, planFeatures };
