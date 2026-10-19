'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { CONFIG } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { jointIntentFactory, planFeatures, PARAMETERS } = require('./personal_joint_intents_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { loadContext, checkedModels } = require('./personal_handoff_first.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function diagnosticFactory(actor, base, summaries) {
  return ({ run, attempt, seed, previousFailure }) => {
    const selector = jointIntentFactory(actor, base.clockIntents, base.trayIntents, attempt === 1), visits = new Map();
    const summary = { run, attempt, seed, previousFailure, choices: 0, clockChoices: 0,
      knownNonPairClockReinspections: 0, repeatedPublicStateVisits: 0, maximumPublicStateVisits: 0, first: [], last: [] };
    summaries.push(summary);
    return (decision, draw) => {
      const before = selector.posterior(), selected = selector(decision, draw), feature = decision.F[selected];
      const identity = hash(JSON.stringify([decision.kindContext, decision.F, decision.knownPlan]));
      const seen = (visits.get(identity) || 0) + 1; visits.set(identity, seen);
      summary.repeatedPublicStateVisits += +(seen > 1); summary.maximumPublicStateVisits = Math.max(summary.maximumPublicStateVisits, seen);
      const clock = decision.kindContext[11] > 0, inspection = feature[19] > 0, knownReopen = feature[65] > 0, preparation = feature[67] > 0;
      summary.choices++; summary.clockChoices += +clock;
      summary.knownNonPairClockReinspections += +(clock && inspection && knownReopen && !preparation);
      const observation = { choice: summary.choices, clock, inspection, knownReopen, preparation,
        position: [feature[21], feature[22], feature[26]], tray: decision.kindContext.slice(1, 4),
        selectedClockPlan: decision.knownPlan[selected].slice(0, 12), posteriorBefore: before.clock, publicStateVisits: seen };
      if (summary.first.length < 12) summary.first.push(observation);
      summary.last.push(observation); if (summary.last.length > 12) summary.last.shift();
      return selected;
    };
  };
}

function main() {
  const context = loadContext(), rows = [], limit = 512, attempts = 8;
  const entries = context.entries.filter(entry => entry.name === 'Dennisisdebeste' && [133, 138, 140].includes(entry.lv));
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    const { actor, base } = checkedModels(entry, context.actors, context.models, context.baseModels), game = decodeGame(entry.game);
    const planning = planningCache(PARAMETERS, 16384, planFeatures);
    for (const [name, memory] of Object.entries({ configuredRecall: CONFIG.memory, noInheritedPictures: 0 })) {
      const stats = {}, summaries = [], factory = diagnosticFactory(actor, base, summaries);
      const chain = Hard.rateChain(game, 1, 20261028, { ...physicalActor(actor), physicalPlan: 0, physicalChoiceLimit: limit,
        learnFromLoss: true, memory, physicalChoiceForAttempt: factory, physicalTrayPlanning: planning, stats }, memory, attempts);
      const caps = stats.contextChoiceLimits || 0;
      assert.equal(caps, chain.computationCensored || 0); assert.equal(stats.physicalClockPlans || 0, 0);
      const row = { name: entry.name, lv: entry.lv, start: entry.start, board: entry.board, modelId: actor.id,
        profile: name, memory, explicitDiagnosticChoiceLimit: limit, attempts, chain, computationCaps: caps, summaries };
      rows.push(row);
      console.log(JSON.stringify({ lv: entry.lv, profile: name, caps, summaries: summaries.map(({ first, last, ...summary }) => summary) }));
    }
  }
  for (const [name, expected] of Object.entries(context.sources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'bounded-public-retry-cycle-diagnostic-only',
    sourceHashes: context.sources, rows,
    note: 'One fixed autonomous run, up toeight attempts, on three explicitly selected slow recent boards. '
      + 'Choice limit512 is a declared diagnostic computation boundary, not the default4096 and never a human loss or count-scoring sample. '
      + 'Configured/zero incoming-picture alternatives use the same earlier-own joint actor, seed and simulated-failure lifecycle. '
      + 'Public-state repeats, chosen clock-inspection features and causal mode probabilities identify cycling without using hidden pictures or actual target human moves. '
      + 'After any computation cap subsequent chain attempts are only harness diagnostics, not valid human retry evidence. '
      + 'This does not replace or restart the live full-count run, select a human memory trait or establish80% forecast accuracy.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/retry-cycle-probe.json'), JSON.stringify(report));
}

if (require.main === module) main();
module.exports = { diagnosticFactory };
