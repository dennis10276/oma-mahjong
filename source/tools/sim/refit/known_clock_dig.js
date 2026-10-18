'use strict';
const route = require('./known_clock_plan.js');
const { advance } = require('./known_tray_plan.js');
const FEATURES = [...route.FEATURES.slice(0, -1), 'clockDigRemoval', 'clockDigInspection', 'urgentClockDig', 'pressuredClockDig', 'clockBoundary'];

function frontierOf(game, state) {
  const frontier = new Set(), pending = [game.clock.i];
  if (game.rules?.locks?.has(game.clock.i)) pending.push(...(game.rules.keys || []).filter(index => state.alive[index]));
  while (pending.length) {
    const target = pending.pop();
    if (frontier.has(target)) continue;
    frontier.add(target);
    pending.push(...game.nb.above[target].filter(index => state.alive[index] && !frontier.has(index)));
    for (const side of [game.nb.left, game.nb.right]) {
      let current = target;
      for (let distance = 0; distance < 6; distance++) {
        const next = side[current].find(index => state.alive[index]);
        if (next === undefined) break;
        if (!frontier.has(next)) pending.push(next);
        current = next;
      }
    }
  }
  return frontier;
}

function featuresOf(game, state, actions, options = route.PARAMETERS) {
  const support = route.featuresOf(game, state, actions, options);
  if (support.inactive) return { ...support, features: actions.map(() => FEATURES.map(() => 0)) };
  const frontier = frontierOf(game, state);
  const urgency = Math.max(0, Math.min(1, state.moves / Math.max(1, game.clock.n)));
  const pressure = Math.min(1, state.tray.length / 3);
  const features = actions.map((action, position) => {
    const moved = advance(game, state, action.index), onFrontier = frontier.has(action.index);
    const inspection = onFrontier && (moved.uncertain || !moved.removed) ? 1 : 0;
    const removed = moved.uncertain ? 0 : [...frontier].reduce((total, index) => total + +(state.alive[index] && !moved.state.alive[index]), 0);
    const digging = +(inspection > 0 || removed > 0);
    return [...support.features[position].slice(0, -1), Math.min(1, removed / 4), inspection,
      digging * urgency, digging * pressure, support.features[position].at(-1)];
  });
  return { ...support, features };
}

module.exports = { FEATURES, PARAMETERS: route.PARAMETERS, frontierOf, featuresOf };
