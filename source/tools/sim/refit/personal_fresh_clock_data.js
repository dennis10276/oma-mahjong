'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { FEATURES, PARAMETERS, featuresOf } = require('./known_clock_strategy.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const archive = 'analysis/archive/personal-bots/';
const previous = archive + 'experiments/personal-clock-strategy-features-2026-10-18T11-26-26-994Z';
const bankFile = archive + 'personal-prefix-versions.json';
const oldFile = previous + '/analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fields = ['aid', 'lv', 'at', 't', 'availableAt', 'stopReason', 'ending', 'complete', 'initialNewLevel', 'reconstructed', 'memorySources'];
const decisionFields = ['F', 'immediate', 'kindContext', 'k', 'tray', 'moves'];
const pick = (object, names) => Object.fromEntries(names.filter(name => Object.hasOwn(object, name)).map(name => [name, object[name]]));
const semantic = game => ({ ...pick(game, fields), decisions: game.decisions.map(decision => pick(decision, decisionFields)) });

function main() {
  const sources = {}, read = filename => {
    const bytes = fs.readFileSync(path.join(root, filename)); sources[filename] = hash(bytes); return JSON.parse(bytes);
  };
  const bank = read(bankFile), manifest = read(previous + '/manifest.json'), old = read(oldFile);
  assert.equal(sources[oldFile], manifest.files['analysis/archive/personal-bots/policy-clock-strategy-prefix-data.json']);
  for (const filename of ['www/hard.js', 'tools/sim/refit/known_clock_strategy.js', 'tools/sim/refit/known_clock_dig.js',
    'tools/sim/refit/known_clock_plan.js', 'tools/sim/refit/known_tray_plan.js']) assert.equal(hash(fs.readFileSync(path.join(root, filename))), manifest.files[filename]);
  for (const [filename, expected] of Object.entries(bank.inputHashes)) assert.equal(hash(fs.readFileSync(path.join(root, filename))), expected);
  assert.equal(bank.type, 'personalPrefixVersions-v1');
  const recorded = recordings(), players = {}, totals = { reused: 0, reconstructed: 0, calls: 0, clockCalls: 0, nodes: 0, boundaries: 0 };
  for (const filename of [...Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep)),
    path.join(root, 'analysis/archive/realdata/plays.json'), ...Object.values(PIDS).map(pid => path.join(root, 'analysis/archive/replays/' + pid + '.json'))]) {
    sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  }
  Object.assign(sources, bank.inputHashes);
  for (const [name, versions] of Object.entries(bank.players)) {
    players[name] = versions.map(version => {
      const cached = old.players[name].find(game => game.aid === version.aid && game.availableAt === version.availableAt);
      if (cached) {
        assert.deepEqual(semantic(cached), semantic(version), 'Cached clock prefix changed its semantic version');
        totals.reused++;
        return { ...version, decisions: cached.decisions };
      }
      const game = recorded[name].find(game => game.aid === version.aid);
      assert(game, 'Missing exact fresh recorded prefix');
      const control = reconstruct(game, false, null, true); assert(control);
      assert.deepEqual(semantic(control.prefix), semantic(version), 'Current raw data cannot reconstruct the pinned fresh version');
      const planned = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
        const result = featuresOf(publicGame, state, actions);
        totals.calls++; totals.clockCalls += +!result.inactive;
        totals.nodes += result.nodes; totals.boundaries += result.boundaries;
        return result;
      });
      assert(planned);
      assert.deepEqual(semantic(planned.prefix), semantic(version));
      assert.deepEqual(planned.state.physicalLog, control.state.physicalLog);
      assert.deepEqual(planned.result, control.result);
      totals.reconstructed++;
      console.log(JSON.stringify({ name, reconstructed: totals.reconstructed, aid: version.aid, calls: totals.calls }));
      return { ...version, decisions: planned.prefix.decisions };
    });
  }
  assert.equal(totals.reused, 398); assert.equal(totals.reconstructed, 47);
  const decisions = Object.values(players).flatMap(games => games.flatMap(game => game.decisions));
  for (const decision of decisions) assert.equal(decision.knownPlan.length, decision.F.length);
  for (const [filename, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, filename))), expected);
  const report = { ...bank, made: new Date().toISOString(), evidence: 'fresh-public-clock-prefix-annotations', targetMet: false,
    clockFeatures: FEATURES, clockParameters: PARAMETERS, sourceHashes: sources, players, totals,
    prefixes: Object.values(players).reduce((sum, games) => sum + games.length, 0), decisions: decisions.length,
    note: '398 semantically identical immutable old clock annotations reused;47 new versions reconstructed with exact physical-frame controls. '
      + 'Version identities, observation times and all natural human choices remain unchanged. Public frozen state only; no forced clock strategy. '
      + 'Feature parity is not winning-count accuracy. Fresh fitting requires exact own version membership and later actual model-ready time.' };
  fs.writeFileSync(path.join(root, archive + 'personal-fresh-clock-prefixes.json'), JSON.stringify(report));
  console.log(JSON.stringify({ prefixes: report.prefixes, decisions: report.decisions, totals }));
}

if (require.main === module) main();
module.exports = { semantic };
