'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { evaluateReference } = require('./personal_public_belief_benchmark.js');
const { verifyCertificate } = require('./public_belief_certificate.js');
const { verifySupport } = require('./public_belief_support.js');
const { verifyReferencePaths } = require('./personal_public_belief_verify.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(directory, variant = 'continuation') {
  assert(['continuation', 'information-revision', 'pressure'].includes(variant));
  const parent = path.resolve(directory), parentBytes = fs.readFileSync(path.join(parent, 'report.json')), parentReport = JSON.parse(parentBytes);
  const profiles = variant === 'continuation' ? { baseline: { ...REFERENCE_PARAMETERS, continuationPruning: false, safeInformationEscape: false },
    continuation128: { ...REFERENCE_PARAMETERS, continuationPruning: true, safeInformationEscape: false },
    combined: { ...REFERENCE_PARAMETERS, continuationPruning: true, safeInformationEscape: true } }
    : variant === 'pressure' ? { baseline: { ...REFERENCE_PARAMETERS, continuationPruning: false, safeInformationEscape: false },
      pressureOne: { ...REFERENCE_PARAMETERS, goalRecovery: true, goalRecoveryMin: 1 },
      pressureTwo: { ...REFERENCE_PARAMETERS, goalRecovery: true, goalRecoveryMin: 2 },
      pressureThree: { ...REFERENCE_PARAMETERS, goalRecovery: true, goalRecoveryMin: 3 } }
    : { baseline: { ...REFERENCE_PARAMETERS, continuationPruning: false, safeInformationEscape: false },
      informationRevision: { ...REFERENCE_PARAMETERS, replanOnInformation: true },
      goalRecovery: { ...REFERENCE_PARAMETERS, goalRecovery: true },
      revisedGoals: { ...REFERENCE_PARAMETERS, goalRecovery: true, replanOnInformation: true } };
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/reference-exact-check-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder); const sourceHashes = {};
  for (const source of Object.keys(require.cache).filter(source => source.startsWith(root + path.sep))) {
    const relative = path.relative(root, source).replace(/\\/g, '/'), content = fs.readFileSync(source), target = path.join(folder, 'sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content, { flag: 'wx' }); sourceHashes[relative] = hash(content);
  }
  const input = { made, targetMet: false, parent, parentReportSha256: hash(parentBytes), sourceHashes, profiles,
    cases: parentReport.rows.map(row => ({ name: row.name, filename: row.filename, sha256: row.sha256 })),
    note: 'Complete previously certified synthetic graph catalog, including genuinely uncertain and physically impossible deals. Re-evaluate actual current public policies on grounded graph actions, not with omniscient hidden-world choices. Exact original baseline histories must reproduce. Not a new physics replay or large-level/screenshot/personal accuracy claim.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(input), { flag: 'wx' });
  const rows = [];
  for (const entry of input.cases) {
    const bytes = fs.readFileSync(path.join(parent, entry.filename)); assert.equal(hash(bytes), entry.sha256);
    const data = JSON.parse(zlib.gunzipSync(bytes)); verifySupport(data.result); verifyCertificate(data.result);
    const evaluations = {};
    for (const [name, options] of Object.entries(profiles)) {
      const evaluated = evaluateReference(data.result, options); verifyReferencePaths(data.result, evaluated);
      if (name === 'baseline') assert.deepEqual(evaluated, data.reference, 'Entire original reference history must reproduce on the exact prior');
      evaluations[name] = evaluated;
      const row = { name: entry.name, profile: name, exactOptimalWins: data.result.winningWorlds, worlds: data.result.totalWorlds,
        wins: evaluated.wins, unresolved: evaluated.unresolved, suboptimalDecisions: evaluated.distinctSuboptimalDecisions,
        matchesExactOptimum: evaluated.wins === data.result.winningWorlds && evaluated.unresolved === 0 };
      rows.push(row); fs.appendFileSync(path.join(folder, 'progress.jsonl'), JSON.stringify(row) + '\n'); console.log(JSON.stringify(row));
    }
    fs.writeFileSync(path.join(folder, entry.name + '.json.gz'), zlib.gzipSync(JSON.stringify(evaluations)), { flag: 'wx' });
  }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(path.join(parent, 'report.json'))), hash(parentBytes));
  fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify({ ...input, rows }), { flag: 'wx' }); console.log(JSON.stringify({ folder, evaluations: rows.length }));
}

if (require.main === module) main(process.argv[2], process.argv[3]);
