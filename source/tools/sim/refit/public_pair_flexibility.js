'use strict';
const physical = require('./known_tray_plan.js');
const { frontierFor } = require('./public_goal_frontier.js');
const { aliveSignature } = require('./public_alive_signature.js');

function createPairFlexibility(game, pictures) {
  const groups = new Map(), cache = new Map();
  pictures.forEach((picture, index) => {
    if (picture === null) return;
    if (!groups.has(picture)) groups.set(picture, []);
    groups.get(picture).push(index);
  });
  return state => {
    const identity = +!!state.relieved + '|' + aliveSignature(state.alive);
    let remaining = cache.get(identity);
    if (!remaining) {
      const allowed = physical.legal(game, state), uncertain = new Set(allowed.uncertain || []);
      const free = new Set(allowed.free.filter(index => !uncertain.has(index)));
      remaining = [];
      for (const [picture, indices] of groups) {
        const active = indices.filter(index => state.alive[index]);
        if (!active.length) continue;
        const costs = active.map(index => free.has(index) ? 0 : Math.max(1, frontierFor(game, state, index).size - 1))
          .sort((left, right) => left - right);
        remaining.push({ picture, count: active.length, debt: costs[0] + (costs[1] ?? 0) });
      }
      cache.set(identity, remaining);
    }
    return remaining.filter(group => !state.tray.includes(group.picture)).reduce((sum, group) => sum + group.debt, 0);
  };
}

module.exports = { createPairFlexibility };
