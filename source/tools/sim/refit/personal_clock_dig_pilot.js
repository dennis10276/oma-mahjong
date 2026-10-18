'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { pinnedRead, actionPinned } = require('./personal_context_runtime_audit.js');
const { PIDS } = require('./mimic_games.js');
const { FEATURES, PARAMETERS, featuresOf } = require('./known_clock_dig.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const parentFile = 'analysis/archive/personal-bots/policy-value-prefix-data.json';
  const parent = pinnedRead(actionPinned, parentFile), recorded = recordings();
  const fingerprintFiles = ['www/hard.js', 'www/layouts.js', ...fs.readdirSync(__dirname).filter(file => file.endsWith('.js')).sort()
    .map(file => 'tools/sim/refit/' + file), 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...['manifest.json', parentFile].map(file => path.relative(root, path.join(actionPinned, file)).replace(/\\/g, '/'))];
  const sourceHashes = Object.fromEntries(fingerprintFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  const rows = [];
  let calls = 0, clockCalls = 0, nodes = 0, boundaries = 0, distinctDigChoices = 0;
  for (const [name, games] of Object.entries(parent.players)) for (const original of [games[0], games.at(-1)]) {
    const game = recorded[name].find(game => game.aid === original.aid), control = reconstruct(game, false, null, true);
    assert(control); assert.deepEqual(control.prefix, original);
    const dig = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
      const result = featuresOf(publicGame, state, actions);
      calls++; clockCalls += +!result.inactive; nodes += result.nodes; boundaries += result.boundaries;
      distinctDigChoices += +[4, 5, 6, 7].some(column => new Set(result.features.map(parts => parts[column])).size > 1);
      assert(result.features.every(parts => parts.length === FEATURES.length && parts.every(value => value >= 0 && value <= 1)));
      return result;
    });
    assert(dig);
    assert.deepEqual({ ...dig.prefix, decisions: dig.prefix.decisions.map(({ knownPlan, ...decision }) => decision) }, original);
    assert.deepEqual(dig.state.physicalLog, control.state.physicalLog);
    assert.deepEqual(dig.result, control.result);
    rows.push({ name, aid: original.aid, lv: original.lv, decisions: original.decisions.length });
  }
  assert.equal(rows.length, 8); assert.equal(calls, 712);
  for (const [file, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected);
  const report = { made: new Date().toISOString(), evidence: 'clock-digging-feature-pilot', targetMet: false,
    features: FEATURES, parameters: PARAMETERS, sourceHashes, rows, calls, clockCalls, nodes, boundaries, distinctDigChoices,
    humanDesignInput: 'Dennis says he first digs for the clock to test whether that strategy works, then adjusts. '
      + 'This motivates a separate hypothesis, not a universal full-route or greedy-finishing rule.',
    note: 'Eight preregistered first/last prefixes, all712 original physical/feature/result controls exact. '
      + 'Clock probing, removal progress and urgency/tray-pressure interactions are public-state features, not fixed preferred actions. '
      + 'Different strategy weights and switching behavior must be fitted to each person\'s earlier choices. '
      + 'This pilot is not a fitted bot, winning-count result, model promotion or80% claim.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/personal-clock-dig-throughput-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes: rows.length, calls, clockCalls, nodes, boundaries, distinctDigChoices }));
}

if (require.main === module) main();
