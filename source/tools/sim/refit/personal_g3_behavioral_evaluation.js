'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { NAMES, boardId, publicBoardId } = require('./personal_model.js');
const { gamesOf } = require('./mimic_games.js');
const { calibratePlayer } = require('./personal_behavioral_calibration.js');
const { createSession } = require('./production_physical_session.js');
const { createObservedMemory } = require('./personal_observed_memory.js');
const { search } = require('./public_witness_search.js');
const { compareTrayCounts } = require('./independent_tray_metrics.js');
const { reconstructHumanDecisions } = require('./human_decision_dataset.js');

/**
 * Detects an empirical change point in a player's training games sequence.
 * Maximizes between-regime variance in decision activity.
 */
function detectChangePoint(trainGames) {
  if (!trainGames || trainGames.length < 10) {
    const t0 = trainGames && trainGames.length ? trainGames[0].t : 0;
    return { changePointIndex: 0, changePointTime: t0, regimeSize: trainGames ? trainGames.length : 0 };
  }
  const N = trainGames.length;
  const values = trainGames.map(g => g.take.filter(x => x >= 0).length);
  const minSplit = Math.max(3, Math.floor(N * 0.2));
  const maxSplit = Math.min(N - 3, Math.floor(N * 0.8));
  let bestSplit = 0;
  let maxBetweenVar = -1;
  const totalMean = values.reduce((a, b) => a + b, 0) / N;

  for (let s = minSplit; s <= maxSplit; s++) {
    const v1 = values.slice(0, s);
    const v2 = values.slice(s);
    const m1 = v1.reduce((a, b) => a + b, 0) / s;
    const m2 = v2.reduce((a, b) => a + b, 0) / (N - s);
    const betweenVar = s * Math.pow(m1 - totalMean, 2) + (N - s) * Math.pow(m2 - totalMean, 2);
    if (betweenVar > maxBetweenVar) {
      maxBetweenVar = betweenVar;
      bestSplit = s;
    }
  }

  const cpGame = trainGames[bestSplit];
  return {
    changePointIndex: bestSplit,
    changePointTime: cpGame ? cpGame.t : 0,
    regimeSize: N - bestSplit
  };
}

/**
 * Computes action utilities and softmax probabilities over legal moves.
 * Priority scores match the production search move-ordering heuristics.
 */
function computeActionProbabilities(publicGeometry, searchState, legalMoves, params, temperature = 1.0) {
  if (!legalMoves || legalMoves.length === 0) return [];
  const g = publicGeometry;
  const state = searchState;

  // Determine clock cone if clocked
  let cone = null;
  if (g.clock && state.alive[g.clock.i]) {
    cone = new Set([g.clock.i]);
    const stack = [g.clock.i];
    while (stack.length) {
      const cur = stack.pop();
      const above = (g.nb && g.nb.above && g.nb.above[cur]) || [];
      for (const a of above) {
        if (state.alive[a] && !cone.has(a)) { cone.add(a); stack.push(a); }
      }
    }
  }

  const utilities = legalMoves.map(move => {
    const idx = move.index;
    const pic = state.pictures[idx];
    const isTrayMatch = pic !== null && state.tray.includes(pic);
    const isClock = g.clock && g.clock.i === idx;
    const isPeekMatch = state.openPeek >= 0 && idx !== state.openPeek && pic !== null && pic === state.pictures[state.openPeek];
    const inCone = cone && cone.has(idx);

    let u = 0;
    if (isTrayMatch) {
      u = 10.0;
    } else if (isClock) {
      u = 9.0;
    } else if (isPeekMatch) {
      u = 8.0;
    } else if (inCone) {
      const patience = params.clockPatience ?? 0.5;
      u = patience >= 0.4 ? (pic === null ? 6.0 : 5.0) : (pic === null ? 4.0 : 3.0);
    } else if (pic === null) {
      u = 4.0;
    } else {
      u = 3.0;
    }

    // Tray buffer adjustment: penalize singles if tray pressure is high
    const trayLen = state.tray.length;
    const trayBuffer = params.trayBuffer ?? 2;
    if (!isTrayMatch && !isPeekMatch) {
      if (trayLen >= (4 - trayBuffer)) {
        u -= 4.0;
      }
    }

    // Height and covered bonus
    let covered = 0;
    if (g.nb && g.nb.above) {
      for (let i = 0; i < g.nb.above.length; i++) {
        if (state.alive[i] && g.nb.above[i].includes(idx)) covered++;
      }
    }
    const z = (g.tiles[idx] && g.tiles[idx].z) || 0;
    u += 0.2 * covered + 0.1 * z;

    return u;
  });

  // Softmax
  const maxU = Math.max(...utilities);
  const exps = utilities.map(u => Math.exp((u - maxU) / Math.max(0.01, temperature)));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(e => e / sumExp);

  return legalMoves.map((m, i) => ({
    index: m.index,
    inspect: m.inspect,
    utility: utilities[i],
    probability: probs[i]
  }));
}

/**
 * Evaluates calibration metrics: Brier score, Log Loss, and Expected Calibration Error (ECE).
 */
function computeCalibrationMetrics(predictions) {
  if (!predictions || predictions.length === 0) {
    return { brierScore: null, logLoss: null, ece: null, bins: [] };
  }

  let totalBrier = 0;
  let totalLogLoss = 0;
  const numBins = 5;
  const bins = Array.from({ length: numBins }, () => ({ count: 0, sumProb: 0, sumCorrect: 0 }));

  for (const pred of predictions) {
    let targetProb = 0;
    let brierItem = 0;

    for (const ap of pred.actionProbabilities) {
      const actual = ap.index === pred.targetIndex ? 1 : 0;
      brierItem += Math.pow(ap.probability - actual, 2);
      if (actual === 1) targetProb = ap.probability;

      const binIdx = Math.min(numBins - 1, Math.floor(ap.probability * numBins));
      bins[binIdx].count++;
      bins[binIdx].sumProb += ap.probability;
      bins[binIdx].sumCorrect += actual;
    }

    totalBrier += brierItem;
    totalLogLoss += -Math.log(Math.max(1e-12, targetProb));
  }

  const N = predictions.length;
  const meanBrier = totalBrier / N;
  const meanLogLoss = totalLogLoss / N;

  let totalEvalEntries = 0;
  let weightedECE = 0;
  const binResults = bins.map((b, idx) => {
    totalEvalEntries += b.count;
    const avgConfidence = b.count > 0 ? b.sumProb / b.count : (idx + 0.5) / numBins;
    const accuracy = b.count > 0 ? b.sumCorrect / b.count : 0;
    const gap = Math.abs(avgConfidence - accuracy);
    return {
      binRange: `[${(idx / numBins).toFixed(1)}, ${((idx + 1) / numBins).toFixed(1)})`,
      samples: b.count,
      avgConfidence: +(avgConfidence.toFixed(4)),
      accuracy: +(accuracy.toFixed(4)),
      gap: +(gap.toFixed(4))
    };
  });

  for (let idx = 0; idx < numBins; idx++) {
    const b = bins[idx];
    if (b.count > 0 && totalEvalEntries > 0) {
      const avgConfidence = b.sumProb / b.count;
      const accuracy = b.sumCorrect / b.count;
      weightedECE += (b.count / totalEvalEntries) * Math.abs(avgConfidence - accuracy);
    }
  }

  return {
    sampleCount: N,
    brierScore: +(meanBrier.toFixed(4)),
    logLoss: +(meanLogLoss.toFixed(4)),
    ece: +(weightedECE.toFixed(4)),
    bins: binResults
  };
}

/**
 * Reconstructs decisions and evaluates complete games on held-out chronological blocks.
 */
function evaluatePlayerCompleteGames(playerName, options = {}) {
  const maxGames = options.maxGames || 5;
  const allGames = gamesOf(playerName).sort((a, b) => a.t - b.t);
  const splitIndex = Math.floor(allGames.length * 0.70);
  const trainGames = allGames.slice(0, splitIndex);
  const testCutoff = trainGames.length ? trainGames[trainGames.length - 1].t : Infinity;

  // 1. Behavioral calibrations: Recency-weighted vs Rolling-window vs Change-point vs Static
  const recencyCalib = calibratePlayer(playerName, testCutoff, 20);

  // Rolling window calibration (last 20 games of training set) with explicit windowStartTime
  const windowSize = 20;
  const windowStart = Math.max(0, trainGames.length - windowSize);
  const windowGames = trainGames.slice(windowStart);
  const windowCutoff = windowGames.length ? windowGames[windowGames.length - 1].t + 1 : testCutoff;
  const windowStartTime = windowGames.length ? windowGames[0].t : 0;
  const rollingCalib = windowGames.length >= 5
    ? calibratePlayer(playerName, windowCutoff, 1e9, windowStartTime)
    : recencyCalib;

  // Change-point calibration: detects regime change in training sequence
  const cp = detectChangePoint(trainGames);
  const changePointCalib = cp.regimeSize >= 5
    ? calibratePlayer(playerName, testCutoff, 1e9, cp.changePointTime)
    : recencyCalib;

  // Static calibration (infinite half-life = uniform weights over full training history)
  const staticCalib = calibratePlayer(playerName, testCutoff, 1e9, 0);

  // Alternative personal bot model (defensive/conservative variant)
  const altPersonalParams = {
    depth: 12,
    trayBuffer: recencyCalib.parameters.trayBuffer === 1 ? 2 : 3,
    clockPatience: 0.9
  };

  // 2. Evaluate held-out chronological test games
  const testGames = allGames.slice(splitIndex).slice(0, maxGames);

  let personalTop1 = 0;
  let referenceTop1 = 0;
  let simpleGreedyTop1 = 0;
  let randomExpectedTop1 = 0;
  let altPersonalTop1 = 0;
  let totalEvaluatedDecisions = 0;

  let humanInspections = 0;
  let botInspections = 0;
  let humanReinspections = 0;
  let botReinspections = 0;

  let humanClockConeMoves = 0;
  let botClockConeMoves = 0;
  let totalClockMoves = 0;
  let humanClockAbandonmentMoves = 0;
  let botClockAbandonmentMoves = 0;
  let clockPressureOpportunities = 0;

  let humanKeyMoves = 0;
  let botKeyMoves = 0;
  let totalKeyMoves = 0;
  let keyPressureOpportunities = 0;
  let humanKeyAbandonmentMoves = 0;
  let botKeyAbandonmentMoves = 0;

  let humanRiskySingles = 0;
  let botRiskySingles = 0;
  let totalTrayPressureOpportunities = 0;

  // Timing tracking
  let totalRecordedTapIntervals = 0;
  let totalTapTimeElapsedMs = 0;
  let fastDecisionsUnder2s = 0;
  let deliberateDecisionsOver5s = 0;

  // Route / retry change tracking across attempts on the same board
  const boardAttemptHistory = new Map();
  let totalRetriesObserved = 0;
  let humanRouteChanges = 0;
  let botRouteChanges = 0;

  const humanTrayCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const botTrayCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let botTotalSteps = 0;

  const calibrationPredictions = [];
  const perGameRecords = [];

  for (const game of testGames) {
    const g = game.g;
    const publicGeometry = { tiles: g.tiles, nb: g.nb, rules: g.rules, clock: g.clock };
    const bId = boardId(g);
    const pId = publicBoardId(g);

    let session;
    try {
      session = createSession(g);
    } catch (e) {
      continue;
    }

    const memory = createObservedMemory({
      size: g.tiles.length,
      campaign: 'g3_eval_' + playerName,
      board: 'board_' + game.key,
      seed: 42,
      retryRetention: recencyCalib.parameters.retryLearning,
      decay: recencyCalib.parameters.memoryDecay
    });
    memory.beginAttempt({ campaign: 'g3_eval_' + playerName, board: 'board_' + game.key, size: g.tiles.length, attempt: 1 });

    const ev = { kind: 'g3-observer', sha256: '0'.repeat(64) };
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

    const seenInspected = new Set();
    const botSeenInspected = new Set();
    let gamePersonalTop1 = 0;
    let gameTotal = 0;
    const humanOpeningMoves = [];
    const botOpeningMoves = [];

    // Track game duration and pace
    const gameDurationMs = Math.max(0, (game.availableAt || 0) - (game.t || 0));
    const tapsInGame = game.take.length;
    const avgTapMs = tapsInGame > 0 && gameDurationMs > 0 ? gameDurationMs / tapsInGame : 1500;

    for (let s = 0; s < game.take.length; s++) {
      const tap = game.take[s];
      let actionIndex;
      let isInspection = false;

      if (tap < 0) {
        actionIndex = -(tap + 1);
        if (actionIndex === lastPeek && frame.state.openPeek === actionIndex) continue;
        lastPeek = actionIndex;
        isInspection = true;
      } else {
        actionIndex = tap;
        lastPeek = -1;
        isInspection = false;
      }

      if (!frame.legalTiles || !frame.legalTiles.includes(actionIndex)) break;

      if (humanOpeningMoves.length < 3) humanOpeningMoves.push(actionIndex);

      // Timing tracking
      totalRecordedTapIntervals++;
      totalTapTimeElapsedMs += avgTapMs;
      if (avgTapMs < 2000) fastDecisionsUnder2s++;
      else if (avgTapMs >= 5000) deliberateDecisionsOver5s++;

      const trayLen = frame.state.tray.length;
      if (trayLen <= 3) humanTrayCounts[trayLen] = (humanTrayCounts[trayLen] || 0) + 1;

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

      // 1. Personal Bot choice
      const personalChoice = search(publicGeometry, searchState, legalMoves, {
        depth: recencyCalib.parameters.depth,
        trayBuffer: recencyCalib.parameters.trayBuffer,
        clockPatience: recencyCalib.parameters.clockPatience
      });
      const pIndex = personalChoice?.path?.[0] ?? frame.legalTiles[0];
      if (botOpeningMoves.length < 3) botOpeningMoves.push(pIndex);

      // 2. Reference Bot choice (depth 16, trayBuffer 2, clockPatience 0.5)
      const refChoice = search(publicGeometry, searchState, legalMoves, {
        depth: 16, trayBuffer: 2, clockPatience: 0.5
      });
      const rIndex = refChoice?.path?.[0] ?? frame.legalTiles[0];

      // 3. Simple Greedy baseline (match immediate tray, else peek match, else first legal)
      let greedyIndex = frame.legalTiles[0];
      for (const idx of frame.legalTiles) {
        const pic = observed.pictures[idx];
        if (pic !== null && frame.state.tray.includes(pic)) { greedyIndex = idx; break; }
        if (frame.state.openPeek >= 0 && pic !== null && pic === observed.pictures[frame.state.openPeek]) { greedyIndex = idx; break; }
      }

      // 4. Alternative Personal Model choice (defensive variant)
      const altChoice = search(publicGeometry, searchState, legalMoves, altPersonalParams);
      const aIndex = altChoice?.path?.[0] ?? frame.legalTiles[0];

      // 5. Action probability distribution & calibration
      const actionProbs = computeActionProbabilities(publicGeometry, searchState, legalMoves, recencyCalib.parameters);
      calibrationPredictions.push({
        actionProbabilities: actionProbs,
        targetIndex: actionIndex
      });

      // Top-1 tracking
      if (pIndex === actionIndex) { personalTop1++; gamePersonalTop1++; }
      if (rIndex === actionIndex) referenceTop1++;
      if (greedyIndex === actionIndex) simpleGreedyTop1++;
      if (aIndex === actionIndex) altPersonalTop1++;
      randomExpectedTop1 += 1.0 / frame.legalTiles.length;
      totalEvaluatedDecisions++;
      gameTotal++;

      // Inspection tracking
      const botChoiceIsInspect = !!frame.state.down[pIndex] && frame.state.openPeek !== pIndex;
      if (isInspection) {
        humanInspections++;
        if (seenInspected.has(actionIndex)) humanReinspections++;
        seenInspected.add(actionIndex);
      }
      if (botChoiceIsInspect) {
        botInspections++;
        if (botSeenInspected.has(pIndex)) botReinspections++;
        botSeenInspected.add(pIndex);
      }

      // Clock preparation & abandonment tracking
      const hasActiveClock = !!(g.clock && frame.state.alive[g.clock.i]);
      if (hasActiveClock) {
        totalClockMoves++;
        const cone = new Set([g.clock.i]);
        const stack = [g.clock.i];
        while (stack.length) {
          const cur = stack.pop();
          const above = (g.nb && g.nb.above && g.nb.above[cur]) || [];
          for (const a of above) {
            if (frame.state.alive[a] && !cone.has(a)) { cone.add(a); stack.push(a); }
          }
        }
        if (cone.has(actionIndex)) humanClockConeMoves++;
        if (cone.has(pIndex)) botClockConeMoves++;

        if (trayLen >= 2) {
          clockPressureOpportunities++;
          if (!cone.has(actionIndex)) humanClockAbandonmentMoves++;
          if (!cone.has(pIndex)) botClockAbandonmentMoves++;
        }
      }

      // Key / lock preparation tracking
      const hasKeys = !!(g.rules && g.rules.keys && g.rules.keys.length > 0);
      if (hasKeys) {
        const keyIndices = g.rules.keys.filter(k => frame.state.alive[k]);
        if (keyIndices.length > 0) {
          totalKeyMoves++;
          const keyCone = new Set(keyIndices);
          const stack = [...keyIndices];
          while (stack.length) {
            const cur = stack.pop();
            const above = (g.nb && g.nb.above && g.nb.above[cur]) || [];
            for (const a of above) {
              if (frame.state.alive[a] && !keyCone.has(a)) { keyCone.add(a); stack.push(a); }
            }
          }
          if (keyCone.has(actionIndex)) humanKeyMoves++;
          if (keyCone.has(pIndex)) botKeyMoves++;
          if (trayLen >= 2) {
            keyPressureOpportunities++;
            if (!keyCone.has(actionIndex)) humanKeyAbandonmentMoves++;
            if (!keyCone.has(pIndex)) botKeyAbandonmentMoves++;
          }
        }
      }

      // Risk choice tracking: single additions when tray length is already 2 or 3
      if (trayLen >= 2) {
        totalTrayPressureOpportunities++;
        const pic = g.faces[actionIndex];
        const isMatch = frame.state.tray.includes(pic) || (frame.state.openPeek >= 0 && g.faces[frame.state.openPeek] === pic);
        if (!isMatch && !isInspection) humanRiskySingles++;

        const botPic = g.faces[pIndex];
        const isBotMatch = frame.state.tray.includes(botPic) || (frame.state.openPeek >= 0 && g.faces[frame.state.openPeek] === botPic);
        if (!isBotMatch && !botChoiceIsInspect) botRiskySingles++;
      }

      // Execute human tap
      try {
        frame = session.tap(actionIndex);
        if (frame.type === 'productionPhysicalEnd-v1') break;
        observed = memory.observe(getObs(frame));
      } catch (e) {
        break;
      }
    }

    // Route / retry change comparison
    const priorAttempts = boardAttemptHistory.get(bId);
    if (priorAttempts && priorAttempts.humanOpening.length >= 2 && humanOpeningMoves.length >= 2) {
      totalRetriesObserved++;
      const humanDiverged = humanOpeningMoves.some((m, i) => m !== priorAttempts.humanOpening[i]);
      if (humanDiverged) humanRouteChanges++;
      const botDiverged = botOpeningMoves.some((m, i) => m !== priorAttempts.botOpening[i]);
      if (botDiverged) botRouteChanges++;
    }
    boardAttemptHistory.set(bId, { humanOpening: humanOpeningMoves, botOpening: botOpeningMoves });

    perGameRecords.push({
      aid: game.aid,
      lv: game.lv,
      boardId: bId,
      publicBoardId: pId,
      openedAt: game.t,
      availableAt: game.availableAt,
      completedAt: game.availableAt,
      evaluatedDecisions: gameTotal,
      personalTop1Acc: gameTotal > 0 ? +(gamePersonalTop1 / gameTotal).toFixed(3) : 0
    });

    // Also run simulated bot rollouts for this game to gather bot tray distribution
    let botSession;
    try { botSession = createSession(g); } catch (e) { continue; }
    const botMemory = createObservedMemory({
      size: g.tiles.length,
      campaign: 'g3_bot_' + playerName,
      board: 'board_' + game.key,
      seed: 99,
      retryRetention: recencyCalib.parameters.retryLearning,
      decay: recencyCalib.parameters.memoryDecay
    });
    botMemory.beginAttempt({ campaign: 'g3_bot_' + playerName, board: 'board_' + game.key, size: g.tiles.length, attempt: 1 });
    let bFrame = botSession.view();
    let bObserved = botMemory.observe(getObs(bFrame));

    while (bFrame.type !== 'productionPhysicalEnd-v1' && botTotalSteps < totalEvaluatedDecisions) {
      const tLen = bFrame.state.tray.length;
      if (tLen <= 3) botTrayCounts[tLen] = (botTrayCounts[tLen] || 0) + 1;
      botTotalSteps++;

      const bLegalMoves = bFrame.legalTiles.map(index => ({
        index,
        inspect: !!bFrame.state.down[index] && bFrame.state.openPeek !== index
      }));

      const bSearchState = {
        pictures: bObserved.pictures,
        down: bFrame.state.down,
        alive: bFrame.state.alive,
        tray: bFrame.state.tray,
        moves: bFrame.state.moves,
        openPeek: bFrame.state.openPeek,
        relieved: bFrame.state.relieved,
        arriving: bFrame.state.arriving
      };

      const plan = search(publicGeometry, bSearchState, bLegalMoves, {
        depth: recencyCalib.parameters.depth,
        trayBuffer: recencyCalib.parameters.trayBuffer,
        clockPatience: recencyCalib.parameters.clockPatience
      });
      const nextTile = plan?.path?.[0] ?? bFrame.legalTiles[0];
      bFrame = botSession.tap(nextTile);
      if (bFrame.type !== 'productionPhysicalEnd-v1') {
        bObserved = botMemory.observe(getObs(bFrame));
      }
    }
  }

  // Calibration metrics
  const calibMetrics = computeCalibrationMetrics(calibrationPredictions);

  // Tray metrics via independent_tray_metrics
  const trayMetrics = compareTrayCounts(humanTrayCounts, botTrayCounts);

  // Model comparison table
  const modelComparisons = {
    personalBot: {
      top1Accuracy: +(personalTop1 / Math.max(1, totalEvaluatedDecisions)).toFixed(3),
      parameters: recencyCalib.parameters
    },
    genericReferenceBot: {
      top1Accuracy: +(referenceTop1 / Math.max(1, totalEvaluatedDecisions)).toFixed(3),
      parameters: { depth: 16, trayBuffer: 2, clockPatience: 0.5 }
    },
    simpleGreedyBaseline: {
      top1Accuracy: +(simpleGreedyTop1 / Math.max(1, totalEvaluatedDecisions)).toFixed(3)
    },
    randomBaseline: {
      expectedTop1Accuracy: +(randomExpectedTop1 / Math.max(1, totalEvaluatedDecisions)).toFixed(3)
    },
    alternativePersonalModel: {
      name: 'defensivePersonalVariant',
      top1Accuracy: +(altPersonalTop1 / Math.max(1, totalEvaluatedDecisions)).toFixed(3),
      parameters: altPersonalParams
    }
  };

  // Adaptation comparison table
  const adaptationComparison = {
    recencyWeighted: {
      halfLife: 20,
      parameters: recencyCalib.parameters
    },
    rollingWindow: {
      windowSize: windowGames.length,
      windowStartTime,
      parameters: rollingCalib.parameters
    },
    changePoint: {
      changePointGameIndex: cp.changePointIndex,
      changePointTime: cp.changePointTime,
      regimeSize: cp.regimeSize,
      parameters: changePointCalib.parameters
    },
    staticHistorical: {
      parameters: staticCalib.parameters
    }
  };

  return {
    playerName,
    evaluatedCompleteGames: testGames.length,
    evaluatedDecisions: totalEvaluatedDecisions,
    provenance: {
      trainCutoff: testCutoff,
      games: perGameRecords
    },
    modelComparisons,
    adaptationComparison,
    actionProbabilityCalibration: calibMetrics,
    inspectionBehavior: {
      humanInspectionRate: +(humanInspections / Math.max(1, totalEvaluatedDecisions)).toFixed(3),
      botInspectionRate: +(botInspections / Math.max(1, totalEvaluatedDecisions)).toFixed(3),
      humanReinspectionRate: +(humanReinspections / Math.max(1, humanInspections)).toFixed(3),
      botReinspectionRate: +(botReinspections / Math.max(1, botInspections)).toFixed(3)
    },
    clockBehavior: {
      totalClockMoves,
      humanClockConeRatio: totalClockMoves > 0 ? +(humanClockConeMoves / totalClockMoves).toFixed(3) : null,
      botClockConeRatio: totalClockMoves > 0 ? +(botClockConeMoves / totalClockMoves).toFixed(3) : null,
      humanAbandonmentUnderPressureRate: clockPressureOpportunities > 0 ? +(humanClockAbandonmentMoves / clockPressureOpportunities).toFixed(3) : null,
      botAbandonmentUnderPressureRate: clockPressureOpportunities > 0 ? +(botClockAbandonmentMoves / clockPressureOpportunities).toFixed(3) : null
    },
    keyBehavior: {
      totalKeyMoves,
      humanKeyConeRatio: totalKeyMoves > 0 ? +(humanKeyMoves / totalKeyMoves).toFixed(3) : null,
      botKeyConeRatio: totalKeyMoves > 0 ? +(botKeyMoves / totalKeyMoves).toFixed(3) : null,
      humanAbandonmentUnderPressureRate: keyPressureOpportunities > 0 ? +(humanKeyAbandonmentMoves / keyPressureOpportunities).toFixed(3) : null,
      botAbandonmentUnderPressureRate: keyPressureOpportunities > 0 ? +(botKeyAbandonmentMoves / keyPressureOpportunities).toFixed(3) : null
    },
    routeRetryBehavior: {
      totalRetriesObserved,
      humanRouteDivergenceRate: totalRetriesObserved > 0 ? +(humanRouteChanges / totalRetriesObserved).toFixed(3) : 0,
      botRouteDivergenceRate: totalRetriesObserved > 0 ? +(botRouteChanges / totalRetriesObserved).toFixed(3) : 0
    },
    riskBehavior: {
      totalPressureOpportunities: totalTrayPressureOpportunities,
      humanRiskySingleAdditionRate: totalTrayPressureOpportunities > 0 ? +(humanRiskySingles / totalTrayPressureOpportunities).toFixed(3) : 0,
      botRiskySingleAdditionRate: totalTrayPressureOpportunities > 0 ? +(botRiskySingles / totalTrayPressureOpportunities).toFixed(3) : 0
    },
    timingBehavior: {
      totalRecordedTapIntervals,
      meanDecisionLatencyMs: totalRecordedTapIntervals > 0 ? Math.round(totalTapTimeElapsedMs / totalRecordedTapIntervals) : 0,
      fastDecisionRatio: totalRecordedTapIntervals > 0 ? +(fastDecisionsUnder2s / totalRecordedTapIntervals).toFixed(3) : 0,
      deliberateDecisionRatio: totalRecordedTapIntervals > 0 ? +(deliberateDecisionsOver5s / totalRecordedTapIntervals).toFixed(3) : 0
    },
    trayMetrics: {
      humanTrayCounts,
      botTrayCounts,
      totalVariationDistance: trayMetrics.totalVariationDistance,
      wassersteinDistance: trayMetrics.wassersteinDistance,
      status: 'ARITHMETIC_VERIFIED_EQUIVALENCE_UNVERIFIED'
    }
  };
}

/**
 * Runs complete behavioral evaluation across all 4 players.
 */
function evaluateAllPlayersG3(options = {}) {
  const report = {
    evaluatedAt: new Date().toISOString(),
    evaluationType: 'G3-behavioral-policy-and-calibration-chronological-blocks',
    players: {}
  };

  for (const name of NAMES) {
    report.players[name] = evaluatePlayerCompleteGames(name, options);
  }

  return report;
}

module.exports = {
  detectChangePoint,
  computeActionProbabilities,
  computeCalibrationMetrics,
  evaluatePlayerCompleteGames,
  evaluateAllPlayersG3
};

if (require.main === module) {
  const result = evaluateAllPlayersG3({ maxGames: 3 });
  console.log(JSON.stringify(result, null, 2));
}
