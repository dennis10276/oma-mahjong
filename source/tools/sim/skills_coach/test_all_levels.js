'use strict';
/**
 * Test Optimal Bot across ALL levels in Oma's Mahjong:
 * 1. Classic Levels 1 to 50 (aspect 1.55)
 * 2. Early Track Levels 51 to 69
 * 3. Designed Track Levels 70 to 269 (200 levels)
 */

const { designed, classic } = require('../refit/boards.js');
const { createOptimalBot } = require('./optimal_bot.js');

function runAll() {
  const bot = createOptimalBot();

  console.log('=== EVALUATING CLASSIC LEVELS (1 - 50, aspect 1.55) ===');
  let classicWins = 0;
  const classicFails = [];
  for (let lv = 1; lv <= 50; lv++) {
    const g = classic(lv, 1.55);
    const res = bot.play(g);
    if (res.win) classicWins++;
    else classicFails.push({ lv, why: res.why, moves: res.moves, tilesRem: res.tilesRemaining });
  }
  console.log(`Classic (1-50): ${classicWins}/50 cleared on Attempt 1 (${(classicWins / 50 * 100).toFixed(1)}%)`);
  if (classicFails.length) {
    console.log('Classic Fails:', classicFails);
  }

  console.log('\n=== EVALUATING EARLY TRACK LEVELS (51 - 69) ===');
  let earlyWins = 0;
  const earlyFails = [];
  for (let lv = 51; lv <= 69; lv++) {
    // 52 is classic, 51 & 53-69 are designed
    const g = lv === 52 ? classic(52, 1.55) : designed('1.55', lv);
    if (!g) {
      console.log(`Level ${lv} could not be loaded`);
      continue;
    }
    const res = bot.play(g);
    if (res.win) earlyWins++;
    else earlyFails.push({ lv, why: res.why, moves: res.moves, tilesRem: res.tilesRemaining });
  }
  console.log(`Early (51-69): ${earlyWins}/19 cleared on Attempt 1 (${(earlyWins / 19 * 100).toFixed(1)}%)`);
  if (earlyFails.length) {
    console.log('Early Fails:', earlyFails);
  }

  console.log('\n=== EVALUATING DESIGNED TRACK LEVELS (70 - 269, 200 levels) ===');
  let designedWins = 0;
  const designedFails = [];
  for (let lv = 70; lv <= 269; lv++) {
    const g = designed('1.55', lv);
    if (!g) {
      console.log(`Level ${lv} could not be loaded`);
      continue;
    }
    const res = bot.play(g);
    if (res.win) designedWins++;
    else designedFails.push({ lv, why: res.why, moves: res.moves, tilesRem: res.tilesRemaining });
  }
  console.log(`Designed (70-269): ${designedWins}/200 cleared on Attempt 1 (${(designedWins / 200 * 100).toFixed(1)}%)`);
  if (designedFails.length) {
    console.log('Designed Fails:', designedFails);
  }

  const totalLevels = 50 + 19 + 200;
  const totalWins = classicWins + earlyWins + designedWins;
  console.log('\n================================================================================');
  console.log(`TOTAL OVERALL: ${totalWins} / ${totalLevels} (${(totalWins / totalLevels * 100).toFixed(1)}%) cleared on Attempt 1`);
  console.log('================================================================================');
}

runAll();
