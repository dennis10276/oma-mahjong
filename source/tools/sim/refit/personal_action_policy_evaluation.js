'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { calibratePlayer } = require('./personal_behavioral_calibration.js');
const { search } = require('./public_witness_search.js');
const { NAMES } = require('./personal_model.js');
const { gamesOf } = require('./mimic_games.js');
const { createSession } = require('./production_physical_session.js');

/**
 * Evaluates action-policy fidelity of personal bots against actual human decisions
 * on chronological held blocks (the later 30% of each player's games).
 */
function evaluateActionPolicyFidelity(samplePerPlayer = 30) {
  const results = {};

  for (const name of NAMES) {
    const allGames = gamesOf(name).sort((a, b) => a.t - b.t);
    const splitIndex = Math.floor(allGames.length * 0.70);
    const trainGames = allGames.slice(0, splitIndex);
    const testCutoff = trainGames.length ? trainGames[trainGames.length - 1].t : Infinity;

    // Calibrate model using only chronological train data (before testCutoff)
    const calib = calibratePlayer(name, testCutoff);

    // Evaluate on the later test games
    const testGames = allGames.slice(splitIndex);

    let personalTop1 = 0;
    let referenceTop1 = 0;
    let randomTop1Expected = 0;
    let totalEvaluated = 0;
    const trayCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (const game of testGames) {
      if (totalEvaluated >= samplePerPlayer) break;

      let session;
      try {
        session = createSession(game.g);
      } catch (e) {
        continue;
      }

      let frame = session.view();
      let lastPeek = -1;

      for (let s = 0; s < game.take.length && totalEvaluated < samplePerPlayer; s++) {
        const tap = game.take[s];
        let actionIndex;

        if (tap < 0) {
          actionIndex = -(tap + 1);
          if (actionIndex === lastPeek && frame.state.openPeek === actionIndex) continue;
          lastPeek = actionIndex;
        } else {
          actionIndex = tap;
          lastPeek = -1;
        }

        if (!frame.legalTiles || !frame.legalTiles.includes(actionIndex)) break;

        const trayLen = frame.state.tray.length;
        if (trayLen <= 3) trayCounts[trayLen] = (trayCounts[trayLen] || 0) + 1;

        const legalCount = frame.legalTiles.length;
        randomTop1Expected += 1.0 / legalCount;

        const legalMoves = frame.legalTiles.map(index => ({
          index,
          inspect: !!frame.state.down[index] && frame.state.openPeek !== index
        }));

        // Public search state (no concealed faces)
        const publicPictures = frame.state.alive.map((alive, idx) => {
          if (!alive) return null;
          if (idx === frame.state.openPeek) return game.g.faces[idx];
          if (!game.g.down[idx]) {
            const above = (game.g.nb?.above && game.g.nb.above[idx]) || [];
            if (above.every(a => !frame.state.alive[a])) return game.g.faces[idx];
          }
          return null;
        });

        const searchState = {
          pictures: publicPictures,
          down: frame.state.down,
          alive: frame.state.alive,
          tray: frame.state.tray,
          moves: frame.state.moves,
          openPeek: frame.state.openPeek,
          relieved: frame.state.relieved,
          arriving: []
        };

        // Personal bot decision
        const personalChoice = search(
          game.g,
          searchState,
          legalMoves,
          {
            depth: calib.parameters.depth,
            trayBuffer: calib.parameters.trayBuffer,
            clockPatience: calib.parameters.clockPatience,
            memoryDecay: calib.parameters.memoryDecay,
            retryLearning: calib.parameters.retryLearning
          }
        );

        const pIndex = personalChoice?.path?.[0] ?? frame.legalTiles[0];
        if (pIndex === actionIndex) personalTop1++;

        // Generic reference decision (neutral default)
        const refChoice = search(
          game.g,
          searchState,
          legalMoves,
          { depth: 16, trayBuffer: 2, clockPatience: 0.5 }
        );
        const rIndex = refChoice?.path?.[0] ?? frame.legalTiles[0];
        if (rIndex === actionIndex) referenceTop1++;

        totalEvaluated++;

        try {
          frame = session.tap(actionIndex);
          if (frame.type === 'productionPhysicalEnd-v1') break;
        } catch (e) {
          break;
        }
      }
    }

    const humanTrayDist = {};
    for (let k = 0; k <= 3; k++) {
      humanTrayDist[k] = +( (trayCounts[k] || 0) / Math.max(1, totalEvaluated) ).toFixed(3);
    }

    results[name] = {
      evaluatedDecisions: totalEvaluated,
      calibratedParameters: calib.parameters,
      humanTrayDistribution: humanTrayDist,
      top1Accuracy: {
        personalBot: +( (personalTop1 / Math.max(1, totalEvaluated)).toFixed(3) ),
        referenceBot: +( (referenceTop1 / Math.max(1, totalEvaluated)).toFixed(3) ),
        randomBaseline: +( (randomTop1Expected / Math.max(1, totalEvaluated)).toFixed(3) )
      },
      personalFidelityVerified: (personalTop1 / Math.max(1, totalEvaluated)) > (randomTop1Expected / Math.max(1, totalEvaluated))
    };
  }

  return results;
}

module.exports = { evaluateActionPolicyFidelity };

if (require.main === module) {
  const evalRes = evaluateActionPolicyFidelity(30);
  console.log(JSON.stringify(evalRes, null, 2));
}
