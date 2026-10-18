'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { PIDS, boardOf } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const { designed } = require('./boards.js');
const { actorOf, selectModels } = require('./physical_count_data.js');
const { prefixOf, reconstruct } = require('./personal_prefix_data.js');
const { pinnedRead, memoryPinned } = require('./personal_context_runtime_audit.js');
const root = path.resolve(__dirname, '../../..');
const parentPinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-episode-full-2026-10-18T06-19-34-227Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function clockExit(game, frames, trace = null, terminal = null) {
  if (!game.clock) return { hasClock: false };
  const exitIndex = frames.findIndex(frame => !frame.alive[game.clock.i]);
  const phase = frames.slice(0, exitIndex < 0 ? frames.length : exitIndex + 1);
  const exit = exitIndex < 0 ? null : frames[exitIndex];
  const last = frames.at(-1);
  const planned = trace === null ? null : trace.filter(event => Object.hasOwn(event, 'physicalPlan')).length;
  return { hasClock: true, exited: !!exit, clockBudget: game.clock.n,
    clockPhaseTaps: phase.length, plannedClockDecisions: planned,
    plannedShare: planned === null || !phase.length ? null : planned / phase.length,
    route: phase.map(frame => [frame.index, frame.kind]),
    exit: exit ? { taps: exitIndex + 1, moves: exit.moves, tray: exit.tray.length,
      remaining: exit.alive.reduce((total, value) => total + value, 0) } : null,
    postExitTaps: exit ? frames.length - exitIndex - 1 : null,
    postExitMoves: exit ? (last?.moves ?? exit.moves) - exit.moves : null,
    trayFailureWithinTwoMoves: terminal === null ? null : !!(exit && terminal.why === 'tray' && last.moves - exit.moves <= 2) };
}

function summarize(rows) {
  const clockRows = rows.filter(row => row.clock.hasClock), exits = clockRows.filter(row => row.clock.exited);
  const boards = [...new Set(clockRows.map(row => row.start))];
  const taps = clockRows.reduce((total, row) => total + row.clock.clockPhaseTaps, 0);
  const planned = clockRows.reduce((total, row) => total + row.clock.plannedClockDecisions, 0);
  return { simulations: rows.length, clockSimulations: clockRows.length, clockBoards: boards.length,
    wins: rows.filter(row => row.win).length, clockExits: exits.length,
    clockPhaseTaps: taps, plannedClockDecisions: planned, plannedShare: taps ? planned / taps : null,
    exitTrayCounts: Object.fromEntries([0, 1, 2, 3, 4].map(size => [size, exits.filter(row => row.clock.exit.tray === size).length])),
    trayFailuresWithinTwoMoves: exits.filter(row => row.clock.trayFailureWithinTwoMoves).length,
    identicalClockRoutesAcrossSeeds: boards.filter(start => new Set(clockRows.filter(row => row.start === start)
      .map(row => JSON.stringify(row.clock.route))).size === 1).length };
}

function main() {
  assert(process.argv[2], 'Supply the immutable copied-run input root');
  const inputRoot = path.resolve(process.argv[2]), manifestBytes = fs.readFileSync(path.join(inputRoot, 'run-manifest.json'));
  const manifest = JSON.parse(manifestBytes), inputHashes = {};
  const read = relative => {
    const bytes = fs.readFileSync(path.join(inputRoot, relative));
    assert.equal(hash(bytes), manifest.sourceInputs[relative], 'Frozen input changed: ' + relative);
    inputHashes[relative] = hash(bytes);
    return JSON.parse(bytes);
  };
  const parent = pinnedRead(parentPinned, 'analysis/archive/personal-bots/physical-plan-count-data.json');
  const held = new Set(parent.comparisonEpisodes), tasks = parent.rows.filter(row => held.has(row.name + '|' + row.start));
  assert.equal(tasks.length, 80);
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const plays = read('analysis/archive/realdata/plays.json'), recordings = {}, boards = new Map();
  for (const [name, pid] of Object.entries(PIDS)) {
    recordings[name] = read('analysis/archive/replays/' + pid + '.json');
    for (const chunks of Object.values(recordings[name])) for (const chunk of Object.values(chunks)) if (chunk?.data) {
      const init = JSON.parse(chunk.data).init;
      if (init && !init.partial && !init.track && init.state) {
        const game = boardOf(init);
        boards.set(boardId(game), game);
      }
    }
  }
  const sourceFiles = ['www/hard.js', 'www/layouts.js', ...fs.readdirSync(__dirname).filter(file => file.endsWith('.js')).sort()
    .map(file => 'tools/sim/refit/' + file)];
  const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const rows = [], human = [];
  for (const task of tasks) {
    const game = boards.get(task.board) || designed(task.version, task.lv);
    assert(game && boardId(game) === task.board, 'No exact held board: ' + task.name + '/' + task.lv);
    const actor = actorOf(selectModels(bank, task).ownAll);
    for (let run = 0; run < 4; run++) {
      const seed = 20261028 * 7919 + run * 104729, trace = [], state = { ...game, physicalLog: [] };
      const result = Hard.play(state, { ...actor, physicalPlan: 8 }, seed, trace);
      assert.notEqual(result.why, 'contextChoiceLimit');
      rows.push({ name: task.name, lv: task.lv, start: task.start, board: task.board, run, seed,
        win: result.win, why: result.why, clock: clockExit(game, state.physicalLog, trace, result) });
    }
    const opening = Object.values(plays[PIDS[task.name]] || {}).find(event => event.k === 'start' && event.t === task.start
      && event.lv === task.lv && event.m !== 'd' && !event.tk);
    const prefix = opening?.aid && recordings[task.name][opening.aid] ? prefixOf(recordings[task.name][opening.aid]) : null;
    const rebuilt = prefix && boardId(prefix.g) === task.board ? reconstruct({ ...prefix, aid: opening.aid }) : null;
    human.push({ name: task.name, lv: task.lv, start: task.start, board: task.board,
      status: rebuilt ? rebuilt.prefix.stopReason : 'unavailableExactOpeningPrefix',
      complete: rebuilt?.prefix.complete ?? false,
      clock: rebuilt ? clockExit(game, rebuilt.state.physicalLog) : null });
  }
  for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected);
  for (const [file, expected] of Object.entries(inputHashes)) assert.equal(hash(fs.readFileSync(path.join(inputRoot, file))), expected);
  const players = Object.fromEntries(Object.keys(PIDS).map(name => [name, {
    autonomous: summarize(rows.filter(row => row.name === name)),
    human: { boards: human.filter(row => row.name === name).length,
      observedClockExits: human.filter(row => row.name === name && row.clock?.exited).length,
      exitTrayCounts: Object.fromEntries([0, 1, 2, 3, 4].map(size => [size, human.filter(row => row.name === name
        && row.clock?.exit?.tray === size).length])),
      unavailableOrCensoredWithoutExit: human.filter(row => row.name === name && (!row.clock || row.clock.hasClock && !row.clock.exited && !row.complete)).length } }]));
  const report = { made: new Date().toISOString(), evidence: 'clock-controller-ownership-diagnostic', targetMet: false,
    inputRoot, inputManifestSha256: hash(manifestBytes), inputHashes, sourceHashes, runs: 4,
    comparisonEpisodes: parent.comparisonEpisodes, players, rows, human,
    note: 'Same 80 held boards and declared first-attempt seeds; independently fitted ownAll actors. '
      + 'Human opening actions are used only after autonomous simulation for descriptive comparison, never as bot inputs. '
      + 'Unavailable/censored human openings remain explicit. Exit pressure and route diversity diagnose the generic clock controller, '
      + 'not winning-count accuracy or causal proof that any alternative route is better.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-clock-exit-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { clockExit, summarize };
