'use strict';
const assert = require('assert/strict');
const path = require('path');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { playHumanCampaign } = require('./human_reference_campaign.js');
const { digest } = require('./human_redeal.js');
const { assertRawOutput, makeManifest, validateManifest, casesOf, runShard, pairedComparison, summarize, renderReport,
  beginExperiment, finishExperiment } = require('./human_redeal_benchmark.js');

function test() {
  const tiles = Array.from({ length: 4 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [1, 1, 2, 2],
    down: [0, 0, 0, 0], rules: null, clock: null });
  const catalog = { observedAt: 'fixed-fixture', rows: [17, 10011].map(level => ({ name: 'Dennisisdebeste',
    lv: level, wonOn: level === 17 ? 1 : 4, status: 'available', game,
    boardSource: level === 17 ? 'currentFixedDefinition' : 'levelLab', historicalBoardExact: level !== 17 })) };
  const manifest = makeManifest(catalog); validateManifest(manifest);
  assert.equal(casesOf(manifest).length, 20); assert.equal(casesOf(manifest, 'luck').length, 100);
  assert.equal(manifest.theme.id, 'sunflower');
  const planning = {}, observed = [];
  const workers = [0, 1, 2].map(shard => ({
    header: { manifestHash: manifest.hash, profileHash: digest(planning), sourceHash: 'fixed-source' },
    rows: runShard(manifest, planning, shard, 3, { runCampaign(actual, options) {
      assert.equal(options.planning.hypothesisRunSalt, 1);
      assert.deepEqual(Object.keys(options.publicContext), ['boardMode']);
      for (const key of ['seed', 'redealSeed', 'level', 'caseId', 'deck']) {
        assert(!Object.hasOwn(options, key)); assert(!Object.hasOwn(actual, key));
      }
      observed.push(options.maximumAttempts);
      return playHumanCampaign(actual, options);
    } }), footer: { sourceUnchanged: true },
  }));
  assert.equal(observed.filter(value => value === 1).length, 10);
  assert.equal(observed.filter(value => value === 3).length, 10);
  const report = summarize(manifest, workers);
  assert(report.complete && report.valid); assert.equal(report.targetRate, 1);
  assert.equal(report.lossTypes.length, 0); assert.equal(report.rows.length, 20);
  assert.equal(renderReport(report).split('\n').filter(line => line.startsWith('| Board |')).length, 1);
  assert.equal(pairedComparison(report, report).adopted, false);
  const partial = summarize(manifest, [{ ...workers[0], footer: null }]);
  assert(!partial.complete && !partial.valid); assert.equal(partial.targetRate, null);
  assert(partial.boards.some(board => board.rate === null)); assert(renderReport(partial).includes('pending'));
  assert.throws(() => summarize(manifest, [workers[0], workers[0]]), /Duplicate/);
  const changed = structuredClone(workers); changed[1].rows[0].seed++;
  assert.throws(() => summarize(manifest, changed));
  const censored = structuredClone(manifest); censored.entries[0].target++; assert.throws(() => validateManifest(censored));
  assert.throws(() => assertRawOutput(path.resolve(__dirname, '../../../analysis/raw-redeal.jsonl')));
  assertRawOutput(path.resolve(__dirname, '../../../../.codex-runs/results.jsonl'));
  const baseRows = Array.from({ length: 20 }, (unused, board) => Array.from({ length: 10 }, (ignored, offset) => ({
    caseId: board + ':' + offset, level: board, seed: offset, target: 1, gameHash: board + ':' + offset, targetMet: offset < 5,
  }))).flat();
  const summary = rows => ({ complete: true, valid: true, manifestHash: 'paired-fixture', rows,
    boards: Array.from({ length: 20 }, (unused, level) => ({ level, rate: rows.filter(row => row.level === level && row.targetMet).length / 10 })),
    lossTypes: [{ type: 'tray_full_unseen_twins', share: 0.9 }, { type: 'rare', share: 0.05 }] });
  const baseline = summary(baseRows);
  const betterRows = baseRows.map(row => ({ ...row, targetMet: row.level === 0 ? row.seed < 4 : true }));
  const candidate = summary(betterRows), gain = pairedComparison(baseline, candidate);
  assert(gain.adopted); assert(gain.improvement > 2 * gain.standardError);
  betterRows[3].targetMet = false;
  assert(!pairedComparison(baseline, summary(betterRows)).adopted, 'A20-point board regression blocks adoption');
  const initial = { manifestHash: 'paired-fixture', consecutiveNoGain: 0, experiments: [] };
  assert.throws(() => beginExperiment(initial, baseline, 'bad', 'rare'), /at least10%/);
  let ledger = initial;
  for (let index = 0; index < 8; index++) {
    ledger = beginExperiment(ledger, baseline, 'try' + index, 'tray_full_unseen_twins');
    ledger = finishExperiment(ledger, 'try' + index, baseline, baseline);
  }
  assert(ledger.stopRequired); assert.equal(ledger.consecutiveNoGain, 8);
  assert.throws(() => beginExperiment(ledger, baseline, 'ninth', 'tray_full_unseen_twins'), /stop rule/);
  console.log('PASS twenty actual re-deal campaigns retain exact retry targets and production replay, shards are complete/disjoint, incomplete data stays pending, paired SE and10-point board guards gate gains, and loss eligibility/eight-miss stop rules are enforced');
}

if (require.main === module) test();
module.exports = test;
