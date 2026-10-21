'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { casesOf, play, SETTINGS } = require('./public_witness_screen.js');
const { REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const root = path.resolve(__dirname, '../../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(parentDirectory, baselineFile) {
  const inputFile = path.join(path.resolve(parentDirectory), 'input.json'), bytes = fs.readFileSync(inputFile), data = JSON.parse(bytes);
  const baselineBytes = fs.readFileSync(path.resolve(baselineFile)), baseline = JSON.parse(baselineBytes);
  assert.equal(hash(bytes), baseline.parentInputSha256);
  const entries = casesOf(data), made = new Date().toISOString();
  assert.equal(entries.length, 29);
  const folder = path.join(root, 'source/analysis/archive/personal-bots/integrated-witness-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const sourceHashes = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'); sourceHashes[relative] = hash(fs.readFileSync(filename));
    const target = path.join(folder, 'sources', relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(filename, target);
  }
  const input = { made, targetMet: false, sourceHashes, parentInputSha256: hash(bytes), baselineSha256: hash(baselineBytes),
    baselineFile: path.resolve(baselineFile), entries, observation: data.observation, settings: SETTINGS, options: REFERENCE_PARAMETERS,
    note: 'Complete29-case integration screen with unchanged symbolic observation, physics, prior and seed. The observation is not the validated screenshot boundary. Retains all case differences; not personal future forecast accuracy or optimality.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(input), { flag: 'wx' });
  const rows = entries.map(entry => {
    const measured = play(entry, data.observation.prior, REFERENCE_PARAMETERS);
    const previous = baseline.rows.find(row => row.name === entry.name && row.lv === entry.lv && row.cohort === entry.cohort);
    assert(previous);
    const control = previous.profiles.recoveryFromTwo;
    const { game: privateGame, ...metadata } = entry;
    const row = { ...metadata, measured, baseline: control, changedOutcome: measured.result.win !== control.result.win };
    fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(row) + '\n');
    return row;
  });
  const scores = Object.fromEntries(['pinnedLaterResearch', 'priorCalibrationControl'].map(cohort => {
    const own = rows.filter(row => row.cohort === cohort);
    return [cohort, { n: own.length, wins: own.filter(row => row.measured.result.win && !row.measured.computationCensored).length,
      computationCensored: own.filter(row => row.measured.computationCensored).length,
      unsupportedChoices: own.reduce((sum, row) => sum + row.measured.unsupportedChoices, 0),
      knownPhysicalControls: own.reduce((sum, row) => sum + row.measured.knownPhysicalControls, 0),
      unmatchedFrames: own.reduce((sum, row) => sum + row.measured.autonomousUnmatchedFrames, 0) }];
  }));
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(inputFile)), input.parentInputSha256);
  assert.equal(hash(fs.readFileSync(path.resolve(baselineFile))), input.baselineSha256);
  const changes = rows.filter(row => row.changedOutcome).map(row => ({ name: row.name, lv: row.lv, cohort: row.cohort,
    before: row.baseline.result, after: row.measured.result }));
  fs.writeFileSync(path.join(folder, 'data.json'), JSON.stringify({ ...input, rows, scores, changes }), { flag: 'wx' });
  console.log(JSON.stringify({ folder, scores, changes }));
}

if (require.main === module) main(process.argv[2], process.argv[3]);
