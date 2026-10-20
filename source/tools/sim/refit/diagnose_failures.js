'use strict';
const fs = require('fs');
const path = require('path');
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

for (const entry of targetCases) {
  const decoded = decodeGame(entry.game);
  const selector = reference(PROFILES.recoveryFromTwo);
  const state = { ...decodeGame(entry.game), physicalLog: [] };
  const history = [];

  const planning = (game, snapshot, actions) => {
    const result = selector.physicalTrayPlanning(game, snapshot, actions);
    const report = selector.report();
    const l = legal(game, snapshot);
    
    // Categorize available choices under zero foresight:
    const trayMatches = l.free.filter(idx => snapshot.pictures[idx] !== null && snapshot.tray.includes(snapshot.pictures[idx]));
    const peekMatches = l.free.filter(idx => snapshot.openPeek >= 0 && idx !== snapshot.openPeek && snapshot.pictures[idx] === snapshot.pictures[snapshot.openPeek]);
    // Known pairs on board
    const boardKnownPics = {};
    for (const idx of l.free) {
      if (snapshot.pictures[idx] !== null) {
        boardKnownPics[snapshot.pictures[idx]] = (boardKnownPics[snapshot.pictures[idx]] || 0) + 1;
      }
    }
    const boardPairs = l.free.filter(idx => snapshot.pictures[idx] !== null && boardKnownPics[snapshot.pictures[idx]] >= 2);
    const faceDowns = l.free.filter(idx => snapshot.down[idx] && snapshot.pictures[idx] === null);
    const nonMatchingKnown = l.free.filter(idx => snapshot.pictures[idx] !== null && !snapshot.tray.includes(snapshot.pictures[idx]) && !boardPairs.includes(idx));

    history.push({
      moves: snapshot.moves,
      tray: [...snapshot.tray],
      alive: snapshot.alive.reduce((a, b) => a + b, 0),
      clock: game.clock && snapshot.alive[game.clock.i] ? (game.clock.n - snapshot.moves) : null,
      chosenIndex: report.index,
      chosenIsDown: !!snapshot.down[report.index],
      chosenKnownPic: snapshot.pictures[report.index],
      chosenActualFace: decoded.faces[report.index],
      goal: report.goal,
      path: report.path,
      trayMatchesCount: trayMatches.length,
      peekMatchesCount: peekMatches.length,
      boardPairsCount: boardPairs.length,
      faceDownsCount: faceDowns.length,
      nonMatchingKnownCount: nonMatchingKnown.length
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

  console.log(`\n============================================================`);
  console.log(`CASE: ${entry.name} Lv ${entry.lv} | RESULT: win=${result.win}, why=${result.why}, moves=${result.moves}, left=${result.left}`);
  console.log(`Initial tiles: ${decoded.tiles.length}, Initial down: ${decoded.down.filter(Boolean).length}, Clock: ${decoded.clock ? `Tile ${decoded.clock.i} at ${decoded.clock.n} moves` : 'None'}`);

  // Find the moment when tray reached length 3
  const firstLen3 = history.findIndex(h => h.tray.length === 3);
  console.log(`First reached tray=3 at decision step ${firstLen3} (move ${history[firstLen3]?.moves})`);
  
  // Show decisions from tray >= 2 until end
  console.log(`Key decisions leading to terminal failure:`);
  const critical = history.slice(-8);
  for (const h of critical) {
    console.log(`  Move ${h.moves}: tray=[${h.tray}] clock=${h.clock} | CHOSEN: tile ${h.chosenIndex} (down=${h.chosenIsDown}, knownPic=${h.chosenKnownPic}, actual=${h.chosenActualFace}) goal=${h.goal} | avail: trayMatches=${h.trayMatchesCount}, boardPairs=${h.boardPairsCount}, faceDowns=${h.faceDownsCount}, nonMatchingKnown=${h.nonMatchingKnownCount}`);
  }
}
