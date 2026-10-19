'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { NAMES, boardId } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { temperedFactory } = require('./personal_tempered_choice.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, planFeatures } = require('./personal_joint_planning_fast.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function publicSignature(decision, frame) {
  return hash(JSON.stringify([decision.kindContext, decision.F, decision.knownPlan,
    frame ? [frame.moves, frame.alive, frame.tray, frame.openPeek] : null]));
}

function summarize(decisions, physicalLog) {
  assert.equal(decisions.length, physicalLog.length);
  const tail = decisions.slice(-128), frames = physicalLog.slice(-128), last = frames.at(-1);
  return { decisions: decisions.length,
    maximumIdenticalDecisionVisits: Math.max(0, ...decisions.map(decision => decision.publicVisits)),
    tailChoices: tail.length,
    tailKnownReinspections: tail.filter(decision => decision.inspection && decision.knownReopen).length,
    tailSameProgress: !!last && frames.every(frame => frame.moves === last.moves
      && JSON.stringify(frame.alive) === JSON.stringify(last.alive) && JSON.stringify(frame.tray) === JSON.stringify(last.tray)),
    first: decisions.slice(0, 8), last: decisions.slice(-8),
  };
}

function main(argument) {
  assert(argument, 'Supply the owned immutable temperature calibration run');
  const runRoot = path.resolve(argument);
  assert(runRoot.startsWith(path.join(root, 'analysis/archive/personal-bots/runs') + path.sep));
  const manifestFile = path.join(runRoot, 'temperature-run-manifest.json'), manifestBytes = fs.readFileSync(manifestFile);
  const manifest = JSON.parse(manifestBytes), inputFile = path.join(runRoot, 'analysis/archive/personal-bots/personal-policy-temperature-input.json');
  const inputBytes = fs.readFileSync(inputFile); assert.equal(hash(inputBytes), manifest.inputSha256);
  const input = JSON.parse(inputBytes), sourceHashes = {};
  for (const filename of Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))) {
    const relative = path.relative(root, filename).replace(/\\/g, '/'), actual = hash(fs.readFileSync(filename));
    if (filename !== __filename) assert.equal(actual, manifest.sourceHashes[relative], 'Diagnostic runtime differs from the measured current actor');
    sourceHashes[relative] = actual;
  }
  const rows = [];
  for (const name of NAMES) {
    const entry = input.entries.filter(row => row.name === name).at(-1);
    const actor = input.actors.find(value => value.name === name && value.id === entry.modelId);
    const model = input.models.find(value => value.name === name && value.id === entry.modelId);
    assert(actor && model);
    for (const temperature of [.25, 1]) {
      const selector = temperedFactory(actor, model, temperature), game = decodeGame(entry.game);
      assert.equal(boardId(game), entry.board);
      const physicalLog = [], decisions = [], visits = new Map(), stats = {};
      const choice = (decision, draw) => {
        const signature = publicSignature(decision, physicalLog.at(-1)), count = (visits.get(signature) || 0) + 1;
        visits.set(signature, count);
        const probabilities = selector.probabilities(decision), selected = selector(decision, draw), features = decision.F[selected];
        decisions.push({ selected, publicVisits: count, inspection: features[19] > 0,
          knownReopen: features[65] > 0, pairPreparation: features[67] > 0,
          activeClock: decision.kindContext[11] > 0, position: [features[21], features[22], features[26]],
          selectedProbability: probabilities[selected], choices: probabilities.length });
        return selected;
      };
      const outcome = Hard.play({ ...game, memory: null, avoidMoves: new Map(), physicalLog },
        { ...physicalActor(actor), physicalPlan: 0, physicalChoice: choice, physicalChoiceLimit: 512,
          physicalTrayPlanning: planningCache(PARAMETERS, 4096, planFeatures), stats }, 20261028 * 7919, []);
      const record = { name, lv: entry.lv, board: entry.board, actorId: actor.id, temperature,
        explicitDiagnosticChoiceLimit: 512, outcome: { win: outcome.win, why: outcome.why, left: outcome.left, moves: outcome.moves },
        computationCaps: stats.contextChoiceLimits || 0, ...summarize(decisions, physicalLog) };
      rows.push(record);
      console.log(JSON.stringify({ name, lv: entry.lv, temperature, why: outcome.why, decisions: record.decisions,
        maximumVisits: record.maximumIdenticalDecisionVisits, tailSameProgress: record.tailSameProgress,
        tailKnownReinspections: record.tailKnownReinspections }));
    }
  }
  for (const [relative, expected] of Object.entries(sourceHashes)) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(hash(fs.readFileSync(inputFile)), hash(inputBytes));
  const report = { made: new Date().toISOString(), evidence: 'bounded-personal-temperature-public-cycle-diagnostic-only',
    targetMet: false, inputSha256: hash(inputBytes), runManifestSha256: hash(manifestBytes), sourceHashes, rows,
    note: 'One declared seed, first attempt only, four explicitly selected prior training boards and two current-own policies. '
      + '512 is a diagnostic computation cap, not a human loss or count forecast. Actual human winning counts are not read. '
      + 'Exact public decision revisits plus128-tap physical stagnation diagnose behavior without banning ordinary necessary blocker reopenings. '
      + 'No default4096 engine boundary, ongoing calibration, person model, old numeric forecast or cohort is changed.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/temperature-cycle-audit.json'), JSON.stringify(report, null, 2));
}

if (require.main === module) main(process.argv[2]);
module.exports = { publicSignature, summarize };
