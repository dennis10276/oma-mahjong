'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), assert = require('assert/strict');
const { PNG } = require('pngjs');
const { roundedContains } = require('./public_tile_pixels.js');
const { supportOf } = require('./personal_pixel_capture_verify.js');
const root = path.resolve(__dirname, '../../..'), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const INSETS = Object.freeze([1, 1.5, 2, 3]);

function bindRecording(directory, prefix) {
  const parent = path.resolve(directory), filename = prefix ? 'cycle-stop-evidence.json' : 'report.json';
  const evidenceBytes = fs.readFileSync(path.join(parent, filename)), evidence = JSON.parse(evidenceBytes);
  const inputBytes = fs.readFileSync(path.join(parent, 'input.json')), input = JSON.parse(inputBytes);
  const artifacts = {}, bind = relative => {
    assert(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..'));
    const bytes = fs.readFileSync(path.join(parent, relative)); artifacts[relative] = hash(bytes); return bytes;
  };
  bind(filename); bind('input.json');
  const frames = prefix ? evidence.observedCompleteFrames : evidence.frames;
  assert(Number.isInteger(frames) && frames > 0);
  if (prefix) {
    assert.equal(evidence.outcome, 'unresolvedDeterministicPublicPolicyCycle');
    assert.equal(hash(inputBytes), evidence.inputSha256);
    assert.deepEqual(Object.keys(evidence.frameHashes).sort(), Array.from({ length: frames }, (_, position) => position + '.json').sort());
  } else for (const [relative, expected] of Object.entries(evidence.artifacts)) assert.equal(hash(bind(relative)), expected);
  for (let position = 0; position < frames; position++) {
    const relative = position + '.json', bytes = bind(relative), saved = JSON.parse(bytes);
    assert.equal(saved.position, position);
    if (prefix) assert.equal(hash(bytes), evidence.frameHashes[relative]);
    bind(position + '.png'); bind(position + '-after.png');
    assert(Array.isArray(saved.bankFiles) && new Set(saved.bankFiles).size === saved.bankFiles.length);
    for (const bank of saved.bankFiles) { assert(bank.startsWith(position + '-tile')); bind(bank); }
  }
  return { parent, input, frames, artifacts, evidenceFile: filename, evidenceSha256: hash(evidenceBytes),
    recordingStatus: prefix ? 'incompleteCycleStoppedPrefix' : 'completedRun' };
}

function main(directory, prefix = false) {
  const recording = bindRecording(directory, prefix), { parent, input, frames } = recording, made = new Date().toISOString();
  const folder = path.join(root, 'analysis/archive/personal-bots/pixel-opaque-inset-' + made.replace(/[:.]/g, '-')); fs.mkdirSync(folder);
  const sourceFiles = Object.keys(require.cache), sourceHashes = {};
  for (const filename of sourceFiles) {
    const relative = filename.startsWith(root + path.sep) ? 'workspace/' + path.relative(root, filename).replace(/\\/g, '/')
      : 'runtime/' + hash(filename) + '/' + path.basename(filename);
    const bytes = fs.readFileSync(filename), target = path.join(folder, 'sources', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
    sourceHashes[relative] = { original: filename, sha256: hash(bytes) };
  }
  const config = { made, targetMet: false, parent, parentEvidenceFile: recording.evidenceFile,
    parentEvidenceSha256: recording.evidenceSha256, recordingStatus: recording.recordingStatus,
    frames, parentArtifacts: recording.artifacts, insets: INSETS, sourceHashes, nodeVersion: process.version,
    note: 'Declared whole-recording geometric target-opacity inset sensitivity screen. Intersect the original nuisance/occlusion mask with a stricter rounded target body, never widen channel tolerance or choose a per-tile inset using its true face. Truth is audit-only. Frozen earlier contexts are unchanged, so this is not an alternative policy rollout, a new win count or an accuracy claim.' };
  fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(config), { flag: 'wx' });
  const totals = Object.fromEntries(INSETS.map(inset => [inset, { banks: 0, singletonCorrect: 0, wrongSingleton: 0, outsideDictionary: 0, truthExcluded: 0, safePixels: 0 }]));
  const rows = [];
  for (let position = 0; position < frames; position++) {
    const saved = JSON.parse(fs.readFileSync(path.join(parent, position + '.json'))), image = PNG.sync.read(fs.readFileSync(path.join(parent, position + '.png')));
    for (const filename of saved.bankFiles) {
      const index = +filename.match(/-tile(\d+)\.json\.gz$/)[1], bank = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(parent, filename))));
      const box = saved.scene.tiles.find(tile => tile.index === index).bounds, actual = input.entry.game.faces[index], results = {};
      for (const inset of INSETS) {
        const mask = bank.mask.map((selected, offset) => +(selected && roundedContains(bank.rectangle.left + offset % bank.rectangle.width + .5,
          bank.rectangle.top + Math.floor(offset / bank.rectangle.width) + .5, box, inset)));
        const observation = supportOf({ ...bank, mask }, image), count = totals[inset];
        if (inset === 1) for (const [key, value] of Object.entries(observation)) assert.deepEqual(saved.observations[index].observation[key], value);
        count.banks++; count.singletonCorrect += +(observation.known === actual);
        count.wrongSingleton += +(observation.known !== null && observation.known !== actual);
        count.outsideDictionary += +(observation.reason === 'outsideDictionary');
        count.truthExcluded += +(!['outsideDictionary', 'noSafeVisiblePixels'].includes(observation.reason) && !observation.pictures.includes(actual));
        count.safePixels += observation.visiblePixels; results[inset] = observation;
      }
      rows.push({ position, index, actual, results });
    }
  }
  for (const [relative, expected] of Object.entries(recording.artifacts)) assert.equal(hash(fs.readFileSync(path.join(parent, relative))), expected);
  for (const entry of Object.values(sourceHashes)) assert.equal(hash(fs.readFileSync(entry.original)), entry.sha256);
  fs.writeFileSync(path.join(folder, 'data.json'), JSON.stringify({ ...config, totals, rows }), { flag: 'wx' });
  console.log(JSON.stringify({ folder, recordingStatus: recording.recordingStatus, frames, boundArtifacts: Object.keys(recording.artifacts).length, totals }));
}

if (require.main === module) {
  assert(process.argv.length === 3 || process.argv.length === 4 && process.argv[3] === '--prefix');
  main(process.argv[2], process.argv[3] === '--prefix');
}
module.exports = { bindRecording };
