'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Hard = require('../../../www/hard.js'), L = require('../../../www/layouts.js');
const { CONFIG, boardId } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { styleAttemptFactory } = require('./personal_outcome_styles_choice.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const inputFile = 'analysis/archive/personal-bots/personal-fresh-count-input.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function physicalFeatures(game) {
  const alive = new Uint8Array(game.tiles.length).fill(1);
  const free = game.tiles.flatMap((tile, index) => L.isFree(index, alive, game.nb) ? [index] : []);
  const faces = new Map();
  for (const index of free) if (!game.down[index]) faces.set(game.faces[index], (faces.get(game.faces[index]) || 0) + 1);
  return [game.tiles.length, game.down.reduce((sum, value) => sum + value, 0) / game.tiles.length,
    Math.max(...game.tiles.map(tile => tile.z)), free.length,
    [...faces.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0),
    game.clock ? game.clock.n / game.tiles.length : 0, game.clock ? 1 : 0,
    Object.keys(game.rules?.ice || {}).length, game.rules?.locks?.size || 0, game.rules?.keys?.length || 0,
    new Set(game.faces).size];
}

function measure(entries, actors, runs, attempts, priorPilot) {
  const models = new Map(actors.map(actor => [actor.id, actor]));
  return entries.map((entry, position) => {
    const actor = models.get(entry.modelId), game = decodeGame(entry.game), chains = {}, caps = {};
    assert(actor && actor.name === entry.name && boardId(game) === entry.board);
    if (entry.kind === 'recent') {
      assert(actor.historicalExploratoryOnly && actor.trainingCut <= entry.start
        && (actor.availableThrough === null || actor.availableThrough < entry.start));
      assert(!actor.trainedAids.some(aid => entry.excludedAids.includes(aid)));
    } else {
      assert(!actor.historicalExploratoryOnly && actor.trainingCut < entry.start && actor.inputObservedThrough < actor.trainingCut);
    }
    for (const [profile, enabled] of Object.entries({ ownOutcomeBase0: false, ownOutcomeStyles0: true })) {
      const factory = styleAttemptFactory(actor, actor.outcomeStyles, true, enabled);
      const stats = {}, persona = { ...physicalActor(actor), memory: CONFIG.memory, learnFromLoss: true,
        physicalPlan: 0, physicalChoiceForAttempt: factory, stats };
      if (priorPilot) {
        const previous = priorPilot.rows.find(row => row.name === entry.name && row.kind === entry.kind && row.lv === entry.lv && row.start === entry.start);
        assert(previous && previous.board === entry.board);
        assert.deepEqual(Hard.rateChain(game, 2, 20261028, persona, CONFIG.memory, 3), previous.chains[profile],
          'Fresh paired pilot chain changed: ' + entry.name + '/' + entry.lv + '/' + profile);
        stats.contextChoiceLimits = 0;
      }
      chains[profile] = Hard.rateChain(game, runs, 20261028, persona, CONFIG.memory, attempts);
      caps[profile] = stats.contextChoiceLimits || 0;
      assert.equal(chains[profile].computationCensored || 0, caps[profile]);
      assert.equal(stats.physicalClockPlans || 0, 0);
    }
    const reference = { strong: Hard.rate(game, 32, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 32, 20261019, Hard.persona('average')).rate };
    const { game: serialized, ...metadata } = entry;
    if ((position + 1) % 5 === 0) parentPort.postMessage({ progress: { worker: workerData.index, completed: position + 1, total: entries.length } });
    return { ...metadata, chains, physical: physicalFeatures(game), reference, computationCaps: caps };
  });
}

async function main() {
  const pilot = process.argv[2] === 'pilot';
  if (process.argv[2] && !pilot) throw new Error('Use explicit pilot mode or full fresh count measurement');
  const input = JSON.parse(fs.readFileSync(path.join(root, inputFile)));
  for (const [name, expected] of Object.entries(input.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const modelFolder = path.join(root, input.modelSnapshot);
  const futureModels = JSON.parse(fs.readFileSync(path.join(modelFolder, 'analysis/archive/personal-bots/personal-fresh-own-models.json')));
  const recentModels = JSON.parse(fs.readFileSync(path.join(modelFolder, 'analysis/archive/personal-bots/personal-fresh-recent-models.json')));
  const actors = [...futureModels.models, ...recentModels.models];
  const parentFolder = path.join(root, input.parent), parentManifest = JSON.parse(fs.readFileSync(path.join(parentFolder, 'manifest.json')));
  const parentName = 'analysis/archive/personal-bots/physical-outcome-styles-count-data.json';
  const parentBytes = fs.readFileSync(path.join(parentFolder, parentName)); assert.equal(hash(parentBytes), parentManifest.files[parentName]);
  const parent = JSON.parse(parentBytes);
  assert.equal(parent.rows.length, 276); assert.equal(parent.computationCaps, 0);
  assert.deepEqual(input.comparisonEpisodes, parent.comparisonEpisodes);
  assert.equal(hash(fs.readFileSync(path.join(root, 'www/hard.js'))), parent.currentEngineSha256);
  const pilotFile = 'analysis/personal-bots/personal-fresh-count-pilot.json';
  const priorPilot = pilot ? null : JSON.parse(fs.readFileSync(path.join(root, pilotFile)));
  if (priorPilot) assert.equal(priorPilot.computationCaps, 0);
  const fingerprintFiles = [...new Set([inputFile, ...Object.keys(input.sourceHashes),
    ...(pilot ? [] : [pilotFile]), 'tools/sim/refit/personal_fresh_count_fit.py', 'tools/sim/refit/attempt_count_fit.py',
    'tools/sim/refit/personal_count_fit.py',
    ...Object.keys(require.cache).filter(file => file.startsWith(root + path.sep)).map(file => path.relative(root, file).replace(/\\/g, '/'))])].sort();
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const name of fingerprintFiles) digest.update(name).update(fs.readFileSync(path.join(root, name)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), entries = [...input.recent.map(row => ({ ...row, kind: 'recent' })),
    ...input.future.map(row => ({ ...row, kind: 'future' }))];
  const runs = pilot ? 2 : 32, attempts = pilot ? 3 : 32;
  const progressFile = path.join(root, 'analysis/personal-bots/personal-fresh-count-' + (pilot ? 'pilot' : 'full') + '-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), fingerprint, entries: entries.length, runs, attempts }) + '\n');
  const batches = await Promise.all(Array.from({ length: 3 }, (unused, index) => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { freshCounts: true, index, runs, attempts, priorPilot,
      actors, entries: entries.filter((entry, position) => position % 3 === index) } });
    worker.on('message', message => {
      if (message.rows) resolve(message.rows);
      else fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), ...message.progress }) + '\n');
    });
    worker.on('error', reject); worker.on('exit', code => { if (code) reject(new Error('Fresh count worker failed')); });
  })));
  assert.equal(fingerprintOf(), fingerprint);
  const measured = batches.flat();
  const computationCaps = measured.reduce((sum, row) => sum + Object.values(row.computationCaps).reduce((total, count) => total + count, 0), 0);
  const report = { made: new Date().toISOString(), evidence: pilot ? 'fresh-paired-lifecycle-pilot-only' : 'fresh-own-historical-and-future-counts',
    targetMet: false, fingerprint, fingerprintFiles, runs, attempts, computationCaps,
    validUncensoredSimulation: computationCaps === 0, inputFrozenAt: input.inputFrozenAt,
    profiles: input.profiles, referenceProfile: input.referenceProfile, modelSnapshot: input.modelSnapshot,
    futureModelReadyAt: input.futureModelReadyAt, liveSnapshot: input.liveSnapshot,
    legacyParentRowsRetained: 276, comparisonEpisodes: parent.comparisonEpisodes,
    pairedPilotChainsMatched: pilot ? 0 : entries.length * 2,
    note: 'Recent targets use earlier own client-time versions, explicitly historical exploratory. '
      + 'Future actors use saved source observation before their actual fitting request. '
      + 'All boards restore exact locks/down flags. Two personal profiles share the same physicalPlan0 lifecycle and own simulated-failure learning. '
      + 'Pilot samples cannot score winning attempts; caps invalidate count scoring. No numeric future forecast is frozen by this measurement.' };
  if (pilot) {
    report.rows = measured.map(row => ({ name: row.name, lv: row.lv, start: row.start, board: row.board, kind: row.kind,
      chains: row.chains, computationCaps: row.computationCaps }));
    fs.writeFileSync(path.join(root, pilotFile), JSON.stringify(report));
  } else {
    report.rows = [...parent.rows.map(row => ({ ...row, chains: Object.fromEntries(Object.keys(input.profiles).map(profile => [profile, row.chains[profile]])) })),
      ...measured.filter(row => row.kind === 'recent')];
    report.future = measured.filter(row => row.kind === 'future');
    report.additionalRecentIds = input.recent.map(row => row.name + '|' + row.start);
    fs.writeFileSync(path.join(archive, 'physical-fresh-count-data.json'), JSON.stringify(report));
  }
  console.log(JSON.stringify({ pilot, measured: measured.length, recent: input.recent.length, future: input.future.length,
    computationCaps, pairedPilotChainsMatched: report.pairedPilotChainsMatched }));
  if (computationCaps) process.exitCode = 2;
}

if (!isMainThread && workerData?.freshCounts) parentPort.postMessage({ rows: measure(workerData.entries, workerData.actors, workerData.runs, workerData.attempts, workerData.priorPilot) });
else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { physicalFeatures };
