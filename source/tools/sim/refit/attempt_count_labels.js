'use strict';
function normalizeAttempts(first, last, confirmedOpening) {
  if (!Number.isInteger(first) || first < 1 || (last !== null && (!Number.isInteger(last) || last < first))) throw new Error('Invalid attempt counters');
  return { firstAttempt: confirmedOpening ? 1 : first, loggedFirstAttempt: first, loggedWonOn: last,
    wonOn: last === null ? null : last - (confirmedOpening ? first - 1 : 0) };
}
module.exports = { normalizeAttempts };
