'use strict';
const fs = require('fs');
const path = require('path');
const Hard = require('../../../www/hard.js');
const L = require('../../../www/layouts.js');
const { NAMES, boardId } = require('./personal_model.js');
const { gamesOf } = require('./mimic_games.js');

const ROOT = path.resolve(__dirname, '../../../..');
const OUTPUT_PATH = path.join(ROOT, 'source', 'analysis', 'personal-bots', 'personal-behavioral-fit.json');

/**
 * Calibrates behavioral parameters for a player from their chronologically earlier games.
 * 
 * Parameters calibrated:
 * - trayBuffer: tolerance threshold before forcing pair recovery (2 or 3)
 * - clockPatience: weight on clock cone unblocking vs open board freedom [0.0, 1.0]
 * - memoryDecay: empirical in-game forgetting rate [0.0, 1.0]
 * - retryLearning: empirical cross-attempt tile location carry-forward rate [0.0, 1.0]
 * - depth: effective lookahead horizon [8, 20]
 * 
 * @param {string} name - Player name
 * @param {number} [cutoffTime=Infinity] - Chronological availability cutoff
 * @param {number} [halfLife=20] - Recency weighting half-life in episodes
 */
function calibratePlayer(name, cutoffTime = Infinity, halfLife = 20) {
  const allGames = gamesOf(name)
    .filter(g => g.availableAt < cutoffTime && g.t < cutoffTime)
    .sort((a, b) => a.t - b.t);

  if (allGames.length === 0) {
    return {
      name,
      episodes: 0,
      parameters: { depth: 16, trayBuffer: 2, clockPatience: 0.5, memoryDecay: 0.1, retryLearning: 0.6 }
    };
  }

  // Recency-weighted tray metrics
  let weightedTraySingleCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let weightedTrayTotalOpportunities = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const singleInTrayDurations = [];

  // Recency-weighted clock metrics (strictly while clock is alive)
  let weightedClockConeMoves = 0;
  let weightedClockTotalMoves = 0;

  // Recency-weighted memory metrics (filtering consecutive state peek duplicates)
  let weightedInspectionsSeen = 0;
  let weightedReInspectedTiles = 0;

  // Recency-weighted depth metrics
  let weightedMovesSum = 0;
  let weightedGamesSum = 0;

  // Cross-attempt retry carry-forward: exact board ID and campaign ID
  const campaignAttempts = new Map();

  allGames.forEach((game, ageFromEnd) => {
    const age = allGames.length - 1 - ageFromEnd;
    const weight = Math.pow(0.5, age / halfLife);

    const movesCount = game.take.filter(x => x >= 0).length;
    weightedGamesSum += weight;
    weightedMovesSum += weight * movesCount;

    // Track exact board campaigns for retryLearning
    const exactBoard = boardId(game.g);
    const campKey = `${game.key}_${exactBoard}`;
    if (!campaignAttempts.has(campKey)) campaignAttempts.set(campKey, []);
    campaignAttempts.get(campKey).push({ game, weight });

    // Clock cone tracking using nb.above
    const hasClock = !!game.g.clock;
    let clockCone = null;
    let clockIdx = -1;
    if (hasClock) {
      clockIdx = game.g.clock.i;
      clockCone = new Set([clockIdx]);
      const stack = [clockIdx];
      while (stack.length) {
        const current = stack.pop();
        const aboveList = (game.g.nb && game.g.nb.above && game.g.nb.above[current]) || [];
        for (const above of aboveList) {
          if (!clockCone.has(above)) {
            clockCone.add(above);
            stack.push(above);
          }
        }
      }
    }

    // Step-by-step trace
    let clockAlive = hasClock;
    let tray = [];
    const trayState = {};
    const inspectionCounts = new Map();
    let lastPeek = -1;

    for (let s = 0; s < game.take.length; s++) {
      const tap = game.take[s];
      const trayLen = tray.length;

      if (tap < 0) {
        // Inspection of face-down tile; only count new physical inspection events
        const inspectedIdx = -(tap + 1);
        if (inspectedIdx !== lastPeek) {
          lastPeek = inspectedIdx;
          inspectionCounts.set(inspectedIdx, (inspectionCounts.get(inspectedIdx) || 0) + 1);
        }
        continue;
      }

      // Removal or physical match tap
      lastPeek = -1;
      const tileIdx = tap;
      const pic = game.g.faces[tileIdx];

      if (trayLen <= 3) {
        weightedTrayTotalOpportunities[trayLen] += weight;
      }

      // Only count clock moves while clock tile is alive
      if (clockAlive && clockCone) {
        weightedClockTotalMoves += weight;
        if (clockCone.has(tileIdx)) {
          weightedClockConeMoves += weight;
        }
        if (tileIdx === clockIdx) {
          clockAlive = false;
        }
      }

      const inTrayIdx = tray.indexOf(pic);
      if (inTrayIdx >= 0) {
        // Paired with tray
        tray.splice(inTrayIdx, 1);
        if (trayState[pic] !== undefined) {
          singleInTrayDurations.push({ span: s - trayState[pic], weight });
          delete trayState[pic];
        }
      } else {
        // Single taken into tray
        if (trayLen <= 3) {
          weightedTraySingleCounts[trayLen] += weight;
        }
        tray.push(pic);
        trayState[pic] = s;
      }
    }

    for (const [, count] of inspectionCounts) {
      weightedInspectionsSeen += weight;
      if (count > 1) {
        weightedReInspectedTiles += weight;
      }
    }
  });

  // Calculate empirical retry learning across exact-board consecutive attempts:
  // Measure direct recall (direct tap of previously inspected face-down tile) vs re-peeking,
  // avoiding generic tile-index overlap and freezing knowledge prior to each retry.
  let weightedDirectMatches = 0;
  let weightedRePeeks = 0;

  for (const [, attempts] of campaignAttempts.entries()) {
    if (attempts.length > 1) {
      const seenBefore = new Set();
      for (let i = 0; i < attempts.length; i++) {
        const { game: attGame, weight: w } = attempts[i];
        const seenThisAttempt = new Set();
        for (const tap of attGame.take) {
          if (tap < 0) {
            const idx = -(tap + 1);
            if (i > 0 && seenBefore.has(idx) && !seenThisAttempt.has(idx)) {
              weightedRePeeks += w;
            }
            seenThisAttempt.add(idx);
          } else {
            const idx = tap;
            if (i > 0 && seenBefore.has(idx) && !seenThisAttempt.has(idx) && attGame.g.down && attGame.g.down[idx]) {
              weightedDirectMatches += w;
            }
          }
        }
        for (const idx of seenThisAttempt) {
          seenBefore.add(idx);
        }
      }
    }
  }

  // Derive parameters with recency-weighted statistics
  const singleProb3 = weightedTraySingleCounts[3] / Math.max(0.001, weightedTrayTotalOpportunities[3]);
  const singleProb2 = weightedTraySingleCounts[2] / Math.max(0.001, weightedTrayTotalOpportunities[2]);

  // trayBuffer: 2 if player heavily restricts singles at tray=2/3; 3 if they tolerate pushing
  const trayBuffer = (singleProb3 < 0.12 && singleProb2 < 0.21) ? 2 : 3;

  // clockPatience: ratio of moves on clock cone strictly while clock is alive
  const clockConeRatio = weightedClockTotalMoves > 0 ? (weightedClockConeMoves / weightedClockTotalMoves) : 0.5;
  const clockPatience = Math.max(0.1, Math.min(0.95, clockConeRatio * 1.5));

  // memoryDecay: per-step empirical forgetting probability from re-inspection rate
  const frac = weightedInspectionsSeen > 0 ? (weightedReInspectedTiles / weightedInspectionsSeen) : 0.5;
  const avgM = weightedMovesSum / Math.max(0.001, weightedGamesSum);
  const memoryDecay = Math.max(0.005, Math.min(0.08, 1 - Math.pow(Math.max(0.01, 1 - frac), 1 / Math.max(10, avgM))));

  // retryLearning: direct recall rate on previously inspected face-down tiles
  const totalRetryInteractions = weightedDirectMatches + weightedRePeeks;
  let retryLearning;
  let retryUncertain = false;
  if (totalRetryInteractions < 5) {
    retryLearning = 0.3; // unidentifiable default
    retryUncertain = true;
  } else {
    retryLearning = Math.max(0.1, Math.min(0.95, weightedDirectMatches / totalRetryInteractions));
  }

  // depth: based on recency-weighted 90th percentile of pairing span
  singleInTrayDurations.sort((a, b) => a.span - b.span);
  const totalSpanWeight = singleInTrayDurations.reduce((sum, item) => sum + item.weight, 0);
  let cumSpanWeight = 0;
  let p90Span = 0;
  for (const item of singleInTrayDurations) {
    cumSpanWeight += item.weight;
    if (cumSpanWeight >= 0.90 * totalSpanWeight) {
      p90Span = item.span;
      break;
    }
  }
  const depth = p90Span >= 6 ? 16 : p90Span >= 5 ? 14 : p90Span >= 3 ? 12 : 10;
  const winRate = allGames.filter(g => g.won).length / allGames.length;

  return {
    name,
    episodes: allGames.length,
    wins: allGames.filter(g => g.won).length,
    winRate: +(winRate.toFixed(3)),
    diagnostics: {
      singleProbAtTray2: +(singleProb2.toFixed(3)),
      singleProbAtTray3: +(singleProb3.toFixed(3)),
      clockConeRatio: +(clockConeRatio.toFixed(3)),
      reInspectedTileFraction: +(frac.toFixed(3)),
      p90PairingSpan: p90Span,
      retryRecallRate: +(retryLearning.toFixed(3)),
      retryCarryForwardRate: +(retryLearning.toFixed(3)),
      retryInteractionsCount: Math.round(totalRetryInteractions),
      retryUncertain
    },
    parameters: {
      depth,
      trayBuffer,
      clockPatience: +(clockPatience.toFixed(2)),
      memoryDecay: +(memoryDecay.toFixed(4)),
      retryLearning: +(retryLearning.toFixed(2))
    }
  };
}

function calibrateAll(outputFile = OUTPUT_PATH, cutoffTime = Infinity) {
  const result = {
    calibratedAt: new Date().toISOString(),
    cutoffTime: Number.isFinite(cutoffTime) ? cutoffTime : null,
    halfLife: 20,
    players: {}
  };

  for (const name of NAMES) {
    result.players[name] = calibratePlayer(name, cutoffTime);
  }

  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
  }

  return result;
}

if (require.main === module) {
  const res = calibrateAll();
  console.log(JSON.stringify(res, null, 2));
}

module.exports = { calibratePlayer, calibrateAll };
