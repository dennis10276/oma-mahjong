'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { semantic } = require('./personal_fresh_clock_data.js');
const { retryMemory } = require('./personal_retry_memory.js');
const { comparePrefixes } = require('./personal_memory_audit.js');
const { campaignsOf } = require('./attempt_campaigns.js');
const { PIDS } = require('./mimic_games.js');
const { boardId } = require('./personal_model.js');
const { choiceFactory } = require('./personal_context_choice.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const modes = ['none', 'configured', 'full'];

function scorePrefix(prefix, actor) {
  const selector = choiceFactory(actor, { type: 'personalChoiceTrees-v1', inputPrecision: 'float32', dimensions: 102, trees: [] }, 0);
  let loss = 0, hits = 0, decisions = 0;
  for (const decision of prefix.decisions) {
    if (decision.k < 0) continue;
    const values = selector.probabilities(decision), maximum = Math.max(...values);
    const ties = values.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
    loss -= Math.log(Math.max(1e-300, values[decision.k]));
    hits += +ties[decision.k] / ties.filter(Boolean).length;
    decisions++;
  }
  return { decisions, jointLogLoss: decisions ? loss / decisions : null, topActionAccuracy: decisions ? hits / decisions : null };
}

function aggregate(rows, mode) {
  const decisions = rows.reduce((sum, row) => sum + row.scores[mode].decisions, 0);
  return { prefixes: rows.length, decisions,
    jointLogLoss: decisions ? rows.reduce((sum, row) => sum + row.scores[mode].jointLogLoss * row.scores[mode].decisions, 0) / decisions : null,
    topActionAccuracy: decisions ? rows.reduce((sum, row) => sum + row.scores[mode].topActionAccuracy * row.scores[mode].decisions, 0) / decisions : null };
}

function main() {
  const sources = {}, read = filename => {
    const bytes = fs.readFileSync(path.join(root, filename)); sources[filename] = hash(bytes); return JSON.parse(bytes);
  };
  const bank = read('analysis/archive/personal-bots/personal-handoff-models.json');
  const data = read(bank.dataFile), future = read(bank.futureActorFile), historical = read(bank.historicalActorFile);
  const baseManifest = read(bank.baseSnapshot + '/manifest.json'), targetsName = 'analysis/archive/personal-bots/personal-fresh-count-input.json';
  const targetsInput = read(bank.baseSnapshot + '/' + targetsName);
  assert.equal(sources[bank.baseSnapshot + '/' + targetsName], baseManifest.files[targetsName]);
  const snapshot = bank.futureActorFile.slice(0, -'analysis/archive/personal-bots/personal-fresh-own-models.json'.length);
  const manifest = read(snapshot + 'manifest.json'), nativeName = 'analysis/personal-bots/personal-fresh-own-native-bridge.json';
  const native = read(snapshot + nativeName);
  assert.equal(sources[snapshot + nativeName], manifest.files[nativeName]);
  for (const [name, expected] of Object.entries(data.sourceHashes)) {
    if (name !== 'analysis/archive/realdata/plays.json' && !name.startsWith('analysis/archive/replays/') && name !== 'www/hard.js') continue;
    assert.equal(hash(fs.readFileSync(path.join(root, name))), expected, 'Recall audit needs the exact frozen natural recordings');
    sources[name] = expected;
  }
  const plays = read('analysis/archive/realdata/plays.json'), recorded = recordings(), rows = [], summaries = {};
  let physicalControls = 0, nativeControls = 0, decisionsControlled = 0;
  for (const [name, versions] of Object.entries(data.players)) {
    const history = [], prefixes = Object.fromEntries(modes.map(mode => [mode, []]));
    const campaigns = new Map(campaignsOf(plays[PIDS[name]]).flatMap(campaign => campaign.campaignAids.map(aid => [aid, campaign.start])));
    const actor = future.models.find(actor => actor.name === name), nativePlayer = native.players[name];
    assert(actor && actor.id === nativePlayer.id && actor.retryMemoryMode === 'none');
    const own = [], recent = [], unmapped = [];
    for (const version of versions.slice().sort((left, right) => left.t - right.t || left.availableAt - right.availableAt)) {
      const game = recorded[name].find(game => game.aid === version.aid);
      assert(game, 'Missing exact recorded prefix for recall audit');
      const control = reconstruct(game, false, null, true); assert(control);
      assert.deepEqual(semantic(control.prefix), semantic(version), 'Recall no-memory control changed a frozen public prefix');
      const target = { name, campaign: campaigns.get(version.aid), board: boardId(game.g), t: version.t };
      if (target.campaign === undefined) unmapped.push(version.aid);
      const variants = { none: control.prefix }, incoming = {};
      prefixes.none.push(control.prefix);
      for (const mode of modes.slice(1)) {
        const recalled = retryMemory(history, target, mode, game.g.faces.length);
        const inheritedPictures = recalled.memory.reduce((sum, value) => sum + value, 0);
        for (const source of recalled.sources) assert(source.availableAt < version.t);
        const alternate = inheritedPictures ? reconstruct(retainedInput(game, control), false, recalled.memory, true) : control;
        assert(alternate);
        assert.deepEqual(alternate.state.physicalLog, control.state.physicalLog);
        assert.deepEqual(alternate.prefix.reconstructed, control.prefix.reconstructed);
        variants[mode] = { ...alternate.prefix, memorySources: recalled.sources, inheritedPictures };
        prefixes[mode].push(variants[mode]);
        incoming[mode] = { inheritedPictures, memorySources: recalled.sources };
        if (version.initialNewLevel) assert.equal(inheritedPictures, 0, 'New initial level cannot inherit a previous campaign');
      }
      const scores = Object.fromEntries(modes.map(mode => [mode, scorePrefix(variants[mode], actor)]));
      const expected = nativePlayer.rows.find(row => row.aid === version.aid && row.versionSha256 === version.versionSha256);
      assert(expected && expected.scores.control.decisions === scores.none.decisions);
      for (const field of ['jointLogLoss', 'topActionAccuracy']) assert(Math.abs(expected.scores.control[field] - scores.none[field]) < 1e-12,
        'Recall baseline differs from immutable native static actor score');
      physicalControls++; nativeControls++; decisionsControlled += scores.none.decisions;
      const output = { name, aid: version.aid, lv: version.lv, at: version.at, t: version.t, availableAt: version.availableAt,
        initialNewLevel: version.initialNewLevel, campaignMapped: target.campaign !== undefined, scores, incoming };
      own.push(output); rows.push({ ...output, evidence: 'future-own-training-prefix-diagnostic-only' });
      for (const target of targetsInput.recent.filter(target => target.name === name && target.excludedAids.includes(version.aid))) {
        const historicalActor = historical.models.find(actor => actor.id === target.modelId);
        assert(historicalActor && historicalActor.trainingCut <= target.start && historicalActor.availableThrough < target.start);
        assert(!historicalActor.trainedAids.some(aid => target.excludedAids.includes(aid)));
        const diagnostic = { ...output, evidence: 'recent-earlier-own-conditional-action-diagnostic-only',
          targetStart: target.start, targetLevel: target.lv, modelId: historicalActor.id,
          scores: Object.fromEntries(modes.map(mode => [mode, scorePrefix(variants[mode], historicalActor)])) };
        recent.push(diagnostic); rows.push(diagnostic);
      }
      history.push({ ...target, aid: version.aid, availableAt: version.availableAt,
        seen: Array.from(control.result.seen), moves: control.result.moves });
    }
    const latest = own.slice().sort((left, right) => right.t - left.t).slice(0, 20);
    summaries[name] = { prefixes: own.length, campaignUnmapped: unmapped.length, unmappedAids: unmapped,
      coverage: Object.fromEntries(modes.slice(1).map(mode => [mode, comparePrefixes(prefixes.none, prefixes[mode])])),
      trainingOnlyScores: Object.fromEntries(modes.map(mode => [mode, aggregate(own, mode)])),
      initialNewTrainingOnlyScores: Object.fromEntries(modes.map(mode => [mode, aggregate(own.filter(row => row.initialNewLevel), mode)])),
      nonInitialNewTrainingOnlyScores: Object.fromEntries(modes.map(mode => [mode, aggregate(own.filter(row => !row.initialNewLevel), mode)])),
      recentEarlierOwnConditionalScores: Object.fromEntries(modes.map(mode => [mode, aggregate(recent, mode)])),
      latest20TrainingOnlyScores: Object.fromEntries(modes.map(mode => [mode, aggregate(latest, mode)])) };
    console.log(JSON.stringify({ name, prefixes: own.length, campaignUnmapped: unmapped.length }));
  }
  assert.equal(physicalControls, 445); assert.equal(nativeControls, 445); assert.equal(decisionsControlled, 39268);
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  for (const [name, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'fresh-own-retry-knowledge-assumption-audit-only',
    sourceHashes: sources, physicalControls, nativeControls, decisionsControlled, modes, summaries, rows,
    note: 'All445 exact frozen natural prefixes retain physical taps/recorded endings; no-memory static scores match immutable native own references. '
      + 'Configured/full are alternative recall assumptions, NOT measured human memory or newly fitted policies. '
      + 'Only actually observed earlier uploaded same-campaign exact-board pictures enter alternatives; unmapped campaigns inherit nothing. '
      + 'These are existing future actors scored on their own TRAINING prefixes, not held action accuracy or pre-opening winning-count evidence. '
      + 'Separately labeled recent rows use earlier-own excluded-target actors, conditioned on actual prior target-attempt observations; these are conditional action diagnostics, never opening forecasts. '
      + 'No current outcome selects recall, no family memory is imposed, no running controller or existing numeric forecast is changed. '
      + 'Individually fitted consistent knowledge actors and autonomous whole-count tests remain required.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/recall-coverage-audit.json'), JSON.stringify(report));
  console.log(JSON.stringify({ physicalControls, nativeControls, decisionsControlled, summaries }, null, 2));
}

if (require.main === module) main();
module.exports = { scorePrefix, aggregate };
