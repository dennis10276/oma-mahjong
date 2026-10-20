'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js');
const { decodeGame } = require('./personal_game_io.js');
const { reference } = require('./public_witness_reference.js');
const { advance } = require('./known_tray_plan.js');
const root = path.resolve(__dirname, '../../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const PROFILES = Object.freeze({ compact: { taps: 8, nodes: 256, beam: 12, progress: 4, pruneDead: false },
  deep: { taps: 20, nodes: 1024, beam: 24, progress: 8, pruneDead: false },
  compactPruned: { taps: 8, nodes: 256, beam: 12, progress: 4, pruneDead: true },
  deepPruned: { taps: 20, nodes: 1024, beam: 24, progress: 8, pruneDead: true },
  compactSelective: { taps: 8, nodes: 256, beam: 12, progress: 4, pruneDead: true, pairProgress: true },
  deepSelective: { taps: 20, nodes: 1024, beam: 24, progress: 8, pruneDead: true, pairProgress: true },
  deepKnownFinish: { taps: 20, nodes: 4096, beam: 32, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true },
  deepRecovery: { taps: 20, nodes: 4096, beam: 32, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true, trayRecovery: true },
  recoverySmallBudget: { taps: 20, nodes: 1024, beam: 24, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true, trayRecovery: true },
  recoveryFromTwo: { taps: 20, nodes: 4096, beam: 32, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true, trayRecovery: true, trayRecoveryMin: 2 },
  recoveryFromThree: { taps: 20, nodes: 4096, beam: 32, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true, trayRecovery: true, trayRecoveryMin: 3 },
  recoveryClockHybrid: { taps: 20, nodes: 4096, beam: 32, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true, trayRecovery: true, trayRecoveryMin: 2, trayRecoveryClockMin: 0 },
  recoveryClockHybridSmall: { taps: 20, nodes: 1024, beam: 24, progress: 8, pruneDead: true, pairProgress: true, finishKnown: true, trayRecovery: true, trayRecoveryMin: 2, trayRecoveryClockMin: 0 } });
const SETTINGS = Object.freeze({ seed: 20261111, choiceLimit: 512 });

function casesOf(data) {
  const cases = data.cases.map(entry => ({ ...entry, cohort: 'pinnedLaterResearch' }));
  for (const actor of data.baseline.input.actors) {
    const entry = data.baseline.input.entries.filter(entry => entry.name === actor.name).sort((left, right) => right.end - left.end)[0]; assert(entry);
    cases.push({ ...entry, cohort: 'priorCalibrationControl' });
  }
  return cases;
}

function play(entry, prior, options) {
  const selector = reference(options), predicted = new Map();
  const state = { ...decodeGame(entry.game), physicalLog: [] };
  const planning = (game, snapshot, actions) => {
    const result = selector.physicalTrayPlanning(game, snapshot, actions), report = selector.report();
    predicted.set(state.physicalLog.length, { index: report.index, moved: advance(game, snapshot, report.index) });
    return result;
  };
  const result = Hard.play(state, { ...Hard.P, physicalFlips: true, allMoves: true, flips: true,
    forceMatches: false, peek: 0, end: 0, plan: 0, physicalPlan: 0, kindModel: { weights: {} },
    publicPicturePrior: prior, physicalChoice: selector, physicalTrayPlanning: planning,
    physicalChoiceLimit: SETTINGS.choiceLimit }, SETTINGS.seed);
  let knownControls = 0, unknownChoices = 0, unsupportedChoices = 0;
  for (const [position, expected] of predicted) {
    const actual = state.physicalLog[position]; assert(actual); assert.equal(actual.index, expected.index);
    if (expected.moved.uncertain) {
      if (expected.moved.reason === 'unseenPicture') unknownChoices++; else unsupportedChoices++;
    } else {
      assert.equal(actual.moves, expected.moved.state.moves); assert.equal(actual.openPeek, expected.moved.state.openPeek);
      assert.deepEqual(actual.alive, expected.moved.state.alive); assert.deepEqual(actual.tray, expected.moved.state.tray); knownControls++;
    }
  }
  return { result: { win: result.win, why: result.why, moves: result.moves, left: result.left,
    tray: result.tray, choices: result.decisions }, computationCensored: result.why === 'contextChoiceLimit',
    knownPhysicalControls: knownControls, unknownChoices, unsupportedChoices,
    physicalFrames: state.physicalLog.length, autonomousUnmatchedFrames: state.physicalLog.length - predicted.size,
    planner: selector.stats() };
}

function measure(entries, prior, progress = () => {}) {
  return entries.map(entry => {
    const profiles = {};
    for (const [profile, options] of Object.entries(PROFILES)) {
      profiles[profile] = play(entry, prior, options);
      progress({ cohort: entry.cohort, name: entry.name, lv: entry.lv, start: entry.start, board: entry.board, profile, ...profiles[profile] });
    }
    const { game, ...metadata } = entry; return { ...metadata, profiles };
  });
}

async function main(directory) {
  const parent = path.resolve(directory), inputFile = path.join(parent, 'input.json'), bytes = fs.readFileSync(inputFile), data = JSON.parse(bytes);
  assert.equal(Hard.PUBLIC_OBSERVATION_VERSION, 1);
  assert.equal(hash(Buffer.from(fs.readFileSync(path.join(root, 'source/www/hard.js'), 'utf8').replace(/\r\n/g, '\n'))), data.observation.prototypeEngineSha256);
  const cases = casesOf(data), made = new Date().toISOString();
  const folder = path.join(root, 'source/analysis/archive/personal-bots/runs/witness-reference-' + made.replace(/[:.]/g, '-')); fs.mkdirSync(folder, { recursive: true });
  const sourceHashes = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'); sourceHashes[relative] = hash(fs.readFileSync(filename));
    const copied = path.join(folder, 'sources', relative); fs.mkdirSync(path.dirname(copied), { recursive: true }); fs.copyFileSync(filename, copied);
  }
  const config = { made, targetMet: false, evidence: 'neutral-public-witness-first-trial-strength-screen-not-person-count-forecasts',
    parentInput: path.relative(root, inputFile).replace(/\\/g, '/'), parentInputSha256: hash(bytes), sourceHashes,
    cases, profiles: PROFILES, settings: SETTINGS, observation: data.observation,
    uniqueCaseInputs: new Set(cases.map(entry => hash(JSON.stringify(entry.game)))).size,
    note: 'All25 pinned later research cases plus four separate prior calibration controls, including PUK. '
      + 'Duplicate board inputs across cohorts are explicit, not independent extra games. Two bounded search '
      + 'budgets, public-proved successor-death pruning, paired progress, known-board completion and '
      + 'tray-recovery ordering are declared before measurement. This is a neutral reference, not a person-specific forecast '
      + 'or imposed greedy policy. Actual production first trials have no hidden beam reveals, resets or '
      + 'free pair macros.512-choice limits remain numerical censoring, never human failures. A stronger '
      + 'reference may later supply optional features for own-person preference/handicap learning.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(config), { flag: 'wx' });
  const journal = path.join(folder, 'progress.jsonl'); fs.writeFileSync(journal, JSON.stringify({ made, cases: cases.length, policies: Object.keys(PROFILES).length }) + '\n', { flag: 'wx' });
  const workers = []; let batches;
  try {
    batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { publicWitnessScreen: true, prior: data.observation.prior,
        entries: cases.filter((entry, position) => position % 3 === index) } }); workers.push(worker);
      let delivered = false;
      worker.on('message', message => {
        if (message.rows) { delivered = true; resolve(message.rows); }
        else fs.appendFileSync(journal, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
      });
      worker.on('error', reject); worker.on('exit', code => { if (code || !delivered) reject(new Error('Witness reference worker incomplete: ' + code)); });
    })));
  } catch (error) { await Promise.all(workers.map(worker => worker.terminate())); throw error; }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(inputFile)), hash(bytes));
  const rows = batches.flat(); assert.equal(rows.length, cases.length);
  const scores = {};
  for (const cohort of ['pinnedLaterResearch', 'priorCalibrationControl']) for (const profile of Object.keys(PROFILES)) {
    const own = rows.filter(row => row.cohort === cohort).map(row => row.profiles[profile]);
    scores[cohort + '|' + profile] = { wins: own.filter(row => row.result.win).length, n: own.length,
      computationCensored: own.filter(row => row.computationCensored).length,
      knownPhysicalControls: own.reduce((sum, row) => sum + row.knownPhysicalControls, 0),
      unknownChoices: own.reduce((sum, row) => sum + row.unknownChoices, 0),
      unsupportedChoices: own.reduce((sum, row) => sum + row.unsupportedChoices, 0) };
  }
  const targetMet = Object.keys(PROFILES).some(profile => scores['pinnedLaterResearch|' + profile]?.wins >= 20 && scores['priorCalibrationControl|' + profile]?.wins >= 3);
  fs.writeFileSync(path.join(folder, 'data.json'), JSON.stringify({ ...config, made: new Date().toISOString(), targetMet, rows, scores,
    progressSha256: hash(fs.readFileSync(journal)), note: config.note + ' First-trial reference wins are NOT agreed-rule human count accuracy or evidence of80% on later frozen personal forecasts.' }), { flag: 'wx' });
  console.log(JSON.stringify({ folder, scores, targetMet }));
}

if (!isMainThread && workerData?.publicWitnessScreen) parentPort.postMessage({ rows: measure(workerData.entries, workerData.prior,
  progress => parentPort.postMessage({ progress })) });
else if (require.main === module) main(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { PROFILES, SETTINGS, casesOf, play, measure };
