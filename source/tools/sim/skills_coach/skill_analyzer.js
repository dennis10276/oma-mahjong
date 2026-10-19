'use strict';
/**
 * Mahjong Skill Differential Analyzer.
 *
 * Compares human gameplay decisions move-by-move against the Optimal Play Bot
 * under strictly identical information visibility.
 *
 * Five Quantified Skill Dimensions:
 * 1. TRAY_HEADROOM (Anti-Greed):
 *    Never taking a 3rd unmatched tile into the tray without an immediate partner.
 * 2. BURIED_MATE (Depth Awareness):
 *    Selecting singles whose partners are near the surface instead of buried under 3+ layers.
 * 3. CLOCK_URGENCY (Critical Path Efficiency):
 *    Prioritizing tiles on the unblocking DAG of the clock tile when clock budget is tight.
 * 4. SAFE_PEEKING (Information Gathering):
 *    Inspecting free face-down tiles before risking speculative tray occupancy.
 * 5. FREE_MATCH (Follow-Through Execution):
 *    Executing available tray matches and board pairs immediately to maintain headroom.
 */

const { createOptimalBot } = require('./optimal_bot.js');

const SKILL_CATEGORIES = {
  TRAY_HEADROOM: {
    id: 'TRAY_HEADROOM',
    nameEn: 'Tray Headroom Management',
    nameNl: 'Tray Ruimtebeheer',
    description: 'Maintaining empty tray slots as safety buffer; avoiding premature 3-tray lockouts.'
  },
  BURIED_MATE: {
    id: 'BURIED_MATE',
    nameEn: 'Buried Mate Awareness',
    nameNl: 'Diepte Inzicht Partner',
    description: 'Targeting pairs where the twin is near the surface, rather than buried deep under layers.'
  },
  CLOCK_URGENCY: {
    id: 'CLOCK_URGENCY',
    nameEn: 'Clock Critical Path Focus',
    nameNl: 'Klok Focus & Urgentie',
    description: 'Focusing strictly on dependencies unblocking the alarm clock when moves are limited.'
  },
  SAFE_PEEKING: {
    id: 'SAFE_PEEKING',
    nameEn: 'Safe Peeking Discipline',
    nameNl: 'Veilig Verkennen',
    description: 'Flipping free face-down tiles for free information before risking singles into the tray.'
  },
  FREE_MATCH: {
    id: 'FREE_MATCH',
    nameEn: 'Immediate Match Execution',
    nameNl: 'Directe Match Pakken',
    description: 'Clearing ready matches immediately to reclaim tray space and lower board entropy.'
  }
};

function createSkillAnalyzer(config = {}) {
  const bot = createOptimalBot(config);

  /**
   * Analyzes a single move made by a player in state St vs the optimal bot choices.
   */
  function analyzeMove(game, state, playerAction) {
    const analysis = {
      turn: state.moves + 1,
      playerAction,
      trayBefore: [...state.tray],
      isOptimal: false,
      skillDiscrepancies: [],
      severity: 'ok', // 'ok', 'suboptimal', 'blunder', 'fatal'
      optimalAction: null,
      explanation: ''
    };

    // Evaluate current state with optimal bot
    const evaluation = bot.chooseBestAction(game, state);
    if (!evaluation || !evaluation.bestAction) {
      return analysis;
    }

    const optimalAction = evaluation.bestAction;
    analysis.optimalAction = optimalAction;

    // Check if player action matches optimal action
    const actionsMatch = (playerAction.type === optimalAction.type) &&
      (playerAction.index === optimalAction.index ||
        (playerAction.indices && optimalAction.indices &&
          playerAction.indices[0] === optimalAction.indices[0] &&
          playerAction.indices[1] === optimalAction.indices[1]));

    if (actionsMatch) {
      analysis.isOptimal = true;
      analysis.explanation = 'Player selected the optimal move.';
      return analysis;
    }

    // DISCREPANCY ANALYSIS
    const clock = bot.getClockMetrics(game, state);
    const trayUnblockers = bot.getTrayGoalFrontier(game, state);

    // 1. TRAY HEADROOM DISCREPANCY
    if (playerAction.type === 'single_take') {
      if (state.tray.length === 3) {
        // Fatal blunder: taking an unmatched tile when tray has 3 items
        analysis.skillDiscrepancies.push({
          skill: SKILL_CATEGORIES.TRAY_HEADROOM.id,
          type: 'FATAL_TRAY_OVERFLOW',
          message: 'Filled the 4th tray slot without an immediate partner, causing an instant tray jam.',
          penalty: 100
        });
        analysis.severity = 'fatal';
      } else if (state.tray.length === 2) {
        // Entered 3-tray state
        const isUnblocker = trayUnblockers.has(playerAction.index);
        if (!isUnblocker && playerAction.mateDepth > 1) {
          analysis.skillDiscrepancies.push({
            skill: SKILL_CATEGORIES.TRAY_HEADROOM.id,
            type: 'PREMATURE_TRAY_3_ENTRY',
            message: `Put an unconnected tile (#${playerAction.index}) into tray slot 3 while partner is depth ${playerAction.mateDepth?.toFixed(1) || 'unknown'}. Leaves zero buffer.`,
            penalty: 60
          });
          analysis.severity = analysis.severity === 'fatal' ? 'fatal' : 'blunder';
        }
      }
    }

    // 2. BURIED MATE DISCREPANCY
    if (playerAction.type === 'single_take' && playerAction.mateDepth !== undefined) {
      const optimalMateDepth = optimalAction.mateDepth ?? 0;
      if (playerAction.mateDepth >= 3 && optimalMateDepth <= 1) {
        analysis.skillDiscrepancies.push({
          skill: SKILL_CATEGORIES.BURIED_MATE.id,
          type: 'DEEP_BURIED_MATE_PICK',
          message: `Picked tile with partner buried ${playerAction.mateDepth.toFixed(1)} layers deep, while shallower options (${optimalMateDepth.toFixed(1)} layers) were accessible.`,
          penalty: 45
        });
        if (analysis.severity === 'ok') analysis.severity = 'suboptimal';
      }
    }

    // 3. CLOCK URGENCY DISCREPANCY
    if (clock.active && clock.slack <= 3) {
      const touchesClock = (playerAction.index === game.clock.i) ||
        (playerAction.indices && playerAction.indices.includes(game.clock.i));
      const onCriticalPath = (playerAction.index !== undefined && clock.criticalTiles.has(playerAction.index)) ||
        (playerAction.indices && playerAction.indices.some(idx => clock.criticalTiles.has(idx)));

      if (!touchesClock && !onCriticalPath) {
        analysis.skillDiscrepancies.push({
          skill: SKILL_CATEGORIES.CLOCK_URGENCY.id,
          type: 'CLOCK_EMERGENCY_DIVERSION',
          message: `Cleared peripheral tiles while the alarm clock has only ${clock.remainingMoves} moves left and requires ${clock.depth} unblocking steps (slack: ${clock.slack}).`,
          penalty: 80
        });
        analysis.severity = analysis.severity === 'fatal' ? 'fatal' : 'blunder';
      }
    }

    // 4. SAFE PEEKING DISCREPANCY
    if (playerAction.type === 'single_take' && state.tray.length >= 1) {
      const availableActions = bot.getAvailableActions(game, state);
      const freePeeks = availableActions.filter(a => a.type === 'safe_peek');
      if (freePeeks.length > 0 && optimalAction.type === 'safe_peek') {
        analysis.skillDiscrepancies.push({
          skill: SKILL_CATEGORIES.SAFE_PEEKING.id,
          type: 'SKIPPED_SAFE_PEEK',
          message: `Took a speculative single into the tray when ${freePeeks.length} free face-down tile(s) were available to peek safely with zero tray risk.`,
          penalty: 40
        });
        if (analysis.severity === 'ok') analysis.severity = 'suboptimal';
      }
    }

    // 5. FREE MATCH DISCREPANCY
    if (playerAction.type === 'single_take') {
      const availableActions = bot.getAvailableActions(game, state);
      const readyMatches = availableActions.filter(a => a.type === 'immediate_match' || a.type === 'pair_match');
      if (readyMatches.length > 0 && (optimalAction.type === 'immediate_match' || optimalAction.type === 'pair_match')) {
        analysis.skillDiscrepancies.push({
          skill: SKILL_CATEGORIES.FREE_MATCH.id,
          type: 'MISSED_READY_MATCH',
          message: 'Took an unmatched single into tray while an immediate match or free board pair was already open.',
          penalty: 50
        });
        if (analysis.severity === 'ok') analysis.severity = 'suboptimal';
      }
    }

    return analysis;
  }

  /**
   * Replays a full sequence of moves (from human follow log or bot history)
   * and computes a complete skill gap profile.
   */
  function analyzeGame(game, actionSequence) {
    const state = bot.initGameState(game);
    const moveAnalyses = [];
    let criticalBlunder = null;

    // Track skill opportunities and errors
    const skillStats = {
      TRAY_HEADROOM: { opportunities: 0, violations: 0, score: 100 },
      BURIED_MATE: { opportunities: 0, violations: 0, score: 100 },
      CLOCK_URGENCY: { opportunities: 0, violations: 0, score: 100 },
      SAFE_PEEKING: { opportunities: 0, violations: 0, score: 100 },
      FREE_MATCH: { opportunities: 0, violations: 0, score: 100 }
    };

    let optimalMoveCount = 0;

    for (let t = 0; t < actionSequence.length; t++) {
      const action = actionSequence[t];
      const clock = bot.getClockMetrics(game, state);

      // Track opportunities
      if (state.tray.length >= 2 && action.type === 'single_take') {
        skillStats.TRAY_HEADROOM.opportunities++;
      }
      if (action.type === 'single_take') {
        skillStats.BURIED_MATE.opportunities++;
      }
      if (clock.active && clock.slack <= 4) {
        skillStats.CLOCK_URGENCY.opportunities++;
      }
      if (action.type === 'single_take') {
        skillStats.SAFE_PEEKING.opportunities++;
        skillStats.FREE_MATCH.opportunities++;
      }

      // Analyze this move
      const moveAnalysis = analyzeMove(game, state, action);
      moveAnalyses.push(moveAnalysis);

      if (moveAnalysis.isOptimal) {
        optimalMoveCount++;
      } else {
        for (const disc of moveAnalysis.skillDiscrepancies) {
          if (skillStats[disc.skill]) {
            skillStats[disc.skill].violations++;
          }
        }
        if (!criticalBlunder && (moveAnalysis.severity === 'blunder' || moveAnalysis.severity === 'fatal')) {
          criticalBlunder = moveAnalysis;
        }
      }

      // Apply action to advance state
      bot.applyAction(game, state, action);
    }

    // Calculate normalized percentage scores (0 to 100)
    for (const key of Object.keys(skillStats)) {
      const opp = skillStats[key].opportunities;
      const viol = skillStats[key].violations;
      if (opp > 0) {
        skillStats[key].score = Math.max(0, Math.round(((opp - viol) / opp) * 100));
      } else {
        skillStats[key].score = 100; // No opportunities to fail
      }
    }

    const overallAccuracy = actionSequence.length > 0 ?
      Math.round((optimalMoveCount / actionSequence.length) * 100) : 100;

    return {
      level: game.level || 0,
      totalMoves: actionSequence.length,
      optimalMoveCount,
      overallAccuracy,
      skillStats,
      criticalBlunder,
      moveAnalyses
    };
  }

  return {
    SKILL_CATEGORIES,
    analyzeMove,
    analyzeGame
  };
}

module.exports = {
  SKILL_CATEGORIES,
  createSkillAnalyzer
};
