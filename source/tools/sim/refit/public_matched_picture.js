'use strict';
const assert = require('assert/strict');

function inferMatchedPicture(before, index, after) {
  assert.deepEqual(Object.keys(after).sort(), ['alive', 'moves', 'openPeek', 'physicalTaps', 'tray']);
  if (!Number.isInteger(index) || !before.alive[index] || before.pictures[index] !== null
    || before.down[index] !== 1 || before.openPeek === index || after.alive[index]
    || !Number.isInteger(before.physicalTaps) || after.physicalTaps !== before.physicalTaps + 1
    || after.alive.length !== before.alive.length || after.alive.some((alive, offset) => alive && !before.alive[offset])) return null;
  const removed = before.alive.flatMap((alive, offset) => alive && !after.alive[offset] ? [offset] : []);
  const unmatched = after.tray.slice(), missing = [];
  for (const picture of before.tray) {
    const match = unmatched.indexOf(picture);
    if (match >= 0) unmatched.splice(match, 1); else missing.push(picture);
  }
  if (removed.length === 1 && missing.length === 1 && !unmatched.length && after.moves === before.moves + 1) {
    return { index, picture: missing[0], source: 'observedTrayMatch' };
  }
  const peek = before.openPeek;
  if (removed.length === 2 && peek >= 0 && removed.includes(peek) && before.pictures[peek] !== null
    && !missing.length && !unmatched.length && after.moves === before.moves + 2 && after.openPeek === -1) {
    return { index, picture: before.pictures[peek], source: 'observedOpenTwinMatch' };
  }
  return null;
}

module.exports = { inferMatchedPicture };
