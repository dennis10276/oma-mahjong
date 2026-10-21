'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main(controlDirectory, candidateDirectory) {
  const source = fs.readFileSync(__filename), load = directory => {
    const folder = path.resolve(directory), reportBytes = fs.readFileSync(path.join(folder, 'report.json')), report = JSON.parse(reportBytes);
    const inputBytes = fs.readFileSync(path.join(folder, 'input.json')), input = JSON.parse(inputBytes);
    assert.equal(hash(inputBytes), report.inputSha256); assert.deepEqual(input.sourceHashes, report.sourceHashes);
    assert.deepEqual(input.cases.map(entry => entry.name), report.rows.map(row => row.name));
    for (const [relative, expected] of Object.entries(input.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(folder, 'sources', relative))), expected);
    const artifacts = report.rows.map(row => {
      assert.equal(row.status, 'exact'); const bytes = fs.readFileSync(path.join(folder, row.filename));
      assert.equal(hash(bytes), row.sha256); return bytes;
    });
    return { folder, report, input, artifacts, reportSha256: hash(reportBytes) };
  };
  const control = load(controlDirectory), candidate = load(candidateDirectory);
  assert.notEqual(control.folder, candidate.folder); assert.deepEqual(control.input.cases, candidate.input.cases);
  assert.deepEqual(control.input.settings, candidate.input.settings); assert.equal(control.artifacts.length, candidate.artifacts.length);
  for (let index = 0; index < control.artifacts.length; index++) assert(control.artifacts[index].equals(candidate.artifacts[index]),
    'Complete graph/certificate/grounding/reference artifact changed: ' + control.report.rows[index].name);
  const elapsed = result => result.report.rows.reduce((sum, row) => { assert(Number.isFinite(row.elapsedMs) && row.elapsedMs > 0); return sum + row.elapsedMs; }, 0);
  const controlMs = elapsed(control), candidateMs = elapsed(candidate);
  const result = { made: new Date().toISOString(), targetMet: false, control: control.folder, candidate: candidate.folder,
    controlReportSha256: control.reportSha256, candidateReportSha256: candidate.reportSha256,
    exactCompleteCases: control.artifacts.length, controlMs, candidateMs, measuredSpeedup: controlMs / candidateMs,
    graphArtifactHashes: control.report.rows.map(row => ({ name: row.name, sha256: row.sha256 })),
    verificationSourceSha256: hash(source),
    note: 'Complete predeclared catalog; every compressed graph, exact policy certificate, independent production grounding result and reference history is byte-identical, with no omitted cases or numerical limits. Timings sum all measured solve/ground/reference/write case durations. This measured CPU workload speedup is not a GPU result, a general Node performance guarantee, a personal accuracy metric or universal optimality.' };
  assert.equal(hash(fs.readFileSync(__filename)), hash(source));
  fs.writeFileSync(path.join(candidate.folder, 'independent-batch-comparison-source.js'), source, { flag: 'wx' });
  fs.writeFileSync(path.join(candidate.folder, 'independent-batch-comparison.json'), JSON.stringify(result), { flag: 'wx' });
  console.log(JSON.stringify({ exactCompleteCases: result.exactCompleteCases, controlMs, candidateMs, measuredSpeedup: result.measuredSpeedup }));
}

if (require.main === module) main(process.argv[2], process.argv[3]);
