'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { PNG } = require('pngjs');
const { supportOf } = require('./personal_pixel_capture_verify.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function readBound(folder, relative, expected) {
  assert(typeof relative === 'string' && !path.isAbsolute(relative));
  const filename = path.resolve(folder, relative);
  assert(filename.startsWith(path.resolve(folder) + path.sep));
  const bytes = fs.readFileSync(filename);
  if (expected !== undefined) assert.equal(hash(bytes), expected, filename);
  return bytes;
}

function verify(folder) {
  const reportBytes = readBound(folder, 'report.json'), report = JSON.parse(reportBytes);
  const config = JSON.parse(readBound(folder, 'config.json'));
  assert.deepEqual(report.sourceHashes, config.sourceHashes);
  for (const [relative, expected] of Object.entries(report.sourceHashes)) readBound(path.join(folder, 'sources'), relative, expected);
  for (const [relative, expected] of Object.entries(report.artifacts)) readBound(folder, relative, expected);
  assert.deepEqual(report.results.map(result => result.name), config.fixtures.map(fixture => fixture.name));
  let frames = 0, banks = 0;
  const cases = [];
  for (const fixture of config.fixtures) {
    const value = JSON.parse(readBound(folder, fixture.name + '.json'));
    const memory = fixture.game.tiles.map(() => null);
    for (const frame of value.frames) {
      const stem = fixture.name + '-' + frame.position, image = PNG.sync.read(readBound(folder, stem + '.png'));
      assert(image.data.equals(PNG.sync.read(readBound(folder, stem + '-after.png')).data));
      const earlier = [], seen = new Set();
      for (const filename of frame.bankFiles) {
        const bank = JSON.parse(zlib.gunzipSync(readBound(folder, filename))), index = +filename.match(/-tile(\d+)\.json\.gz$/)[1];
        assert(!seen.has(index)); seen.add(index);
        assert.deepEqual(bank.publicRecognizedContext, earlier);
        const calculated = supportOf(bank, image), observation = frame.observations[index].observation;
        for (const [key, expected] of Object.entries(calculated)) assert.deepEqual(observation[key], expected);
        assert(calculated.pictures.includes(fixture.game.faces[index]));
        if (calculated.known !== null) {
          assert.equal(calculated.known, fixture.game.faces[index]); earlier.push({ index, picture: calculated.known });
        }
        banks++;
      }
      for (const row of frame.observations) {
        assert.equal(seen.has(row.index), row.alive);
        if (!row.alive) { assert.equal(row.observation, null); continue; }
        if (row.observation.known !== null) {
          assert(memory[row.index] === null || memory[row.index] === row.observation.known);
          memory[row.index] = row.observation.known;
        }
      }
      assert.deepEqual(memory, frame.memory); frames++;
    }
    cases.push(value);
  }
  return { report, reportSha256: hash(reportBytes), cases, frames, banks };
}

function physicalControlOf(value) {
  return { name: value.name, frames: value.frames.map(frame => ({ position: frame.position, frame: frame.frame,
    memory: frame.memory, selectedWitness: frame.plan ? { index: frame.plan.index, path: frame.plan.path } : null })),
    final: value.final, stopped: value.stopped, audit: value.audit };
}

function main(controlDirectory, candidateDirectory, scope = 'exact') {
  assert(['exact', 'preservedControls', 'physicalControls'].includes(scope));
  const controlFolder = path.resolve(controlDirectory), candidateFolder = path.resolve(candidateDirectory);
  assert.notEqual(controlFolder, candidateFolder);
  const control = verify(controlFolder), candidate = verify(candidateFolder);
  assert.equal(candidate.report.templateMode, 'parallel');
  const controlNames = control.cases.map(value => value.name);
  const matched = candidate.cases.filter(value => controlNames.includes(value.name));
  if (scope === 'physicalControls') {
    assert.deepEqual(candidate.cases.map(value => value.name), controlNames);
    for (let position = 0; position < matched.length; position++) assert.equal(hash(JSON.stringify(physicalControlOf(matched[position]))),
      hash(JSON.stringify(physicalControlOf(control.cases[position]))), 'Physical control changed: ' + controlNames[position]);
  } else assert.deepEqual(matched, control.cases);
  assert.deepEqual(candidate.report.results.filter(value => controlNames.includes(value.name)), control.report.results);
  if (scope === 'exact') {
    assert.equal(candidate.cases.length, control.cases.length);
    assert.equal(candidate.frames, control.frames); assert.equal(candidate.banks, control.banks);
  }
  const result = { made: new Date().toISOString(), targetMet: false, controlFolder, candidateFolder,
    controlReportSha256: control.reportSha256, candidateReportSha256: candidate.reportSha256,
    scope, verifiedCases: candidate.cases.length, matchedControls: matched.length,
    additionalCases: candidate.cases.filter(value => !controlNames.includes(value.name)).map(value => value.name),
    verifiedControlFrames: control.frames, verifiedCandidateFrames: candidate.frames,
    verifiedControlBanks: control.banks, verifiedCandidateBanks: candidate.banks,
    publicPlanReportsIdentical: matched.every((value, position) => JSON.stringify(value.frames.map(frame => frame.plan))
      === JSON.stringify(control.cases[position].frames.map(frame => frame.plan))),
    verificationSourceSha256: hash(fs.readFileSync(__filename)),
    note: (scope === 'physicalControls'
      ? 'Complete named-control physical parity: every memory state, selected tap/witness path, physical frame, raw production result/log/trace and terminal outcome. Full plan-report equality is separately reported, not assumed. Pixel masks, candidate support and dictionary identifiers may differ; this does not assert pixel-equivalence, unchanged search diagnostics or an isolated causal explanation of another board clear. '
      : 'Exact complete case JSON parity: every observation, memory state, public plan, physical frame, raw production result/log/trace and terminal outcome. ')
      + 'Independently replays support arithmetic and earlier singleton-context provenance for both runs, and checks archived source/artifact/image hashes and fixture truth membership. This is finite settled-static control evidence, not reference strength, complete human perception or80% forecasts.' };
  fs.copyFileSync(__filename, path.join(candidateFolder, 'serial-control-comparison-source.js'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(candidateFolder, 'serial-control-comparison.json'), JSON.stringify(result), { flag: 'wx' });
  console.log(JSON.stringify(result));
}

if (require.main === module) main(process.argv[2], process.argv[3], process.argv[4]);
module.exports = { verify, physicalControlOf };
