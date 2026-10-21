'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const Layouts = require('../../../www/layouts.js');
const { createSession } = require('./production_physical_session.js');
const { createObservedMemory } = require('./personal_observed_memory.js');
const { search } = require('./public_witness_search.js');
const { calibratePlayer } = require('./personal_behavioral_calibration.js');
const { boardId, publicBoardId } = require('./personal_model.js');

/**
 * Simulates a player's multi-attempt campaign on a Mahjong board using their calibrated behavioral bot.
 * 
 * Enforces:
 * 1. Production physical rules: transitions run strictly through compiled production Hard via createSession.
 * 2. Human-visible information only: zero inspection of hidden faces; public-belief search via public_witness_search.
 * 3. Exact observation boundary: face-up tiles visible only when exposed/uncovered; face-down tiles require physical inspection.
 * 4. Production clock mechanics: pure inspection costs 0 removal moves.
 * 5. Production tray overflow: tray >= 4 loses immediately.
 * 6. Production victory: requires empty board AND empty tray; loss or censoring returns wonOn = null.
 * 7. Legitimate cross-attempt learning: managed via createObservedMemory with exact board ID and campaign ID binding.
 * 8. Only an actual completed production physicalLoss permits another attempt; computation caps or partial prefixes do not become free retries.
 * 
 * @param {Object} game - Initial board layout { tiles, nb, faces, down, rules, clock }
 * @param {string} playerName - Player name (Dennis, Mrs. Doubtfire, PUK, Gerda)
 * @param {Object} [options={}] - Simulation options (maxAttempts, customParams, cutoffTime, seed, campaign)
 * @returns {Object} Simulation outcome { playerName, wonOn, cleared, totalAttempts, parameters, history }
 */
function simulatePersonalCampaign(game, playerName, options = {}) {
  const maxAttempts = options.maxAttempts || 8;
  const cutoffTime = options.cutoffTime || Infinity;
  const calibrated = calibratePlayer(playerName, cutoffTime);
  const params = { ...calibrated.parameters, ...(options.customParams || {}) };

  const size = game.tiles.length;
  // The policy receives geometry and public rules, never the private deal.
  const publicGeometry = { tiles: game.tiles, nb: game.nb, rules: game.rules, clock: game.clock };
  const board = boardId(game);
  const publicBoard = publicBoardId(game);
  const campaign = options.campaign || game.aid || 'camp_' + crypto.createHash('sha256').update(publicBoard).digest('hex').slice(0, 16);
  const baseSeed = options.seed ?? crypto.createHash('sha256').update([playerName, campaign, publicBoard].join('|')).digest().readUInt32LE(0);

  const memory = createObservedMemory({
    size,
    campaign,
    board,
    seed: baseSeed,
    retryRetention: params.retryLearning,
    decay: params.memoryDecay
  });

  const evidence = {
    kind: 'production-physical-simulation-observer',
    sha256: crypto.createHash('sha256').update([playerName, campaign, board].join('|')).digest('hex')
  };

  let wonOn = null;
  const attemptHistory = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    memory.beginAttempt({ campaign, board, size, attempt });
    const attemptSeed = (baseSeed + attempt * 10007) >>> 0;
    const sessionOptions = { seed: attemptSeed };
    if (options.choiceLimit !== undefined) sessionOptions.choiceLimit = options.choiceLimit;
    if (options.settleBefore !== undefined) sessionOptions.settleBefore = options.settleBefore;
    if (options.tapTimes !== undefined) sessionOptions.tapTimes = options.tapTimes;
    const session = createSession(game, sessionOptions);
    let frame = session.view();

    const getObservation = f => {
      const pictures = f.state.alive.map((alive, index) => {
        if (!alive) return null;
        if (index === f.state.openPeek) return game.faces[index];
        if (!game.down[index]) {
          const aboveList = (game.nb && game.nb.above && game.nb.above[index]) || [];
          if (aboveList.every(a => !f.state.alive[a])) return game.faces[index];
        }
        return null;
      });
      return {
        physicalTaps: f.state.physicalTaps,
        alive: f.state.alive,
        pictures,
        evidence: pictures.map(p => p !== null ? evidence : null)
      };
    };

    let observed = memory.observe(getObservation(frame));

    while (frame.type !== 'productionPhysicalEnd-v1') {
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
        arriving: frame.state.arriving
      };

      const searchOptions = {
        depth: params.depth,
        trayBuffer: params.trayBuffer,
        clockPatience: params.clockPatience,
        memoryDecay: params.memoryDecay,
        retryLearning: params.retryLearning
      };

      const plan = search(publicGeometry, searchState, legalMoves, searchOptions);
      const nextTile = plan?.path?.[0] ?? frame.legalTiles[0];

      frame = session.tap(nextTile);
      if (frame.type !== 'productionPhysicalEnd-v1') {
        observed = memory.observe(getObservation(frame));
      }
    }

    const end = memory.endAttempt(frame);
    attemptHistory.push({
      attempt,
      status: end.status,
      moves: frame.state.moves,
      physicalTaps: frame.state.physicalTaps,
      why: frame.why,
      win: frame.win
    });

    if (end.status === 'cleared') {
      wonOn = attempt;
      break;
    }

    if (end.status !== 'physicalLoss') {
      // Unresolved or calculation limit: cannot retry
      break;
    }
  }

  return {
    playerName,
    wonOn, // null if not cleared!
    cleared: wonOn !== null,
    totalAttempts: attemptHistory.length,
    parameters: params,
    history: attemptHistory
  };
}

module.exports = { simulatePersonalCampaign };
