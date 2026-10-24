'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const { loadDevelopmentClears } = require('./human_reference_catalog.js');
const { digest, SALTS } = require('./human_reference_noise_screen.js');
const { passes } = require('./human_reference_screen.js');
const LAB_LEVELS = Object.freeze([10032, 10033, 10041, 10052]);

function validateLabInput(input) {
  assert.equal(input.schema, 'human-reference-lab-retry-input-v1');
  assert.deepEqual(input.entries.map(entry => entry.lv), LAB_LEVELS);
  assert.equal(input.inputHash, digest(input.entries));
  assert(input.entries.every(entry => entry.name === 'Dennisisdebeste' && entry.boardSource === 'levelLab' && entry.game));
}

function runLabSalt(input, planning, salt, { runCampaign = playHumanCampaign, emit = () => {} } = {}) {
  validateLabInput(input); assert(SALTS.includes(salt));
  const rows = [];
  for (const entry of input.entries) {
    let row;
    try {
      const result = runCampaign(decodeGame(entry.game), { planning: { ...planning, hypothesisRunSalt: salt },
        publicContext: { boardMode: 'lab' }, maximumAttempts: 4, captureDecisions: true });
      assert(result.attempts.length >= 1 && result.attempts.length <= 4);
      const attempts = result.attempts.map(attempt => {
        const opening = attempt.decisions[0]?.state;
        assert(opening, 'Retry audit needs the first public decision of each actual attempt');
        return { attempt: attempt.attempt, status: attempt.status, taps: attempt.taps,
          unseenAtStart: opening.pictures.filter((picture, index) => opening.alive[index] && picture === null).length,
          unseenAtEnd: attempt.last.pictures.filter(picture => picture === null).length };
      });
      for (let index = 1; index < attempts.length; index++) assert(attempts[index].unseenAtStart <= attempts[index - 1].unseenAtEnd,
        'Same-level retries must retain earlier observed pictures');
      assert(result.wonOn === null || result.wonOn === result.attempts.length);
      row = { level: entry.lv, salt, humanTries: entry.wonOn, botTries: result.wonOn,
        strictPass: passes(entry.wonOn, result.wonOn), status: result.status, attempts,
        verifiedTaps: result.verifiedTaps, slowestMs: Math.round(result.slowestMs * 10) / 10,
        exactSearchCalls: result.hypothesis?.exactSearchCalls ?? 0, exactSearchNodes: result.hypothesis?.exactSearchNodes ?? 0 };
    } catch (error) {
      row = { level: entry.lv, salt, humanTries: entry.wonOn, botTries: null, strictPass: false,
        status: 'invalid', slowestMs: null, error: String(error.message).slice(0, 300) };
    }
    rows.push(row); emit(row);
  }
  return rows;
}

function assembleLabReport(workers) {
  assert.equal(workers.length, 3); assert.deepEqual(workers.map(worker => worker.salt).sort(), SALTS);
  assert(workers.every(worker => worker.schema === 'human-reference-lab-retry-salt-v1'
    && worker.inputHash === workers[0].inputHash && worker.sourceHash === workers[0].sourceHash
    && digest(worker.planning) === digest(workers[0].planning) && worker.rows.every(row => row.salt === worker.salt)));
  const rows = workers.flatMap(worker => worker.rows);
  for (const salt of SALTS) assert.deepEqual(rows.filter(row => row.salt === salt).map(row => row.level), LAB_LEVELS);
  return { schema: 'human-reference-lab-retry-screen-v1', inputHash: workers[0].inputHash, sourceHash: workers[0].sourceHash,
    planning: workers[0].planning, rows, clearsWithinFour: rows.filter(row => row.botTries !== null).length,
    strictPasses: rows.filter(row => row.strictPass).length,
    valid: workers.every(worker => worker.sourceUnchanged)
      && rows.every(row => row.status !== 'invalid' && Number.isFinite(row.slowestMs) && row.slowestMs < 2000) };
}

function renderLabReport(result) {
  const lines = ['# Lab retry memory: three-salt diagnostic', '',
    'Profile: `' + JSON.stringify(result.planning) + '`.',
    'Source: `' + result.sourceHash + '`; input: `' + result.inputHash + '`.', '',
    '| Lab | Human tries | Bot salts1/2/3 | Strict passes | Unseen pictures at actual retry starts |',
    '|---:|---:|---|---:|---|'];
  for (const level of LAB_LEVELS) {
    const rows = SALTS.map(salt => result.rows.find(row => row.level === level && row.salt === salt));
    lines.push(`|${level - 10000}|${rows[0].humanTries}|${rows.map(row => row.botTries ?? '>4/unresolved').join(' / ')}|${rows.filter(row => row.strictPass).length}/3|${rows.map(row => (row.attempts ?? []).map(attempt => attempt.unseenAtStart).join('→')).join(' / ')}|`);
  }
  lines.push('', `Clears within four actual tries: ${result.clearsWithinFour}/12; strict human-try passes: ${result.strictPasses}/12. Valid screen: ${result.valid}.`,
    `Slowest move: ${Math.max(...result.rows.map(row => row.slowestMs ?? 0))}ms; exact-search nodes: ${result.rows.reduce((sum, row) => sum + (row.exactSearchNodes ?? 0), 0)}.`,
    'Every restart counts; only same-level actual observations carry forward. A late clear can pass this four-try diagnostic while failing the strict human-try gate. Caps remain unresolved; no impossibility claim or unseen20 test.', '');
  return lines.join('\n');
}

async function main(command, ...args) {
  if (command === 'prepare') {
    assert.equal(args.length, 1); assert(!fs.existsSync(args[0]));
    const catalog = await loadDevelopmentClears({ selectedLevels: LAB_LEVELS });
    const entries = LAB_LEVELS.map(level => catalog.rows.find(entry => entry.lv === level));
    const input = { schema: 'human-reference-lab-retry-input-v1', entries, inputHash: digest(entries) };
    validateLabInput(input); fs.writeFileSync(args[0], JSON.stringify(input), { flag: 'wx' });
    console.log(JSON.stringify({ prepared: args[0], cases: 4, inputHash: input.inputHash })); return;
  }
  if (command === 'run') {
    assert.equal(args.length, 4);
    const [inputFile, profileFile, saltText, outputFile] = args; assert(!fs.existsSync(outputFile));
    const input = JSON.parse(fs.readFileSync(inputFile)), planning = JSON.parse(fs.readFileSync(profileFile)), salt = Number(saltText);
    const sourceRoot = path.resolve(__dirname, '../../..');
    const files = Object.keys(require.cache).filter(filename => filename.startsWith(sourceRoot + path.sep)).sort();
    const fingerprint = () => crypto.createHash('sha256').update(files.map(filename => path.relative(sourceRoot, filename).replace(/\\/g, '/')
      + '\0' + crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')).join('\n')).digest('hex');
    const sourceHash = fingerprint();
    console.log(JSON.stringify({ startedAt: new Date().toISOString(), salt, cases: 4, maximumAttempts: 4, sourceHash, inputHash: input.inputHash }));
    const rows = runLabSalt(input, planning, salt, { emit: row => console.log(JSON.stringify(row)) });
    fs.writeFileSync(outputFile, JSON.stringify({ schema: 'human-reference-lab-retry-salt-v1', salt, planning,
      inputHash: input.inputHash, sourceHash, sourceUnchanged: fingerprint() === sourceHash, rows }), { flag: 'wx' }); return;
  }
  assert.equal(command, 'report'); assert.equal(args.length, 4);
  const [outputBase, ...filenames] = args;
  assert(!fs.existsSync(outputBase + '.json') && !fs.existsSync(outputBase + '.md'));
  const result = assembleLabReport(filenames.map(filename => JSON.parse(fs.readFileSync(filename))));
  fs.writeFileSync(outputBase + '.json', JSON.stringify(result), { flag: 'wx' });
  fs.writeFileSync(outputBase + '.md', renderLabReport(result), { flag: 'wx' });
  console.log(JSON.stringify({ clearsWithinFour: result.clearsWithinFour, strictPasses: result.strictPasses, valid: result.valid }));
}

if (require.main === module) main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { LAB_LEVELS, runLabSalt, assembleLabReport, renderLabReport };
