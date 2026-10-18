'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { descriptorOf, cueOf } = require('./personal_handoff_cues.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const dataFile = path.join(archive, 'personal-tray-intents-prefixes.json'), nativeFile = path.join(archive, 'personal-joint-intents-native.json');
  const dataBytes = fs.readFileSync(dataFile), nativeBytes = fs.readFileSync(nativeFile);
  const data = JSON.parse(dataBytes), native = JSON.parse(nativeBytes);
  assert.equal(hash(dataBytes), native.dataSha256);
  const players = {};
  for (const [name, games] of Object.entries(data.players)) {
    const groups = {};
    for (const game of games) {
      const reference = native.references.find(row => row.name === name && row.aid === game.aid && row.availableAt === game.availableAt);
      assert(reference);
      const indexed = new Map(reference.decisions.map(row => [row.index, row]));
      let previous = null;
      for (const [index, decision] of game.decisions.entries()) {
        if (decision.k < 0) { previous = null; continue; }
        const cue = cueOf(decision, previous);
        if (cue) {
          const key = cue.type + (decision.kindContext[11] > 0 ? '.clock' : '.tray');
          const group = groups[key] || (groups[key] = { samples: 0, followed: 0, modelProbabilityTotal: 0 });
          group.samples++; group.followed += +cue.indices.includes(decision.k);
          group.modelProbabilityTotal += cue.indices.reduce((sum, option) => sum + indexed.get(index).probabilities[option], 0);
        }
        previous = descriptorOf(decision, decision.k);
      }
    }
    players[name] = Object.fromEntries(Object.entries(groups).map(([type, group]) => [type, { ...group,
      observedFollowRate: group.followed / group.samples, meanModelProbability: group.modelProbabilityTotal / group.samples }]));
  }
  const report = { made: new Date().toISOString(), evidence: 'descriptive-training-prefix-handoff-gap', targetMet: false,
    dataSha256: hash(dataBytes), nativeSha256: hash(nativeBytes), players,
    sourceHashes: Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
      .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))])),
    note: 'Cue membership uses previous actual public choice and current known options only. No hidden mate is invented. '
      + 'Human labels and baseline probabilities describe existing training prefixes; this is not held action/count accuracy. '
      + 'Completing a newly started tray pair differs from taking any visible pair. Same-tile continuation is not assumed. '
      + 'All winning-try forecasts/misses remain unchanged; no80% claim.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/handoff-gap-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
