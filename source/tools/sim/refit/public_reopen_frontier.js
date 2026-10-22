'use strict';
const physical = require('./known_tray_plan.js');

function opensKnownFrontier(game, state, index, allowed) {
  if (!allowed.free.includes(index) || allowed.uncertain?.includes(index)) return false;
  let moved = physical.advance(game, state, index);
  if (moved.uncertain || moved.lost) return false;
  if (!moved.removed) moved = physical.advance(game, moved.state, index);
  if (moved.uncertain || moved.lost || !moved.removed) return false;
  const after = physical.legal(game, moved.state);
  return after.free.some(candidate => !allowed.free.includes(candidate)
    || allowed.uncertain?.includes(candidate) && !after.uncertain?.includes(candidate));
}

module.exports = { opensKnownFrontier };
