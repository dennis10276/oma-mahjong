'use strict';
const fs = require('fs');
const path = require('path');
const { decodeGame } = require('./personal_game_io.js');
const { reference } = require('./public_witness_reference.js');
const { legal } = require('./known_tray_plan.js');
const { PROFILES, SETTINGS, casesOf } = require('./public_witness_screen.js');
const Hard = require('../../../www/hard.js');

const inputPath = path.resolve('../personal-bot-review/source/analysis/archive/personal-bots/runs/public-retention-2026-10-20T00-22-52-038Z/input.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const cases = casesOf(data);

for (const lv of [112, 113]) {
  const entry = cases.find(c => c.name === 'Mrs. Doubtfire' && c.lv === lv);
  const decodedEntryGame = decodeGame(entry.game);
  console.log(`\n======================================================================`);
  console.log(`DETAILED FAILURE AUDIT: Mrs. Doubtfire Level ${lv}`);
  console.log(`======================================================================`);
  
  const selector = reference(PROFILES.recoveryFromTwo);
  const state = { ...decodeGame(entry.game), physicalLog: [] };
  const trace = [];

  const planning = (g, snapshot, actions) => {
    const result = selector.physicalTrayPlanning(g, snapshot, actions);
    const report = selector.report();
    const l = legal(g, snapshot);
    
    trace.push({
      step: state.physicalLog.length,
      moves: snapshot.moves,
      tray: [...snapshot.tray],
      alive: snapshot.alive.reduce((a, b) => a + b, 0),
      chosenIndex: report.index,
      chosenIsDown: !!snapshot.down[report.index],
      chosenKnownPic: snapshot.pictures[report.index],
      chosenActualFace: decodedEntryGame.faces[report.index],
      goal: report.goal,
      path: report.path,
      freeTiles: l.free.map(idx => ({
        idx,
        down: !!snapshot.down[idx],
        known: snapshot.pictures[idx],
        actual: decodedEntryGame.faces[idx]
      }))
    });
    return result;
  };

  const result = Hard.play(state, {
    ...Hard.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false, peek: 0, end: 0, plan: 0, physicalPlan: 0,
    kindModel: { weights: {} }, publicPicturePrior: data.observation.prior, physicalChoice: selector, physicalTrayPlanning: planning,
    physicalChoiceLimit: SETTINGS.choiceLimit
  }, SETTINGS.seed);

  console.log(`Result: win=${result.win}, why=${result.why}, moves=${result.moves}, left=${result.left}, tray=[${result.tray.join(',')}]`);
  
  // Print the last 15 steps
  const tail = trace.slice(-15);
  for (const t of tail) {
    console.log(`\nStep ${t.step} | Move ${t.moves} | Tray: [${t.tray.join(',')}] | Alive: ${t.alive}`);
    console.log(`  Chosen: Tile ${t.chosenIndex} (down: ${t.chosenIsDown}, known: ${t.chosenKnownPic}, actual: ${t.chosenActualFace}) Goal: ${t.goal} Path: [${t.path.join(',')}]`);
    console.log(`  Free tiles (${t.freeTiles.length}):`);
    for (const f of t.freeTiles) {
      const matchTray = f.known !== null && t.tray.includes(f.known);
      console.log(`    Tile ${f.idx}: down=${f.down}, known=${f.known}, actual=${f.actual} ${matchTray ? '<< MATCHES TRAY' : ''}`);
    }
  }
}
