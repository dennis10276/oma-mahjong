'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const original = require('./known_clock_strategy.js'), fast = require('./known_clock_strategy_fast.js');
const { recordings, reconstruct } = require('./personal_prefix_data.js');
const { retainedInput } = require('./personal_known_plan_data.js');
const { semantic } = require('./personal_fresh_clock_data.js');
const { CONFIG } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { planFeatures: originalPlan } = require('./personal_joint_intents_choice.js');
const { planFeatures: fastPlan, PARAMETERS } = require('./personal_joint_planning_fast.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { loadContext, checkedModels } = require('./personal_handoff_first.js');
const { diagnosticFactory } = require('./personal_retry_cycle_probe.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const milliseconds = started => Number(process.hrtime.bigint() - started) / 1e6;

function main() {
  const sources = {}, read = filename => {
    const bytes = fs.readFileSync(path.join(root, filename)); sources[filename] = hash(bytes); return JSON.parse(bytes);
  };
  const bank = read('analysis/archive/personal-bots/personal-handoff-models.json'), data = read(bank.dataFile), recorded = recordings();
  const probe = read('analysis/personal-bots/retry-cycle-probe.json'), context = loadContext();
  Object.assign(sources, context.sources);
  for (const [name, expected] of Object.entries(data.sourceHashes)) {
    if (name !== 'analysis/archive/realdata/plays.json' && !name.startsWith('analysis/archive/replays/') && name !== 'www/hard.js') continue;
    assert.equal(hash(fs.readFileSync(path.join(root, name))), expected); sources[name] = expected;
  }
  let prefixes = 0, decisions = 0, activeClockDecisions = 0, nodes = 0, boundaries = 0, originalMs = 0, fastMs = 0;
  for (const [name, versions] of Object.entries(data.players)) {
    for (const version of versions) {
      const game = recorded[name].find(game => game.aid === version.aid), control = reconstruct(game, false, null, true);
      assert(control); assert.deepEqual(semantic(control.prefix), semantic(version));
      let index = 0;
      const planned = reconstruct(retainedInput(game, control), false, null, true, (publicGame, state, actions) => {
        let started = process.hrtime.bigint();
        const expected = original.featuresOf(publicGame, state, actions); originalMs += milliseconds(started);
        started = process.hrtime.bigint();
        const actual = fast.featuresOf(publicGame, state, actions); fastMs += milliseconds(started);
        assert.deepEqual(actual, expected, name + '/' + version.aid + '/' + index + ': feature or search-budget change');
        assert.deepEqual(actual.features, version.decisions[index].knownPlan, 'Changed a frozen public clock annotation');
        decisions++; activeClockDecisions += +!actual.inactive; nodes += actual.nodes; boundaries += actual.boundaries; index++;
        return actual;
      });
      assert(planned); assert.equal(index, version.decisions.length);
      assert.deepEqual(semantic(planned.prefix), semantic(version));
      assert.deepEqual(planned.state.physicalLog, control.state.physicalLog); prefixes++;
    }
    console.log(JSON.stringify({ stage: 'all-public-prefixes', name, prefixes, decisions, activeClockDecisions }));
  }
  assert.equal(prefixes, 445); assert.equal(decisions, 39268); assert.equal(activeClockDecisions, 1378);
  const paths = [];
  for (const entry of context.entries.filter(entry => entry.name === 'Dennisisdebeste' && [133, 138, 140].includes(entry.lv))) {
    const { actor, base } = checkedModels(entry, context.actors, context.models, context.baseModels), game = decodeGame(entry.game);
    for (const [profile, memory] of Object.entries({ configuredRecall: CONFIG.memory, noInheritedPictures: 0 })) {
      const paired = {};
      for (const [name, planner] of Object.entries({ original: originalPlan, cachedClock: fastPlan })) {
        const stats = {}, summaries = [], physicalLog = [], planning = planningCache(PARAMETERS, 16384, planner);
        const factory = diagnosticFactory(actor, base, summaries), started = process.hrtime.bigint();
        const chain = Hard.rateChain({ ...game, physicalLog }, 1, 20261028, { ...physicalActor(actor), physicalPlan: 0,
          physicalChoiceLimit: 512, learnFromLoss: true, memory, physicalChoiceForAttempt: factory, physicalTrayPlanning: planning, stats }, memory, 8);
        const elapsedMs = milliseconds(started);
        assert.equal(stats.physicalClockPlans || 0, 0);
        paired[name] = { chain, summaries, physicalLog, elapsedMs, caps: stats.contextChoiceLimits || 0, planningNodes: stats.knownPlanNodes || 0,
          boundaries: stats.knownPlanBoundaries || 0, planningCache: planning.stats() };
      }
      const previous = probe.rows.find(row => row.lv === entry.lv && row.profile === profile);
      assert(previous && previous.start === entry.start && previous.board === entry.board);
      assert.deepEqual(paired.original.chain, previous.chain); assert.deepEqual(paired.original.summaries, previous.summaries);
      for (const field of ['chain', 'summaries', 'physicalLog', 'caps', 'planningNodes', 'boundaries', 'planningCache']) {
        assert.deepEqual(paired.cachedClock[field], paired.original[field], 'Cached clock changed autonomous lifecycle field:' + field);
      }
      assert.equal(paired.original.caps, 0);
      paths.push({ name: entry.name, lv: entry.lv, profile, attempts: paired.original.summaries.length,
        physicalTaps: paired.original.physicalLog.length, fullPhysicalPathSha256: hash(JSON.stringify(paired.original.physicalLog)),
        originalMs: paired.original.elapsedMs, cachedClockMs: paired.cachedClock.elapsedMs,
        planningNodes: paired.original.planningNodes, boundaries: paired.original.boundaries, caps: 0 });
      console.log(JSON.stringify({ stage: 'autonomous-retry-paths', ...paths.at(-1) }));
    }
  }
  assert.equal(paths.length, 6);
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) sources[path.relative(root, filename).replace(/\\/g, '/')] = hash(fs.readFileSync(filename));
  for (const [name, expected] of Object.entries(sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'exact-cached-clock-search-and-autonomous-retry-parity-only',
    sourceHashes: sources, prefixes, decisions, activeClockDecisions, nodes, boundaries, prefixTiming: { originalMs, cachedClockMs: fastMs },
    exactAutonomousPathPairs: paths.length, paths,
    note: 'Every445 frozen human prefix and39,268 public planning calls retains exact features, search-node budgets, boundaries and physical frames. '
      + 'Six paired one-run/eight-attempt autonomous lifecycles retain complete physical tap paths, summaries, caps, node/boundary totals and planning-cache behavior. '
      + 'Only legal-state caching and cached immutable geometry/left bookkeeping change computational cost; search traversal/order/budgets and choices are not optimized away. '
      + 'Timing is measured under concurrent machine load, not a guaranteed benchmark. No live full-count runtime is modified/restarted. '
      + 'This enables broader whole-count evaluation; it is not a behavioral improvement, new numeric forecast or80% success.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/clock-fast-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ prefixes, decisions, activeClockDecisions, exactAutonomousPathPairs: paths.length, prefixTiming: report.prefixTiming }));
}

if (require.main === module) main();
