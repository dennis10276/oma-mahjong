'use strict';
const { advance } = require('./known_tray_plan.js');

function preferKnownRecovery(game, state, plan) {
  if (plan.knownWin || plan.safeClockExit) return true;
  let position = state, removed = 0;
  for (const index of plan.path) {
    const moved = advance(game, position, index);
    if (moved.uncertain || moved.lost) return false;
    removed += moved.removed;
    position = moved.state;
    if (removed > 0 && (state.tray.length === 0 ? position.tray.length === 0 : position.tray.length < state.tray.length)) return true;
    if (state.openPeek >= 0 && !position.alive[state.openPeek] && position.tray.length <= state.tray.length) return true;
  }
  return false;
}

module.exports = { preferKnownRecovery };
