'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const Layouts = require('../../../www/layouts.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const defaultProfile = require('./human_level_measure_profile.json');
const { captureSources } = require('./human_level_sources.js');
const sourceSnapshot = captureSources(module);

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function normalizeBoard(input) {
  const board = Array.isArray(input.tiles) ? input : input.game ?? input.board;
  assert(board && Array.isArray(board.tiles) && board.tiles.length > 0);
  const packed = Array.isArray(board.tiles[0]);
  const tiles = Array.from(board.tiles, tile => packed ? { x: tile[0], y: tile[1], z: tile[2] } : { x: tile.x, y: tile.y, z: tile.z });
  const values = Array.from(board.down ?? []);
  const indices = packed || values.length !== tiles.length;
  if (indices) assert(values.every(index => Number.isInteger(index) && index >= 0 && index < tiles.length));
  const faceDown = new Set(indices ? values : []);
  const down = indices ? tiles.map((tile, index) => +faceDown.has(index)) : values;
  const obstacle = board.rules ?? board.obst;
  const rows = values => Array.from(values, row => Array.from(row));
  const neighbors = board.nb ? Object.fromEntries(['above', 'left', 'right'].map(name => [name, rows(board.nb[name])])) : Layouts.neighbors(tiles);
  const encoded = encodeGame({ tiles, nb: neighbors, faces: board.faces, down,
    rules: obstacle ? { ice: obstacle.ice ?? obstacle.need ?? {}, iceNb: obstacle.iceNb ? rows(obstacle.iceNb) : Layouts.iceNeighbors(tiles),
      locks: obstacle.locks ?? null, keys: obstacle.keys ?? [] } : null, clock: board.clock ?? null });
  assert.deepEqual(encoded.nb, Layouts.neighbors(tiles), 'Board neighbors must match production geometry');
  if (encoded.rules) assert.deepEqual(encoded.rules.iceNb, Layouts.iceNeighbors(tiles), 'Ice neighbors must match production geometry');
  return encoded;
}

function lossType(attempt) {
  if (attempt.status === 'cleared') return null;
  if (attempt.why === 'clock') return 'clock_expired';
  if (attempt.why === 'tray') {
    const unseenTwin = attempt.tray.some(picture => !attempt.last.pictures.some((known, index) => attempt.last.alive[index] && known === picture));
    return unseenTwin ? 'tray_full_unseen_partner' : 'tray_full_known_or_blocked_partner';
  }
  if (attempt.why === 'stuck') return 'stuck_geometry_or_obstacles';
  if (attempt.status === 'unresolvedBudget') return 'decision_limit';
  if (attempt.status === 'unresolvedPublicFrontier') return 'unresolved_public_frontier';
  return 'unresolved';
}

function createMeasurer(planning = defaultProfile) {
  const frozenProfile = structuredClone(planning);
  assert(!frozenProfile.exclusiveRoles && !frozenProfile.usePlacementContract && !frozenProfile.causalAvailabilityMemory,
    'A label-free arbitrary-board policy cannot assume exclusive roles or private placement contracts');
  return function measure(board, options = {}) {
    sourceSnapshot.verify();
    assert(Object.keys(options).every(key => ['salts', 'maxTries'].includes(key)), 'Unknown measure option');
    const salts = options.salts ?? [1, 2, 3], maxTries = options.maxTries ?? 12;
    assert(Array.isArray(salts) && salts.length > 0 && new Set(salts).size === salts.length);
    assert(salts.every(salt => Number.isInteger(salt) && salt > 0 && salt <= 0x7fffffff));
    assert(Number.isInteger(maxTries) && maxTries > 0 && maxTries <= 12);
    const encoded = normalizeBoard(board), boardHash = digest(encoded), started = performance.now();
    const runs = [], lossTypes = {};
    let slowestMove = 0;
    for (const salt of salts) {
      const runStarted = performance.now();
      try {
        const result = playHumanCampaign(decodeGame(encoded), { maximumAttempts: maxTries,
          planning: { ...frozenProfile, publicActionSalt: salt }, publicContext: {} });
        assert.equal(digest(encoded), boardHash, 'A salt changed the real board');
        slowestMove = Math.max(slowestMove, result.slowestMs);
        for (const attempt of result.attempts) {
          const type = lossType(attempt);
          if (type) lossTypes[type] = (lossTypes[type] ?? 0) + 1;
        }
        runs.push({ salt, tries: result.wonOn, status: result.status, valid: result.slowestMs < 2000,
          slowestMove: result.slowestMs, minutes: (performance.now() - runStarted) / 60000,
          verifiedTaps: result.verifiedTaps, decisions: result.decisionCount,
          ...(result.retryCompletion ? { retryCompletion: result.retryCompletion } : {}),
          ...(result.retryInformation ? { retryInformation: result.retryInformation } : {}),
          ...(result.keyIdentityEvidence ? { keyIdentityEvidence: result.keyIdentityEvidence } : {}),
          ...(result.observedSafetyTransfer ? { observedSafetyTransfer: result.observedSafetyTransfer } : {}),
          attempts: result.attempts.map(attempt => ({ attempt: attempt.attempt, status: attempt.status,
            why: attempt.why, taps: attempt.taps, left: attempt.left, actions: attempt.actions.slice(), lossType: lossType(attempt) })) });
      } catch (error) {
        lossTypes.invalid_execution = (lossTypes.invalid_execution ?? 0) + 1;
        runs.push({ salt, tries: null, status: 'invalid', valid: false, slowestMove: null,
          minutes: (performance.now() - runStarted) / 60000, error: String(error.message).slice(0, 800) });
      }
    }
    const triesPerSalt = runs.map(run => run.tries), clearedAll = triesPerSalt.every(tries => tries !== null);
    sourceSnapshot.verify();
    return { salts: salts.slice(), maxTries, triesPerSalt,
      firstTryWinRate: triesPerSalt.filter(tries => tries === 1).length / salts.length,
      averageTries: clearedAll ? triesPerSalt.reduce((sum, tries) => sum + tries, 0) / salts.length : null,
      lossTypes, slowestMove, minutesPerBoard: (performance.now() - started) / 60000,
      clearedAll, valid: runs.every(run => run.valid), runs, boardHash, profileHash: digest(frozenProfile), sourceHash: sourceSnapshot.hash,
      theme: 'sunflower', saltMeaning: 'Public action ordering; real pictures, roles and clock never change.' };
  };
}

const measure = createMeasurer();

function main(args = process.argv.slice(2)) {
  const filename = args.shift();
  assert(filename, 'Usage: human_level_measure.js board.json [--salts 1,2,3] [--max-tries 12] [--out file]');
  const options = {};
  let output = null;
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    assert(value !== undefined, 'Missing value for ' + flag);
    if (flag === '--salts') options.salts = value.split(',').map(Number);
    else if (flag === '--max-tries') options.maxTries = Number(value);
    else if (flag === '--out') output = path.resolve(value);
    else throw Error('Unknown flag:' + flag);
  }
  const input = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8').replace(/^\uFEFF/, ''));
  const result = measure(input.game ?? input, options);
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (output) {
    const analysis = path.resolve(__dirname, '../../../analysis');
    assert(output !== analysis && !output.startsWith(analysis + path.sep), 'Raw measurements belong in .codex-runs/');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, serialized, { flag: 'wx' });
  }
  process.stdout.write(serialized);
  if (!result.valid) process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { measure, createMeasurer, lossType, normalizeBoard,
  measurementSource: { hash: sourceSnapshot.hash, files: sourceSnapshot.files.slice() } };
