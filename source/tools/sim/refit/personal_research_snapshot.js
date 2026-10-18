'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const experiment = process.argv[2] || 'personal';
  if (!['personal', 'joint', 'keys', 'single', 'intent', 'relation', 'sequence', 'memory'].includes(experiment)) throw new Error('Unknown personal snapshot experiment');
  const slug = experiment === 'keys' ? 'key' : experiment;
  const measurement = 'analysis/archive/personal-bots/physical-' + slug + '-count-data.json';
  const raw = fs.readFileSync(path.join(root, measurement)), data = JSON.parse(raw);
  const digest = crypto.createHash('sha256');
  for (const file of data.fingerprintFiles) digest.update(fs.readFileSync(path.join(root, file)));
  if (digest.digest('hex') !== data.fingerprint) throw new Error('Personal experiment sources changed before snapshot');
  const reportFile = 'analysis/personal-bots/physical-' + slug + '-count-evaluation.json';
  const report = JSON.parse(fs.readFileSync(path.join(root, reportFile)));
  if (report.dataSha256 !== hash(raw) || report.measurementFingerprint !== data.fingerprint || !report.personalOnly) throw new Error('Count report does not match personal measurement');
  const sourceFiles = fs.readdirSync(__dirname).filter(file => /\.(js|py|md)$/.test(file)).map(file => 'tools/sim/refit/' + file);
  const reportFiles = ['analysis/personal-bots/personal-' + (experiment === 'memory' ? 'memory-action' : experiment === 'sequence' ? 'sequence-action' : experiment === 'relation' ? 'relation-action' : experiment === 'intent' ? 'intent-action' : experiment === 'single' ? 'single-action' : experiment === 'keys' ? 'key-action' : experiment === 'joint' ? 'joint-action' : 'action') + '-evaluation.json', reportFile,
    'analysis/archive/personal-bots/physical-' + slug + '-count-scored.json', 'analysis/personal-bots/WORK_LOG.md',
    'analysis/personal-bots/progression-prospective-results.json', 'analysis/archive/personal-bots/prospective-outcomes.json',
    'analysis/personal-bots/physical-finish-tray-audit.json', 'analysis/personal-bots/physical-opening-audit.json', 'analysis/personal-bots/physical-handoff-audit.json',
    'analysis/personal-bots/physical-retry-audit.json',
    ...(['intent', 'relation', 'sequence', 'memory'].includes(experiment) ? [] : ['analysis/personal-bots/' + (experiment === 'single' ? 'physical-single-scoring-audit.json' : 'physical-scoring-audit.json')]),
    'analysis/personal-bots/personal-' + (['intent', 'relation', 'sequence', 'memory'].includes(experiment) ? experiment + '-' : '') + 'recent-selection.json',
    ...(experiment === 'relation' ? ['analysis/personal-bots/personal-pair-preparation-observations.json'] : []),
    ...(experiment === 'sequence' ? ['analysis/personal-bots/personal-pair-follow-through-observations.json', 'analysis/personal-bots/personal-retry-knowledge-audit.json'] : []),
    ...(experiment === 'memory' ? ['analysis/personal-bots/personal-memory-reconstruction-audit.json', 'analysis/personal-bots/personal-late-memory-audit.json'] : []),
    ...['prospective', 'kind-prospective', 'count-profile-prospective', 'progression-prospective'].map(name => 'analysis/personal-bots/' + name + '-forecasts.json')];
  const files = [...new Set([...data.fingerprintFiles, measurement, ...sourceFiles, ...reportFiles, 'tests/t_personal_bots.js'])];
  const folder = path.join(root, 'analysis/archive/personal-bots/experiments/personal-' + (['intent', 'relation', 'sequence', 'memory'].includes(experiment) ? experiment : experiment === 'single' ? 'single' : experiment === 'keys' ? 'key' : experiment === 'joint' ? 'joint' : 'first') + '-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const pinned = {};
  for (const file of files) {
    const source = path.join(root, file), destination = path.join(folder, file);
    const bytes = fs.readFileSync(source);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    pinned[file] = hash(bytes);
  }
  const manifest = { made: new Date().toISOString(), measurementFingerprint: data.fingerprint,
    evidence: 'historical-exploratory', targetMet: false, files: pinned,
    note: 'Independent per-person refits after campaign opening/resume repairs. Earlier physical results for Mrs.91 and Gerda56 were contaminated; their archived numbers are not rewritten. Additional finish/opening audits reference their own earlier pinned engine. Numeric prospective ledgers are unchanged; no fresh prospective 80% success is established.' };
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(folder, files.length, 'pinned files');
}

if (require.main === module) main();
