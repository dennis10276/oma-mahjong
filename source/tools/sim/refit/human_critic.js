'use strict';
// human_critic.js: Critic that judges level quality and failure modes in Dennis's terms.
const { measureHuman } = require('./human_style_measure.js');

/**
 * Evaluates a board layout for game quality, fairness, and specific failure modes.
 * Returns flags, quantitative scores, and human-readable reasons in Dennis's terms.
 *
 * @param {Object} board - The board object { tiles, faces, down, obst, clock }
 * @param {Object} [options] - Options passed to measureHuman (e.g. { runs, seed })
 * @returns {Object} { flags, kinds, measure }
 */
function critique(board, options = {}) {
  const seed = options.seed ?? 4711;
  const runs = options.runs ?? 20;
  // Run base evaluation with Dennis profile
  const m = measureHuman(board, { runs, setting: 'dennis', seed, ...options });

  const tiles = board.tiles || [];
  const n = tiles.length;
  const obst = board.obst || { ice: {}, locks: [], keys: [] };
  const clock = board.clock || null;
  const downList = board.down || [];
  const downCount = Array.isArray(downList) && downList.length && typeof downList[0] === 'number' && downList.length <= n && downList.some(x => x > 1)
    ? downList.length
    : (downList.filter ? downList.filter(Boolean).length : 0);
  const downShare = n > 0 ? +(downCount / n).toFixed(2) : 0;

  const at = m.results.flatMap(r => r.attempts);
  const losses = at.filter(a => !a.win && !a.censored);
  const totalLosses = losses.length;

  // 1. Late squeeze: hard part is at the very end (tray pressure while finishing)
  const lateLosses = losses.filter(a => a.left <= 0.45 * n).length;
  const lateShare = totalLosses > 0 ? +(lateLosses / totalLosses).toFixed(2) : 0;
  const postClockAttempts = clock ? at.filter(a => a.clockLeft != null) : [];
  const postClockLosses = postClockAttempts.filter(a => !a.win && !a.censored);
  const postClockLateLosses = postClockLosses.filter(a => a.left <= 0.45 * n).length;
  const postClockLateShare = postClockLosses.length > 0 ? +(postClockLateLosses / postClockLosses.length).toFixed(2) : 0;

  const lateSqueezeFlag = (lateShare >= 0.30 && lateLosses >= 4) || (postClockLosses.length >= 5 && postClockLateShare >= 0.70);
  const lateSqueezeReason = lateSqueezeFlag
    ? `frustrating tray pressure at the very end (${lateShare >= 0.30 ? Math.round(lateShare * 100) + '% of losses with <=45% tiles left' : Math.round(postClockLateShare * 100) + '% of post-clock losses late'})`
    : 'no late squeeze (losses occur with plenty of tiles left)';

  // 2. Clock metrics
  const clockReach = clock ? +(postClockAttempts.length / Math.max(1, at.length)).toFixed(3) : 1;
  const clockLosses = losses.filter(a => a.why === 'clock').length;
  const clockLossShare = totalLosses > 0 ? +(clockLosses / totalLosses).toFixed(2) : 0;
  const beforeClockShare = +(m.lossTiming?.shares?.beforeClock ?? 0).toFixed(2);

  const spares = clock ? postClockAttempts.map(a => clock.n - (n - a.clockLeft)) : [];
  const avgSpare = spares.length ? +(spares.reduce((a, b) => a + b, 0) / spares.length).toFixed(1) : null;

  // 2. Clock too tight: no route to the clock a person can find in time (wants more spare moves)
  const clockTooTightFlag = clock != null && ((clockReach < 0.01 && (clockLosses >= 15 || totalLosses >= 30) && clock.n <= 22) || (clockLossShare >= 0.50 && beforeClockShare >= 0.75 && (avgSpare == null || avgSpare <= 0.8) && clockReach <= 0.35 && clock.n <= 22));
  const clockTooTightReason = clockTooTightFlag
    ? `no route to the clock a person can find in time (reach rate ${Math.round(clockReach * 100)}%, wants more spare moves)`
    : 'clock allows enough time for viable routes';

  // 3. Boring after clock: once clock taken it is just collecting with no tension left
  const postClockWins = postClockAttempts.filter(a => a.win).length;
  const boringAfterClockFlag = clock != null && clockReach >= 0.80 && postClockLosses.length === 0 && postClockWins >= 10;
  const boringAfterClockReason = boringAfterClockFlag
    ? 'once the clock is taken it is just collecting with no tension left (0 post-clock losses)'
    : 'maintains engagement after clock';

  // 4. Clock too loose: clock has more spare than it needs
  const clockTooLooseFlag = clock != null && (
    (avgSpare >= 3.5 && clockLossShare <= 0.05 && clockReach >= 0.30 && m.expectedTries <= 6.5 && downShare <= 0.55) ||
    (m.expectedTries <= 2.5 && avgSpare >= 0.7 && m.firstTryRate >= 0.30 && clockLossShare < 0.75 && clock.n >= 20 && (m.label === 'right' || m.label === 'easy'))
  );
  const clockTooLooseReason = clockTooLooseFlag
    ? `the clock has more spare than it needs (average spare ${avgSpare ?? 0} moves upon reach)`
    : 'clock timer matches route distance well';

  // 5. Special adds nothing: obstacle category that does not change how you play
  const iceCount = Object.keys(obst.ice || {}).length;
  const lockCount = (obst.locks || []).length;
  let minSpecialDiff = 999;
  let minSpecialKind = 'none';
  const strippedDiffs = {};

  if (!options.skipSpecials && m.expectedTries < 7.0 && m.expectedTries > 1.3) {
    if (iceCount >= 4) {
      const mNoIce = measureHuman({ ...board, obst: { ...obst, ice: {} } }, { runs: 10, setting: 'dennis', seed });
      const diff = Math.abs(mNoIce.expectedTries - m.expectedTries);
      strippedDiffs.ice = diff;
      if (diff < minSpecialDiff) { minSpecialDiff = diff; minSpecialKind = 'ice'; }
    }
    if (lockCount >= 2) {
      const mNoLocks = measureHuman({ ...board, obst: { ...obst, locks: [], keys: [] } }, { runs: 10, setting: 'dennis', seed });
      const diff = Math.abs(mNoLocks.expectedTries - m.expectedTries);
      strippedDiffs.locks = diff;
      if (diff < minSpecialDiff) { minSpecialDiff = diff; minSpecialKind = 'locks'; }
    }
    if (clock != null && m.expectedTries >= 1.5) {
      const mNoClock = measureHuman({ ...board, clock: null }, { runs: 10, setting: 'dennis', seed });
      const diff = Math.abs(mNoClock.expectedTries - m.expectedTries);
      strippedDiffs.clock = diff;
      if (diff < minSpecialDiff) { minSpecialDiff = diff; minSpecialKind = 'clock'; }
    }
  }

  const specialAddsNothingFlag = minSpecialDiff <= 0.25 && (iceCount >= 4 || lockCount >= 2 || clock != null);
  const specialAddsNothingReason = specialAddsNothingFlag
    ? `${minSpecialKind} does not change how you play (difficulty shifts by ${+minSpecialDiff.toFixed(2)} when removed)`
    : 'specials meaningfully contribute to the puzzle';

  // 6. Too easy: won without having to think
  const tooEasyFlag = (m.expectedTries <= 1.05 && m.firstTryRate >= 0.95) ||
                      (downShare <= 0.45 && (
                        (m.expectedTries <= 1.35 && m.firstTryRate >= 0.95) ||
                        (m.expectedTries <= 1.70 && m.firstTryRate >= 0.75 && (obst.locks || []).length >= 6)
                      ));
  const tooEasyReason = tooEasyFlag
    ? `won without having to think (expected ${m.expectedTries} tries, ${Math.round(m.firstTryRate * 100)}% first-try wins)`
    : 'requires thoughtful planning';

  // 7. Guessing: progress depends on blind digging or guessing, not working things out
  const keys = obst.keys || [];
  let keysBlockedByDown = 0;
  if (keys.length > 0) {
    const downSet = new Set(Array.isArray(downList) && downList.length && typeof downList[0] === 'number' && downList.some(x => x > 1) ? downList : []);
    if (!downSet.size && downList.forEach) {
      downList.forEach((d, i) => { if (d) downSet.add(i); });
    }
    for (const keyIdx of keys) {
      const kt = tiles[keyIdx];
      if (!kt) continue;
      const kz = kt.z !== undefined ? kt.z : kt[2];
      const kx = kt.x !== undefined ? kt.x : kt[0];
      const ky = kt.y !== undefined ? kt.y : kt[1];
      for (let i = 0; i < tiles.length; i++) {
        if (i === keyIdx) continue;
        const t = tiles[i];
        const tz = t.z !== undefined ? t.z : t[2];
        const tx = t.x !== undefined ? t.x : t[0];
        const ty = t.y !== undefined ? t.y : t[1];
        if (tz > kz && Math.abs(tx - kx) < 2 && Math.abs(ty - ky) < 2 && downSet.has(i)) {
          keysBlockedByDown++;
          break;
        }
      }
    }
  }

  const guessingFlag = (specialAddsNothingFlag && (strippedDiffs.clock <= 0.20 || strippedDiffs.locks <= 0.20 || strippedDiffs.ice <= 0.10) && downCount >= 25 && m.expectedTries <= 4.5 && (minSpecialKind === 'clock' || minSpecialKind === 'ice' || minSpecialKind === 'locks')) ||
                       (clock != null && keys.length > 0 && keysBlockedByDown > 0 && clockLossShare >= 0.50 && (avgSpare == null || avgSpare <= 0.8));
  const guessingReason = guessingFlag
    ? 'progress depends on blind digging or guessing rather than deduction'
    : 'routes and obstacles can be worked out visually';

  // 8. Fun: 4-5 stars, fair challenge with positive engagement
  const funFlag = !lateSqueezeFlag && !clockTooTightFlag && !boringAfterClockFlag && !specialAddsNothingFlag && !tooEasyFlag && !guessingFlag && m.expectedTries >= 1.2 && m.expectedTries <= 7.9;
  const funReason = funFlag
    ? 'satisfying and fair challenge with engaging puzzle mechanics'
    : 'imbalanced difficulty or unengaging obstacle structure';

  const flags = [];
  if (lateSqueezeFlag) flags.push('lateSqueeze');
  if (boringAfterClockFlag) flags.push('boringAfterClock');
  if (clockTooTightFlag) flags.push('clockTooTight');
  if (clockTooLooseFlag) flags.push('clockTooLoose');
  if (guessingFlag) flags.push('guessing');
  if (specialAddsNothingFlag) flags.push('specialAddsNothing');
  if (tooEasyFlag) flags.push('tooEasy');
  if (funFlag) flags.push('fun');

  return {
    flags,
    kinds: {
      lateSqueeze: { flag: lateSqueezeFlag, value: lateShare, reason: lateSqueezeReason },
      boringAfterClock: { flag: boringAfterClockFlag, value: boringAfterClockFlag ? 1 : 0, reason: boringAfterClockReason },
      clockTooTight: { flag: clockTooTightFlag, value: clockReach, reason: clockTooTightReason },
      clockTooLoose: { flag: clockTooLooseFlag, value: avgSpare ?? 0, reason: clockTooLooseReason },
      guessing: { flag: guessingFlag, value: guessingFlag ? 1 : 0, reason: guessingReason },
      specialAddsNothing: { flag: specialAddsNothingFlag, value: +(minSpecialDiff === 999 ? 0 : minSpecialDiff).toFixed(2), reason: specialAddsNothingReason },
      tooEasy: { flag: tooEasyFlag, value: m.expectedTries, reason: tooEasyReason },
      fun: { flag: funFlag, value: m.expectedTries, reason: funReason }
    },
    measure: m
  };
}

module.exports = { critique };
