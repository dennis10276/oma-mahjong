'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { NAMES } = require('./personal_model.js');
const { decodeGame } = require('./personal_game_io.js');
const { physicalActor } = require('./personal_physical_actor.js');
const { temperedFactory } = require('./personal_tempered_choice.js');
const { attentionFactory } = require('./personal_attention_choice.js');
const { publicSignature, summarize } = require('./personal_temperature_cycle_audit.js');
const { planningCache } = require('./known_tray_plan_cache.js');
const { PARAMETERS, planFeatures } = require('./personal_joint_planning_fast.js');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function sample(game, actor, selector) {
  const physicalLog = [], decisions = [], visits = new Map(), stats = {};
  const choice = (decision, draw) => {
    const key = publicSignature(decision, physicalLog.at(-1)), count = (visits.get(key) || 0) + 1;
    visits.set(key, count);
    const selected = selector(decision, draw), feature = decision.F[selected];
    decisions.push({ publicVisits: count, inspection: feature[19] > 0, knownReopen: feature[65] > 0 });
    return selected;
  };
  const result = Hard.play({ ...game, memory: null, avoidMoves: new Map(), physicalLog },
    { ...physicalActor(actor), physicalPlan: 0, physicalChoice: choice, physicalChoiceLimit: 512,
      physicalTrayPlanning: planningCache(PARAMETERS, 4096, planFeatures), stats }, 20261028 * 7919, []);
  return { outcome: { win: result.win, why: result.why, left: result.left, moves: result.moves },
    computationCaps: stats.contextChoiceLimits || 0, physicalLog, ...summarize(decisions, physicalLog) };
}

function main(argument, variant = 'clipped') {
  assert(['clipped', 'log'].includes(variant));
  const suffix = variant === 'log' ? '-log' : '';
  assert(argument, 'Supply the immutable original temperature calibration run');
  const runRoot = path.resolve(argument);
  assert(runRoot.startsWith(path.join(root, 'analysis/archive/personal-bots/runs') + path.sep));
  const manifest = JSON.parse(fs.readFileSync(path.join(runRoot, 'temperature-run-manifest.json')));
  const inputBytes = fs.readFileSync(path.join(runRoot, 'analysis/archive/personal-bots/personal-policy-temperature-input.json'));
  assert.equal(hash(inputBytes), manifest.inputSha256);
  const input = JSON.parse(inputBytes), modelFile = path.join(root, 'analysis/archive/personal-bots/personal-attention' + suffix + '-models.json');
  const modelBytes = fs.readFileSync(modelFile), bank = JSON.parse(modelBytes);
  assert.equal(bank.variant || 'clipped', variant);
  const runtimeFile = path.join(root, 'analysis/personal-bots/attention' + suffix + '-runtime-audit.json'), runtimeBytes = fs.readFileSync(runtimeFile), runtime = JSON.parse(runtimeBytes);
  assert.equal(runtime.modelsSha256, hash(modelBytes)); assert.equal(runtime.decisions, 39268);
  for (const [relative, expected] of Object.entries({ ...bank.inputHashes, ...runtime.sourceHashes })) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  const baseBank = JSON.parse(fs.readFileSync(path.join(root, bank.baseFile)));
  const rows = [];
  for (const name of NAMES) {
    const entry = input.entries.filter(value => value.name === name).at(-1), game = decodeGame(entry.game);
    const actor = input.actors.find(value => value.id === entry.modelId), base = input.models.find(value => value.id === actor.id);
    const model = bank.models.find(value => value.id === actor.id && value.name === name);
    assert(model); assert.deepEqual(base, baseBank.models.find(value => value.id === actor.id));
    for (const temperature of [.25, 1]) {
      const original = sample(game, actor, temperedFactory(actor, base, temperature));
      const disabled = sample(game, actor, attentionFactory(actor, base, { ...model, attention: { ...model.attention, weights: [0, 0] } }, temperature));
      assert.deepEqual(disabled, original, 'Zero attention changed a complete diagnostic physical path');
      const modified = sample(game, actor, attentionFactory(actor, base, model, temperature));
      const summary = value => { const { physicalLog, ...statistics } = value; return { ...statistics, physicalPathSha256: hash(JSON.stringify(physicalLog)) }; };
      rows.push({ name, lv: entry.lv, board: entry.board, actorId: actor.id, temperature,
        exactZeroControl: true, baseline: summary(original), attention: summary(modified) });
      console.log(JSON.stringify({ name, lv: entry.lv, temperature, baseline: original.outcome.why, attention: modified.outcome.why,
        baselineCaps: original.computationCaps, attentionCaps: modified.computationCaps,
        maximumAttentionVisits: modified.maximumIdenticalDecisionVisits }));
    }
  }
  assert.equal(hash(fs.readFileSync(modelFile)), hash(modelBytes));
  const report = { made: new Date().toISOString(), targetMet: false, evidence: 'bounded-personal-attention-first-path-diagnostic-only',
    variant, modelsSha256: hash(modelBytes), runtimeAuditSha256: hash(runtimeBytes), inputSha256: hash(inputBytes), rows,
    explicitDiagnosticChoiceLimit: 512, exactZeroPhysicalPathControls: rows.length,
    sourceHashes: Object.fromEntries(Object.keys(require.cache).filter(filename => filename.startsWith(root + path.sep))
      .map(filename => [path.relative(root, filename).replace(/\\/g, '/'), hash(fs.readFileSync(filename))])),
    note: 'One first-attempt seed on four selected prior training boards. Zero attention reproduces whole physical paths exactly. '
      + '512 boundaries are diagnostics, not human losses or winning-count forecasts. Human winning labels are not read. '
      + 'The changed policy needs new full autonomous count calibration and genuine future freezes; old temperature chains cannot substitute.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/attention' + suffix + '-first-audit.json'), JSON.stringify(report, null, 2));
}

if (require.main === module) main(process.argv[2], process.argv[3]);
