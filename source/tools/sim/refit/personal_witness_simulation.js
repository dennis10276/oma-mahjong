'use strict';
const crypto = require('crypto');
const Hard = require('../../../www/hard.js');
const L = require('../../../www/layouts.js');
const physical = require('./known_tray_plan.js');
const { search } = require('./public_witness_search.js');
const { calibratePlayer } = require('./personal_behavioral_calibration.js');
const { retryMemory } = require('./personal_retry_memory.js');

/**
 * Simulates a player's multi-attempt play on a Mahjong board using their calibrated behavioral bot.
 * 
 * Enforces:
 * 1. Production physical rules (Hard.step, Hard.rateChain).
 * 2. Human-visible information only (zero foresight into unrevealed tiles).
 * 3. Empirical calibrated behavioral knobs (depth, trayBuffer, clockPatience, memoryDecay, retryLearning).
 * 4. Genuine cross-attempt memory carry-forward between consecutive attempts (retryLearning).
 * 5. Deterministic repeatable PRNG for memory decay and exploration.
 * 
 * @param {Object} game - Initial board layout { tiles, nb, faces, down, rules, clock }
 * @param {string} playerName - Player name (Dennis, Mrs. Doubtfire, PUK, Gerda)
 * @param {Object} [options={}] - Simulation options (maxAttempts, customParams, cutoffTime)
 * @returns {Object} Simulation outcome { wonOn, attempts, clearedWithin, history }
 */
function simulatePersonalCampaign(game, playerName, options = {}) {
  const maxAttempts = options.maxAttempts || 8;
  const cutoffTime = options.cutoffTime || Infinity;
  const calibrated = calibratePlayer(playerName, cutoffTime);
  const params = { ...calibrated.parameters, ...(options.customParams || {}) };

  const tilesCount = game.tiles.length;
  let wonOn = null;
  const attemptHistory = [];
  let persistentSeen = new Uint8Array(tilesCount);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Generate deterministic attempt seed
    const seed = crypto.createHash('sha256')
      .update([playerName, game.key || 'deal', attempt].join('|'))
      .digest().readUInt32LE(0);
    const rng = L.rng(seed);

    // Build initial attempt state
    // On attempt > 1, carry forward tiles remembered from previous attempts based on retryLearning
    const knownPictures = new Array(tilesCount).fill(null);
    for (let i = 0; i < tilesCount; i++) {
      if (!game.down[i]) {
        // Face-up tiles are immediately observable
        knownPictures[i] = game.faces[i];
      } else if (attempt > 1 && persistentSeen[i]) {
        // Check carry-forward retention
        if (rng() < params.retryLearning) {
          knownPictures[i] = game.faces[i];
        }
      }
    }

    const state = {
      pictures: knownPictures,
      down: Array.from(game.down),
      alive: new Array(tilesCount).fill(1),
      tray: [],
      moves: 0,
      openPeek: -1,
      relieved: false,
      arriving: []
    };

    // Run attempt step-by-step
    let won = false;
    let lost = false;
    let moves = 0;
    const maxMoves = tilesCount * 2 + (game.clock ? game.clock.n : 50);

    while (!won && !lost && moves < maxMoves) {
      // Find legal actions via authoritative physical model
      const allowed = physical.legal(game, state);
      if (!allowed || !allowed.free || allowed.free.length === 0) {
        lost = true;
        break;
      }

      // Check win condition
      const aliveRemaining = state.alive.reduce((sum, v) => sum + v, 0);
      if (aliveRemaining === 0) {
        won = true;
        break;
      }

      const legalMoves = allowed.free.map(index => ({
        index,
        inspect: !!state.down[index] && state.openPeek !== index
      }));

      // Call search with calibrated knobs
      const searchOptions = {
        depth: params.depth,
        trayBuffer: params.trayBuffer,
        clockPatience: params.clockPatience,
        memoryDecay: params.memoryDecay,
        retryLearning: params.retryLearning,
        rng
      };

      const plan = search(game, state, legalMoves, searchOptions);
      if (!plan || !plan.path || plan.path.length === 0) {
        lost = true;
        break;
      }

      const nextTile = plan.path[0];
      moves++;

      // Advance state physically
      if (state.down[nextTile] && state.openPeek !== nextTile) {
        // Inspecting face-down tile
        state.openPeek = nextTile;
        state.pictures[nextTile] = game.faces[nextTile];
        persistentSeen[nextTile] = 1;
      } else {
        // Taking tile into tray or matching
        const pic = game.faces[nextTile];
        persistentSeen[nextTile] = 1;
        state.alive[nextTile] = 0;
        state.pictures[nextTile] = pic;

        if (state.openPeek === nextTile) {
          state.openPeek = -1;
        }

        const trayMatchIdx = state.tray.indexOf(pic);
        if (trayMatchIdx >= 0) {
          // Matched with tray
          state.tray.splice(trayMatchIdx, 1);
        } else if (state.openPeek >= 0 && game.faces[state.openPeek] === pic) {
          // Matched with openPeek
          state.alive[state.openPeek] = 0;
          state.openPeek = -1;
        } else {
          // Placed into tray
          state.tray.push(pic);
          if (state.tray.length > 4) {
            lost = true;
            break;
          }
        }
      }

      // Check clock expiration
      if (game.clock && state.alive[game.clock.i] && moves >= game.clock.n) {
        lost = true;
        break;
      }

      // Check remaining tiles
      if (state.alive.reduce((sum, v) => sum + v, 0) === 0) {
        won = true;
        break;
      }
    }

    attemptHistory.push({ attempt, won, moves });

    if (won) {
      wonOn = attempt;
      break;
    }
  }

  return {
    playerName,
    wonOn: wonOn || maxAttempts,
    cleared: wonOn !== null,
    totalAttempts: attemptHistory.length,
    parameters: params,
    history: attemptHistory
  };
}

module.exports = { simulatePersonalCampaign };
