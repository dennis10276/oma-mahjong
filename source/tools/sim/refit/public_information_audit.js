'use strict';
const { advance, legal } = require('./known_tray_plan.js');

function describeInformation(game, state, path, roles) {
  const events = [], recorded = new Set();
  let position = state;
  for (const [offset, index] of path.entries()) {
    const allowed = legal(game, position);
    if (!allowed.free.includes(index)) return { events, boundary: { afterTaps: offset, index, reason: 'blockedKnownSuffix' } };
    const moved = advance(game, position, index);
    if (moved.uncertain) return { events, boundary: { afterTaps: offset, index, reason: moved.reason } };
    if (moved.lost) return { events, boundary: { afterTaps: offset + 1, index, reason: 'knownPhysicalLoss' } };
    position = moved.state;
    const gained = (game.publicExposure?.(position) || []).filter(target => !recorded.has(target));
    if (!gained.length) continue;
    const frontier = legal(game, position);
    events.push({ afterTaps: offset + 1, index, tray: position.tray.slice(), gained: gained.map(target => {
      recorded.add(target);
      return { index: target, rememberedPicture: state.pictures[target], rememberedDown: state.down[target],
        observedRole: roles[target], availability: frontier.uncertain?.includes(target) ? 'uncertain'
          : frontier.free.includes(target) ? 'guaranteedFree' : 'blocked' };
    }) });
  }
  return { events, boundary: null };
}

module.exports = { describeInformation };
