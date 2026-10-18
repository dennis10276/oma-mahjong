'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const inputFile = 'analysis/archive/personal-bots/progression-profile-input.json';
  const raw = fs.readFileSync(path.join(root, inputFile)), inputs = JSON.parse(raw);
  const digest = crypto.createHash('sha256');
  for (const file of inputs.fingerprintFiles) digest.update(fs.readFileSync(path.join(root, file)));
  if (digest.digest('hex') !== inputs.fingerprint) throw new Error('Progression coverage sources changed before snapshot');
  const ledgerFile = 'analysis/personal-bots/progression-prospective-forecasts.json';
  const ledger = JSON.parse(fs.readFileSync(path.join(root, ledgerFile)));
  if (ledger.at(-1).inputsSha256 !== hash(raw)) throw new Error('Latest coverage freeze does not match progression input');
  const snapshotFile = 'analysis/archive/realdata/snapshot.json';
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, snapshotFile)));
  const prospective = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/progression-prospective-results.json')));
  const files = [...new Set([...inputs.fingerprintFiles, inputFile, snapshotFile,
    ...snapshot.files.map(file => 'analysis/archive/' + file), ledgerFile,
    ...['prospective', 'kind-prospective', 'count-profile-prospective'].map(name => 'analysis/personal-bots/' + name + '-forecasts.json'),
    'analysis/archive/personal-bots/prospective-outcomes.json', 'analysis/personal-bots/progression-prospective-results.json',
    'analysis/personal-bots/WORK_LOG.md', 'tests/t_personal_bots.js', 'tools/sim/refit/BOARD_VERSIONS.md',
    ...['attempt_campaigns.js', 'attempt_count.js', 'attempt_count_labels.js', 'prospective_openings.js', 'prospective_data.js',
      'progression_refresh_snapshot.js', 'boards.js', 'pdata.js', 'dataset.js', 'mimic_data.js', 'mimic_games.js', 'attempts.json'].map(file => 'tools/sim/refit/' + file),
    ...['Dennisisdebeste', 'Mrs_Doubtfire', 'PUK', 'Gerda'].map(name => 'tools/sim/refit/mimic/' + name + '.json')])];
  const folder = path.join(root, 'analysis/archive/personal-bots/experiments/progression-refresh-' + snapshot.downloadedAt.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const pinned = {};
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, file)), destination = path.join(folder, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    pinned[file] = hash(bytes);
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ made: new Date().toISOString(), files: pinned,
    downloadedAt: snapshot.downloadedAt, progressionFingerprint: inputs.fingerprint, latestFrozenAt: ledger.at(-1).frozenAt,
    primaryCohort: prospective.cohort, targetMet: prospective.targetMet,
    note: 'Read-only live refresh and append-only same-v1 forecast coverage. Original numeric snapshots, misses and cohort clock remain unchanged. The authoritative current cohort is copied from the scored report, not a stale hardcoded summary. No new research-model promotion.' }, null, 2));
  console.log(folder, files.length, 'pinned files');
}

if (require.main === module) main();
