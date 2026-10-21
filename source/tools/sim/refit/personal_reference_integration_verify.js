'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function verify(directory) {
  const folder = path.resolve(directory), inputBytes = fs.readFileSync(path.join(folder, 'input.json'));
  const resultBytes = fs.readFileSync(path.join(folder, 'data.json')), input = JSON.parse(inputBytes), result = JSON.parse(resultBytes);
  for (const [key, value] of Object.entries(input)) assert.deepEqual(result[key], value);
  for (const [relative, expected] of Object.entries(input.sourceHashes)) {
    assert.equal(hash(fs.readFileSync(path.join(folder, 'sources', relative))), expected);
  }
  const engine = fs.readFileSync(path.join(folder, 'sources/source/www/hard.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(hash(engine), input.observation.prototypeEngineSha256);
  const baselineBytes = fs.readFileSync(input.baselineFile); assert.equal(hash(baselineBytes), input.baselineSha256);
  const baseline = JSON.parse(baselineBytes); assert.equal(baseline.parentInputSha256, input.parentInputSha256);
  const journal = fs.readFileSync(path.join(folder, 'progress.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(journal, result.rows); assert.equal(result.rows.length, input.entries.length); assert.equal(result.rows.length, 29);
  const identities = new Set(), scores = {};
  for (const row of result.rows) {
    const identity = JSON.stringify([row.cohort, row.name, row.lv, row.start]); assert(!identities.has(identity)); identities.add(identity);
    const entry = input.entries.find(entry => JSON.stringify([entry.cohort, entry.name, entry.lv, entry.start]) === identity); assert(entry);
    const { game: privateGame, ...metadata } = entry;
    const { measured, baseline: previous, changedOutcome, ...actualMetadata } = row; assert.deepEqual(actualMetadata, metadata);
    const before = baseline.rows.find(entry => entry.cohort === row.cohort && entry.name === row.name && entry.lv === row.lv);
    assert.deepEqual(previous, before.profiles.recoveryFromTwo);
    assert.equal(changedOutcome, measured.result.win !== previous.result.win);
    assert.equal(measured.computationCensored, measured.result.why === 'contextChoiceLimit');
    assert.equal(measured.physicalFrames, measured.knownPhysicalControls + measured.unknownChoices + measured.unsupportedChoices);
    assert.equal(measured.autonomousUnmatchedFrames, 0);
    const score = scores[row.cohort] ||= { n: 0, wins: 0, computationCensored: 0, unsupportedChoices: 0, knownPhysicalControls: 0, unmatchedFrames: 0 };
    score.n++; score.wins += +(measured.result.win && !measured.computationCensored);
    score.computationCensored += +measured.computationCensored; score.unsupportedChoices += measured.unsupportedChoices;
    score.knownPhysicalControls += measured.knownPhysicalControls; score.unmatchedFrames += measured.autonomousUnmatchedFrames;
  }
  assert.deepEqual(scores, result.scores);
  assert.equal(scores.pinnedLaterResearch.n, 25); assert.equal(scores.priorCalibrationControl.n, 4);
  const verification = { made: new Date().toISOString(), targetMet: false, sourceSha256: hash(fs.readFileSync(__filename)),
    inputSha256: hash(inputBytes), resultSha256: hash(resultBytes), sourcesChecked: Object.keys(input.sourceHashes).length,
    casesChecked: result.rows.length, scores,
    note: 'Independent archive/source/engine/journal/score consistency checks. Known physics was checked against actual production actions by the archived runner. This verifier is not a second autonomous replay, screenshot-information proof or personal accuracy evidence.' };
  fs.copyFileSync(__filename, path.join(folder, 'verification-source.js'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(folder, 'verification.json'), JSON.stringify(verification), { flag: 'wx' });
  console.log(JSON.stringify(verification));
  return verification;
}

if (require.main === module) verify(process.argv[2]);
module.exports = { verify };
