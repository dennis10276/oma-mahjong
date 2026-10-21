'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { reference } = require('./public_witness_reference.js');
const { advance, legal } = require('./known_tray_plan.js');
const { analyze } = require('./public_dead_end.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function publicForensics(geometry, state, actions, selected, proofNodes = 1024) {
  const choices = actions.map(action => {
    const moved = advance(geometry, state, action.index);
    return { index: action.index, picture: state.pictures[action.index], down: state.down[action.index],
      uncertain: !!moved.uncertain, reason: moved.reason || null, lost: moved.lost ?? null,
      removed: moved.removed ?? null, resultingTray: moved.state?.tray ?? null,
      knownMatch: !moved.uncertain && !moved.lost && moved.state.tray.length < state.tray.length };
  });
  const chosen = choices.find(action => action.index === selected); assert(chosen);
  const knownSafeRemovals = choices.filter(action => !action.uncertain && !action.lost && action.removed > 0);
  const publicDeadEnd = analyze(geometry, state, actions, proofNodes);
  const thirdSlotCommitment = !chosen.uncertain && !chosen.lost && chosen.resultingTray.length > state.tray.length
    && chosen.resultingTray.length === 3;
  let successorProof = null;
  if (thirdSlotCommitment) {
    const moved = advance(geometry, state, selected), nextActions = legal(geometry, moved.state).free.map(index => ({ index }));
    if (nextActions.length) successorProof = analyze(geometry, moved.state, nextActions, proofNodes);
  }
  return { choices, chosen, thirdSlotCommitment, successorProof,
    knownSafeRemovalIndices: knownSafeRemovals.map(action => action.index),
    immediatelyAvoidableKnownLoss: !!chosen.lost && knownSafeRemovals.length > 0,
    publicDeadEnd, informationBoundary: choices.some(action => action.uncertain),
    note: 'Public-snapshot diagnostic only. A safe immediate removal is not necessarily a winning route. Reachable information or a bounded proof is not a death certificate. No actual concealed pictures or later revelations are supplied.' };
}

function encodeGeometry(game) {
  return { tiles: game.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })), nb: structuredClone(game.nb),
    rules: game.rules ? { ice: { ...game.rules.ice }, iceNb: structuredClone(game.rules.iceNb),
      locks: Array.from(game.rules.locks || []), keys: Array.from(game.rules.keys || []) } : null,
    clock: game.clock ? { ...game.clock } : null };
}

function decodeGeometry(game) {
  return { ...game, rules: game.rules ? { ...game.rules, locks: new Set(game.rules.locks || []) } : null };
}

function traceCase(entry, prior, options, settings) {
  const selector = reference(options), actual = { ...decodeGame(entry.game), physicalLog: [] }, frames = [], trace = [];
  let geometry = null;
  const planning = (game, state, actions) => {
    const planned = selector.physicalTrayPlanning(game, state, actions);
    if (!geometry) geometry = encodeGeometry(game);
    frames.push({ position: actual.physicalLog.length,
      state: { ...structuredClone(state), pictures: state.pictures.map((picture, index) => state.alive[index] ? picture : null) },
      actions: structuredClone(actions), plan: structuredClone(selector.report()) });
    return planned;
  };
  const result = Hard.play(actual, { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, forceMatches: false,
    peek: 0, end: 0, plan: 0, physicalPlan: 0, kindModel: { weights: {} }, publicPicturePrior: prior,
    physicalChoice: selector, physicalTrayPlanning: planning, physicalChoiceLimit: settings.choiceLimit }, settings.seed, trace);
  let knownPhysicalControls = 0, unknownChoices = 0, unsupportedChoices = 0;
  const game = decodeGeometry(geometry);
  Object.defineProperty(game, 'faces', { get() { throw Error('Forensics read private actual deck'); } });
  for (const frame of frames) {
    const moved = advance(game, frame.state, frame.plan.index), recorded = actual.physicalLog[frame.position];
    assert.equal(recorded.index, frame.plan.index);
    if (moved.uncertain) {
      if (moved.reason === 'unseenPicture') unknownChoices++; else unsupportedChoices++;
    } else {
      for (const key of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(recorded[key], moved.state[key]); knownPhysicalControls++;
    }
  }
  const measured = { result: { win: result.win, why: result.why, moves: result.moves, left: result.left, tray: result.tray, choices: result.decisions },
    computationCensored: result.why === 'contextChoiceLimit', knownPhysicalControls, unknownChoices, unsupportedChoices,
    physicalFrames: actual.physicalLog.length, autonomousUnmatchedFrames: actual.physicalLog.length - frames.length, planner: selector.stats() };
  const inspected = !result.win ? frames.filter(frame => {
    const moved = advance(game, frame.state, frame.plan.index);
    return frame.position >= frames.length - 8 || !moved.uncertain && moved.state.tray.length > frame.state.tray.length && moved.state.tray.length >= 3;
  }).map(frame => ({ position: frame.position, ...publicForensics(game, frame.state, frame.actions, frame.plan.index) })) : [];
  return { measured, geometry, frames, result, physicalLog: actual.physicalLog, trace, inspected };
}

function main(baselineFilename) {
  const baselineFile = path.resolve(baselineFilename), baselineBytes = fs.readFileSync(baselineFile), baseline = JSON.parse(baselineBytes);
  assert.equal(baseline.entries.length, 29);
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/reference-failures-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sourceHashes = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'), bytes = fs.readFileSync(filename), target = path.join(folder, 'sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' }); sourceHashes[relative] = hash(bytes);
  }
  const input = { made, targetMet: false, baselineFile, baselineSha256: hash(baselineBytes), entries: baseline.entries,
    settings: baseline.settings, options: baseline.options, observation: baseline.observation, sourceHashes,
    note: 'Complete29-case exact baseline reproduction with passive public callback capture and post-play public-only forensic probes. Dead tile pictures are masked in saved snapshots; no extra choice/RNG/memory query, free retry or altered physics. Symbolic observer, not screenshot perception or personal winning-try accuracy.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(input), { flag: 'wx' });
  const rows = [];
  for (const [position, entry] of baseline.entries.entries()) {
    const data = traceCase(entry, input.observation.prior, input.options, input.settings);
    const expected = baseline.rows.find(row => row.name === entry.name && row.start === entry.start && row.board === entry.board && row.cohort === entry.cohort); assert(expected);
    assert.deepEqual(data.measured, expected.measured, 'Passive tracing must reproduce every original result and planner/physics counter');
    const filename = position + '.json.gz', bytes = zlib.gzipSync(JSON.stringify(data)); fs.writeFileSync(path.join(folder, filename), bytes, { flag: 'wx' });
    const final = data.inspected.at(-1);
    const row = { name: entry.name, lv: entry.lv, cohort: entry.cohort, ...data.measured.result, frames: data.frames.length,
      thirdSlotCommitments: data.inspected.filter(frame => frame.thirdSlotCommitment).map(frame => frame.position),
      finalPublicProof: final?.publicDeadEnd ?? null, immediatelyAvoidableKnownLosses: data.inspected.filter(frame => frame.immediatelyAvoidableKnownLoss).length,
      filename, sha256: hash(bytes) };
    rows.push(row); fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(row) + '\n');
  }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(baselineFile)), hash(baselineBytes));
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ ...input, rows }), { flag: 'wx' });
  console.log(JSON.stringify({ folder, exactCases: rows.length, failures: rows.filter(row => !row.win) }));
}

if (require.main === module) main(process.argv[2]);
module.exports = { publicForensics, decodeGeometry };
