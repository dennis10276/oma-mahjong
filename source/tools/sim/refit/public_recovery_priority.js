'use strict';
const { advance } = require('./known_tray_plan.js');

function preferKnownRecovery(game, state, plan) {
  if (plan.knownWin || plan.safeClockExit) return true;
  let position = state, removed = 0;
  for (const [offset, index] of plan.path.entries()) {
    const moved = advance(game, position, index);
    if (moved.uncertain) {
      if (moved.reason !== 'unseenPicture' || offset !== plan.path.length - 1) return false;
      break;
    }
    if (moved.lost) return false;
    removed += moved.removed;
    position = moved.state;
  }
  return removed > 0 && (state.tray.length === 0 ? position.tray.length === 0 : position.tray.length < state.tray.length);
}

module.exports = { preferKnownRecovery };
