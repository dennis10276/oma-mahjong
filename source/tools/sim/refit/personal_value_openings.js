'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const Hard = require('../../../www/hard.js');
const { tasksOf, selectModels, actorOf } = require('./physical_count_data.js');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');
const pinned = 'analysis/archive/personal-bots/experiments/personal-memory-2026-10-18T00-43-24-647Z';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function main() {
  const parentFile = 'analysis/archive/personal-bots/physical-memory-count-data.json', bankFile = 'analysis/archive/personal-bots/physical-memory-policy-bank.json';
  const manifest = JSON.parse(fs.readFileSync(path.join(root, pinned, 'manifest.json')));
  const parentRaw = fs.readFileSync(path.join(root, pinned, parentFile)), bankRaw = fs.readFileSync(path.join(root, pinned, bankFile));
  assert.equal(hash(parentRaw), manifest.files[parentFile]);
  assert.equal(hash(bankRaw), manifest.files[bankFile]);
  const parent = JSON.parse(parentRaw), bank = JSON.parse(bankRaw);
  const fingerprintFiles = [...new Set(['www/hard.js', 'www/layouts.js',
    ...['personal_value_openings.js', 'physical_count_data.js', 'attempt_count.js', 'attempt_campaigns.js', 'attempt_count_labels.js',
      'attempt_features.js', 'pdata.js', 'boards.js', 'board_versions.js', 'personal_model.js', 'mimic_games.js', 'kinds.js', 'personal_policy_prior.js', 'attempts.json']
      .map(file => 'tools/sim/refit/' + file), 'analysis/archive/realdata/plays.json',
    ...Object.values(PIDS).map(pid => 'analysis/archive/replays/' + pid + '.json'),
    ...fs.readdirSync(path.join(__dirname, 'tables')).filter(file => /^(levels|hard|early)-/.test(file)).sort().map(file => 'tools/sim/refit/tables/' + file)])];
  const fingerprintOf = () => { const digest = crypto.createHash('sha256'); for (const file of fingerprintFiles) digest.update(file).update(fs.readFileSync(path.join(root, file))); return digest.digest('hex'); };
  const fingerprint = fingerprintOf(), tasks = tasksOf();
  assert.equal(tasks.length, parent.rows.length);
  const rows = tasks.map((task, position) => {
    const original = parent.rows.find(row => row.name === task.name && row.start === task.start);
    assert(original);
    for (const field of ['board', 'wonOn', 'end', 'firstAttempt']) assert.equal(task[field], original[field]);
    const models = selectModels(bank, task), actor = { ...actorOf(models.ownAll), physicalPlan: 0, physicalKeyPlan: 0, search: 0 };
    const game = { ...task.game, captureValue: true, valueLog: true, log: [], policyLog: [], physicalLog: [] };
    const result = Hard.play(game, actor, 1);
    assert.equal(result.why, 'valueCapture');
    assert.equal(result.moves, 0);
    assert.equal(game.physicalLog.length, 0);
    assert(game.capturedValue);
    if ((position + 1) % 25 === 0) console.log('Captured', position + 1, '/', tasks.length, 'pre-tap opening feature sets');
    return { name: task.name, start: task.start, lv: task.lv, board: task.board, ...game.capturedValue };
  });
  assert.equal(fingerprintOf(), fingerprint);
  const data = { made: new Date().toISOString(), scope: 'pre-tap-personal-value-openings-v1',
    fingerprint, fingerprintFiles, parentDataSha256: hash(parentRaw), pinnedActorBankSha256: hash(bankRaw), rows,
    note: 'Opening features stop before any actual tap, inspection, clock/key plan or automatic match. No human target choice or winning count is exported as a feature. Unknown pictures remain hidden; every original campaign is retained.' };
  fs.writeFileSync(path.join(root, 'analysis/archive/personal-bots/personal-value-openings.json'), JSON.stringify(data));
  console.log('Saved', rows.length, 'opening probes without executing a move');
}

if (require.main === module) main();
