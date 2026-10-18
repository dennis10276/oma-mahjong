'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { choiceFactory } = require('./personal_context_choice.js');
const root = path.resolve(__dirname, '../../..');
const actionPinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-context-actions-2026-10-18T01-55-11-704Z');
const memoryPinned = path.join(root, 'analysis/archive/personal-bots/experiments/personal-memory-2026-10-18T00-43-24-647Z');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function pinnedRead(folder, file) {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'))), bytes = fs.readFileSync(path.join(folder, file));
  assert.equal(hash(bytes), manifest.files[file]);
  return JSON.parse(bytes);
}

function main() {
  const data = pinnedRead(actionPinned, 'analysis/archive/personal-bots/policy-value-prefix-data.json');
  const fitted = pinnedRead(actionPinned, 'analysis/archive/personal-bots/personal-context-models.json');
  const expected = pinnedRead(actionPinned, 'analysis/personal-bots/personal-context-action-evaluation.json');
  const bank = pinnedRead(memoryPinned, 'analysis/archive/personal-bots/physical-memory-policy-bank.json');
  const models = new Map(fitted.models.map(model => [model.id, model.choiceResidual]));
  const actors = new Map(bank.models.map(model => [model.id, model]));
  const fingerprintFiles = [...new Set([...data.fingerprintFiles,
    ...['personal_context_runtime_audit.js', 'personal_context_choice.js', 'physical_count_data.js'].map(file => 'tools/sim/refit/' + file)])];
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file)));
    return digest.digest('hex');
  };
  const fingerprint = fingerprintOf(), measured = {};
  let probabilityDecisions = 0;
  for (const [name, player] of Object.entries(expected.players)) {
    measured[name] = {};
    for (const scope of ['ownAll', 'ownCarryAll']) {
      measured[name][scope] = {};
      for (const [method, requested] of Object.entries({ control: 0, context8: 8, context24: 24 })) {
        let decisions = 0, loss = 0, hits = 0;
        for (const row of player.rows) {
          if (!row.scores) continue;
          const identity = bank.selections.find(item => item.name === name && item.start === row.opening).models[scope];
          const model = models.get(identity), choose = choiceFactory(actors.get(identity), model, Math.min(requested, model.trees.length));
          const games = scope === 'ownAll' ? data.players[name] : data.memoryPlayers.configured[name];
          const game = games.find(item => item.aid === row.aid);
          assert(game);
          for (const decision of game.decisions) {
            if (decision.k < 0) continue;
            const probabilities = choose.probabilities(decision), maximum = Math.max(...probabilities);
            const ties = probabilities.map(value => Math.abs(value - maximum) <= 1e-12 + 1e-8 * Math.abs(maximum));
            loss -= Math.log(Math.max(1e-300, probabilities[decision.k]));
            hits += +ties[decision.k] / ties.filter(Boolean).length;
            decisions++;
          }
        }
        const result = { decisions, jointLogLoss: decisions ? loss / decisions : null, topActionAccuracy: decisions ? hits / decisions : null };
        const original = player.models[scope][method];
        assert.equal(result.decisions, original.decisions);
        for (const field of ['jointLogLoss', 'topActionAccuracy']) assert(Math.abs(result[field] - original[field]) < 1e-12, name + '/' + scope + '/' + method + '/' + field);
        measured[name][scope][method] = result;
        probabilityDecisions += decisions;
      }
    }
  }
  console.log('All JavaScript context/control likelihoods match pinned Python summaries to1e-12');
  const recorded = recordings(), actor = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false,
    kindModel: { weights: {} } };
  let controlPrefixes = 0, controlDecisions = 0, runtimePrefixes = 0, runtimeDecisions = 0, maskedInspectionRows = 0;
  const unsupported = [];
  for (const [name, games] of Object.entries(data.players)) for (const original of games) {
    const game = recorded[name].find(item => item.aid === original.aid);
    assert(game);
    const rebuilt = reconstruct(game, false, null, true);
    assert(rebuilt);
    assert.deepEqual(rebuilt.prefix, original);
    const actions = game.actions.slice(0, rebuilt.state.physicalLog.length), state = { ...game.g,
      tapTimes: actions.map(action => action.time), settleBefore: actions.map(action => action.settled), physicalLog: [] };
    let position = 0;
    const stopped = new Error('End of validated natural prefix');
    try {
      Hard.play(state, { ...actor, physicalChoice: features => {
        if (position === original.decisions.length) throw stopped;
        const decision = original.decisions[position++];
        const unused = new Set(decision.F.map((feature, index) => index));
        const mapping = features.F.map(feature => {
          const encoded = JSON.stringify(feature), found = [...unused].find(index => JSON.stringify(decision.F[index]) === encoded);
          assert.notEqual(found, undefined, name + '/' + original.aid + '/' + (position - 1) + ': runtime added or changed an option');
          unused.delete(found);
          return found;
        });
        const removed = [...unused];
        for (const index of removed) assert(decision.F[index][19] && decision.F[index][65], 'Only existing known-reinspection safeguards may mask an option');
        maskedInspectionRows += removed.length;
        assert.deepEqual(features.immediate, mapping.map(index => decision.immediate[index]));
        const context = decision.kindContext.slice(), flips = features.F.filter(feature => feature[19]);
        context[5] = +(flips.length > 0);
        context[24] = flips.filter(feature => feature[65]).length / Math.max(1, flips.length);
        context[25] = flips.filter(feature => feature[67]).length / Math.max(1, flips.length);
        assert.deepEqual(features.kindContext, context);
        const selected = mapping.indexOf(decision.k);
        if (selected < 0) {
          unsupported.push({ name, aid: original.aid, level: original.lv, decision: position - 1, reason: 'recorded-repeat-exceeds-existing-runtime-inspection-safeguard' });
          throw stopped;
        }
        runtimeDecisions++;
        return selected;
      } }, 1);
    } catch (error) {
      if (error !== stopped) throw error;
    }
    const incomplete = unsupported.at(-1)?.aid === original.aid;
    if (!incomplete) {
      assert.equal(position, original.decisions.length);
      assert.deepEqual(state.physicalLog, rebuilt.state.physicalLog);
      runtimePrefixes++;
    } else assert.deepEqual(state.physicalLog, rebuilt.state.physicalLog.slice(0, state.physicalLog.length));
    controlPrefixes++;
    controlDecisions += original.decisions.length;
    if (controlPrefixes % 50 === 0) console.log('Verified', controlPrefixes, 'autonomous feature/control prefixes');
  }
  assert.equal(fingerprintOf(), fingerprint);
  assert.equal(runtimePrefixes, controlPrefixes);
  assert.equal(runtimeDecisions, controlDecisions);
  assert.equal(maskedInspectionRows, 0);
  assert.equal(unsupported.length, 0);
  const report = { made: new Date().toISOString(), evidence: 'context-runtime-parity-diagnostic', targetMet: false,
    fingerprint, fingerprintFiles, controlPrefixes, controlDecisions, runtimePrefixes, runtimeDecisions, maskedInspectionRows, unsupported, probabilityDecisions, measured,
    pinnedActionExperiment: path.relative(root, actionPinned).replace(/\\/g, '/'),
    note: 'Every original zero-memory natural prefix matches unchanged followed features/physical outcomes, and every actual decision now replays through the optional runtime selector without inspection masks or discarded prefixes. The prior two-reinspection mismatch is preserved separately; context bots permit legal repeats with an explicit computation boundary, never silently treating that boundary as a measured human loss. All held zero/configured-memory control/context probability summaries match Python to1e-12, including the explicit float32 boundary unit test. Human indices are supplied only for parity diagnostics, never autonomous forecast evidence. Full autonomous count cohorts remain separate and unchanged; no winning-count accuracy or new forecast is claimed.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-context-runtime-audit.json'), JSON.stringify(report, null, 2));
  console.log('Verified', controlPrefixes, 'prefixes,', controlDecisions, 'actual choices and', probabilityDecisions, 'probability decisions');
}

if (require.main === module) main();
module.exports = { pinnedRead, actionPinned, memoryPinned };
