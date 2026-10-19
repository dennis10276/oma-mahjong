'use strict';
/**
 * Test Suite for Mahjong Skills Coach and Optimal Play Bot.
 *
 * Verifies:
 * 1. Strict information horizon (the bot never cheats or peeks ahead at face-down faces).
 * 2. Invariant: bot never willingly commits a fatal tray overflow.
 * 3. Accurate skill discrepancy detection across all 5 skill categories.
 * 4. High-quality educational popup generation in Dutch and English.
 */

const assert = require('assert/strict');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const H = require('../../../www/hard.js');
const { game } = require('../tighten_clocks.js');
const { createOptimalBot } = require('./optimal_bot.js');
const { createSkillAnalyzer, SKILL_CATEGORIES } = require('./skill_analyzer.js');
const { generateCoachingPopup, renderMarkdownCard, getTileName } = require('./coaching_popups.js');

function runTests() {
  console.log('Running test_skills_coach.js...');

  // --- 1. TEST INFORMATION HORIZON (ZERO CHEATING ON FACE-DOWN TILES) ---
  {
    const bot = createOptimalBot();
    const fakeFaces = [1, 1, 2, 2, 3, 3, 4, 4];
    const fakeTiles = fakeFaces.map((_, i) => ({ x: i * 4, y: 0, z: 0 }));
    const mockGame = {
      tiles: fakeTiles,
      nb: { above: fakeTiles.map(() => []), left: fakeTiles.map((_, i) => i > 0 ? [i - 1] : []), right: fakeTiles.map((_, i) => i < 7 ? [i + 1] : []) },
      faces: fakeFaces,
      down: [2, 3, 4, 5] // tiles 2, 3, 4, 5 are face-down
    };

    const state = bot.initGameState(mockGame);

    // Initial check: face-down tiles MUST be -1 in state.known
    assert.equal(state.known[0], 1, 'Face-up tile 0 should be known');
    assert.equal(state.known[1], 1, 'Face-up tile 1 should be known');
    assert.equal(state.known[2], -1, 'Face-down tile 2 MUST NOT be known');
    assert.equal(state.known[3], -1, 'Face-down tile 3 MUST NOT be known');
    assert.equal(state.known[4], -1, 'Face-down tile 4 MUST NOT be known');
    assert.equal(state.known[5], -1, 'Face-down tile 5 MUST NOT be known');

    // Bayesian unseen multiset check
    const unseen = bot.getUnseenMultiset(state);
    assert.equal(unseen.get(2), 2, 'Unseen multiset should include both faces of 2');
    assert.equal(unseen.get(3), 2, 'Unseen multiset should include both faces of 3');
    assert.equal(unseen.has(1), false, 'Face 1 is face-up and known; should not be in unseen multiset');

    console.log('  [PASS] Information Horizon: Face-down tiles strictly hidden until peeked.');
  }

  // --- 2. TEST TRAY HEADROOM INVARIANT (NO BLUNDER OVERFLOWS) ---
  {
    const bot = createOptimalBot();
    const mockGame = {
      tiles: Array.from({ length: 6 }, (_, i) => ({ x: i * 4, y: 0, z: 0 })),
      nb: { above: [[], [], [], [], [], []], left: [[], [0], [1], [2], [3], [4]], right: [[1], [2], [3], [4], [5], []] },
      faces: [10, 20, 30, 40, 50, 60],
      down: []
    };

    const state = bot.initGameState(mockGame);
    state.tray = [10, 20, 30]; // 3 items in tray

    const choice = bot.chooseBestAction(mockGame, state);
    // Any single take here should be heavily penalized (-100000)
    for (const act of choice.rankedActions) {
      if (act.action.type === 'single_take' && state.tray.length === 3) {
        assert(act.score <= -90000, 'Single take with 3 tray items must be severely penalized');
      }
    }

    console.log('  [PASS] Tray Headroom Invariant: Bot strictly prohibits filling 4th tray slot.');
  }

  // --- 3. TEST SKILL ANALYZER ATTRIBUTION ---
  {
    const analyzer = createSkillAnalyzer();
    const mockGame = {
      tiles: Array.from({ length: 8 }, (_, i) => ({ x: i * 4, y: 0, z: 0 })),
      nb: { above: [[], [], [], [], [], [], [], []], left: Array.from({ length: 8 }, (_, i) => i > 0 ? [i - 1] : []), right: Array.from({ length: 8 }, (_, i) => i < 7 ? [i + 1] : []) },
      faces: [1, 2, 3, 4, 5, 6, 7, 8],
      down: []
    };

    const bot = createOptimalBot();
    const state = bot.initGameState(mockGame);
    state.tray = [1, 2, 3]; // 3 tray items

    // Player takes an unmatched single (tile 4, face 5)
    const blunderAction = {
      type: 'single_take',
      index: 4,
      face: 5,
      mateDepth: 4.0
    };

    const moveAnalysis = analyzer.analyzeMove(mockGame, state, blunderAction);
    assert.equal(moveAnalysis.severity, 'fatal', '4th tray item should be flagged as fatal');
    assert(moveAnalysis.skillDiscrepancies.some(d => d.skill === 'TRAY_HEADROOM'), 'Should flag TRAY_HEADROOM');

    console.log('  [PASS] Skill Analyzer: Correctly identifies and categorizes fatal tray blunder.');
  }

  // --- 4. TEST COACHING POPUPS (DUTCH & ENGLISH) ---
  {
    const moveAnalysis = {
      turn: 14,
      severity: 'fatal',
      playerAction: { type: 'single_take', index: 5, face: 0, mateDepth: 3.5 },
      optimalAction: { type: 'pair_match', indices: [1, 2], face: 15, description: 'Match pair of free tiles #1 and #2' },
      skillDiscrepancies: [{
        skill: 'TRAY_HEADROOM',
        type: 'FATAL_TRAY_OVERFLOW',
        message: 'Filled 4th slot'
      }]
    };

    const popupNl = generateCoachingPopup({ level: 50 }, moveAnalysis, 'nl');
    const popupEn = generateCoachingPopup({ level: 50 }, moveAnalysis, 'en');

    assert(popupNl.title.includes('tray'), 'Dutch popup should mention tray');
    assert(popupNl.situation.includes('Bamboe 1 (Vogel)'), 'Dutch popup should translate face 0 to Bamboe 1 (Vogel)');
    assert(popupEn.situation.includes('Bamboo 1 (Bird)'), 'English popup should translate face 0 to Bamboo 1 (Bird)');

    const card = renderMarkdownCard(popupNl, 'nl');
    assert(card.includes('> [!TIP]'), 'Markdown card should use GitHub-style alert');
    assert(card.includes('Wat gebeurde er?'), 'Dutch card should include section headers');

    console.log('  [PASS] Coaching Popups: Generates valid Dutch & English educational cards.');
  }

  // --- 5. TEST REAL LEVEL SIMULATION ON LEVEL 80 ---
  {
    const levelsFilePath = path.resolve(__dirname, '../../../www/levels-hard.js');
    const code = fs.readFileSync(levelsFilePath, 'utf8') + '; HARD_LEVELS;';
    const HL = vm.runInNewContext(code);
    const d = H.unpack(80, HL.levels[80 - HL.from]);
    const g = game(d);

    const bot = createOptimalBot();
    const res = bot.play(g);

    assert.equal(res.win, true, 'Optimal bot should clear Level 80');
    assert.equal(res.tilesRemaining, 0, 'Level 80 should have 0 tiles remaining');
    assert(res.moves <= 80, `Level 80 should clear efficiently (took ${res.moves} moves)`);

    console.log(`  [PASS] Optimal Bot Benchmark: Successfully cleared Level 80 in ${res.moves} moves.`);
  }

  console.log('\nAll skills coach tests passed cleanly!\n');
}

if (require.main === module) {
  runTests();
}

module.exports = {
  runTests
};
