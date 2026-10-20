'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { reference } = require('./public_witness_reference.js');
const { advance, legal } = require('./known_tray_plan.js');
const { PROFILES, SETTINGS } = require('./public_witness_screen.js');

const inputPath = path.resolve('../personal-bot-review/source/analysis/archive/personal-bots/runs/public-retention-2026-10-20T00-22-52-038Z/input.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const targetCases = [
  ...data.cases.filter(c => c.name === 'Mrs. Doubtfire' && [106, 107, 109, 112, 113].includes(c.lv)),
  ...data.baseline.input.entries.filter(e => e.name === 'Dennisisdebeste' && e.lv === 150)
];

console.log(`Analyzing ${targetCases.length} cases...`);

for (const entry of targetCases) {
  console.log(`\n======================================================================`);
  console.log(`${entry.name.toUpperCase()} LEVEL ${entry.lv} (Board: ${entry.board.slice(0, 16)}...)`);
  console.log(`======================================================================`);

  const decoded = decodeGame(entry.game);
  console.log(`Total tiles: ${decoded.tiles.length}, Clock: ${decoded.clock ? `tile ${decoded.clock.i} at ${decoded.clock.n} moves` : 'None'}`);

  // Count face-down tiles at deal
  const faceDownAtDeal = decoded.down ? decoded.down.filter(Boolean).length : 0;
  console.log(`Face-down tiles at deal: ${faceDownAtDeal}`);

  // Omniscient test: can Hard.play with perfect information solve it?
  // Let's test standard greedy/search if omniscient
  const omniState = { ...decodeGame(entry.game), physicalLog: [] };
  // Check if standard game engine can play it
  const omniPlay = Hard.play(omniState, {
    ...Hard.P,
    physicalFlips: true,
    allMoves: true,
    flips: true,
    forceMatches: false,
    peek: 0, end: 0, plan: 0, physicalPlan: 0,
    physicalChoiceLimit: SETTINGS.choiceLimit
  }, SETTINGS.seed);
  console.log(`Default engine baseline: win=${omniPlay.win}, why=${omniPlay.why}, moves=${omniPlay.moves}, left=${omniPlay.left}`);

  // Now trace with reference bot
  const selector = reference(PROFILES.recoveryFromTwo);
  const state = { ...decodeGame(entry.game), physicalLog: [] };
  const trace = [];

  const planning = (game, snapshot, actions) => {
    const result = selector.physicalTrayPlanning(game, snapshot, actions);
    const report = selector.report();
    const l = legal(game, snapshot);
    const freeWithPictures = l.free.map(idx => ({
      index: idx,
      isDown: !!snapshot.down[idx],
      knownPic: snapshot.pictures[idx],
      actualPic: decoded.faces[idx],
      matchesTray: snapshot.pictures[idx] !== null && snapshot.tray.includes(snapshot.pictures[idx]),
      matchesPeek: snapshot.openPeek >= 0 && idx !== snapshot.openPeek && snapshot.pictures[idx] === snapshot.pictures[snapshot.openPeek]
    }));

    trace.push({
      step: state.physicalLog.length,
      moves: snapshot.moves,
      tray: [...snapshot.tray],
      openPeek: snapshot.openPeek,
      aliveCount: snapshot.alive.reduce((a, b) => a + b, 0),
      chosenIndex: report.index,
      chosenPic: snapshot.pictures[report.index],
      chosenActualPic: decoded.faces[report.index],
      chosenIsDown: !!snapshot.down[report.index],
      goal: report.goal,
      path: report.path,
      freeTilesCount: l.free.length,
      freeWithPictures,
      clockAlive: game.clock ? snapshot.alive[game.clock.i] : false,
      clockMovesRemaining: game.clock && snapshot.alive[game.clock.i] ? (game.clock.n - snapshot.moves) : null,
      knownWin: report.knownWin,
      safeClockExit: report.safeClockExit,
      information: report.information,
      knownDead: report.knownDead,
      nodes: report.nodes
    });
    return result;
  };

  const result = Hard.play(state, {
    ...Hard.P,
    physicalFlips: true,
    allMoves: true,
    flips: true,
    forceMatches: false,
    peek: 0, end: 0, plan: 0, physicalPlan: 0,
    kindModel: { weights: {} },
    publicPicturePrior: data.observation.prior,
    physicalChoice: selector,
    physicalTrayPlanning: planning,
    physicalChoiceLimit: SETTINGS.choiceLimit
  }, SETTINGS.seed);

  console.log(`Reference Bot result: win=${result.win}, why=${result.why}, moves=${result.moves}, left=${result.left}, tray=[${result.tray.join(',')}]`);

  // Analyze the critical branch point: when did tray occupancy go to 3, and what happened next?
  console.log(`\n--- Critical Branch Analysis ---`);
  for (let i = 0; i < trace.length; i++) {
    const t = trace[i];
    if (t.tray.length >= 2 || i >= trace.length - 8) {
      console.log(`[Step ${t.step} | Move ${t.moves}] Tray: [${t.tray.join(',')}] (len ${t.tray.length}) | ClockRem: ${t.clockMovesRemaining}`);
      console.log(`  Chosen: tile ${t.chosenIndex} (down: ${t.chosenIsDown}, knownPic: ${t.chosenPic}, actualPic: ${t.chosenActualPic}), goal: ${t.goal}, path: [${t.path.join(',')}]`);
      const trayMatchesAvailable = t.freeWithPictures.filter(f => f.matchesTray);
      const peekMatchesAvailable = t.freeWithPictures.filter(f => f.matchesPeek);
      const faceDownFree = t.freeWithPictures.filter(f => f.isDown);
      const faceUpKnown = t.freeWithPictures.filter(f => !f.isDown && f.knownPic !== null && !f.matchesTray && !f.matchesPeek);
      console.log(`  Available free tiles (${t.freeTilesCount}): trayMatches=[${trayMatchesAvailable.map(f=>f.index)}], peekMatches=[${peekMatchesAvailable.map(f=>f.index)}], faceDownFree=[${faceDownFree.map(f=>f.index)}], faceUpKnown=[${faceUpKnown.map(f=>f.index + ':' + f.knownPic)}]`);
    }
  }
}
