'use strict';
const fs = require('fs');
const path = require('path');
const Hard = require('../../../www/hard.js');
const L = require('../../../www/layouts.js');
const { NAMES } = require('./personal_model.js');
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
    .filter(g => g.availableAt < cutoffTime)
    .sort((a, b) => a.t - b.t);

  if (allGames.length === 0) {
    return {
      name,
      episodes: 0,
      parameters: { depth: 16, trayBuffer: 2, clockPatience: 0.5, memoryDecay: 0.1, retryLearning: 0.6 }
    };
  }

  // Tray metrics
  let traySingleCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let trayTotalOpportunities = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let weightedTrayRisk = 0;
  let totalTrayWeight = 0;

  // Clock metrics
  let weightedClockConeMoves = 0;
  let weightedClockTotalMoves = 0;

  // Memory metrics: tracking re-inspections of already peeked/turned tiles
  let inspectedTilesSeen = 0;
  let redundantInspections = 0;

  // Cross-attempt retry carry-forward: same board/level consecutive attempts
  const campaignAttempts = new Map();

  allGames.forEach((game, ageFromEnd) => {
    const age = allGames.length - 1 - ageFromEnd;
    const weight = Math.pow(0.5, age / halfLife);

    // Track campaigns for retryLearning
    const campKey = `${game.key}_${game.lv}`;
    if (!campaignAttempts.has(campKey)) campaignAttempts.set(campKey, []);
    campaignAttempts.get(campKey).push({ game, weight });

    // Clock cone tracking
    const hasClock = !!game.g.clock;
    let clockCone = null;
    if (hasClock) {
      const clockIdx = game.g.clock.i;
      // Dependency cone
      const tiles = game.g.tiles;
      clockCone = new Set([clockIdx]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (let i = 0; i < tiles.length; i++) {
          if (!clockCone.has(i)) {
            // If i is an ancestor/neighbor covering any tile in clockCone
            const nb = game.g.nb[i];
            if (nb && nb.some(n => clockCone.has(n) && tiles[i].z > tiles[n].z)) {
              clockCone.add(i);
              expanded = true;
            }
          }
        }
      }
    }

    // Step-by-step trace
    let tray = [];
    let seenInspections = new Set();

    for (let s = 0; s < game.take.length; s++) {
      const tap = game.take[s];
      const trayLen = tray.length;

      if (trayLen <= 3) {
        trayTotalOpportunities[trayLen]++;
      }

      if (tap < 0) {
        // Inspection of face-down tile
        const inspectedIdx = -(tap + 1);
        if (seenInspections.has(inspectedIdx)) {
          redundantInspections++;
        } else {
          seenInspections.add(inspectedIdx);
          inspectedTilesSeen++;
        }
        continue;
      }

      const tileIdx = tap;
      const pic = game.g.faces[tileIdx];

      if (hasClock && clockCone) {
        weightedClockTotalMoves += weight;
        if (clockCone.has(tileIdx)) {
          weightedClockConeMoves += weight;
        }
      }

      const inTrayIdx = tray.indexOf(pic);
      if (inTrayIdx >= 0) {
        // Paired with tray
        tray.splice(inTrayIdx, 1);
      } else {
        // Single taken into tray
        if (trayLen <= 3) {
          traySingleCounts[trayLen]++;
        }
        tray.push(pic);
        if (trayLen >= 2) {
          weightedTrayRisk += weight * (trayLen === 2 ? 1.0 : 2.5);
        }
        totalTrayWeight += weight;
      }
    }
  });

  // Calculate empirical retry learning
  let weightedRetryOverlap = 0;
  let weightedRetryTotal = 0;

  for (const [key, attempts] of campaignAttempts.entries()) {
    if (attempts.length > 1) {
      for (let i = 1; i < attempts.length; i++) {
        const prev = attempts[i - 1];
        const curr = attempts[i];
        const prevSet = new Set(prev.game.take.filter(x => x >= 0));
        const currTakes = curr.game.take.filter(x => x >= 0);
        let overlap = 0;
        for (const t of currTakes) {
          if (prevSet.has(t)) overlap++;
        }
        const w = (prev.weight + curr.weight) / 2;
        weightedRetryOverlap += w * overlap;
        weightedRetryTotal += w * currTakes.length;
      }
    }
  }

  // Derive parameters
  const singleProb3 = traySingleCounts[3] / Math.max(1, trayTotalOpportunities[3]);
  const singleProb2 = traySingleCounts[2] / Math.max(1, trayTotalOpportunities[2]);

  // trayBuffer: 2 if player heavily restricts singles at tray=2/3; 3 if they tolerate pushing
  const trayBuffer = (singleProb3 < 0.12 && singleProb2 < 0.21) ? 2 : 3;

  // clockPatience: ratio of moves on clock cone
  const clockConeRatio = weightedClockTotalMoves > 0 ? (weightedClockConeMoves / weightedClockTotalMoves) : 0.5;
  const clockPatience = Math.max(0.1, Math.min(0.95, clockConeRatio * 1.5));

  // memoryDecay: rate of redundant inspections or memory slip
  const rawDecay = inspectedTilesSeen > 0 ? (redundantInspections / inspectedTilesSeen) : 0.05;
  const memoryDecay = Math.max(0.0, Math.min(0.4, rawDecay));

  // retryLearning: carry-forward fraction
  const rawRetry = weightedRetryTotal > 0 ? (weightedRetryOverlap / weightedRetryTotal) : 0.6;
  const retryLearning = Math.max(0.1, Math.min(0.95, rawRetry));

  // depth: based on win rate and moves
  const winRate = allGames.filter(g => g.won).length / allGames.length;
  const depth = winRate > 0.7 ? 20 : winRate > 0.5 ? 16 : winRate > 0.3 ? 12 : 8;

  return {
    name,
    episodes: allGames.length,
    wins: allGames.filter(g => g.won).length,
    winRate: +(winRate.toFixed(3)),
    diagnostics: {
      singleProbAtTray2: +(singleProb2.toFixed(3)),
      singleProbAtTray3: +(singleProb3.toFixed(3)),
      clockConeRatio: +(clockConeRatio.toFixed(3)),
      redundantInspectionRate: +(rawDecay.toFixed(3)),
      retryCarryForwardRate: +(rawRetry.toFixed(3))
    },
    parameters: {
      depth,
      trayBuffer,
      clockPatience: +(clockPatience.toFixed(2)),
      memoryDecay: +(memoryDecay.toFixed(2)),
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
