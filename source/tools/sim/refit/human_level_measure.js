'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const { decodeGame } = require('./personal_game_io.js');
const { normalizeBoard } = require('./public_board_input.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const defaultProfile = require('./human_level_measure_profile.json');
const { captureSources } = require('./human_level_sources.js');
const sourceSnapshot = captureSources(module);

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceRoot=path.resolve(__dirname,'../../..');
// Git may check the same text out with LF or CRLF. Pin semantic source text
// across checkouts; sourceSnapshot.verify still detects live byte changes.
const canonicalSourceHash=digest(sourceSnapshot.files.map(file=>[file,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,file),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));

function finishableWithinThree(runs,maxTries){
 const canonical=[1,2,3].map(salt=>runs.find(run=>run.salt===salt));
 if(canonical.some(run=>run&&(run.tries>3||run.tries===null&&maxTries>=3)))return false;
 if(canonical.every(run=>run&&run.tries!==null&&run.tries<=3))return true;
 return null;
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
  const isDefault=planning===defaultProfile;
  const frozenProfile = structuredClone(planning);
  assert(!frozenProfile.exclusiveRoles && !frozenProfile.usePlacementContract && !frozenProfile.causalAvailabilityMemory,
    'A label-free arbitrary-board policy cannot assume exclusive roles or private placement contracts');
  return function measure(board, options = {}) {
    sourceSnapshot.verify();
    const manifestFile=path.join(__dirname,'human_reference_frozen.json');
    const frozen=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):null;
    if(frozen&&(isDefault||digest(frozenProfile)===frozen.profileHash)){
      assert.equal(digest(frozenProfile),frozen.profileHash,'Frozen reference profile changed');
      assert.equal(canonicalSourceHash,frozen.canonicalSourceHash,'Frozen reference source changed; keep human-model work separate');
    }
    assert(Object.keys(options).every(key => ['salts', 'maxTries'].includes(key)), 'Unknown measure option');
    const salts = options.salts ?? [1, 2, 3], maxTries = options.maxTries ?? 3;
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
          ...(result.knownWitnessPortfolio ? { knownWitnessPortfolio: result.knownWitnessPortfolio } : {}),
          ...(result.survivalBranches ? { survivalBranches: result.survivalBranches } : {}),
          ...(result.openingPlanning ? { openingPlanning: result.openingPlanning } : {}),
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
    return { salts: salts.slice(), maxTries, triesPerSalt,finishable:runs.every(run=>run.valid)?finishableWithinThree(runs,maxTries):null,
      referenceVersion:frozen&&digest(frozenProfile)===frozen.profileHash?frozen.version:null,
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
  assert(filename, 'Usage: human_level_measure.js board.json [--salts 1,2,3] [--max-tries 3] [--out file]');
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
module.exports = { measure, createMeasurer, lossType, normalizeBoard,finishableWithinThree,
  measurementSource: { hash: sourceSnapshot.hash,canonicalHash:canonicalSourceHash, files: sourceSnapshot.files.slice() } };
