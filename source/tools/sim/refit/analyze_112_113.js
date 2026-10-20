'use strict';
const fs = require('fs');
const path = require('path');
const { decodeGame } = require('./personal_game_io.js');
const { casesOf } = require('./public_witness_screen.js');
const Hard = require('../../../www/hard.js');
const { legal } = require('./known_tray_plan.js');

const inputPath = path.resolve('../personal-bot-review/source/analysis/archive/personal-bots/runs/public-retention-2026-10-20T00-22-52-038Z/input.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const cases = casesOf(data);

for (const lv of [112, 113]) {
  const entry = cases.find(c => c.name === 'Mrs. Doubtfire' && c.lv === lv);
  const game = decodeGame(entry.game);
  console.log(`\n======================================================`);
  console.log(`Analyzing Mrs. Doubtfire Level ${lv}`);
  console.log(`======================================================`);
  console.log(`Total tiles: ${game.tiles.length}, Clock: ${game.clock ? `Tile ${game.clock.i} in ${game.clock.n} moves` : 'none'}`);
  
  // What are the open tiles at deal?
  const n = game.tiles.length;
  const initialAlive = new Array(n).fill(1);
  const l = legal(game, { alive: initialAlive, down: game.down, tray: [], openPeek: -1, pictures: game.faces.map((f, i) => game.down[i] ? null : f) });
  console.log(`Initial free tiles count: ${l.free.length}`);
  const downCount = l.free.filter(i => game.down[i]).length;
  const upCount = l.free.filter(i => !game.down[i]).length;
  console.log(`  Face-down: ${downCount}, Face-up: ${upCount}`);
  
  // Face-up tile pictures at opening
  const upPics = l.free.filter(i => !game.down[i]).map(i => game.faces[i]);
  console.log(`  Face-up pictures: [${upPics.join(', ')}]`);
  
  // Any initial matching pairs among face-up tiles?
  const counts = {};
  for (const p of upPics) counts[p] = (counts[p] || 0) + 1;
  const openPairs = Object.entries(counts).filter(([p, c]) => c >= 2);
  console.log(`  Open pairs at deal: ${openPairs.length ? openPairs.map(([p, c]) => `face ${p} (${c})`).join(', ') : 'NONE!'}`);

  // Clock analysis
  if (game.clock) {
    const clockTile = game.clock.i;
    console.log(`  Clock tile: ${clockTile}, face: ${game.faces[clockTile]}, down: ${game.down[clockTile]}`);
    console.log(`  Clock blockers above: [${game.nb.above[clockTile].join(', ')}]`);
    console.log(`  Clock blockers left: [${game.nb.left[clockTile].join(', ')}]`);
    console.log(`  Clock blockers right: [${game.nb.right[clockTile].join(', ')}]`);
  }
}
