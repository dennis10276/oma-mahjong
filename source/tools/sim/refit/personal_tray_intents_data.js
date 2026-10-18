'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { semantic } = require('./personal_fresh_clock_data.js');
const { FEATURES, featuresOf } = require('./known_tray_plan_bits.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const PARAMETERS = { taps: 6, nodes: 256, progress: 4 };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const snapshot = path.join(archive, 'experiments/personal-fresh-clock-actions-2026-10-18T16-30-12-344Z');
  const name = 'analysis/archive/personal-bots/personal-fresh-clock-prefixes.json';
  const dataBytes = fs.readFileSync(path.join(snapshot, name));
  const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, 'manifest.json')));
  assert.equal(hash(dataBytes), manifest.files[name]);
  const data = JSON.parse(dataBytes), recorded = recordings(), players = {}, totals = { prefixes: 0, calls: 0, nodes: 0, boundaries: 0 };
  const sources = Object.fromEntries([path.join(snapshot, name), path.join(snapshot, 'manifest.json'),
    path.join(root, 'analysis/archive/realdata/plays.json'), ...Object.values(PIDS).map(pid => path.join(root, 'analysis/archive/replays/' + pid + '.json')),
    ...Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))]
    .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))]));
  const progressFile = path.join(root, 'analysis/personal-bots/tray-intents-data-progress.jsonl');
  fs.writeFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), expectedPrefixes: 445, targetMet: false }) + '\n');
  for (const [person, games] of Object.entries(data.players)) {
    players[person] = games.map(version => {
      const game = recorded[person].find(game => game.aid === version.aid); assert(game);
      const control = reconstruct(game, false, null, true); assert(control);
      assert.deepEqual(semantic(control.prefix), semantic(version), 'Cannot reconstruct the exact retained natural version');
      const planned = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
        const result = featuresOf(publicGame, state, actions, PARAMETERS);
        totals.calls++; totals.nodes += result.nodes; totals.boundaries += result.boundaries;
        return result;
      });
      assert(planned); assert.deepEqual(semantic(planned.prefix), semantic(version));
      assert.deepEqual(planned.state.physicalLog, control.state.physicalLog); assert.deepEqual(planned.result, control.result);
      totals.prefixes++;
      if (totals.prefixes % 10 === 0) fs.appendFileSync(progressFile, JSON.stringify({ made: new Date().toISOString(), person, ...totals }) + '\n');
      return { ...version, decisions: version.decisions.map((decision, index) => ({ ...decision,
        trayPlan: planned.prefix.decisions[index].knownPlan })) };
    });
  }
  assert.equal(totals.prefixes, 445); assert.equal(totals.calls, 39268);
  for (const [filename, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, filename))), expected);
  const report = { ...data, made: new Date().toISOString(), evidence: 'fresh-public-tray-and-clock-intent-annotations', targetMet: false,
    trayFeatures: FEATURES, trayParameters: PARAMETERS, sourceHashes: sources, players, totals,
    note: 'All445 exact natural versions re-instrumented using the previously verified bitset public planner. '
      + 'Every retained physical frame/result and original semantic version is unchanged. Clock12 and tray5 features remain separate. '
      + 'Six-tap/256-node boundaries are unresolved observations, not human failures. No hidden pictures or synthetic winning labels.' };
  fs.writeFileSync(path.join(archive, 'personal-tray-intents-prefixes.json'), JSON.stringify(report));
  console.log(JSON.stringify({ prefixes: totals.prefixes, calls: totals.calls, nodes: totals.nodes, boundaries: totals.boundaries }));
}

if (require.main === module) main();
