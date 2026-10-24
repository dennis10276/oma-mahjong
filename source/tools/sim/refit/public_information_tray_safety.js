'use strict';

function informationTraySafe(state, index, executesUnknownTap, allowed) {
  if (!executesUnknownTap || state.tray.length < 3) return true;
  const picture = state.pictures[index];
  if (picture !== null && state.tray.includes(picture)) return true;
  if (state.down[index] === 1 && state.openPeek !== index) return true;
  const peek = state.openPeek;
  return picture !== null && peek >= 0 && peek !== index && state.alive[peek]
    && state.pictures[peek] === picture && allowed.free.includes(peek) && !allowed.uncertain?.includes(peek);
}

function safeDiscoveryCount(state, allowed) {
  return allowed.free.filter(index => state.pictures[index] === null && state.down[index] !== null
    && informationTraySafe(state, index, true, allowed)).length;
}

module.exports = { informationTraySafe, safeDiscoveryCount };
