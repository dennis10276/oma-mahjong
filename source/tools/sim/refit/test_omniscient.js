'use strict';
const fs = require('fs');
const path = require('path');
const { decodeGame } = require('./personal_game_io.js');
const { casesOf } = require('./public_witness_screen.js');
const Hard = require('../../../www/hard.js');

const inputPath = path.resolve('../personal-bot-review/source/analysis/archive/personal-bots/runs/public-retention-2026-10-20T00-22-52-038Z/input.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const cases = casesOf(data);

const doubtfireCases = cases.filter(c => c.name === 'Mrs. Doubtfire' && [106, 107, 109, 112, 113].includes(c.lv));

for (const entry of doubtfireCases) {
  const game = decodeGame(entry.game);
  console.log(`\nChecking Mrs. Doubtfire Lv ${entry.lv}:`);
  
  // Create an omniscient game where all faces are revealed (down is all 0)
  // Can a depth-first search or greedy solver find a winning sequence?
  const n = game.tiles.length;
  console.log(`Total tiles: ${n}, Clock: ${game.clock ? `tile ${game.clock.i} in ${game.clock.n} moves` : 'none'}`);

  // Omniscient solver: DFS with memoization on visited state
  function solveOmniscient() {
    // Initial state: all alive, empty tray, moves=0
    const initialAlive = new Uint8Array(n).fill(1);
    const faces = game.faces;
    const memo = new Set();
    let bestLeft = n;

    function dfs(alive, tray, moves, clockLeft) {
      const leftCount = alive.reduce((a, b) => a + b, 0);
      if (leftCount === 0 && tray.length === 0) return true;
      if (tray.length >= 4) return false;
      if (game.clock && clockLeft !== null && clockLeft <= 0 && alive[game.clock.i]) return false;

      if (leftCount < bestLeft) {
        bestLeft = leftCount;
      }

      // State key for memo
      // tray sorted
      const trayKey = tray.slice().sort((a,b)=>a-b).join(',');
      const aliveKey = alive.join('');
      const key = `${aliveKey}|${trayKey}|${clockLeft}`;
      if (memo.has(key)) return false;
      if (memo.size > 200000) return null; // cap
      memo.add(key);

      // Find free tiles
      const free = [];
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        // Check blockers above
        let blocked = false;
        for (const a of game.nb.above[i]) {
          if (alive[a]) { blocked = true; break; }
        }
        if (blocked) continue;
        // Check left/right
        let leftBlocked = false;
        for (const l of game.nb.left[i]) {
          if (alive[l]) { leftBlocked = true; break; }
        }
        let rightBlocked = false;
        for (const r of game.nb.right[i]) {
          if (alive[r]) { rightBlocked = true; break; }
        }
        if (!leftBlocked || !rightBlocked) {
          free.push(i);
        }
      }

      if (free.length === 0) return false;

      // 1. Prioritize immediate matches with tray
      for (const i of free) {
        const pic = faces[i];
        if (tray.includes(pic)) {
          // match!
          const nextAlive = new Uint8Array(alive);
          nextAlive[i] = 0;
          const nextTray = [...tray];
          nextTray.splice(nextTray.indexOf(pic), 1);
          const nextClock = (clockLeft !== null && alive[game.clock.i]) ? clockLeft - 1 : null;
          const res = dfs(nextAlive, nextTray, moves + 1, nextClock);
          if (res) return true;
        }
      }

      // 2. Prioritize pairs among free tiles
      const freeByFace = new Map();
      for (const i of free) {
        const pic = faces[i];
        if (!freeByFace.has(pic)) freeByFace.set(pic, []);
        freeByFace.get(pic).push(i);
      }
      for (const [pic, indices] of freeByFace) {
        if (indices.length >= 2) {
          const [i1, i2] = indices;
          const nextAlive = new Uint8Array(alive);
          nextAlive[i1] = 0;
          nextAlive[i2] = 0;
          const nextClock = (clockLeft !== null && alive[game.clock.i]) ? clockLeft - 2 : null;
          const res = dfs(nextAlive, tray, moves + 2, nextClock);
          if (res) return true;
        }
      }

      // 3. If tray has room, try adding a tile
      if (tray.length < 3) {
        // Order free tiles: clock cone / blocking first, then others
        for (const i of free) {
          const pic = faces[i];
          const nextAlive = new Uint8Array(alive);
          nextAlive[i] = 0;
          const nextTray = [...tray, pic];
          const nextClock = (clockLeft !== null && alive[game.clock.i]) ? clockLeft - 1 : null;
          const res = dfs(nextAlive, nextTray, moves + 1, nextClock);
          if (res) return true;
        }
      }

      return false;
    }

    const clockLeft = game.clock ? game.clock.n : null;
    const solved = dfs(initialAlive, [], 0, clockLeft);
    console.log(`  Omniscient result: solved=${solved}, bestLeft=${bestLeft}, memoNodes=${memo.size}`);
    return solved;
  }

  solveOmniscient();
}
