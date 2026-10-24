'use strict';
const { advance, legal } = require('./known_tray_plan.js');

function openTwinRecovery(game, state) {
  const peek = state.openPeek, picture = state.pictures[peek];
  if (peek < 0 || !state.alive[peek] || picture === null || picture >= 100 || state.tray.includes(picture)) return null;
  const allowed = legal(game, state);
  if (!allowed.free.includes(peek) || allowed.uncertain?.includes(peek)) return null;
  for (const index of allowed.free) {
    if (index === peek || state.pictures[index] !== picture || allowed.uncertain?.includes(index)) continue;
    const moved = advance(game, state, index);
    if (!moved.uncertain && !moved.lost && moved.removed === 2 && !moved.state.alive[peek]) return { index, moved };
  }
  return null;
}

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

module.exports = { preferKnownRecovery, openTwinRecovery };
