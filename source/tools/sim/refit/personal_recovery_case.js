'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const { designed } = require('./boards.js');
const { legal, advance } = require('./known_tray_plan.js');
const { analyzeRecovery } = require('./public_recovery_graph.js');
const Hard = require('../../../www/hard.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function replayTaps(game, taps) {
  let state = { alive: game.tiles.map(() => 1), pictures: game.faces.slice(), down: Array.from(game.down),
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [] };
  const frames = [], take = [];
  for (const tap of taps) {
    const before = state, moved = advance(game, state, tap.index);
    assert(!moved.uncertain && !moved.lost, 'Retrospective physical tap is unresolved or losing');
    state = moved.state;
    const removed = before.alive.flatMap((alive, index) => alive && !state.alive[index] ? [index] : []);
    if (removed.length) take.push(tap.index, ...removed.filter(index => index !== tap.index));
    else take.push(-tap.index - 1);
    frames.push({ index: tap.index, kind: removed.length ? 'take' : 'flip', moves: state.moves,
      alive: state.alive, tray: state.tray, openPeek: state.openPeek, originalStep: tap.originalStep, deferredBee: !!tap.deferredBee });
  }
  const physical = { ...game, follow: take, policyLog: [], physicalLog: [], log: [],
    tapTimes: taps.map(tap => tap.time), settleBefore: taps.map(() => true) };
  const result = Hard.play(physical, { ...Hard.P, physicalFlips: true, physicalSingleStep: false,
    peek: 0, end: 0, plan: 0, forceMatches: false }, 1);
  assert.equal(physical.physicalLog.length, frames.length);
  for (const [index, frame] of frames.entries()) for (const field of ['index', 'kind', 'moves', 'alive', 'tray', 'openPeek']) {
    assert.deepEqual(physical.physicalLog[index][field], frame[field], 'Retrospective light/real physics differ at ' + index + '/' + field);
  }
  return { state, frames, result, maximumTray: Math.max(0, ...frames.map(frame => frame.tray.length)),
    physicalFrameControls: frames.length };
}

function main() {
  const name = process.argv[2] || 'Dennisisdebeste', level = +(process.argv[3] || 150);
  assert(PIDS[name] && Number.isInteger(level) && level > 0);
  const playsFile = 'analysis/archive/realdata/plays.json', plays = JSON.parse(fs.readFileSync(path.join(root, playsFile)));
  const events = Object.values(plays[PIDS[name]] || {}).filter(event => event.lv === level && event.m !== 'd' && !event.tk).sort((left, right) => left.t - right.t);
  const ending = events.filter(event => event.k === 'end' && event.r === 'win').at(-1);
  assert(ending, 'A completed winning case is required; do not infer a future outcome');
  const games = recordings()[name].filter(game => game.lv === level && game.t <= ending.t);
  const game = games.find(game => game.aid === ending.aid);
  assert(game && game.openingRecorded);
  const captures = [];
  const planning = (publicGame, state, actions) => {
    captures.push({ game: publicGame, state, actions });
    return { features: actions.map(() => [0, 0, 0, 0, 0]), nodes: 0, boundaries: 0 };
  };
  const baseline = reconstruct(game, false, null, true), observed = reconstruct(game, false, null, true, planning);
  assert(baseline && observed && !observed.prefix.physicsBoundary);
  assert.deepEqual(observed.result, baseline.result);
  assert.deepEqual(observed.state.physicalLog, baseline.state.physicalLog);
  assert.deepEqual(observed.prefix.decisions.map(({ knownPlan, ...decision }) => decision), baseline.prefix.decisions);
  assert.equal(captures.length, observed.prefix.decisions.length); assert.equal(captures.length, game.actions.length);
  const remaining = state => state.alive.flatMap((alive, index) => alive ? [{ index, picture: state.pictures[index],
    down: state.down[index], ...game.g.tiles[index] }] : []);
  const candidates = [];
  for (let index = Math.max(0, game.actions.length - 35); index < game.actions.length - 1; index++) {
    const action = game.actions[index], before = captures[index], after = captures[index + 1];
    if (action.kind !== 'take' || before.state.tray.length !== 2 || action.tray.length !== 3) continue;
    assert.deepEqual(action.alive, after.state.alive);
    assert.deepEqual(action.tray, after.state.tray);
    const moved = advance(before.game, before.state, action.index);
    assert(!moved.uncertain && !moved.lost);
    assert.deepEqual(moved.state.alive, action.alive); assert.deepEqual(moved.state.tray, action.tray);
    const recovery = analyzeRecovery(after.game, after.state, { nodes: 100000 });
    const publicOptions = legal(after.game, after.state).free.map(tile => ({ index: tile, picture: after.state.pictures[tile],
      knownTrayMatch: after.state.pictures[tile] !== null && after.state.tray.includes(after.state.pictures[tile]),
      down: after.state.down[tile], openPeek: tile === after.state.openPeek }));
    const followed = game.actions.slice(index + 1, index + 9).map((next, offset) => ({ step: index + offset + 2,
      index: next.index, picture: game.g.faces[next.index], kind: next.kind, time: next.time, tray: next.tray,
      left: next.alive.filter(Boolean).length }));
    candidates.push({ step: index + 1, time: action.time, tile: action.index, picture: game.g.faces[action.index],
      beforeTray: before.state.tray, afterTray: after.state.tray, left: action.alive.filter(Boolean).length,
      allLivePicturesKnown: remaining(after.state).every(tile => tile.picture !== null),
      publicState: after.state, remainingTiles: remaining(after.state), publicOptions, recovery, observedContinuation: followed });
  }
  const previousAttempts = games.map(previous => {
    const rebuilt = reconstruct(previous, false, null, true);
    assert(rebuilt && !rebuilt.prefix.physicsBoundary);
    return { aid: previous.aid, displayedAttempt: previous.at, opening: previous.t, availableAt: previous.availableAt,
      board: boardId(previous.g), manualChoices: previous.actions.length, stopReason: previous.stopReason,
      ending: previous.ending, reconstructed: rebuilt.prefix.reconstructed };
  });
  assert(previousAttempts.every(attempt => attempt.board === boardId(game.g)));
  let beeDeferral = null;
  if (name === 'Dennisisdebeste' && level === 150) {
    const originalTaps = game.actions.map((action, index) => ({ index: action.index, time: action.time, originalStep: index + 1 }));
    const original = replayTaps(game.g, originalTaps);
    assert.deepEqual(original.frames.map(({ originalStep, deferredBee, ...frame }) => frame), observed.state.physicalLog);
    const beePosition = game.actions.findIndex(action => action.time === 272415 && action.index === 28);
    assert.equal(beePosition, 188); assert.equal(game.g.faces[28], 1);
    assert.equal(captures[beePosition].state.tray.length, 1); assert.equal(game.actions[beePosition].tray.length, 2);
    const partner = game.actions.findIndex((action, index) => index > beePosition && action.index === 31);
    assert.equal(partner, 201); assert.equal(game.g.faces[31], 1);
    const deferred = originalTaps.flatMap((tap, index) => index === beePosition ? []
      : index === partner ? [tap, { index: 28, time: tap.time + 1, originalStep: null, deferredBee: true }] : [tap]);
    const counterfactual = replayTaps(game.g, deferred);
    assert.equal(counterfactual.frames.length, original.frames.length);
    assert.deepEqual(counterfactual.state.alive, original.state.alive);
    assert.deepEqual(counterfactual.state.tray, original.state.tray);
    assert.equal(counterfactual.state.moves, original.state.moves);
    const inserted = counterfactual.frames.findIndex(frame => frame.deferredBee);
    assert.equal(counterfactual.frames[inserted - 1].index, 31);
    assert.equal(counterfactual.frames[inserted - 1].kind, 'flip');
    assert.equal(counterfactual.frames[inserted - 1].openPeek, 31);
    assert.equal(counterfactual.frames[inserted].kind, 'take');
    assert.equal(counterfactual.frames[inserted - 1].alive.filter(Boolean).length - counterfactual.frames[inserted].alive.filter(Boolean).length, 2);
    const originalWindow = original.frames.slice(beePosition, partner + 1);
    const deferredWindow = counterfactual.frames.filter(frame => frame.originalStep >= beePosition + 1 && frame.originalStep <= partner + 1 || frame.deferredBee);
    assert.equal(Math.max(...originalWindow.map(frame => frame.tray.length)), 3);
    assert.equal(Math.max(...deferredWindow.map(frame => frame.tray.length)), 2);
    beeDeferral = { humanClarification: JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/level150-user-clarification.json'))),
      originalStep: beePosition + 1, tile: 28, picture: 1, time: game.actions[beePosition].time,
      heldUntilStep: partner + 1, heldForMs: game.actions[partner].time - game.actions[beePosition].time,
      deferredUntilAfterStep: partner + 1, mate: 31, originalMaximumTray: original.maximumTray,
      counterfactualMaximumTray: counterfactual.maximumTray, originalManualTaps: original.frames.length,
      originalWindowMaximumTray: 3, counterfactualWindowMaximumTray: 2,
      originalWindowThirdSlotStates: originalWindow.filter(frame => frame.tray.length === 3).length,
      counterfactualWindowThirdSlotStates: deferredWindow.filter(frame => frame.tray.length === 3).length,
      counterfactualManualTaps: counterfactual.frames.length, exactCounterfactualPhysicsControls: counterfactual.physicalFrameControls,
      finalAliveIdentical: true, finalTrayIdentical: true, finalMovesIdentical: true, finalLeft: counterfactual.result.left,
      changedWindow: counterfactual.frames.filter(frame => frame.originalStep >= beePosition + 1 && frame.originalStep <= partner + 2 || frame.deferredBee),
      note: 'Retrospective constructive alternative, NOT a forecast or a guarantee the player would choose it. '
        + 'Leave the visible bee28 on the board, keep all other actual taps, and probe31 at its actual time. '
        + 'Without a bee in the tray that tap reveals31 instead of taking it. Its bee face is THEN public; '
        + 'tap the still-free visible bee28 immediately, atomically pairing with peek31. '
        + 'The inserted choice uses a newly exposed mate, not a future hidden face. Full recorded faces serve '
        + 'only as the physical environment for exact transition validation, never as bot-choice features. '
        + 'All209 light/real-engine frames match; the same pre-auto six-tile state is reached with the same tap count. '
        + 'Human says the earlier second-slot bee felt unnecessary, not that either third-slot move was a motor misclick.' };
  }
  const fingerprintFiles = [...new Set([playsFile, 'analysis/archive/realdata/snapshot.json', 'www/tiles.js',
    ...(beeDeferral ? ['analysis/personal-bots/level150-user-clarification.json'] : []),
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/'))])].sort();
  const sourceHashes = Object.fromEntries(fingerprintFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const oldDesigned = designed('1.57', level);
  const report = { made: new Date().toISOString(), evidence: 'retrospective-public-recovery-case', targetMet: false,
    name, level, aid: game.aid, version: ending.v, board: boardId(game.g), opening: game.t, availableAt: game.availableAt,
    actualDisplayedWinningAttempt: ending.at, old157BoardIdentical: !!oldDesigned && boardId(oldDesigned) === boardId(game.g),
    observedManualDecisions: game.actions.length, exactPhysicalFrameControls: game.actions.length,
    finalManualState: { left: observed.result.left, tray: observed.state.physicalLog.at(-1).tray, stopReason: game.stopReason },
    endEvent: ending, previousAttempts, candidates, beeDeferral, sourceHashes,
    note: 'A retrospective case, not a newly frozen winning-attempt prediction. The clarified bee event concerns unnecessary '
      + 'second-slot pressure, not either third-slot event. Public before-action observations reproduce every physical frame exactly. '
      + 'Known-picture routes assume perfect recall of what was actually exposed, not knowledge of hidden recording faces. '
      + 'Observed continuation pictures describe real later taps only; they never enter the counterfactual public recovery graph. '
      + 'Final automatic cleanup is explicitly separated from manual behavior. No universal greedy rule or80% claim follows from one successful case.' };
  for (const [file, digest] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), digest);
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-recovery-level' + level + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, level, aid: game.aid, observedManualDecisions: game.actions.length,
    finalManualState: report.finalManualState, beeDeferral, candidates: candidates.map(candidate => ({ step: candidate.step, time: candidate.time,
      tile: candidate.tile, picture: candidate.picture, left: candidate.left, allLivePicturesKnown: candidate.allLivePicturesKnown,
      recovery: candidate.recovery, observedContinuation: candidate.observedContinuation })) }, null, 2));
}

if (require.main === module) main();
module.exports = { replayTaps };
