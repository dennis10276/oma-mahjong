'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const { publicContextFor } = require('./human_reference_screen.js');
const { loadRecordedClears } = require('./human_reference_catalog.js');
const { digest, targetTries, sunflowerTheme, makeRedeal, classifyLoss } = require('./human_redeal.js');
const seeds = require('./human_redeal_seeds.json');
const root = path.resolve(__dirname, '../../..');

function assertRawOutput(filename) {
  const resolved = path.resolve(filename), forbidden = path.join(root, 'analysis');
  assert(resolved !== forbidden && !resolved.startsWith(forbidden + path.sep), 'Raw re-deal data/logs belong outside source/analysis');
}

function makeManifest(catalog) {
  const entries = catalog.rows.map(entry => {
    assert.equal(entry.name, 'Dennisisdebeste');
    assert(entry.lv !== 10031 && entry.game && (!entry.status || entry.status === 'available'),
      'Keep missing boards unresolved; do not silently drop a requested clear');
    const game = entry.game; decodeGame(game);
    assert(publicContextFor(entry).boardMode, 'A board needs recognized public provenance');
    return { level: entry.lv, kind: entry.boardSource === 'levelLab' ? 'lab' : 'natural',
      human: entry.wonOn, target: targetTries(entry.wonOn), boardSource: entry.boardSource,
      historicalBoardExact: entry.historicalBoardExact ?? null, version: entry.version ?? null,
      boardHash: digest(game), game };
  }).sort((left, right) => left.level - right.level);
  assert(entries.length > 0 && new Set(entries.map(entry => entry.level)).size === entries.length);
  const payload = { schema: 'human-reference-redeal-manifest-v1', observedAt: catalog.observedAt,
    theme: sunflowerTheme(), seedManifestHash: digest(seeds), developmentSeeds: seeds.development,
    luckSeeds: seeds.luck, visibility: 'face-up-visible-one-geometry-gate-v1', excluded: [10031], entries };
  return { ...payload, hash: digest(payload) };
}

function validateManifest(manifest) {
  const { hash, ...payload } = manifest;
  assert.equal(hash, digest(payload)); assert.equal(manifest.schema, 'human-reference-redeal-manifest-v1');
  assert.equal(manifest.theme.id, 'sunflower'); assert.equal(manifest.theme.sourceHash, sunflowerTheme().sourceHash);
  assert.equal(manifest.seedManifestHash, digest(seeds)); assert.deepEqual(manifest.developmentSeeds, seeds.development);
  assert.deepEqual(manifest.luckSeeds, seeds.luck);
  assert(new Set(manifest.entries.map(entry => entry.level)).size === manifest.entries.length);
  for (const entry of manifest.entries) {
    assert.equal(entry.boardHash, digest(entry.game)); assert.equal(entry.target, targetTries(entry.human));
    assert(entry.level !== 10031); decodeGame(entry.game);
  }
}

function casesOf(manifest, split = 'development') {
  assert(['development', 'luck'].includes(split));
  const values = split === 'development' ? manifest.developmentSeeds : manifest.luckSeeds;
  return manifest.entries.flatMap(entry => values.map((seed, index) => ({ entry, seed,
    ordinal: index + 1, split, caseId: entry.level + ':' + split + ':' + (index + 1) })));
}

function runCase(task, planning, runCampaign = playHumanCampaign) {
  const { entry, seed, ordinal, split, caseId } = task;
  const redeal = makeRedeal(entry.game, seed), game = decodeGame(redeal.game);
  const metadata = { caseId, level: entry.level, kind: entry.kind, human: entry.human, target: entry.target,
    ordinal, split, seed, boardHash: entry.boardHash, gameHash: digest(redeal.game),
    openingHash: redeal.openingHash, hiddenCount: redeal.hiddenCount, changedCount: redeal.changedCount };
  try {
    const result = runCampaign(game, { planning: { ...planning, hypothesisRunSalt: 1 },
      publicContext: publicContextFor({ boardSource: entry.boardSource }), maximumAttempts: entry.target, captureDecisions: true });
    assert(result.attempts.length > 0 && result.attempts.length <= entry.target);
    assert.equal(result.verifiedTaps, result.attempts.reduce((sum, attempt) => sum + attempt.taps, 0));
    assert(result.wonOn === null || result.wonOn === result.attempts.length);
    const targetMet = result.status === 'cleared' && result.wonOn !== null && result.wonOn <= entry.target;
    const geometry = { tiles: game.tiles, nb: game.nb, clock: game.clock };
    return { ...metadata, targetMet, bot: result.wonOn, status: result.status,
      valid: Number.isFinite(result.slowestMs) && result.slowestMs < 2000,
      slowestMs: result.slowestMs, verifiedTaps: result.verifiedTaps, decisions: result.decisionCount,
      attempts: result.attempts.map(attempt => ({ attempt: attempt.attempt, status: attempt.status,
        why: attempt.why, taps: attempt.taps, left: attempt.left })),
      loss: targetMet ? null : classifyLoss(result, geometry) };
  } catch (error) {
    return { ...metadata, targetMet: false, bot: null, status: 'invalid', valid: false, slowestMs: null,
      loss: { primary: 'invalid_execution', error: String(error.message).slice(0, 240), witness: null } };
  }
}

function runShard(manifest, planning, shard, count, { runCampaign, emit = () => {}, completed = new Set() } = {}) {
  assert(Number.isInteger(count) && count > 0 && count <= 12 && Number.isInteger(shard) && shard >= 0 && shard < count);
  const rows = [];
  for (const [index, task] of casesOf(manifest).entries()) if (index % count === shard && !completed.has(task.caseId)) {
    const row = runCase(task, planning, runCampaign); rows.push(row); emit(row);
  }
  return rows;
}

function pairedComparison(baseline, candidate) {
  assert(baseline.complete && candidate.complete && baseline.manifestHash === candidate.manifestHash);
  const previous = new Map(baseline.rows.map(row => [row.caseId, row]));
  assert.equal(previous.size, candidate.rows.length);
  const differences = candidate.rows.map(row => {
    const before = previous.get(row.caseId); assert(before);
    assert.equal(row.gameHash, before.gameHash); assert.equal(row.seed, before.seed);
    assert.equal(row.target, before.target); return +row.targetMet - +before.targetMet;
  });
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardError = values => values.length < 2 ? null
    : Math.sqrt(values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1) / values.length);
  const boardChanges = candidate.boards.map(board => {
    const before = baseline.boards.find(row => row.level === board.level); assert(before);
    return { level: board.level, delta: board.rate - before.rate };
  });
  const caseSE = standardError(differences), boardSE = standardError(boardChanges.map(row => row.delta));
  const error = caseSE === null || boardSE === null ? null : Math.max(caseSE, boardSE);
  const improvement = mean(differences), excessiveDrops = boardChanges.filter(row => row.delta < -0.1 - 1e-12);
  return { improvement, caseSE, boardSE, standardError: error, boardChanges, excessiveDrops,
    adopted: baseline.valid && candidate.valid && error !== null && improvement > 2 * error + 1e-12 && !excessiveDrops.length,
    method: 'Paired identical cases; use the larger of case and board-cluster standard errors. No board may lose more than10 percentage points.' };
}

function summarize(manifest, workers) {
  validateManifest(manifest); assert(workers.length > 0);
  assert(workers.every(worker => worker.header.manifestHash === manifest.hash
    && worker.header.profileHash === workers[0].header.profileHash && worker.header.sourceHash === workers[0].header.sourceHash));
  const rows = workers.flatMap(worker => worker.rows), expected = new Map(casesOf(manifest).map(task => [task.caseId, task]));
  assert.equal(new Set(rows.map(row => row.caseId)).size, rows.length, 'Duplicate re-deal result');
  for (const row of rows) {
    const task = expected.get(row.caseId); assert(task);
    assert.equal(row.seed, task.seed); assert.equal(row.boardHash, task.entry.boardHash);
    assert.equal(row.target, task.entry.target); assert.equal(row.gameHash, digest(makeRedeal(task.entry.game, task.seed).game));
    assert(row.targetMet || row.loss?.primary, 'Every target miss needs an automatic loss classification');
  }
  const boards = manifest.entries.map(entry => {
    const selected = rows.filter(row => row.level === entry.level), wins = selected.filter(row => row.targetMet).length;
    return { level: entry.level, kind: entry.kind, human: entry.human, target: entry.target,
      completed: selected.length, wins, rate: selected.length === manifest.developmentSeeds.length
        ? wins / manifest.developmentSeeds.length : null };
  });
  const counts = {};
  for (const row of rows.filter(row => !row.targetMet)) counts[row.loss.primary] = (counts[row.loss.primary] ?? 0) + 1;
  const losses = rows.filter(row => !row.targetMet).length;
  return { schema: 'human-reference-redeal-summary-v1', manifestHash: manifest.hash, theme: manifest.theme.id,
    profileHash: workers[0].header.profileHash, sourceHash: workers[0].header.sourceHash,
    expected: expected.size, completed: rows.length, complete: rows.length === expected.size,
    valid: workers.every(worker => worker.footer?.sourceUnchanged) && rows.every(row => row.valid),
    targetRate: rows.length === expected.size ? rows.filter(row => row.targetMet).length / expected.size : null,
    observedTargetRate: rows.length ? rows.filter(row => row.targetMet).length / rows.length : null, rows, boards,
    slowestMs: Math.max(0, ...rows.map(row => row.slowestMs ?? 0)),
    lossTypes: Object.entries(counts).map(([type, count]) => ({ type, count, share: count / Math.max(1, losses),
      eligibleForChange: count / Math.max(1, losses) >= 0.1 })).sort((left, right) => right.count - left.count) };
}

function renderReport(report, comparison = null) {
  const lines = ['# Sunflower re-deal benchmark', '',
    `Complete: ${report.complete}; valid: ${report.valid}; completed ${report.completed}/${report.expected}.`,
    `Manifest: ${report.manifestHash}; profile: ${report.profileHash}; source: ${report.sourceHash}.`, '',
    '| Board | Group | Dennis | Target | Clears/done | Target rate |', '|---:|---|---:|---:|---:|---:|',
    `|Overall|all|—|—|${report.rows.filter(row => row.targetMet).length}/${report.completed}|${report.targetRate === null ? 'pending' : (report.targetRate * 100).toFixed(1) + '%'}|`];
  for (const board of report.boards.filter(board => board.wins < 10)) lines.push(
    `|${board.level}|${board.kind}|${board.human}|${board.target}|${board.wins}/${board.completed}|${board.rate === null ? 'pending' : (board.rate * 100).toFixed(0) + '%'}|`);
  lines.push('', `Slowest move: ${report.slowestMs.toFixed(1)}ms. Every accepted tap independently replays original production.`,
    'Loss types: ' + report.lossTypes.map(row => `${row.type} ${row.count} (${(row.share * 100).toFixed(1)}%${row.eligibleForChange ? ', eligible >=10%' : ''})`).join('; ') + '.',
    'No luck flags are established by this10-re-deal development run. Missing cases and computation caps are not proofs of impossibility.');
  if (comparison) lines.push(`Paired gain: ${(comparison.improvement * 100).toFixed(2)} points; SE: ${comparison.standardError === null ? 'unavailable' : (comparison.standardError * 100).toFixed(2)} points; adopted: ${comparison.adopted}.`,
    comparison.method, `Boards losing >10 points: ${comparison.excessiveDrops.map(row => row.level).join(', ') || 'none'}.`);
  return lines.join('\n') + '\n';
}

function sourceFingerprint() {
  const extra = ['www/tiles.js', 'www/js/board.js', 'www/style.css'].map(filename => path.join(root, filename));
  const files = [...new Set([...Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep)), ...extra])].sort();
  const fingerprint = () => digest(files.map(filename => [path.relative(root, filename).replace(/\\/g, '/'),
    crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')]));
  return { files: files.map(filename => path.relative(root, filename)), hash: fingerprint(), fingerprint };
}

function beginExperiment(ledger, baseline, id, lossType) {
  assert(baseline.complete && baseline.valid, 'Finish and validate the baseline before a planner experiment');
  assert(ledger.manifestHash === baseline.manifestHash && !ledger.experiments.some(row => row.id === id));
  assert(ledger.consecutiveNoGain + ledger.experiments.filter(row => row.status === 'running').length < 8,
    'Eight-experiment stop rule: report and wait for the user');
  assert(baseline.lossTypes.some(row => row.type === lossType && row.share >= 0.1),
    'A mechanism must target a class covering at least10% of baseline target misses');
  return { ...ledger, experiments: [...ledger.experiments, { id, lossType, status: 'running' }] };
}

function finishExperiment(ledger, id, baseline, candidate) {
  const experiment = ledger.experiments.find(row => row.id === id);
  assert(experiment?.status === 'running');
  const comparison = pairedComparison(baseline, candidate);
  const consecutiveNoGain = comparison.adopted ? 0 : ledger.consecutiveNoGain + 1;
  return { ...ledger, consecutiveNoGain, stopRequired: consecutiveNoGain >= 8,
    experiments: ledger.experiments.map(row => row.id === id ? { ...row, status: 'completed', comparison } : row) };
}

function readWorker(filename) {
  const records = fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(records[0]?.type, 'header');
  return { header: records[0], rows: records.filter(row => row.type === 'case').map(({ type, ...row }) => row),
    footer: records.find(row => row.type === 'footer') ?? null };
}

async function main(command, ...args) {
  if (command === 'catalog') {
    assert.equal(args.length, 1); assertRawOutput(args[0]); assert(!fs.existsSync(args[0]));
    const natural = await loadRecordedClears(), labs = JSON.parse(fs.readFileSync(path.join(root, 'analysis/lab-clears.json'))).rows;
    const rows = labs.filter(row => row.name === 'Dennisisdebeste' && row.lv !== 10031).map(row => {
      assert(Number.isInteger(row.wonOn) && row.wonOn > 0); assert(!row.stackedRoles); return { ...row, status: 'available' };
    });
    const catalog = { ...natural, rows: [...natural.rows, ...rows], excluded: [10031] };
    fs.writeFileSync(args[0], JSON.stringify(catalog), { flag: 'wx' }); return;
  }
  if (command === 'prepare') {
    assert.equal(args.length, 2); assertRawOutput(args[1]); assert(!fs.existsSync(args[1]));
    const manifest = makeManifest(JSON.parse(fs.readFileSync(args[0]))); validateManifest(manifest);
    fs.writeFileSync(args[1], JSON.stringify(manifest), { flag: 'wx' });
    console.log(JSON.stringify({ manifestHash: manifest.hash, boards: manifest.entries.length, cases: casesOf(manifest).length, theme: manifest.theme.id })); return;
  }
  if (command === 'run') {
    assert.equal(args.length, 5);
    const [manifestFile, profileFile, shardText, countText, output] = args;
    assertRawOutput(output); assert(!fs.existsSync(output));
    const manifest = JSON.parse(fs.readFileSync(manifestFile)), planning = JSON.parse(fs.readFileSync(profileFile));
    validateManifest(manifest); const source = sourceFingerprint();
    const header = { type: 'header', manifestHash: manifest.hash, profileHash: digest(planning), sourceHash: source.hash,
      sourceFiles: source.files, shard: Number(shardText), count: Number(countText), startedAt: new Date().toISOString() };
    fs.writeFileSync(output, JSON.stringify(header) + '\n', { flag: 'wx' }); console.log(JSON.stringify(header));
    runShard(manifest, planning, header.shard, header.count, { emit(row) {
      assert.equal(source.fingerprint(), source.hash, 'Loaded source changed during the frozen benchmark');
      fs.appendFileSync(output, JSON.stringify({ type: 'case', ...row }) + '\n');
      console.log(JSON.stringify({ caseId: row.caseId, targetMet: row.targetMet, bot: row.bot, loss: row.loss?.primary }));
    } });
    const footer = { type: 'footer', sourceUnchanged: source.fingerprint() === source.hash, finishedAt: new Date().toISOString() };
    fs.appendFileSync(output, JSON.stringify(footer) + '\n'); console.log(JSON.stringify(footer)); return;
  }
  assert.equal(command, 'report'); assert(args.length >= 4);
  const [manifestFile, rawOutput, markdownOutput, ...workerFiles] = args; assertRawOutput(rawOutput);
  const manifest = JSON.parse(fs.readFileSync(manifestFile)), report = summarize(manifest, workerFiles.map(readWorker));
  fs.writeFileSync(rawOutput, JSON.stringify(report)); fs.writeFileSync(markdownOutput, renderReport(report));
  console.log(JSON.stringify({ complete: report.complete, valid: report.valid, targetRate: report.targetRate, losses: report.lossTypes }));
}

if (require.main === module) main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { assertRawOutput, makeManifest, validateManifest, casesOf, runCase, runShard, pairedComparison, summarize, renderReport, readWorker, sourceFingerprint,
  beginExperiment, finishExperiment };
