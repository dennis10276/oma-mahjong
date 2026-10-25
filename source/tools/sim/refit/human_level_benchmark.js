'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createMeasurer, measurementSource, normalizeBoard } = require('./human_level_measure.js');
const { loadDevelopmentClears } = require('./human_reference_catalog.js');
const { evaluate } = require('./human_level_evaluation.js');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceRoot = path.resolve(__dirname, '../../..');
const CRITICAL_LABS = Object.freeze([10011, 10032, 10033, 10041, 10052]);

function rawOutput(filename) {
  const resolved = path.resolve(filename), analysis = path.join(sourceRoot, 'analysis');
  assert(resolved !== analysis && !resolved.startsWith(analysis + path.sep), 'Raw measurement data belongs in .codex-runs/');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

async function prepare(filename, previousRealFile) {
  const catalog = await loadDevelopmentClears();
  const selected = catalog.rows.filter(entry => entry.lv >= 17);
  assert(selected.every(entry => entry.status === 'available' && entry.game), 'Keep unavailable recorded boards unresolved; do not silently omit them');
  const entries = selected.map(entry => ({ lv: entry.lv, wonOn: entry.wonOn,
    kind: entry.boardSource === 'levelLab' ? 'lab' : 'natural', boardSource: entry.boardSource,
    historicalBoardExact: entry.historicalBoardExact, version: entry.version, game: normalizeBoard(entry.game) })).sort((left, right) => left.lv - right.lv);
  assert.equal(new Set(entries.map(entry => entry.lv)).size, entries.length);
  assert(entries.every(entry => Number.isInteger(entry.wonOn) && entry.wonOn > 0));
  assert.equal(entries.filter(entry => entry.kind === 'lab').length, 15);
  const previous = JSON.parse(fs.readFileSync(previousRealFile));
  assert(previous.complete && previous.valid);
  const failing = new Set([...CRITICAL_LABS, ...previous.rows.filter(row => !row.pass).map(row => row.level)]);
  const guardPool = entries.filter(entry => !failing.has(entry.lv) && previous.rows.some(row => row.level === entry.lv && row.pass));
  const guards = guardPool.map(entry => ({ level: entry.lv, order: digest('human-level-design-guards-v1/' + entry.lv) }))
    .sort((left, right) => left.order.localeCompare(right.order)).slice(0, 20).map(entry => entry.level);
  assert.equal(guards.length, 20);
  const payload = { schema: 'human-level-design-catalog-v1', observedAt: catalog.observedAt,
    publicRule: 'free-tile-takeability-and-drawn-back-overlays-2026-10-25', salts: [1, 2, 3], maxTries: 12,
    criticalLabs: CRITICAL_LABS, failures: [...failing].filter(level => entries.some(entry => entry.lv === level)), guards,
    entries, excluded: [10031] };
  const input = { ...payload, hash: digest(payload) };
  fs.writeFileSync(rawOutput(filename), JSON.stringify(input), { flag: 'wx' });
  return input;
}

function validate(input) {
  const { hash, ...payload } = input;
  assert.equal(input.schema, 'human-level-design-catalog-v1');
  assert.equal(hash, digest(payload));
  assert.deepEqual(input.salts, [1, 2, 3]);
  assert.equal(input.maxTries, 12);
  assert.equal(input.guards.length, 20);
}

function scopeEntries(input, scope) {
  validate(input);
  if (scope.startsWith('selection:') || scope.startsWith('remaining:')) {
    const selection = JSON.parse(fs.readFileSync(scope.slice(10)));
    const { hash, ...payload } = selection;
    assert.equal(hash, digest(payload));
    assert.equal(selection.catalogHash, input.hash);
    assert.equal(selection.guards.length, 20);
    assert.equal(new Set(selection.levels).size, selection.levels.length);
    assert(selection.levels.every(level => input.entries.some(entry => entry.lv === level)));
    const levels = new Set(selection.levels), include = scope.startsWith('selection:');
    return input.entries.filter(entry => levels.has(entry.lv) === include).sort((left, right) =>
      (CRITICAL_LABS.includes(left.lv) ? 0 : 1) - (CRITICAL_LABS.includes(right.lv) ? 0 : 1) || left.lv - right.lv);
  }
  const development = new Set([...input.failures, ...input.guards]);
  if (scope === 'all') return input.entries;
  if (scope === 'development') return input.entries.filter(entry => development.has(entry.lv)).sort((left, right) =>
    (CRITICAL_LABS.includes(left.lv) ? 0 : 1) - (CRITICAL_LABS.includes(right.lv) ? 0 : 1) || left.lv - right.lv);
  if (scope === 'remainder') return input.entries.filter(entry => !development.has(entry.lv));
  throw Error('Unknown scope:' + scope);
}

function run(input, planning, scope, shard, count, filename) {
  assert(Number.isInteger(shard) && shard >= 0 && Number.isInteger(count) && count > shard && count <= 12);
  const entries = scopeEntries(input, scope).filter((entry, index) => index % count === shard);
  const output = rawOutput(filename), measure = createMeasurer(planning);
  fs.writeFileSync(output, JSON.stringify({ type: 'header', catalogHash: input.hash, profileHash: digest(planning),
    sourceHash: measurementSource.hash, sourceFiles: measurementSource.files, scope, shard, count,
    pid: process.pid, startedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
  let valid = true;
  for (const entry of entries) {
    const measurement = measure(entry.game, { salts: input.salts, maxTries: input.maxTries });
    const record = { type: 'board', level: entry.lv, measurement };
    fs.appendFileSync(output, JSON.stringify(record) + '\n');
    valid &&= measurement.valid;
  }
  fs.appendFileSync(output, JSON.stringify({ type: 'footer', completed: entries.length, valid, finishedAt: new Date().toISOString() }) + '\n');
}

function summarize(input, files, scope = 'all') {
  const expected = scopeEntries(input, scope), records = [], headers = [];
  for (const filename of files) {
    const rows = fs.readFileSync(filename, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    const header = rows.shift(), footer = rows.pop();
    assert.equal(header.type, 'header');
    assert.equal(header.catalogHash, input.hash);
    assert.equal(footer.type, 'footer');
    const boards = rows.filter(row => row.type === 'board');
    assert.equal(footer.completed, boards.length);
    headers.push(header); records.push(...boards);
  }
  assert(headers.every(header => header.profileHash === headers[0].profileHash && header.sourceHash === headers[0].sourceHash));
  assert.equal(records.length, expected.length);
  const summary = evaluate(expected, records);
  assert.equal(summary.sourceHash, headers[0].sourceHash);
  assert.equal(summary.profileHash, headers[0].profileHash);
  return { ...summary, catalogHash: input.hash, observedAt: input.observedAt, scope };
}

function renderReport(summary, title = 'Human-information real-board baseline') {
  const lines = ['# ' + title, '',
    'Public rule: current free-tile takeability and drawn back overlays; hidden pictures remain gated.',
    'Salts:' + summary.salts.join(',') + '; max12 real tries per salt; no re-deals.', '',
    '| Level | Group | Dennis | Bot salts1/2/3 | Mean | Dennis+1 | Minutes/board |', '|---:|---|---:|---|---:|---|---:|'];
  for (const row of summary.rows.slice().sort((left, right) => left.level - right.level)) lines.push('|' + row.level
    + (row.historicalBoardExact === false ? '†' : '') + '|' + row.kind + '|' + row.dennis + '|'
    + row.tries.map(tries => tries ?? '>12/unresolved').join('/') + '|' + (row.average === null ? 'unresolved' : row.average.toFixed(2))
    + '|' + row.withinDennisPlusOne + '|' + row.minutesPerBoard.toFixed(2) + '|');
  lines.push('', 'Gates:' + JSON.stringify(summary.gates) + '; valid:' + summary.valid + '.',
    'Dennis total:' + summary.dennisTotal + '; bot totals per salt:' + summary.botTotalsPerSalt.map(total => total ?? 'unresolved').join('/')
      + '; mean bot total:' + (summary.botMeanTotal ?? 'unresolved') + '.',
    'Spearman:' + (summary.correlation ?? 'unresolved') + '; cleared-only diagnostic:' + (summary.clearedOnlyCorrelation ?? 'undefined')
      + '; eligible cleared pairs:' + summary.difficultySampleSize + '.',
    'Slowest move:' + summary.slowestMove.toFixed(1) + 'ms; mean minutes/board for3 salts:' + summary.minutesPerBoard.toFixed(2) + '.',
    'Largest mismatches(double underestimates):' + summary.biggestMismatches.map(row => row.level + ':' + (row.mismatch ?? 'uncleared')).join(',') + '.',
    '† No exact historical opening recording; uses the explicitly authorized board definition.',
    'Catalog:' + summary.catalogHash + '; source:' + summary.sourceHash + '; profile:' + summary.profileHash + '.', '');
  return lines.join('\n');
}

async function main() {
  const [command, inputFile, ...args] = process.argv.slice(2);
  if (command === 'prepare') {
    const input = await prepare(inputFile, args[0]);
    console.log(JSON.stringify({ catalog: inputFile, hash: input.hash, boards: input.entries.length,
      development: scopeEntries(input, 'development').length, criticalLabs: input.criticalLabs, guards: input.guards }));
  } else if (command === 'run') {
    const [profileFile, scope, shard, count, output] = args;
    run(JSON.parse(fs.readFileSync(inputFile)), JSON.parse(fs.readFileSync(profileFile)), scope, Number(shard), Number(count), output);
  } else throw Error('Use prepare <catalog> <old-real-summary>, or run <catalog> <profile> <scope> <shard> <count> <output>');
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { prepare, validate, scopeEntries, run, summarize, renderReport };
