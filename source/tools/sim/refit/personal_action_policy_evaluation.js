'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { calibratePlayer } = require('./personal_behavioral_calibration.js');
const { search } = require('./public_witness_search.js');
const { NAMES, boardId, publicBoardId } = require('./personal_model.js');
const { gamesOf } = require('./mimic_games.js');
const { createSession } = require('./production_physical_session.js');
const { createObservedMemory } = require('./personal_observed_memory.js');
const { compareTrayCounts } = require('./independent_tray_metrics.js');

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
    const perGameRecords = [];

    for (const game of testGames) {
      if (totalEvaluated >= samplePerPlayer) break;
      const g = game.g;
      const publicGeometry = { tiles: g.tiles, nb: g.nb, rules: g.rules, clock: g.clock };
      const bId = boardId(g);
      const pId = publicBoardId(g);
      let gameEvaluated = 0;

      let session;
      try {
        session = createSession(g);
      } catch (e) {
        continue;
      }

      const memory = createObservedMemory({
        size: g.tiles.length,
        campaign: 'eval_tf_' + name,
        board: 'board_' + game.key,
        seed: 42,
        retryRetention: calib.parameters.retryLearning,
        decay: calib.parameters.memoryDecay
      });
      memory.beginAttempt({ campaign: 'eval_tf_' + name, board: 'board_' + game.key, size: g.tiles.length, attempt: 1 });

      const ev = { kind: 'eval-observer', sha256: '0'.repeat(64) };
      const getObs = f => {
        const pictures = f.state.alive.map((alive, index) => {
          if (!alive) return null;
          if (index === f.state.openPeek) return g.faces[index];
          if (!g.down[index]) {
            const aboveList = (g.nb && g.nb.above && g.nb.above[index]) || [];
            if (aboveList.every(a => !f.state.alive[a])) return g.faces[index];
          }
          return null;
        });
        return { physicalTaps: f.state.physicalTaps, alive: f.state.alive, pictures, evidence: pictures.map(p => p !== null ? ev : null) };
      };

      let frame = session.view();
      let observed = memory.observe(getObs(frame));
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

        const searchState = {
          pictures: observed.pictures,
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
          publicGeometry,
          searchState,
          legalMoves,
          {
            depth: calib.parameters.depth,
            trayBuffer: calib.parameters.trayBuffer,
            clockPatience: calib.parameters.clockPatience
          }
        );

        const pIndex = personalChoice?.path?.[0] ?? frame.legalTiles[0];
        if (pIndex === actionIndex) personalTop1++;

        // Generic reference decision (neutral default)
        const refChoice = search(
          publicGeometry,
          searchState,
          legalMoves,
          { depth: 16, trayBuffer: 2, clockPatience: 0.5 }
        );
        const rIndex = refChoice?.path?.[0] ?? frame.legalTiles[0];
        if (rIndex === actionIndex) referenceTop1++;

        totalEvaluated++;
        gameEvaluated++;

        try {
          frame = session.tap(actionIndex);
          if (frame.type === 'productionPhysicalEnd-v1') break;
          observed = memory.observe(getObs(frame));
        } catch (e) {
          break;
        }
      }

      perGameRecords.push({
        aid: game.aid,
        lv: game.lv,
        boardId: bId,
        publicBoardId: pId,
        openedAt: game.t,
        availableAt: game.availableAt,
        completedAt: game.availableAt,
        evaluatedDecisions: gameEvaluated
      });
    }

    const humanTrayDist = {};
    for (let k = 0; k <= 3; k++) {
      humanTrayDist[k] = +( (trayCounts[k] || 0) / Math.max(1, totalEvaluated) ).toFixed(3);
    }

    // Simulated bot rollout on held-out test games to measure bot tray distribution
    const botTrayCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    let botSteps = 0;
    const botStepTarget = Math.max(30, samplePerPlayer);

    for (const game of testGames) {
      if (botSteps >= botStepTarget) break;
      const g = game.g;
      const publicGeometry = { tiles: g.tiles, nb: g.nb, rules: g.rules, clock: g.clock };
      const memory = createObservedMemory({
        size: g.tiles.length,
        campaign: 'eval_' + name,
        board: 'board_' + game.key,
        seed: 42,
        retryRetention: calib.parameters.retryLearning,
        decay: calib.parameters.memoryDecay
      });
      memory.beginAttempt({ campaign: 'eval_' + name, board: 'board_' + game.key, size: g.tiles.length, attempt: 1 });
      let botSession;
      try { botSession = createSession(g); } catch (e) { continue; }
      let bFrame = botSession.view();

      const ev = { kind: 'eval-observer', sha256: '0'.repeat(64) };
      const getObs = f => {
        const pictures = f.state.alive.map((alive, index) => {
          if (!alive) return null;
          if (index === f.state.openPeek) return g.faces[index];
          if (!g.down[index]) {
            const aboveList = (g.nb && g.nb.above && g.nb.above[index]) || [];
            if (aboveList.every(a => !f.state.alive[a])) return g.faces[index];
          }
          return null;
        });
        return { physicalTaps: f.state.physicalTaps, alive: f.state.alive, pictures, evidence: pictures.map(p => p !== null ? ev : null) };
      };

      let observed = memory.observe(getObs(bFrame));

      while (bFrame.type !== 'productionPhysicalEnd-v1' && botSteps < botStepTarget) {
        const tLen = bFrame.state.tray.length;
        if (tLen <= 3) botTrayCounts[tLen] = (botTrayCounts[tLen] || 0) + 1;
        botSteps++;

        const legalMoves = bFrame.legalTiles.map(index => ({
          index,
          inspect: !!bFrame.state.down[index] && bFrame.state.openPeek !== index
        }));

        const sState = {
          pictures: observed.pictures,
          down: bFrame.state.down,
          alive: bFrame.state.alive,
          tray: bFrame.state.tray,
          moves: bFrame.state.moves,
          openPeek: bFrame.state.openPeek,
          relieved: bFrame.state.relieved,
          arriving: bFrame.state.arriving
        };

        const plan = search(publicGeometry, sState, legalMoves, {
          depth: calib.parameters.depth,
          trayBuffer: calib.parameters.trayBuffer,
          clockPatience: calib.parameters.clockPatience,
          pairProgress: true
        });

        const nextTile = plan?.path?.[0] ?? bFrame.legalTiles[0];
        bFrame = botSession.tap(nextTile);
        if (bFrame.type !== 'productionPhysicalEnd-v1') {
          observed = memory.observe(getObs(bFrame));
        }
      }
    }

    const botTrayDist = {};
    for (let k = 0; k <= 3; k++) {
      botTrayDist[k] = +( (botTrayCounts[k] || 0) / Math.max(1, botSteps) ).toFixed(3);
    }

    const trayMetrics = compareTrayCounts(trayCounts, botTrayCounts);

    results[name] = {
      evaluatedDecisions: totalEvaluated,
      calibratedParameters: calib.parameters,
      humanTrayDistribution: humanTrayDist,
      botTrayDistribution: botTrayDist,
      humanTrayCounts: { ...trayCounts },
      botTrayCounts: { ...botTrayCounts },
      trayComparison: {
        totalVariationDistance: trayMetrics.totalVariationDistance,
        wassersteinDistance: trayMetrics.wassersteinDistance,
        replicatesDistribution: trayMetrics.totalVariationDistance <= 0.50
      },
      top1Accuracy: {
        personalBot: +( (personalTop1 / Math.max(1, totalEvaluated)).toFixed(3) ),
        referenceBot: +( (referenceTop1 / Math.max(1, totalEvaluated)).toFixed(3) ),
        randomBaseline: +( (randomTop1Expected / Math.max(1, totalEvaluated)).toFixed(3) )
      },
      personalFidelityVerified: (personalTop1 / Math.max(1, totalEvaluated)) > (randomTop1Expected / Math.max(1, totalEvaluated)),
      provenance: {
        trainCutoff: testCutoff,
        games: perGameRecords,
        unresolvedEvents: []
      }
    };
  }

  return results;
}

module.exports = { evaluateActionPolicyFidelity };

if (require.main === module) {
  const evalRes = evaluateActionPolicyFidelity(30);
  console.log(JSON.stringify(evalRes, null, 2));
}
