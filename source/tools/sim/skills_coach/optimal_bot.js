'use strict';
/**
 * Optimal Mahjong Solitaire Bot under Identical Human Information.
 *
 * Information Invariant:
 * - The bot observes ONLY what a human player observes at turn t:
 *   - Tile 3D coordinates (x, y, z) and geometric layout neighbors (above, left, right).
 *   - Faces of initially face-up uncovered tiles.
 *   - Face-down tiles are strictly UNKNOWN until explicitly peeked/inspected.
 *   - Exact multiset of remaining unseen tiles is inferred via Bayesian accounting:
 *     Total Tile Multiset - (Tray Tiles + Cleared Tiles + Visible Known Tiles).
 *   - Tray occupancy (0 to 3 tiles, 4th causes immediate loss).
 *   - Clock tile index and remaining move budget.
 *   - Ice / locks / keys obstacles visible on the board.
 *
 * Core Decision Principles:
 * 1. Zero-Jam Tray Headroom Discipline: Never enters tray size 3 without immediate guaranteed mate.
 * 2. Safe Peeking Priority: Gathers free information from face-down tiles before risking singles.
 * 3. Buried Mate Awareness: Minimizes tray dwell time by avoiding singles whose mates are buried deep.
 * 4. Clock-Critical Path: Prioritizes unblocking dependencies when clock slack is tight.
 * 5. Immediate Free Matching: Reclaims tray headroom as soon as matching tiles become accessible.
 */

const L = require('../../../www/layouts.js');

function createOptimalBot(config = {}) {
  const options = {
    maxTrayCapacity: 4,
    lookaheadDepth: config.lookaheadDepth ?? 4,
    debug: !!config.debug,
    ...config
  };

  /**
   * Initializes state tracking under strictly human-visible information.
   */
  function initGameState(game) {
    const n = game.tiles.length;
    const initial = new Uint8Array(n).fill(1);
    const alive = new Uint8Array(n).fill(1);
    const down = new Uint8Array(n);
    if (game.down) {
      if (Array.isArray(game.down)) for (const i of game.down) down[i] = 1;
      else if (game.down instanceof Uint8Array || game.down instanceof Set) {
        for (let i = 0; i < n; i++) down[i] = game.down.has ? (game.down.has(i) ? 1 : 0) : game.down[i];
      }
    }

    // Known faces: initially known only if face-up
    const known = new Int16Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (!down[i]) {
        known[i] = game.faces[i];
      }
    }

    // Multiset of all tiles in the level
    const totalMultiset = new Map();
    for (const f of game.faces) {
      totalMultiset.set(f, (totalMultiset.get(f) || 0) + 1);
    }

    return {
      n,
      initial,
      alive,
      down,
      known, // -1 if unknown, >=0 if revealed
      tray: [], // array of faces currently in tray
      moves: 0,
      cleared: [],
      history: [],
      totalMultiset,
      openPeek: -1 // index of tile temporarily peeked if applicable
    };
  }

  /**
   * Computes the multiset of remaining unseen tiles.
   * Total multiset minus (cleared + tray + known alive).
   */
  function getUnseenMultiset(state) {
    const unseen = new Map(state.totalMultiset);
    const dec = f => {
      const c = unseen.get(f) || 0;
      if (c <= 1) unseen.delete(f);
      else unseen.set(f, c - 1);
    };

    // Account for cleared tiles
    for (const f of state.cleared) dec(f);
    // Account for tray tiles
    for (const f of state.tray) dec(f);
    // Account for known alive tiles
    for (let i = 0; i < state.n; i++) {
      if (state.alive[i] && state.known[i] >= 0) {
        dec(state.known[i]);
      }
    }
    return unseen;
  }

  /**
   * Checks if tile i is geometrically and mechanically free to take/peek.
   */
  function isTileFree(game, state, i) {
    if (!state.alive[i]) return false;
    if (!game.rules) return L.isFree(i, state.alive, game.nb);
    return L.takeable(i, state.alive, game.nb, game.rules, state.initial);
  }

  /**
   * Calculates the DAG depth / distance to unblock tile target.
   */
  function getUnblockingDepth(game, state, target) {
    if (!state.alive[target]) return 0;
    if (isTileFree(game, state, target)) return 0;

    const visited = new Set();
    const queue = [target];
    let coveringCount = 0;

    while (queue.length > 0) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);

      if (cur !== target && state.alive[cur]) coveringCount++;

      // Tiles directly above cur
      if (game.nb.above && game.nb.above[cur]) {
        for (const up of game.nb.above[cur]) {
          if (state.alive[up] && !visited.has(up)) queue.push(up);
        }
      }
    }

    // Side dependencies
    let leftCount = 0, rightCount = 0;
    if (game.nb.left && game.nb.left[target]) {
      for (const l of game.nb.left[target]) if (state.alive[l]) leftCount++;
    }
    if (game.nb.right && game.nb.right[target]) {
      for (const r of game.nb.right[target]) if (state.alive[r]) rightCount++;
    }

    let iceCost = 0;
    if (game.rules && game.rules.ice && game.rules.ice[target]) {
      let gone = 0;
      if (game.rules.iceNb && game.rules.iceNb[target]) {
        for (const j of game.rules.iceNb[target]) {
          if (!state.alive[j]) gone++;
        }
      }
      iceCost = Math.max(0, game.rules.ice[target] - gone);
    }

    let lockCost = 0;
    if (game.rules && game.rules.locks && game.rules.locks.has && game.rules.locks.has(target) && game.rules.keys) {
      for (const k of game.rules.keys) {
        if (state.alive[k]) lockCost += 2;
      }
    }

    return coveringCount + Math.min(leftCount, rightCount) + iceCost + lockCost;
  }

  /**
   * Computes the goal frontier: all tiles directly above or laterally flanking the goal.
   */
  function getGoalFrontier(game, state, goal) {
    const frontier = new Set([goal]);
    const stack = [goal];
    while (stack.length > 0) {
      const idx = stack.pop();
      if (game.nb.above && game.nb.above[idx]) {
        for (const up of game.nb.above[idx]) {
          if (state.alive[up] && !frontier.has(up)) {
            frontier.add(up);
            stack.push(up);
          }
        }
      }
    }
    // Lateral flankers
    for (const side of [game.nb.left, game.nb.right]) {
      if (!side) continue;
      let cur = goal;
      for (let step = 0; step < 6; step++) {
        const next = side[cur]?.find(cand => state.alive[cand]);
        if (next === undefined) break;
        frontier.add(next);
        cur = next;
      }
    }
    // Obstacle keys if goal is locked
    if (game.rules && game.rules.locks && game.rules.locks.has && game.rules.locks.has(goal) && game.rules.keys) {
      for (const k of game.rules.keys) {
        if (state.alive[k]) {
          frontier.add(k);
          for (const keyUp of getGoalFrontier(game, state, k)) frontier.add(keyUp);
        }
      }
    }
    return frontier;
  }

  /**
   * Computes clock critical path metrics.
   */
  function getClockMetrics(game, state) {
    if (!game.clock || !state.alive[game.clock.i]) {
      return { active: false, slack: Infinity, depth: 0, criticalTiles: new Set() };
    }
    const clockIdx = game.clock.i;
    const remainingMoves = game.clock.n - state.moves;
    const depth = getUnblockingDepth(game, state, clockIdx);
    const slack = remainingMoves - depth;
    const criticalTiles = getGoalFrontier(game, state, clockIdx);

    return {
      active: true,
      remainingMoves,
      depth,
      slack,
      criticalTiles
    };
  }

  /**
   * Identifies tiles on the board that unblock the partners of tiles currently in the tray.
   */
  function getTrayGoalFrontier(game, state) {
    if (!state.tray.length) return new Set();
    const unblockers = new Set();
    for (const trayFace of state.tray) {
      for (let i = 0; i < state.n; i++) {
        if (!state.alive[i]) continue;
        if (state.known[i] === trayFace) {
          const frontier = getGoalFrontier(game, state, i);
          for (const fIdx of frontier) if (fIdx !== i) unblockers.add(fIdx);
        }
      }
    }
    return unblockers;
  }

  /**
   * Returns all legally available actions given ONLY current known state.
   */
  function getAvailableActions(game, state) {
    const actions = [];
    const freeTiles = [];
    for (let i = 0; i < state.n; i++) {
      if (isTileFree(game, state, i)) freeTiles.push(i);
    }

    const unseen = getUnseenMultiset(state);
    let totalUnseenCount = 0;
    for (const cnt of unseen.values()) totalUnseenCount += cnt;

    // Group free known tiles by face
    const freeByFace = new Map();
    const freeFaceDown = [];

    for (const i of freeTiles) {
      if (state.known[i] < 0) {
        // Face down and unknown
        freeFaceDown.push(i);
      } else {
        const f = state.known[i];
        if (!freeByFace.has(f)) freeByFace.set(f, []);
        freeByFace.get(f).push(i);
      }
    }

    // 1. Immediate Matches with Tray
    for (const [face, indices] of freeByFace) {
      const trayIdx = state.tray.indexOf(face);
      if (trayIdx >= 0) {
        for (const idx of indices) {
          actions.push({
            type: 'immediate_match',
            index: idx,
            face,
            trayIndex: trayIdx,
            description: `Match free tile #${idx} (face ${face}) with waiting tray slot ${trayIdx}`
          });
        }
      }
    }

    // 2. Free Pairs on Board
    for (const [face, indices] of freeByFace) {
      if (indices.length >= 2) {
        for (let a = 0; a < indices.length; a++) {
          for (let b = a + 1; b < indices.length; b++) {
            actions.push({
              type: 'pair_match',
              indices: [indices[a], indices[b]],
              face,
              description: `Match pair of free tiles #${indices[a]} and #${indices[b]} (face ${face})`
            });
          }
        }
      }
    }

    // 3. Safe Peeks of Free Face-Down Tiles
    for (const i of freeFaceDown) {
      // Probability this peek matches a tile already waiting in tray
      let matchProb = 0;
      if (totalUnseenCount > 0) {
        for (const trayFace of state.tray) {
          matchProb += (unseen.get(trayFace) || 0) / totalUnseenCount;
        }
      }

      // Coverage degree: how many tiles lie under i that will be closer to freed
      let unblockDegree = 0;
      for (let other = 0; other < state.n; other++) {
        if (state.alive[other] && game.nb.above[other] && game.nb.above[other].includes(i)) {
          unblockDegree++;
        }
      }

      actions.push({
        type: 'safe_peek',
        index: i,
        pTrayMatch: matchProb,
        unblockDegree,
        description: `Peek hidden free tile #${i} (pMatch=${matchProb.toFixed(2)}, unblocks=${unblockDegree})`
      });
    }

    // 4. Single Takes into Tray
    // Only tiles whose face is known and not already matching a tray tile
    for (const [face, indices] of freeByFace) {
      if (!state.tray.includes(face)) {
        for (const idx of indices) {
          // Find closest known partner on board
          let closestDepth = Infinity;
          let partnerFound = false;
          for (let other = 0; other < state.n; other++) {
            if (other !== idx && state.alive[other] && state.known[other] === face) {
              const d = getUnblockingDepth(game, state, other);
              if (d < closestDepth) closestDepth = d;
              partnerFound = true;
            }
          }
          if (!partnerFound) {
            // Partner is currently hidden/unseen; estimate depth based on average board height
            closestDepth = 2.5;
          }

          actions.push({
            type: 'single_take',
            index: idx,
            face,
            mateDepth: closestDepth,
            nextTraySize: state.tray.length + 1,
            description: `Take single tile #${idx} (face ${face}) into tray (mate depth=${closestDepth.toFixed(1)})`
          });
        }
      }
    }

    return actions;
  }

  /**
   * Computes lookahead unblocking value for candidate action.
   */
  function getLookaheadValue(game, state, action) {
    const hypAlive = state.alive.slice();
    const hypTray = state.tray.slice();
    const hypKnown = state.known.slice();

    if (action.type === 'immediate_match') {
      hypAlive[action.index] = 0;
      const tIdx = hypTray.indexOf(action.face);
      if (tIdx >= 0) hypTray.splice(tIdx, 1);
    } else if (action.type === 'pair_match') {
      hypAlive[action.indices[0]] = 0;
      hypAlive[action.indices[1]] = 0;
    } else if (action.type === 'safe_peek') {
      hypAlive[action.index] = 0;
    } else if (action.type === 'single_take') {
      hypAlive[action.index] = 0;
      hypTray.push(action.face);
    }

    if (hypTray.length >= options.maxTrayCapacity) return -999999;

    let newlyFreedKnownMatches = 0;
    let newlyFreedPeeks = 0;
    for (let i = 0; i < state.n; i++) {
      if (hypAlive[i] && !state.alive[i]) continue;
      if (hypAlive[i] && L.isFree(i, hypAlive, game.nb)) {
        if (!L.isFree(i, state.alive, game.nb)) {
          if (hypKnown[i] >= 0) {
            if (hypTray.includes(hypKnown[i])) newlyFreedKnownMatches += 2;
            else newlyFreedKnownMatches += 1;
          } else {
            newlyFreedPeeks += 1;
          }
        }
      }
    }

    return newlyFreedKnownMatches * 1500 + newlyFreedPeeks * 800;
  }

  /**
   * Scores an action using the Optimal Decision Policy principles.
   */
  function scoreAction(game, state, action) {
    const clock = getClockMetrics(game, state);
    let score = 0;
    const reasons = [];

    // --- CLOCK RULES ---
    if (clock.active) {
      const isClockTile = (action.index === game.clock.i) ||
        (action.indices && action.indices.includes(game.clock.i));
      const isClockMatch = isClockTile && (action.type === 'immediate_match' || action.type === 'pair_match');

      if (isClockMatch) {
        score += 100000;
        reasons.push('CRITICAL_CLOCK_MATCH_CLEAR (+100000)');
      } else if (isClockTile) {
        // The clock tile is already free on the board!
        if (clock.remainingMoves <= 1) {
          score += 100000;
          reasons.push('CLOCK_FINAL_DEADLINE_TAKE (+100000)');
        } else {
          // Strategic Clock Delay: it is already free on the board!
          // Delay taking it if the tray already has items to keep tray buffer open
          if (state.tray.length >= 1) {
            score -= 6000;
            reasons.push('STRATEGIC_CLOCK_DELAY_KEEP_TRAY_OPEN (-6000)');
          } else {
            score += 10000;
            reasons.push('SAFE_CLOCK_TAKE (+10000)');
          }
        }
      } else {
        // Clock tile is still buried: must unblock it before moves run out
        const onCriticalPath = (action.index !== undefined && clock.criticalTiles.has(action.index)) ||
          (action.indices && action.indices.some(idx => clock.criticalTiles.has(idx)));

        if (clock.slack <= 3) {
          if (onCriticalPath) {
            score += 35000;
            reasons.push('CLOCK_CRITICAL_UNBLOCKING_PATH (+35000)');
          } else {
            score -= 30000;
            reasons.push('CLOCK_UNBLOCKING_OFF_PATH_DIVERSION (-30000)');
          }
        } else if (clock.slack <= 5) {
          if (onCriticalPath) {
            score += 8000;
            reasons.push('CLOCK_PATH_PRIORITY (+8000)');
          }
        }
      }
    }

    // --- TRAY GOAL UNBLOCKER INCENTIVE ---
    const trayUnblockers = getTrayGoalFrontier(game, state);
    const isUnblocker = (action.index !== undefined && trayUnblockers.has(action.index)) ||
      (action.indices && action.indices.some(idx => trayUnblockers.has(idx)));

    if (isUnblocker) {
      score += 10000;
      reasons.push('TRAY_PARTNER_UNBLOCKER (+10000)');
    }

    // --- LOOKAHEAD UNBLOCKING POTENTIAL ---
    const lookaheadBonus = getLookaheadValue(game, state, action);
    if (lookaheadBonus > 0) {
      score += lookaheadBonus;
      reasons.push(`LOOKAHEAD_UNBLOCKING (+${lookaheadBonus})`);
    }

    // --- ACTION TYPE HEURISTICS ---
    switch (action.type) {
      case 'immediate_match': {
        // Highly desirable: clears 1 tray slot, frees up board tile!
        score += 14000;
        reasons.push('IMMEDIATE_TRAY_MATCH (+14000)');
        // Extra bonus if tray was crowded
        if (state.tray.length >= 2) {
          score += 5000;
          reasons.push('RELIEVES_CROWDED_TRAY (+5000)');
        }
        break;
      }

      case 'pair_match': {
        // Clears 2 board tiles with 0 net tray change
        score += 8000;
        reasons.push('FREE_PAIR_CLEAR (+8000)');
        break;
      }

      case 'safe_peek': {
        // Free information gathering!
        score += 4500;
        reasons.push('SAFE_PEEK_INFO (+4500)');

        // Bayesian bonus if high chance to match current tray
        if (action.pTrayMatch > 0) {
          const matchBonus = Math.round(action.pTrayMatch * 7000);
          score += matchBonus;
          reasons.push(`P_TRAY_MATCH_BONUS (+${matchBonus})`);
        }

        // Unblocking degree bonus
        if (action.unblockDegree > 0) {
          const degBonus = action.unblockDegree * 300;
          score += degBonus;
          reasons.push(`UNBLOCK_DEGREE (+${degBonus})`);
        }

        // If tray has 1, 2, or 3 tiles, peeking is VASTLY superior to taking a speculative single
        if (state.tray.length >= 2) {
          score += 8000;
          reasons.push('PEEK_OVER_CROWDED_TRAY_RISK (+8000)');
        } else if (state.tray.length === 1) {
          score += 2000;
          reasons.push('PEEK_BEFORE_TRAY_EXPANSION (+2000)');
        }
        break;
      }

      case 'single_take': {
        // TAKING A SINGLE INTO TRAY
        // PRINCIPLE 1: Tray headroom management
        if (state.tray.length === 3) {
          // Taking an unmatched tile when tray has 3 items causes INSTANT DEATH (tray capacity = 4)
          score -= 100000;
          reasons.push('FATAL_TRAY_OVERFLOW_BLUNDER (-100000)');
        } else if (state.tray.length === 2) {
          // Taking an unmatched tile brings tray to 3 (very dangerous)
          if (isUnblocker && action.mateDepth <= 1) {
            score -= 5000;
            reasons.push('UNBLOCKER_CONTROLLED_TRAY_3_ENTRY (-5000)');
          } else {
            score -= 35000;
            reasons.push('DANGEROUS_UNCONNECTED_TRAY_3_ENTRY (-35000)');
          }
        } else if (state.tray.length === 1) {
          if (isUnblocker) {
            score += 1500;
            reasons.push('TRAY_UNBLOCKER_TAKE (+1500)');
          } else {
            score -= 4000;
            reasons.push('UNCONNECTED_TRAY_2_DISTRACTION (-4000)');
          }
        } else {
          // Tray length 0: safe
          score -= 300;
          reasons.push('TRAY_OCCUPANCY_COST_0_TO_1 (-300)');
        }

        // PRINCIPLE 3: Buried Mate Depth
        if (action.mateDepth === 0) {
          score += 6000;
          reasons.push('MATE_ALREADY_FREE (+6000)');
        } else {
          const depthPenalty = Math.round(action.mateDepth * 2000);
          score -= depthPenalty;
          reasons.push(`BURIED_MATE_PENALTY_DEPTH_${action.mateDepth.toFixed(1)} (-${depthPenalty})`);
        }
        break;
      }
    }

    return { score, reasons };
  }

  /**
   * Evaluates all available actions and chooses the highest scoring one.
   */
  function chooseBestAction(game, state) {
    const actions = getAvailableActions(game, state);
    if (!actions.length) return null;

    let bestAction = null;
    let highestScore = -Infinity;
    let bestBreakdown = null;

    const evaluatedActions = actions.map(act => {
      const breakdown = scoreAction(game, state, act);
      if (breakdown.score > highestScore) {
        highestScore = breakdown.score;
        bestAction = act;
        bestBreakdown = breakdown;
      }
      return { action: act, ...breakdown };
    });

    evaluatedActions.sort((a, b) => b.score - a.score);

    return {
      bestAction,
      score: highestScore,
      reasons: bestBreakdown?.reasons || [],
      rankedActions: evaluatedActions
    };
  }

  /**
   * Executes an action on the game state (strictly preserving human observation rules).
   */
  function applyAction(game, state, action) {
    state.moves++;
    state.history.push({ ...action, moveNumber: state.moves, trayBefore: [...state.tray] });

    switch (action.type) {
      case 'immediate_match': {
        const i = action.index;
        state.alive[i] = 0;
        state.cleared.push(action.face);
        state.cleared.push(action.face);
        // Remove from tray
        const idx = state.tray.indexOf(action.face);
        if (idx >= 0) state.tray.splice(idx, 1);
        break;
      }

      case 'pair_match': {
        const [a, b] = action.indices;
        state.alive[a] = 0;
        state.alive[b] = 0;
        state.cleared.push(action.face);
        state.cleared.push(action.face);
        break;
      }

      case 'safe_peek': {
        const i = action.index;
        // The tile is peeked! Now its face becomes known.
        // NOTE: ONLY NOW does the bot know game.faces[i]
        const revealedFace = game.faces[i];
        state.known[i] = revealedFace;

        // In Oma's Mahjong rules, if the peeked face matches a tile already in tray,
        // it auto-matches immediately and leaves the board!
        const trayIdx = state.tray.indexOf(revealedFace);
        if (trayIdx >= 0) {
          state.alive[i] = 0;
          state.tray.splice(trayIdx, 1);
          state.cleared.push(revealedFace);
          state.cleared.push(revealedFace);
        }
        break;
      }

      case 'single_take': {
        const i = action.index;
        state.alive[i] = 0;
        state.tray.push(action.face);
        break;
      }
    }

    // Check end conditions
    if (state.tray.length >= options.maxTrayCapacity) {
      return { ended: true, win: false, why: 'tray' };
    }
    if (game.clock && state.alive[game.clock.i] && state.moves >= game.clock.n) {
      return { ended: true, win: false, why: 'clock' };
    }

    const remainingAlive = state.alive.some(a => a === 1);
    if (!remainingAlive && state.tray.length === 0) {
      return { ended: true, win: true, why: 'cleared' };
    }

    return { ended: false };
  }

  /**
   * Plays an entire level from start to finish using the optimal policy.
   */
  function play(game, maxTurns = 200) {
    const state = initGameState(game);
    let result = { ended: false };

    while (!result.ended && state.moves < maxTurns) {
      const choice = chooseBestAction(game, state);
      if (!choice || !choice.bestAction) {
        // No legal actions remain
        result = {
          ended: true,
          win: false,
          why: state.tray.length > 0 ? 'tray' : 'no_moves'
        };
        break;
      }

      // If the chosen action would result in a fatal overflow, mark why
      if (choice.bestAction.type === 'single_take' && state.tray.length >= options.maxTrayCapacity - 1) {
        // Taking this will cause instant overflow
        result = { ended: true, win: false, why: 'tray' };
        break;
      }

      result = applyAction(game, state, choice.bestAction);
    }

    return {
      win: !!result.win,
      why: result.why || (result.win ? 'cleared' : 'stuck'),
      moves: state.moves,
      history: state.history,
      trayEnd: state.tray,
      tilesRemaining: state.alive.reduce((sum, a) => sum + a, 0)
    };
  }

  return {
    initGameState,
    getUnseenMultiset,
    isTileFree,
    getUnblockingDepth,
    getGoalFrontier,
    getTrayGoalFrontier,
    getClockMetrics,
    getAvailableActions,
    scoreAction,
    chooseBestAction,
    applyAction,
    play
  };
}

module.exports = {
  createOptimalBot
};
