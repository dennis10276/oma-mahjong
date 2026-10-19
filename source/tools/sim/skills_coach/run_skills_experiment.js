'use strict';
/**
 * Runner for the Mahjong Skills Coach Experiment.
 *
 * Measures:
 * 1. Optimal Bot performance (win rate, move efficiency) with identical human information.
 * 2. Per-player skill gap analysis across all 4 cohorts (Dennis, Mrs. Doubtfire, Gerda, PUK).
 * 3. Generation of contextual, explainable educational coaching popups for detected skill gaps.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const H = require('../../../www/hard.js');
const { game } = require('../tighten_clocks.js');
const { createOptimalBot } = require('./optimal_bot.js');
const { createSkillAnalyzer, SKILL_CATEGORIES } = require('./skill_analyzer.js');
const { generateCoachingPopup, renderMarkdownCard } = require('./coaching_popups.js');

// Player personas representing real-world human behavioral styles in Oma's Mahjong
const PLAYER_PROFILES = {
  Dennisisdebeste: {
    name: 'Dennisisdebeste',
    description: 'Fast, skilled player with strong clock discipline and good tray lookahead.',
    persona: {
      ...H.P,
      temp: 1.2,
      physicalFlips: true,
      physicalPlan: 12,
      physicalClockSafeExit: true,
      physicalSafety: 0.85,
      peek: 0,
      end: 0,
      plan: 0,
      keyPlan: 0,
      flips: true,
      allMoves: true,
      blunder: 0.05
    }
  },
  MrsDoubtfire: {
    name: 'Mrs. Doubtfire',
    description: 'Deliberate, patient player. Suffered from buried mate depth early on, adapted post-101.',
    persona: {
      ...H.P,
      temp: 2.5,
      deep: 0.3, // Lower depth awareness (picks deep buried mates)
      physicalFlips: true,
      physicalPlan: 8,
      physicalClockSafeExit: true,
      physicalSafety: 0.60,
      peek: 0,
      end: 0,
      plan: 0,
      keyPlan: 0,
      flips: true,
      allMoves: true,
      blunder: 0.12
    }
  },
  Gerda: {
    name: 'Gerda',
    description: 'Bimodal player with high blunder rate on tray headroom; frequently jams 4-slot tray.',
    persona: {
      ...H.P,
      temp: 3.5,
      tray: [0, 1, 1.5, 3], // Low penalty for filling tray to 3
      deep: 0.2,
      physicalFlips: true,
      physicalPlan: 4,
      physicalSafety: 0.30,
      peek: 0,
      end: 0,
      plan: 0,
      keyPlan: 0,
      flips: true,
      allMoves: true,
      blunder: 0.45 // High blunder rate at 3 tray tiles
    }
  },
  PUK: {
    name: 'PUK',
    description: 'Relaxed non-clock player. Low safe-peeking frequency on complex multi-layer boards.',
    persona: {
      ...H.P,
      temp: 2.8,
      physicalFlips: true,
      physicalPlan: 0,
      physicalSafety: 0.50,
      peek: 0,
      end: 0,
      plan: 0,
      keyPlan: 0,
      flips: false, // Often forgets to peek free face-down tiles
      allMoves: true,
      blunder: 0.20
    }
  }
};

function runSkillsExperiment() {
  console.log('================================================================================');
  console.log('      MAHJONG SKILLS COACH & OPTIMAL PLAY BENCHMARK EXPERIMENT');
  console.log('================================================================================\n');

  // Load levels from levels-hard.js
  const levelsFilePath = path.resolve(__dirname, '../../../www/levels-hard.js');
  const code = fs.readFileSync(levelsFilePath, 'utf8') + '; HARD_LEVELS;';
  const HL = vm.runInNewContext(code);

  const testLevels = [70, 75, 80, 85, 95, 100, 105, 110];
  console.log(`Running benchmark across ${testLevels.length} test levels: [${testLevels.join(', ')}]...\n`);

  const bot = createOptimalBot();
  const analyzer = createSkillAnalyzer();

  // 1. Run Optimal Bot Benchmark
  console.log('--- 1. OPTIMAL BOT BENCHMARK (Human-Visible Information Only) ---');
  let optimalWins = 0;
  const optimalResults = [];

  for (const lv of testLevels) {
    const d = H.unpack(lv, HL.levels[lv - HL.from]);
    const g = game(d);
    const res = bot.play(g);
    if (res.win) optimalWins++;
    optimalResults.push({
      level: lv,
      win: res.win,
      moves: res.moves,
      why: res.why,
      tilesRemaining: res.tilesRemaining
    });
    console.log(`  Level ${lv.toString().padStart(3)}: ${res.win ? 'WIN  ' : 'FAIL '} | Moves: ${res.moves.toString().padStart(2)} | Status: ${res.why.padEnd(7)} | Left: ${res.tilesRemaining}`);
  }

  const optimalWinRate = Math.round((optimalWins / testLevels.length) * 100);
  console.log(`\n  Optimal Bot Win Rate: ${optimalWins}/${testLevels.length} (${optimalWinRate}%)\n`);

  // 2. Run Human Cohort Benchmarks & Skill Gap Analysis
  console.log('--- 2. HUMAN COHORT SKILL GAP ANALYSIS ---');
  const playerResults = {};

  for (const [key, player] of Object.entries(PLAYER_PROFILES)) {
    console.log(`\nAnalyzing Cohort: ${player.name} (${player.description})`);

    let playerWins = 0;
    const aggregateSkills = {
      TRAY_HEADROOM: { opp: 0, viol: 0 },
      BURIED_MATE: { opp: 0, viol: 0 },
      CLOCK_URGENCY: { opp: 0, viol: 0 },
      SAFE_PEEKING: { opp: 0, viol: 0 },
      FREE_MATCH: { opp: 0, viol: 0 }
    };

    const blunders = [];
    let totalTurnsAnalyzed = 0;
    let optimalMatchTurns = 0;

    for (const lv of testLevels) {
      const d = H.unpack(lv, HL.levels[lv - HL.from]);
      const g = game(d);
      const trace = [];

      // Simulate human play with their fitted persona
      const hRes = H.play(g, player.persona, 12345 + lv * 7919, trace);
      if (hRes.win) playerWins++;

      // Convert trace into discrete action sequence
      const actionSequence = [];
      for (const t of trace) {
        if (t.pick) {
          if (t.pick.length === 2) {
            actionSequence.push({
              type: 'pair_match',
              indices: t.pick,
              face: g.faces[t.pick[0]],
              description: `Player paired #${t.pick[0]} and #${t.pick[1]}`
            });
          } else if (t.pick.length === 1) {
            const idx = t.pick[0];
            const trayMatch = t.tray && t.tray.includes(g.faces[idx]);
            if (trayMatch) {
              actionSequence.push({
                type: 'immediate_match',
                index: idx,
                face: g.faces[idx],
                description: `Player matched #${idx}`
              });
            } else {
              actionSequence.push({
                type: 'single_take',
                index: idx,
                face: g.faces[idx],
                mateDepth: 2.0, // estimated
                description: `Player took #${idx} into tray`
              });
            }
          }
        } else if (t.inspection !== undefined || t.physicalPlan !== undefined) {
          const idx = t.inspection ?? t.physicalPlan;
          actionSequence.push({
            type: 'safe_peek',
            index: idx,
            description: `Player inspected tile #${idx}`
          });
        }
      }

      if (actionSequence.length > 0) {
        const gameAnalysis = analyzer.analyzeGame(g, actionSequence);
        totalTurnsAnalyzed += gameAnalysis.totalMoves;
        optimalMatchTurns += gameAnalysis.optimalMoveCount;

        for (const [sk, stat] of Object.entries(gameAnalysis.skillStats)) {
          aggregateSkills[sk].opp += stat.opportunities;
          aggregateSkills[sk].viol += stat.violations;
        }

        if (gameAnalysis.criticalBlunder) {
          blunders.push({
            level: lv,
            ...gameAnalysis.criticalBlunder
          });
        }
      }
    }

    // Compute player scorecard
    const scorecard = {};
    for (const [sk, stat] of Object.entries(aggregateSkills)) {
      if (stat.opp > 0) {
        scorecard[sk] = Math.max(0, Math.round(((stat.opp - stat.viol) / stat.opp) * 100));
      } else {
        scorecard[sk] = 100;
      }
    }

    const playerWinRate = Math.round((playerWins / testLevels.length) * 100);
    const agreementRate = totalTurnsAnalyzed > 0 ?
      Math.round((optimalMatchTurns / totalTurnsAnalyzed) * 100) : 0;

    playerResults[key] = {
      name: player.name,
      winRate: playerWinRate,
      optimalAgreementRate: agreementRate,
      scorecard,
      criticalBlundersCount: blunders.length,
      sampleBlunder: blunders[0] || null
    };

    console.log(`  Win Rate: ${playerWins}/${testLevels.length} (${playerWinRate}%) | Agreement with Coach: ${agreementRate}%`);
    console.log(`  Skill Scorecard:`);
    console.log(`    - Tray Headroom (Anti-Greed)  : ${scorecard.TRAY_HEADROOM}%`);
    console.log(`    - Buried Mate Awareness       : ${scorecard.BURIED_MATE}%`);
    console.log(`    - Clock Urgency Discipline    : ${scorecard.CLOCK_URGENCY}%`);
    console.log(`    - Safe Peeking Frequency      : ${scorecard.SAFE_PEEKING}%`);
    console.log(`    - Immediate Match Execution   : ${scorecard.FREE_MATCH}%`);
  }

  // 3. Generate Explainable Educational Coaching Popups
  console.log('\n--- 3. EXPLAINABLE EDUCATIONAL COACHING POPUPS DEMONSTRATION ---');
  const popupExamples = [];

  for (const [key, res] of Object.entries(playerResults)) {
    if (res.sampleBlunder) {
      const popupNl = generateCoachingPopup({ level: res.sampleBlunder.level }, res.sampleBlunder, 'nl');
      const popupEn = generateCoachingPopup({ level: res.sampleBlunder.level }, res.sampleBlunder, 'en');

      popupExamples.push({
        player: res.name,
        level: res.sampleBlunder.level,
        popupNl,
        popupEn
      });

      console.log(`\n[Coaching Popup for ${res.name} on Level ${res.sampleBlunder.level}]`);
      console.log(renderMarkdownCard(popupNl, 'nl'));
    }
  }

  // Save experiment report to JSON
  const reportPath = path.resolve(__dirname, 'skills_experiment_report.json');
  const reportData = {
    date: new Date().toISOString(),
    benchmarkLevels: testLevels,
    optimalBot: {
      winRate: optimalWinRate,
      results: optimalResults
    },
    playerScorecards: playerResults,
    popupExamples
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2) + '\n');
  console.log(`\n================================================================================`);
  console.log(`  Skills Coach Experiment Complete. Report saved to:`);
  console.log(`  ${reportPath}`);
  console.log(`================================================================================\n`);

  return reportData;
}

if (require.main === module) {
  runSkillsExperiment();
}

module.exports = {
  PLAYER_PROFILES,
  runSkillsExperiment
};
