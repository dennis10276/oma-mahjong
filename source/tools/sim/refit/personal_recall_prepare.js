'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { semantic } = require('./personal_fresh_clock_data.js');
const { retryMemory } = require('./personal_retry_memory.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const { scorePrefix } = require('./personal_recall_coverage.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const sources = {}, read = filename => {
    const bytes = fs.readFileSync(path.join(root, filename)); sources[filename] = hash(bytes); return JSON.parse(bytes);
  };
  const audit = read('analysis/personal-bots/recall-coverage-audit.json');
  for (const [name, expected] of Object.entries(audit.sourceHashes)) {
    assert.equal(hash(fs.readFileSync(path.join(root, name))), expected); sources[name] = expected;
  }
  const bank = read('analysis/archive/personal-bots/personal-handoff-models.json'), data = read(bank.dataFile);
  const actors = read(bank.futureActorFile).models, plays = read('analysis/archive/realdata/plays.json'), recorded = recordings();
  const alternatives = { configured: {}, full: {} }, totals = { physicalControls: 0, decisionsControlled: 0, alternativePrefixes: 0 };
  for (const [name, versions] of Object.entries(data.players)) {
    const history = [], actor = actors.find(actor => actor.name === name);
    const campaigns = new Map(campaignsOf(plays[PIDS[name]]).flatMap(campaign => campaign.campaignAids.map(aid => [aid, campaign.start])));
    for (const mode of Object.keys(alternatives)) alternatives[mode][name] = [];
    for (const version of versions.slice().sort((left, right) => left.t - right.t || left.availableAt - right.availableAt)) {
      const game = recorded[name].find(game => game.aid === version.aid), control = reconstruct(game, false, null, true);
      assert(control); assert.deepEqual(semantic(control.prefix), semantic(version));
      const target = { name, campaign: campaigns.get(version.aid), board: boardId(game.g), t: version.t };
      const expected = audit.rows.find(row => row.name === name && row.aid === version.aid && row.evidence === 'future-own-training-prefix-diagnostic-only');
      assert(expected);
      for (const mode of Object.keys(alternatives)) {
        const recalled = retryMemory(history, target, mode, game.g.faces.length);
        const inheritedPictures = recalled.memory.reduce((sum, value) => sum + value, 0);
        assert.deepEqual({ inheritedPictures, memorySources: recalled.sources }, expected.incoming[mode]);
        if (!inheritedPictures) continue;
        const alternate = reconstruct(retainedInput(game, control), false, recalled.memory, true);
        assert(alternate); assert.deepEqual(alternate.state.physicalLog, control.state.physicalLog);
        assert.deepEqual(alternate.prefix.reconstructed, control.prefix.reconstructed);
        const score = scorePrefix(alternate.prefix, actor), wanted = expected.scores[mode];
        assert.equal(score.decisions, wanted.decisions);
        for (const field of ['jointLogLoss', 'topActionAccuracy']) assert(Math.abs(score[field] - wanted[field]) < 1e-12);
        alternatives[mode][name].push({ ...alternate.prefix, memorySources: recalled.sources, inheritedPictures,
          originalVersionSha256: version.versionSha256, originalObservedAt: version.observedAt });
        totals.alternativePrefixes++;
      }
      totals.physicalControls++; totals.decisionsControlled += control.prefix.decisions.filter(decision => decision.k >= 0).length;
      history.push({ ...target, aid: version.aid, availableAt: version.availableAt, seen: Array.from(control.result.seen), moves: control.result.moves });
    }
    console.log(JSON.stringify({ name, variants: Object.fromEntries(Object.entries(alternatives).map(([mode, players]) => [mode, players[name].length])) }));
  }
  assert.equal(totals.physicalControls, 445); assert.equal(totals.decisionsControlled, 39268);
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  for (const [name, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const output = { made: new Date().toISOString(), targetMet: false, evidence: 'fresh-own-recall-alternative-features-only',
    type: 'personalRecallAlternatives-v1', sourceHashes: sources, baseFile: bank.dataFile, baseSha256: sources[bank.dataFile],
    features: data.features, kindContextFeatures: data.kindContextFeatures, base: data.base, alternatives, totals,
    note: 'Sparse configured/full alternatives replace only prefixes with inherited actually observed same-campaign exact-board pictures. '
      + 'All other prefixes resolve to their exact no-memory base version. Physical taps and endings are unchanged. '
      + 'Declared recall alternatives are not measured human memory or fitted actors. Effective input availability includes every memory source; '
      + 'fitters must exclude target campaign/source IDs and respect both input observations and actual new model readiness. '
      + 'No clock/tray planning features are silently reused after memory changes; consistent planning requires reinstrumentation. '
      + 'No running controller or existing numeric forecast is changed. This is not winning-count accuracy.' };
  const filename = path.join(root, 'analysis/archive/personal-bots/personal-recall-prefix-data.json');
  fs.writeFileSync(filename, JSON.stringify(output));
  console.log(JSON.stringify({ ...totals, sha256: hash(fs.readFileSync(filename)) }));
}

if (require.main === module) main();
