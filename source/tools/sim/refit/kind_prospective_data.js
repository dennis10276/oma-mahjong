'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { NAMES, CONFIG, boardId } = require('./personal_model.js');
const { currentTarget } = require('./personal_bot.js');
const { board } = require('./predict_mbot.js');
const { PIDS } = require('./mimic_games.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { features } = require('./attempt_count.js');
const { countFeatures } = require('./kind_count_measure.js');
const Hard = require('../../../www/hard.js');
const root = path.resolve(__dirname, '../../..'), archive = path.join(root, 'analysis/archive/personal-bots');
const dataset = JSON.parse(fs.readFileSync(path.join(archive, 'kind-count-data.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'analysis/personal-bots/personal-kind-policy.json'), 'utf8'));
const plays = JSON.parse(fs.readFileSync(path.join(root, 'analysis/archive/realdata/plays.json'), 'utf8'));

function fingerprint(files) {
  const digest = crypto.createHash('sha256');
  for (const filename of files) digest.update(fs.readFileSync(path.join(root, filename)));
  return digest.digest('hex');
}

const runs = +(process.argv[2] || 64), horizon = +(process.argv[3] || 24), cutoff = Date.now(), rows = [];
if (fingerprint(dataset.fingerprintFiles) !== dataset.fingerprint) throw new Error('Context measurements are stale; rebuild before forecasting');
const fingerprintFiles = [...new Set([...dataset.fingerprintFiles, 'analysis/archive/personal-bots/kind-count-data.json',
  'analysis/personal-bots/kind-count-evaluation.json', 'tools/sim/refit/kind_count_fit.py',
  'tools/sim/refit/kind_prospective_data.js', 'tools/sim/refit/kind_prospective.py', 'tools/sim/refit/prospective.py',
  'tools/sim/refit/prospective_data.js', 'tools/sim/refit/prospective_openings.js'])];
const sourcesAtStart = fingerprint(fingerprintFiles);
const references = new Map(dataset.rows.map(row => [row.board, row.reference]));
for (const name of NAMES) {
  const target = currentTarget(plays[PIDS[name]]);
  if (!target || target.version !== '1.55') continue;
  const first = target.lv + (target.active || target.at > 1 ? 1 : 0);
  const persona = { ...Hard.P, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })], allMoves: true, flips: true,
    kinds: { ...DEFAULT_KINDS, ...kindsAt(name, cutoff) }, peek: 0, end: 12, plan: 10, memory: CONFIG.memory };
  const fitted = policy.players[name];
  if (fitted.trainingCut > cutoff) throw new Error('Personal context model is not available yet');
  for (let lv = first; lv < first + horizon; lv++) {
    const game = board(lv, name === 'PUK' ? 1.1 : 1.6), identity = boardId(game);
    const controlChain = Hard.rateChain(game, runs, 20261023, persona, CONFIG.memory, 20);
    const contextChain = Hard.rateChain(game, runs, 20261023, { ...persona, kindModel: fitted.model }, CONFIG.memory, 20);
    const reference = references.get(identity) || { strong: Hard.rate(game, 128, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 128, 20261019, Hard.persona('average')).rate };
    const priorCounter = Math.max(0, ...Object.values(plays[PIDS[name]] || {}).filter(event => event.m !== 'd' && !event.tk && event.lv === lv && event.t < cutoff)
      .map(event => Number(event.at) || 0));
    const row = { name, lv, version: '1.55', board: identity, start: cutoff, firstAttempt: 1,
      priorCounter, physical: features(game), reference, controlChain, contextChain };
    row.features = countFeatures(dataset.rows, row);
    rows.push(row);
    console.log(name + ' L' + lv + ': repaired future forecast measured');
  }
}
if (fingerprint(fingerprintFiles) !== sourcesAtStart) throw new Error('Inputs changed during future simulation; forecasts were not frozen');
fs.writeFileSync(path.join(archive, 'kind-prospective-input.json'), JSON.stringify({ inputsFrozenAt: cutoff, fingerprint: sourcesAtStart,
  fingerprintFiles, featureSchema: { version: 'kind-count-v1', columns: dataset.rows[0].features.length }, rows }));
