'use strict';
const assert = require('assert/strict');
const { spawnSync } = require('child_process');

const worker = String.raw`
const path = require('path');
const root = process.argv[1];
require(path.join(root, 'human_reference_ablation.js')).install(process.argv[2]);
const { loadRecordedClears } = require(path.join(root, 'human_reference_catalog.js'));
const { decodeGame } = require(path.join(root, 'personal_game_io.js'));
const { playHumanCampaign } = require(path.join(root, 'human_reference_campaign.js'));
const { publicContextFor } = require(path.join(root, 'human_reference_screen.js'));
(async () => {
  const level = Number(process.argv[3]), planning = JSON.parse(process.argv[4]);
  const catalog = await loadRecordedClears({ selectedLevels: [level] });
  const entry = catalog.rows.find(row => row.lv === level);
  if (!entry?.game) throw Error('Requested development board unavailable');
  const game = decodeGame(entry.game);
  const result = playHumanCampaign(game, { maximumAttempts: Math.max(1, entry.wonOn - 1), captureDecisions: true, planning,
    publicContext: publicContextFor(entry) });
  console.log(JSON.stringify({ mode: process.argv[2], clock: game.clock, wonOn: result.wonOn, status: result.status,
    slowestMs: result.slowestMs, attempts: result.attempts.map(attempt => ({ taps: attempt.taps, left: attempt.left,
      status: attempt.status, decisions: attempt.decisions })) }));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

function compareTraces(first, second, clock) {
  const common = Math.min(first.length, second.length);
  let divergence = 0;
  while (divergence < common && first[divergence].index === second[divergence].index
    && first[divergence].accepted === second[divergence].accepted) divergence++;
  const describe = (choice, offset) => ({ decision: offset + 1, physicalTaps: choice.state.physicalTaps,
    index: choice.index, accepted: choice.accepted, picture: choice.state.pictures[choice.index], down: choice.state.down[choice.index],
    tray: choice.state.tray, moves: choice.state.moves, clockAlive: clock ? choice.state.alive[clock.i] : null,
    goal: choice.plan.goal, path: choice.plan.path,
    unknownAlive: choice.state.alive.reduce((sum, alive, index) => sum + +(alive && choice.state.pictures[index] === null), 0) });
  const window = decisions => decisions.flatMap((choice, offset) => offset >= Math.max(0, divergence - 1) && offset <= divergence + 5
    ? [describe(choice, offset)] : []);
  return { commonDecisions: divergence, firstDifferentDecision: divergence < Math.max(first.length, second.length) ? divergence + 1 : null,
    sameProjectionAtDivergence: divergence < common ? JSON.stringify(first[divergence].state) === JSON.stringify(second[divergence].state) : null,
    current: window(first), alternative: window(second) };
}

function readTrace(mode, level, settings) {
  const result = spawnSync(process.execPath, ['-e', worker, __dirname, mode, String(level), settings],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Diagnostic child failed');
  return JSON.parse(result.stdout);
}

function main(levelText, mode = 'firstVisit', settings = '{}', attemptText = '1', alternativeSettings) {
  const level = Number(levelText), attempt = Number(attemptText);
  assert(Number.isInteger(level) && level > 0 && Number.isInteger(attempt) && attempt > 0);
  assert(['firstVisit', 'noBounds', 'both', 'noOutcomeMemory', 'profile'].includes(mode));
  assert(mode !== 'profile' || typeof alternativeSettings === 'string', 'A profile comparison requires explicit alternative settings');
  const current = readTrace('current', level, settings), alternative = readTrace(mode === 'profile' ? 'current' : mode, level, alternativeSettings ?? settings);
  assert(current.attempts[attempt - 1] && alternative.attempts[attempt - 1], 'Requested attempt does not exist in both campaigns');
  const summary = result => ({ mode: result.mode, wonOn: result.wonOn, status: result.status, slowestMs: result.slowestMs,
    attempts: result.attempts.map(({ decisions, ...attempt }) => attempt) });
  console.log(JSON.stringify({ diagnostic: true, level, attempt, current: { ...summary(current), planning: JSON.parse(settings) },
    alternative: { ...summary(alternative), planning: JSON.parse(alternativeSettings ?? settings) },
    comparison: compareTraces(current.attempts[attempt - 1].decisions, alternative.attempts[attempt - 1].decisions, current.clock),
    note: 'Fresh-process comparison of actual visibility-gated controller records; full traces stay in memory and only the first divergent window is printed. Explicit ablation/profile comparison, not a canonical frozen-policy claim.' }));
}

if (require.main === module) main(...process.argv.slice(2));
module.exports = { compareTraces };
