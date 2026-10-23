'use strict';
const { legal, advance } = require('./known_tray_plan.js');

function knownCleanup(game, state, actions) {
  if (game.clock && state.alive[game.clock.i] || state.tray.includes(101)) return null;
  const groups = new Map();
  for (const [index, alive] of state.alive.entries()) {
    if (!alive) continue;
    const picture = state.pictures[index];
    if (picture === null || picture === 101) return null;
    if (!groups.has(picture)) groups.set(picture, []);
    groups.get(picture).push(index);
  }
  const allowed = legal(game, state), uncertain = new Set(allowed.uncertain || []);
  const free = new Set(allowed.free.filter(index => !uncertain.has(index)));
  for (const action of actions) {
    const index = action.index, picture = state.pictures[index], group = groups.get(picture);
    if (!free.has(index) || !group) continue;
    const waiting = state.tray.includes(picture);
    if (waiting ? group.length !== 1 : group.length !== 2) continue;
    const partner = waiting ? null : group.find(mate => mate !== index);
    if (partner !== null && !free.has(partner)) continue;
    const moved = advance(game, state, index);
    if (moved.uncertain || moved.lost) continue;
    if (waiting || moved.removed === 2) return { path: [index], state: moved.state, removed: moved.removed };
    const paired = advance(game, moved.state, partner);
    if (paired.uncertain || paired.lost || moved.removed + paired.removed !== 2) continue;
    return { path: [index, partner], state: paired.state, removed: 2 };
  }
  return null;
}

module.exports = { knownCleanup };
