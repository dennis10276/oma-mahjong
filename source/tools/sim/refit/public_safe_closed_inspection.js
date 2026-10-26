'use strict';
const { SLOTS } = require('../../../www/layouts.js');

function safeClosedInspection(state, index, clock, currentlyTakeable) {
  if (!Number.isInteger(index) || state.tray.length >= SLOTS || currentlyTakeable !== true || state.alive[index] !== 1
    || state.down[index] !== 1 || state.pictures[index] !== null || state.openPeek === index) return false;
  if (!clock || !state.alive[clock.i]) return true;
  const remaining = clock.n - state.moves;
  if (remaining <= 0) return false;
  if (clock.i === index) return true;
  const peek = state.openPeek;
  const possibleOpenTwin = peek >= 0 && state.alive[peek] && !state.tray.includes(state.pictures[peek]);
  const maximumClockMoves = possibleOpenTwin ? 2 : state.tray.length ? 1 : 0;
  return remaining > maximumClockMoves;
}

module.exports = { safeClosedInspection };
