'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const { loadDevelopmentClears } = require('./human_reference_catalog.js');
const { publicContextFor } = require('./human_reference_screen.js');

const FAILURES = Object.freeze([81, 93, 99, 102, 107, 112, 125, 137]);
const GUARDS = Object.freeze([134, 141, 143, 147, 150, 151, 153, 156]);
const LEVELS = Object.freeze([...FAILURES, ...GUARDS]);
const SALTS = Object.freeze([1, 2, 3]);
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function validateInput(input) {
  assert.equal(input.schema, 'human-reference-noise-input-v1');
  assert.equal(input.entries.length, 16); assert.equal(input.inputHash, digest(input.entries));
  assert.deepEqual(input.entries.map(entry => entry.lv), LEVELS);
  assert(input.entries.every(entry => entry.name === 'Dennisisdebeste' && entry.game && Number.isInteger(entry.wonOn)));
}

function runSaltScreen(input, planning, salt, { runCampaign = playHumanCampaign, emit = () => {} } = {}) {
  validateInput(input); assert(SALTS.includes(salt));
  const rows = [];
  for (const entry of input.entries) {
    let row;
    try {
      const result = runCampaign(decodeGame(entry.game), { planning: { ...planning, hypothesisRunSalt: salt },
        publicContext: publicContextFor(entry), maximumAttempts: 1 });
      assert.equal(result.attempts.length, 1, 'Noise screens must execute exactly one attempt');
      assert(result.wonOn === null || result.wonOn === 1);
      const hypothesis = result.hypothesis ?? {};
      row = { level: entry.lv, salt, guard: GUARDS.includes(entry.lv), humanTries: entry.wonOn,
        wonFirstTry: result.wonOn === 1 && result.status === 'cleared', status: result.status, attempts: 1,
        boardSource: entry.boardSource, verifiedTaps: result.verifiedTaps,
        slowestMs: Math.round(result.slowestMs * 10) / 10, decisions: result.decisionCount,
        contested: hypothesis.contestedDecisions ?? 0, changed: hypothesis.changed ?? 0,
        completeWorlds: hypothesis.completeWorlds ?? 0, informationEvaluations: hypothesis.informationEvaluations ?? 0,
        informationClears: hypothesis.informationClears ?? 0, informationUnresolved: hypothesis.informationUnresolved ?? 0,
        confidenceDecisions: hypothesis.confidenceDecisions ?? 0, confidenceOverrides: hypothesis.confidenceOverrides ?? 0,
        confidenceSuppressed: hypothesis.confidenceSuppressed ?? 0 };
    } catch (error) {
      row = { level: entry.lv, salt, guard: GUARDS.includes(entry.lv), humanTries: entry.wonOn,
        wonFirstTry: false, status: 'invalid', attempts: null, slowestMs: null,
        error: String(error.message).slice(0, 300) };
    }
    rows.push(row); emit(row);
  }
  return rows;
}

function assembleNoiseReport(workers, baseline = null) {
  assert.equal(workers.length, 3); assert.deepEqual(workers.map(worker => worker.salt).sort(), SALTS);
  assert(workers.every(worker => worker.schema === 'human-reference-noise-salt-v1'
    && worker.inputHash === workers[0].inputHash && digest(worker.planning) === digest(workers[0].planning)
    && worker.sourceHash === workers[0].sourceHash));
  assert(workers.every(worker => worker.rows.every(row => row.salt === worker.salt)));
  const rows = workers.flatMap(worker => worker.rows);
  assert.equal(rows.length, 48);
  for (const salt of SALTS) assert.deepEqual(rows.filter(row => row.salt === salt).map(row => row.level), LEVELS);
  const valid = workers.every(worker => worker.sourceUnchanged)
    && rows.every(row => row.status !== 'invalid' && row.attempts === 1 && Number.isFinite(row.slowestMs) && row.slowestMs < 2000);
  const result = { schema: 'human-reference-noise-screen-v1', inputHash: workers[0].inputHash,
    sourceHash: workers[0].sourceHash, planning: workers[0].planning, valid, rows,
    wins: rows.filter(row => row.wonFirstTry).length,
    bySalt: SALTS.map(salt => ({ salt, wins: rows.filter(row => row.salt === salt && row.wonFirstTry).length })),
    slowestMs: Math.max(...rows.map(row => row.slowestMs ?? 0)),
    contested: rows.reduce((sum, row) => sum + (row.contested ?? 0), 0),
    changed: rows.reduce((sum, row) => sum + (row.changed ?? 0), 0),
    completeWorlds: rows.reduce((sum, row) => sum + (row.completeWorlds ?? 0), 0),
    informationEvaluations: rows.reduce((sum, row) => sum + (row.informationEvaluations ?? 0), 0),
    confidenceOverrides: rows.reduce((sum, row) => sum + (row.confidenceOverrides ?? 0), 0),
    confidenceSuppressed: rows.reduce((sum, row) => sum + (row.confidenceSuppressed ?? 0), 0) };
  if (baseline) {
    assert.equal(baseline.schema, result.schema); assert.equal(baseline.inputHash, result.inputHash);
    assert.equal(baseline.rows.length, 48);
    assert.equal(baseline.wins, baseline.rows.filter(row => row.wonFirstTry).length);
    const previous = new Map(baseline.rows.map(row => [row.level + '|' + row.salt, row]));
    assert.equal(previous.size, 48); assert(rows.every(row => previous.has(row.level + '|' + row.salt)));
    result.baselineWins = baseline.wins;
    result.gains = rows.filter(row => row.wonFirstTry && !previous.get(row.level + '|' + row.salt).wonFirstTry).length;
    result.losses = rows.filter(row => !row.wonFirstTry && previous.get(row.level + '|' + row.salt).wonFirstTry).length;
    result.guardChanges = GUARDS.map(level => ({ level,
      gains: rows.filter(row => row.level === level && row.wonFirstTry && !previous.get(level + '|' + row.salt).wonFirstTry).length,
      losses: rows.filter(row => row.level === level && !row.wonFirstTry && previous.get(level + '|' + row.salt).wonFirstTry).length }));
    result.adoptable = valid && baseline.valid && result.wins > baseline.wins && result.guardChanges.every(guard => guard.losses <= 1);
  } else result.adoptable = false;
  return result;
}

function renderNoiseReport(result, baseline = null) {
  const marks = (screen, level) => SALTS.map(salt => screen.rows.find(row => row.level === level && row.salt === salt).wonFirstTry ? 'W' : 'L').join(' / ');
  const lines = ['# Personal reference: seeded first-try noise screen', '',
    'Profile: `' + JSON.stringify(result.planning) + '`.',
    'Source: `' + result.sourceHash + '`; input: `' + result.inputHash + '`.',
    'Every row is try1 only, with three independent salt workers. Guard membership follows the requested list regardless of historical human attempt counts.', '',
    baseline ? '| Level | Group | Baseline salts1/2/3 | Candidate salts1/2/3 | Gains | Losses |' : '| Level | Group | Salt1 / Salt2 / Salt3 | Wins |',
    baseline ? '|---:|---|---|---|---:|---:|' : '|---:|---|---|---:|'];
  for (const level of LEVELS) {
    const group = GUARDS.includes(level) ? 'guard' : 'failure';
    const wins = result.rows.filter(row => row.level === level && row.wonFirstTry).length;
    if (!baseline) lines.push(`|${level}|${group}|${marks(result, level)}|${wins}/3|`);
    else {
      const old = new Map(baseline.rows.filter(row => row.level === level).map(row => [row.salt, row.wonFirstTry]));
      const gains = result.rows.filter(row => row.level === level && row.wonFirstTry && !old.get(row.salt)).length;
      const losses = result.rows.filter(row => row.level === level && !row.wonFirstTry && old.get(row.salt)).length;
      lines.push(`|${level}|${group}|${marks(baseline, level)}|${marks(result, level)}|${gains}|${losses}|`);
    }
  }
  lines.push('', `First-try wins: ${result.wins}/48; salts: ${result.bySalt.map(row => row.wins + '/16').join(', ')}.`,
    `Valid complete screen: ${result.valid}. Slowest move: ${result.slowestMs}ms.`,
    `Sampling changed ${result.changed}/${result.contested} contested first taps; mean completed fillings per contested decision: ${(result.completeWorlds / Math.max(1, result.contested)).toFixed(2)}.`,
    `Play-outs evaluated: ${result.informationEvaluations}; confidence overrides: ${result.confidenceOverrides}; suppressed proposals: ${result.confidenceSuppressed}.`);
  if (baseline) lines.push(`Baseline ${baseline.wins}/48; gains ${result.gains}, losses ${result.losses}; adoption gate: ${result.adoptable}.`,
    'Adoption requires a higher total and at most one previously won salt lost per guard.');
  lines.push('Capped runs remain unresolved; W requires a verified production clear. Salt changes only the public-state random stream; wall-time budgets can still affect sample counts. This is development evidence, not unseen20 validation.', '');
  return lines.join('\n');
}

async function main(command, ...args) {
  if (command === 'prepare') {
    assert.equal(args.length, 1); assert(!fs.existsSync(args[0]));
    const catalog = await loadDevelopmentClears({ selectedLevels: LEVELS });
    const entries = LEVELS.map(level => catalog.rows.find(entry => entry.lv === level));
    const input = { schema: 'human-reference-noise-input-v1', entries, inputHash: digest(entries) };
    validateInput(input); fs.writeFileSync(args[0], JSON.stringify(input), { flag: 'wx' });
    console.log(JSON.stringify({ prepared: args[0], inputHash: input.inputHash, cases: entries.length })); return;
  }
  if (command === 'run') {
    assert.equal(args.length, 4);
    const [inputFile, planningFile, saltText, outputFile] = args; assert(!fs.existsSync(outputFile));
    const input = JSON.parse(fs.readFileSync(inputFile)), planning = JSON.parse(fs.readFileSync(planningFile)), salt = Number(saltText);
    const sourceRoot = path.resolve(__dirname, '../../..');
    const files = Object.keys(require.cache).filter(filename => filename.startsWith(sourceRoot + path.sep)).sort();
    const fingerprint = () => crypto.createHash('sha256').update(files.map(filename => path.relative(sourceRoot, filename).replace(/\\/g, '/')
      + '\0' + crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')).join('\n')).digest('hex');
    const sourceHash = fingerprint();
    console.log(JSON.stringify({ startedAt: new Date().toISOString(), salt, cases: 16, sourceHash, inputHash: input.inputHash, planning }));
    const rows = runSaltScreen(input, planning, salt, { emit: row => console.log(JSON.stringify(row)) });
    const result = { schema: 'human-reference-noise-salt-v1', salt, inputHash: input.inputHash, planning, sourceHash,
      sourceUnchanged: fingerprint() === sourceHash, rows };
    fs.writeFileSync(outputFile, JSON.stringify(result), { flag: 'wx' });
    console.log(JSON.stringify({ salt, finished: true, wins: rows.filter(row => row.wonFirstTry).length, sourceUnchanged: result.sourceUnchanged })); return;
  }
  assert.equal(command, 'report'); assert(args.length === 4 || args.length === 5);
  const [outputBase, ...filenames] = args;
  assert(!fs.existsSync(outputBase + '.json') && !fs.existsSync(outputBase + '.md'));
  const workers = filenames.slice(0, 3).map(filename => JSON.parse(fs.readFileSync(filename)));
  const baseline = filenames[3] ? JSON.parse(fs.readFileSync(filenames[3])) : null;
  const result = assembleNoiseReport(workers, baseline);
  fs.writeFileSync(outputBase + '.json', JSON.stringify(result), { flag: 'wx' });
  fs.writeFileSync(outputBase + '.md', renderNoiseReport(result, baseline), { flag: 'wx' });
  console.log(JSON.stringify({ wins: result.wins, valid: result.valid, gains: result.gains, losses: result.losses, adoptable: result.adoptable }));
}

if (require.main === module) main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { LEVELS, GUARDS, SALTS, digest, validateInput, runSaltScreen, assembleNoiseReport, renderNoiseReport };
