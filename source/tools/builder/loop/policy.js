'use strict';
// Dennis's decisions: LEVEL-DESIGN-FACTS.md, updated 2026-11-08.
const SKILLED = Object.freeze({ lo: 2.5, hi: 6 });
const SKILLED_FALLBACK_MIN = 2;
const TREND = Object.freeze({ points: [[250, 10], [274, 12], [275, 13]], afterStep: 3 / 25 });
function familyTarget(level) {
  if (!Number.isInteger(level) || level < 250) throw Error('new-level policy starts at 250');
  if (level <= 274) return 10 + (level - 250) * 2 / 24;
  return 13 + (level - 275) * TREND.afterStep;
}
function assertSkilledOptions(o = {}) {
  if ((o.lo != null && !(Number.isFinite(o.lo) && o.lo >= SKILLED_FALLBACK_MIN && o.lo <= SKILLED.lo)) || (o.hi != null && o.hi !== SKILLED.hi) || (o.floor != null && o.floor !== 'hard'))
    throw Error('Every level requires skilled 2.5-6 normally, with an explicit fallback minimum of 2; averaging is not supported');
}
module.exports = { SKILLED, SKILLED_FALLBACK_MIN, TREND, familyTarget, assertSkilledOptions };
