'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto'), assert = require('assert/strict');
const { PNG } = require('pngjs');
const { SYMBOLS } = require('./personal_public_picture_prior.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function supportOf(bank, image) {
  assert.equal(bank.tolerance, 1);
  const rectangle = bank.rectangle;
  assert([rectangle.left, rectangle.top, rectangle.width, rectangle.height].every(Number.isInteger));
  assert(rectangle.left >= 0 && rectangle.top >= 0 && rectangle.width > 0 && rectangle.height > 0
    && rectangle.left + rectangle.width <= image.width && rectangle.top + rectangle.height <= image.height);
  assert.equal(bank.mask.length, rectangle.width * rectangle.height);
  assert(bank.mask.every(value => value === 0 || value === 1));
  const alphabet = SYMBOLS.slice().sort((left, right) => left - right);
  assert.deepEqual(bank.templates.map(template => template.picture).sort((left, right) => left - right), alphabet);
  const positions = bank.mask.flatMap((value, index) => value ? [index] : []);
  const found = bank.templates.filter(template => {
    assert.equal(template.pixels.length, bank.mask.length * 4);
    assert(template.pixels.every(value => Number.isInteger(value) && value >= 0 && value <= 255));
    return positions.every(pixel => {
      const horizontal = pixel % rectangle.width + rectangle.left, vertical = Math.floor(pixel / rectangle.width) + rectangle.top;
      return [0, 1, 2, 3].every(channel => Math.abs(template.pixels[pixel * 4 + channel]
        - image.data[(vertical * image.width + horizontal) * 4 + channel]) <= bank.tolerance);
    });
  }).map(template => template.picture).sort((left, right) => left - right);
  return { pictures: found.length ? found : alphabet, known: positions.length && found.length === 1 ? found[0] : null,
    visiblePixels: positions.length, reason: !positions.length ? 'noSafeVisiblePixels'
      : !found.length ? 'outsideDictionary' : found.length > 1 ? 'ambiguousPixels' : 'identified' };
}

function main(directory) {
  const folder = path.resolve(directory), reportBytes = fs.readFileSync(path.join(folder, 'report.json')), report = JSON.parse(reportBytes);
  assert.equal(report.templateBoundary, 'public-geometry-fixed-glyph0-and-earlier-screenshot-recognized-foreground-no-original-html-or-private-game-state');
  assert.equal(report.rows.length, 18);
  const seen = new Set(); let banks = 0, contextIdentities = 0;
  for (const [relative, expected] of Object.entries(report.sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(folder, 'sources', relative))), expected);
  for (const row of report.rows) {
    assert(report.themes.includes(row.theme) && report.phases.includes(row.phase) && report.worlds.includes(row.picture));
    const stem = [row.theme, row.phase, row.picture].join('-'); assert(!seen.has(stem)); seen.add(stem);
    const observedBytes = fs.readFileSync(path.join(folder, stem + '.png'));
    const restoredBytes = fs.readFileSync(path.join(folder, stem + '-restored.png'));
    assert.equal(hash(observedBytes), row.observedSha256); assert.equal(hash(restoredBytes), row.restoredSha256);
    const image = PNG.sync.read(observedBytes); assert.deepEqual(image.data, PNG.sync.read(restoredBytes).data);
    const context = [], targets = new Set();
    for (const entry of row.banks) {
      assert(!targets.has(entry.index)); targets.add(entry.index);
      const bytes = fs.readFileSync(path.join(folder, entry.filename)); assert.equal(hash(bytes), entry.sha256);
      const bank = JSON.parse(zlib.gunzipSync(bytes)); assert.deepEqual(bank.publicRecognizedContext, context);
      const calculated = supportOf(bank, image), observation = row.rows[entry.index].observation;
      for (const [field, value] of Object.entries(calculated)) assert.deepEqual(observation[field], value);
      const expected = entry.index < 2 ? row.picture : entry.index < 4 ? 3 : 4;
      assert(calculated.pictures.includes(expected));
      if (calculated.known !== null) { assert.equal(calculated.known, expected); context.push({ index: entry.index, picture: calculated.known }); }
      contextIdentities += bank.publicRecognizedContext.length; banks++;
    }
    for (const tile of row.rows) {
      assert.equal(targets.has(tile.index), tile.alive);
      assert.equal(row.known[tile.index], +(tile.alive && tile.observation.known !== null));
    }
  }
  assert.equal(banks, 72);
  const result = { made: new Date().toISOString(), targetMet: false, reportSha256: hash(reportBytes),
    verifiedScenes: seen.size, verifiedBanks: banks, verifiedEarlierPublicContextIdentities: contextIdentities,
    verifiedArchivedSources: Object.keys(report.sourceHashes).length, verificationSourceSha256: hash(fs.readFileSync(__filename)),
    note: 'Independent direct RGBA arithmetic, exact earlier screenshot singleton-context provenance, fixture truth membership, unchanged observed scenes and archived source/bank/PNG hashes. No matcher or recognizer implementation is imported. This finite static fixture replay does not prove general perception, dynamic play, reference optimality or80% human forecast accuracy.' };
  fs.copyFileSync(__filename, path.join(folder, 'independent-replay-source.js'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(folder, 'independent-replay.json'), JSON.stringify(result), { flag: 'wx' });
  console.log(JSON.stringify(result));
}

if (require.main === module) main(process.argv[2]);
module.exports = { supportOf };
