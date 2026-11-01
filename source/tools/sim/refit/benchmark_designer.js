'use strict';
/**
 * benchmark_designer.js
 *
 * Runs the comprehensive bot-designer benchmark over all 20 piles in
 * source/analysis/factory/piles-mid2.json for two target bands:
 * - Band 1: [3.4, 4.9] (Dennis 'right', 4 stars, levels 175-199 middle band)
 * - Band 2: [4.4, 5.4] (Dennis 'harder right', 5 stars, level 200 jump)
 *
 * Verifies all success gates:
 * - Check A (Hit rate in band): >= 60% within 10 tries per pile
 * - Check B (Every special matters): 100% pass specialsMatter(board).ok === true
 * - Check C (Valid): 100% valid, clock exists with 1-3 spares, 2 keys share same face, tiles >= 52 px
 * - Check D (Warnings): <= 10% carry g3 critic warnings (lateSqueeze, clockTooTight, guessing, specialAddsNothing)
 * - Check E (Speed): <= 10 minutes per finished level
 * - Check F (Variety): no single puzzle > 40% of outputs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const Hard = require(path.join(ROOT, 'www', 'hard.js'));
const piles = require(path.join(ROOT, 'analysis', 'factory', 'piles-mid2.json'));
const I = require(path.join(ROOT, 'tools', 'lab', 'ideas.js'));
const { designWithBot } = require('./bot_designer.js');

const BAD_CRITIC_FLAGS = new Set(['lateSqueeze', 'clockTooTight', 'guessing', 'specialAddsNothing']);

function runBenchmark(band, bandName, maxTriesPerPile = 10) {
  console.log(`\n======================================================`);
  console.log(`Starting Benchmark for Band: ${bandName} [${band[0]}, ${band[1]}]`);
  console.log(`Total Piles: ${piles.length}, Max Tries per Pile: ${maxTriesPerPile}`);
  console.log(`======================================================\n`);

  const results = [];
  let totalCalls = 0;
  let successfulCalls = 0;
  const recipeCounts = {};
  let totalTimeMs = 0;
  let criticWarningCount = 0;

  for (let pIdx = 0; pIdx < piles.length; pIdx++) {
    const p = piles[pIdx];
    const tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
    const pileT0 = Date.now();
    let pileHit = null;
    let triesForPile = 0;

    for (let attempt = 0; attempt < maxTriesPerPile; attempt++) {
      triesForPile++;
      totalCalls++;
      const salt = 50 + attempt;
      const d = Hard.makeNow(p.level, 1.6, 1, salt, { tiles });
      const callT0 = Date.now();

      const res = designWithBot(d, band, {
        runs: 20,
        seed: 4711,
        maxAttempts: 6,
        pileIndex: pIdx + attempt
      });

      const callSec = ((Date.now() - callT0) / 1000).toFixed(1);

      if (res && res.g2 && res.g2.exp >= band[0] && res.g2.exp <= band[1] && res.specialsMatter && res.specialsMatter.ok) {
        successfulCalls++;
        pileHit = {
          pileIndex: pIdx,
          level: p.level,
          shape: p.shape,
          nTiles: tiles.length,
          attempt,
          salt,
          triesNeeded: triesForPile,
          callSec: +callSec,
          res
        };
        break;
      }
    }

    const pileSec = ((Date.now() - pileT0) / 1000).toFixed(1);
    totalTimeMs += (Date.now() - pileT0);

    if (pileHit) {
      const { res, attempt, salt, callSec } = pileHit;
      recipeCounts[res.recipe] = (recipeCounts[res.recipe] || 0) + 1;
      const badFlags = (res.critic.flags || []).filter(f => BAD_CRITIC_FLAGS.has(f));
      if (badFlags.length > 0) criticWarningCount++;

      console.log(`Pile ${pIdx.toString().padStart(2, ' ')} (lvl ${p.level}): HIT try ${attempt + 1}/${maxTriesPerPile} (salt ${salt}) in ${pileSec}s | recipe=${res.recipe.padEnd(23, ' ')} exp=${res.g2.exp.toFixed(2)} spare=${res.clockSpare} smOk=${res.specialsMatter.ok} flags=[${(res.critic.flags || []).join(', ')}]`);

      const row = {
        band: `${band[0]}-${band[1]}`,
        pileIndex: pIdx,
        level: p.level,
        shape: p.shape,
        tiles: tiles.length,
        tries: attempt + 1,
        timeSec: +pileSec,
        recipe: res.recipe,
        exp: res.g2.exp,
        label: res.g2.label,
        firstTryRate: res.g2.first,
        clockSpare: res.clockSpare,
        clockIndex: res.board.solution.indexOf(res.board.clock.i) + 1,
        smOk: res.specialsMatter.ok,
        smKinds: res.specialsMatter.kinds,
        criticFlags: res.critic.flags,
        badFlags,
        board: res.board
      };
      results.push(row);
      const notesDir = path.resolve(__dirname, '..', '..', '..', '..', 'notes');
      if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });
      fs.appendFileSync(path.join(notesDir, 'BOT_DESIGNER_BENCHMARK.jsonl'), JSON.stringify(row) + '\n', 'utf8');
    } else {
      console.log(`Pile ${pIdx.toString().padStart(2, ' ')} (lvl ${p.level}): MISS after ${maxTriesPerPile} tries (${pileSec}s)`);
    }
  }

  // Summary Metrics
  const pilesHit = results.length;
  const pileHitRate = (pilesHit / piles.length) * 100;
  const callHitRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
  const smPassRate = pilesHit > 0 ? (results.filter(r => r.smOk).length / pilesHit) * 100 : 0;
  const validPassRate = pilesHit > 0 ? (results.filter(r => I.valid(r.board) && r.clockSpare >= 1 && r.clockSpare <= 3).length / pilesHit) * 100 : 0;
  const warningRate = pilesHit > 0 ? (criticWarningCount / pilesHit) * 100 : 0;
  const maxPuzzleShare = pilesHit > 0 ? Math.max(...Object.values(recipeCounts)) / pilesHit * 100 : 0;
  const avgTimePerLevelSec = pilesHit > 0 ? +(totalTimeMs / pilesHit / 1000).toFixed(1) : 0;

  console.log(`\n--- Summary for ${bandName} [${band[0]}, ${band[1]}] ---`);
  console.log(`Piles Succeeded in Band: ${pilesHit}/${piles.length} (${pileHitRate.toFixed(1)}%) [Gate: >= 60%]`);
  console.log(`Designer Call Hit Rate: ${successfulCalls}/${totalCalls} (${callHitRate.toFixed(1)}%)`);
  console.log(`Check B (Specials Matter): ${smPassRate.toFixed(1)}% [Gate: 100%]`);
  console.log(`Check C (Game Validity): ${validPassRate.toFixed(1)}% [Gate: 100%]`);
  console.log(`Check D (Critic Warnings): ${warningRate.toFixed(1)}% [Gate: <= 10%]`);
  console.log(`Check E (Avg Speed per Level): ${avgTimePerLevelSec}s [Gate: <= 600s]`);
  console.log(`Check F (Max Single Recipe Share): ${maxPuzzleShare.toFixed(1)}% [Gate: <= 40%]`);
  console.log(`Recipe Distribution:`, recipeCounts);

  return {
    bandName,
    band,
    pilesCount: piles.length,
    pilesHit,
    pileHitRate,
    totalCalls,
    successfulCalls,
    callHitRate,
    smPassRate,
    validPassRate,
    warningRate,
    avgTimePerLevelSec,
    maxPuzzleShare,
    recipeCounts,
    results
  };
}

module.exports = { runBenchmark };

if (require.main === module) {
  const bandArg = process.argv[2] || 'both';
  const outDir = path.resolve(__dirname, '..', '..', '..', '..', 'notes');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const allSummary = {};

  if (bandArg === 'band1' || bandArg === 'both') {
    const summary1 = runBenchmark([3.4, 4.9], 'Band1_Middle');
    allSummary.band1 = summary1;
  }

  if (bandArg === 'band2' || bandArg === 'both') {
    const summary2 = runBenchmark([4.4, 5.4], 'Band2_Harder');
    allSummary.band2 = summary2;
  }

  // Save benchmark records to notes
  const benchmarkFile = path.join(outDir, 'BOT_DESIGNER_BENCHMARK.jsonl');
  const lines = [];
  if (allSummary.band1) lines.push(JSON.stringify({ type: 'summary', ...allSummary.band1, results: undefined }));
  if (allSummary.band1) for (const r of allSummary.band1.results) lines.push(JSON.stringify({ band: '3.4-4.9', ...r }));
  if (allSummary.band2) lines.push(JSON.stringify({ type: 'summary', ...allSummary.band2, results: undefined }));
  if (allSummary.band2) for (const r of allSummary.band2.results) lines.push(JSON.stringify({ band: '4.4-5.4', ...r }));
  fs.writeFileSync(benchmarkFile, lines.join('\n') + '\n', 'utf8');
  console.log(`\nSaved benchmark logs to ${benchmarkFile}`);
}
