'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { tasksOf, selectModels, actorOf } = require('./physical_count_data.js');
const { pinnedRead, memoryPinned } = require('./personal_context_runtime_audit.js');
const root = path.resolve(__dirname, '../../..');
const contextPinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-context-full-2026-10-18T05-17-41-214Z');

function preFinalState(game, frames) {
  assert(frames.length > 0);
  const cover = Hard.coverOf(game.tiles, game.nb), seen = new Uint8Array(game.tiles.length);
  let alive = game.tiles.map(() => 1), moves = 0, tray = [], openPeek = -1;
  const observe = () => {
    for (let index = 0; index < alive.length; index++) if (alive[index] && (!game.down[index]
      && !cover[index].some(above => alive[above]) || index === openPeek)) seen[index] = 1;
  };
  observe();
  for (const frame of frames.slice(0, -1)) {
    for (let index = 0; index < alive.length; index++) if (alive[index] && !frame.alive[index]) seen[index] = 1;
    if (frame.kind === 'flip') seen[frame.index] = 1;
    alive = frame.alive.slice(); moves = frame.moves; tray = frame.tray.slice(); openPeek = frame.openPeek;
    observe();
  }
  const remaining = alive.reduce((total, value) => total + value, 0);
  return { remaining, knownRemaining: alive.reduce((total, value, index) => total + +(value && seen[index]), 0),
    clockActive: !!(game.clock && alive[game.clock.i]), clockBudget: game.clock && alive[game.clock.i] ? game.clock.n - moves : null,
    tray: tray.length, openPeek, finalKind: frames.at(-1).kind };
}

function main() {
  const parent = pinnedRead(contextPinned, 'analysis/archive/personal-bots/physical-context-count-data.json');
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const held = new Set(parent.comparisonEpisodes), tasks = tasksOf().filter(task => held.has(task.name + '|' + task.start));
  assert.equal(tasks.length, 80);
  const fingerprintFiles = [...new Set([...parent.fingerprintFiles.filter(name => !name.includes('/experiments/')),
    'tools/sim/refit/personal_failure_stage_audit.js'])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), rows = [], players = {};
  for (const task of tasks) {
    const actor = actorOf(selectModels(bank, task).ownAll);
    for (let run = 0; run < 4; run++) {
      const game = { ...task.game, physicalLog: [] }, seed = 20261028 * 7919 + run * 104729;
      const result = Hard.play(game, { ...actor, physicalPlan: 8 }, seed);
      assert.notEqual(result.why, 'contextChoiceLimit');
      const before = game.physicalLog.length ? preFinalState(game, game.physicalLog) : null;
      rows.push({ name: task.name, level: task.lv, start: task.start, board: task.board, run, seed,
        win: result.win, why: result.why, left: result.left, moves: result.moves, beforeFinalTap: before });
    }
  }
  for (const name of [...new Set(tasks.map(task => task.name))]) {
    const samples = rows.filter(row => row.name === name), failures = samples.filter(row => !row.win);
    players[name] = { boards: tasks.filter(task => task.name === name).length, simulations: samples.length,
      wins: samples.filter(row => row.win).length, failures: failures.length,
      byCause: Object.fromEntries([...new Set(failures.map(row => row.why))].map(why => [why, failures.filter(row => row.why === why).length])),
      beforeFinalTap: Object.fromEntries([8, 12, 16, 24].map(limit => [limit, {
        remainingAtMost: failures.filter(row => row.beforeFinalTap?.remaining <= limit).length,
        allRemainingKnown: failures.filter(row => row.beforeFinalTap?.remaining <= limit
          && row.beforeFinalTap.remaining === row.beforeFinalTap.knownRemaining).length,
        allRemainingKnownClockOff: failures.filter(row => row.beforeFinalTap?.remaining <= limit
          && row.beforeFinalTap.remaining === row.beforeFinalTap.knownRemaining && !row.beforeFinalTap.clockActive).length }])) };
  }
  assert.equal(fingerprintOf(), fingerprint);
  const report = { made: new Date().toISOString(), evidence: 'autonomous-first-attempt-failure-stage-diagnostic', targetMet: false,
    runs: 4, profiles: ['ownAllPlan8'], fingerprint, fingerprintFiles,
    immutableParents: [contextPinned, memoryPinned].map(folder => ({ path: path.relative(root, folder).replace(/\\/g, '/'),
      manifestSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(folder, 'manifest.json'))).digest('hex') })),
    players, rows, note: 'Same 80 held new-level boards, four declared first-attempt seeds each, frozen own-person policies. '
      + 'No human target sequence or winning-try label is supplied to the bot. '
      + 'Known pictures are reconstructed from real prior simulated taps and exposed face-up pictures, before the final tap. '
      + 'These are diagnostic opportunities, not proof that an endgame solver could rescue a state or that a human would plan. '
      + 'This limited sample is not a winning-count forecast evaluation or an 80% success claim.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-failure-stage-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { preFinalState };
