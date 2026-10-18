'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../../..');

function comparePrefixes(original, recalled) {
  assert.equal(original.length, recalled.length);
  const summary = { prefixes: original.length, decisions: 0, prefixesWithMemory: 0, changedDecisions: 0,
    reopeningsRecognized: 0, rememberedInspectionsNowTakes: 0, blindFeaturesResolved: 0, fatalLabelsResolved: 0, pairKindsRestored: 0 };
  for (const [position, before] of original.entries()) {
    const after = recalled[position];
    assert.equal(before.aid, after.aid);
    assert.deepEqual(before.reconstructed, after.reconstructed);
    assert.equal(before.decisions.length, after.decisions.length);
    for (const source of after.memorySources || []) assert(source.availableAt < after.t && source.availableAt <= after.availableAt);
    summary.prefixesWithMemory += +(after.inheritedPictures > 0);
    for (const [index, previous] of before.decisions.entries()) {
      const current = after.decisions[index], selectedBefore = previous.F[previous.k], selectedAfter = current.F[current.k];
      summary.decisions++;
      summary.changedDecisions += +(JSON.stringify(previous.F) !== JSON.stringify(current.F)
        || JSON.stringify(previous.kindContext) !== JSON.stringify(current.kindContext));
      summary.reopeningsRecognized += +(!!selectedBefore[19] && !selectedBefore[65] && !!selectedAfter[65]);
      summary.rememberedInspectionsNowTakes += +(!!selectedBefore[19] && !selectedAfter[19]);
      summary.blindFeaturesResolved += +(!!selectedBefore[16] && !selectedAfter[16]);
      summary.fatalLabelsResolved += +(!!selectedBefore[18] && !selectedAfter[18]);
      summary.pairKindsRestored += +(!selectedBefore[14] && !!selectedAfter[14]);
    }
  }
  return summary;
}

function main() {
  const input = path.join(root, 'analysis/archive/personal-bots/policy-memory-prefix-data.json');
  const raw = fs.readFileSync(input), data = JSON.parse(raw), digest = crypto.createHash('sha256');
  for (const source of data.fingerprintFiles) digest.update(source).update(fs.readFileSync(path.join(root, source)));
  assert.equal(digest.digest('hex'), data.fingerprint);
  const pinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-sequence-2026-10-18T00-22-44-838Z');
  const previousFile = 'analysis/archive/personal-bots/policy-sequence-prefix-data.json';
  const previousRaw = fs.readFileSync(path.join(pinned, previousFile)), previous = JSON.parse(previousRaw);
  const manifest = JSON.parse(fs.readFileSync(path.join(pinned, 'manifest.json')));
  assert.equal(crypto.createHash('sha256').update(previousRaw).digest('hex'), manifest.files[previousFile]);
  const players = {};
  for (const name of Object.keys(data.players)) {
    const before = previous.players[name], after = data.players[name];
    assert.equal(before.length, after.length);
    for (const [index, game] of before.entries()) {
      assert.equal(game.aid, after[index].aid);
      assert.deepEqual(game.reconstructed, after[index].reconstructed);
      assert.deepEqual(game.decisions, after[index].decisions);
    }
    players[name] = Object.fromEntries(Object.entries(data.memoryPlayers).map(([mode, people]) => [mode, comparePrefixes(after, people[name])]));
  }
  const report = { made: new Date().toISOString(), evidence: 'memory-feature-reconstruction-not-winning-try-accuracy',
    prefixFingerprint: data.fingerprint, prefixDataSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    previousPrefixSha256: manifest.files[previousFile], sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    players, note: 'All original controls, physical reconstructions and choices are retained. Configured phase recall and full recall are declared alternative assumptions, not proof of human recall. Only prior actually observed same-campaign, exact-board pictures uploaded before the retry enter features. No target outcome enters reconstruction.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-memory-reconstruction-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { comparePrefixes };
