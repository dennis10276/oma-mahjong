'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { NAMES, CONFIG, boardId, conditional, fit, predict } = require('./personal_model.js');
const { outcomesOf, features } = require('./attempt_count.js');
const { currentTarget } = require('./personal_bot.js');
const { board } = require('./predict_mbot.js');
const { PIDS, boardOf } = require('./mimic_games.js');
const { kindsAt } = require('./kinds.js');
const { DEFAULT_KINDS } = require('./personal_policy_prior.js');
const { buildFeatures, featureNames } = require('./attempt_features.js');
const { includePendingOpenings } = require('./prospective_openings.js');
const { designed } = require('./boards.js');
const Hard = require('../../../www/hard.js');
const archive = path.resolve(__dirname, '../../../analysis/archive');
const dataset = JSON.parse(fs.readFileSync(path.join(archive, 'personal-bots/attempt-count-data.json'), 'utf8'));

if (process.argv[2] === 'outcomes') {
  const plays = JSON.parse(fs.readFileSync(path.join(archive, 'realdata/plays.json'), 'utf8'));
  const rows = NAMES.flatMap(name => {
    const recorded = new Map(), replay = JSON.parse(fs.readFileSync(path.join(archive, 'replays/' + PIDS[name] + '.json'), 'utf8'));
    for (const [aid, chunks] of Object.entries(replay)) for (const chunk of Object.values(chunks)) {
      if (!chunk?.data) continue;
      const init = JSON.parse(chunk.data).init;
      if (init && !init.partial && !init.track && init.state) recorded.set(aid, boardOf(init));
    }
    const episodes = outcomesOf(name).map(({ name, lv, version, board, start, end, wonOn, firstAttempt, loggedFirstAttempt, loggedWonOn, campaignAids, openingRecorded }) =>
      ({ name, lv, version, board, start, end, wonOn, firstAttempt, loggedFirstAttempt, loggedWonOn,
        campaignAids, openingRecorded }));
    return includePendingOpenings(name, episodes, plays[PIDS[name]], start => {
      const game = recorded.get(start.aid) || designed(start.v, start.lv);
      return game ? boardId(game) : null;
    });
  });
  fs.writeFileSync(path.join(archive, 'personal-bots/prospective-outcomes.json'), JSON.stringify(rows));
  console.log('Exported completed and pending episodes for prospective scoring.');
} else {
  const now = Date.now(), runs = +(process.argv[2] || 256), horizon = +(process.argv[3] || 3);
  const plays = JSON.parse(fs.readFileSync(path.join(archive, 'realdata/plays.json'), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../analysis/personal-bots/personal-policy.json'), 'utf8'));
  const trialRows = NAMES.flatMap(name => JSON.parse(fs.readFileSync(path.join(archive, 'personal-bots/' + name.replace(/[^A-Za-z]/g, '') + '.json'), 'utf8')).rows);
  const correction = fit(trialRows.filter(row => row.t < now)), rows = [];
  for (const name of NAMES) {
    const target = currentTarget(plays[PIDS[name]]);
    if (!target || target.version !== '1.55') continue;
    const first = target.lv + (target.active || target.at > 1 ? 1 : 0);
    const kinds = kindsAt(name, now), base = { ...Hard.P, w: [...Hard.weightsOf({ ...Hard.persona('strong'), temp: 2 })], allMoves: true,
      flips: true, kinds, peek: 0, end: 12, plan: 10, memory: CONFIG.memory };
    const prior = { ...base, kinds: { ...DEFAULT_KINDS, ...kinds } };
    const weights = policy.players[name].models.full.weights;
    for (let lv = first; lv < first + horizon; lv++) {
      const game = board(lv, name === 'PUK' ? 1.1 : 1.6), identity = boardId(game);
      const chain = Hard.rateChain(game, runs, 20261018, base, CONFIG.memory, 20);
      const extraChains = { prior: Hard.rateChain(game, runs, 20261020, prior, CONFIG.memory, 20),
        strong: Hard.rateChain(game, runs, 20261020, Hard.persona('strong'), CONFIG.memory, 20),
        learned: Hard.rateChain(game, runs, 20261020, { ...prior, w: weights.slice(0, Hard.FEAT.length), spatial: weights.slice(Hard.FEAT.length) }, CONFIG.memory, 20) };
      const reference = { strong: Hard.rate(game, 128, 20261019, Hard.persona('strong')).rate,
        average: Hard.rate(game, 128, 20261019, Hard.persona('average')).rate };
      const row = { name, lv, version: '1.55', board: identity, start: now, firstAttempt: 1, chain, extraChains, reference, physical: features(game) };
      if (dataset.retryAudit) {
        row.retryChains = {};
        const { PROFILES } = require('./attempt_retry_eval.js');
        for (const [mode, parameters] of Object.entries(PROFILES)) {
          const persona = { ...prior, ...parameters };
          const candidate = Hard.rateChain(game, runs, 20261021, persona, persona.memory, 20);
          row.retryChains[mode] = candidate;
        }
      }
      if (dataset.memoryAudit) {
        row.memoryChains = {};
        const { PROFILES } = require('./attempt_memory_eval.js');
        for (const [mode, parameters] of Object.entries(PROFILES)) {
          const persona = { ...prior, learnFromLoss: true, retryPlan: 14, keyPlan: 4, ...parameters };
          const candidate = Hard.rateChain(game, runs, 20261022, persona, persona.memory, 20);
          row.memoryChains[mode] = candidate;
        }
      }
      row.features = buildFeatures(dataset.rows, row);
      if (JSON.stringify(featureNames(row)) !== JSON.stringify(dataset.featureSchema?.names)) throw new Error('Training and forecast feature schemas differ');
      let remaining = 1;
      row.distribution = Array.from({ length: 20 }, (_, index) => {
        const probability = predict(correction, { name, at: index + 1, board: identity, raw: conditional(chain, index + 1) });
        const mass = remaining * probability; remaining *= 1 - probability; return mass;
      });
      rows.push(row);
      console.log(name + ' L' + lv + ': future-level simulation complete');
    }
  }
  const fingerprintFiles = ['analysis/archive/personal-bots/attempt-count-data.json', 'analysis/personal-bots/personal-policy.json',
    'analysis/personal-bots/attempt-count-evaluation.json',
    'www/hard.js', 'tools/sim/refit/attempt_features.js', 'tools/sim/refit/attempt_count_fit.py', 'tools/sim/refit/attempt_hazard.py',
    'tools/sim/refit/prospective.py', 'tools/sim/refit/prospective_data.js'];
  const digest = crypto.createHash('sha256');
  for (const filename of fingerprintFiles) digest.update(fs.readFileSync(path.resolve(__dirname, '../../..', filename)));
  const fingerprint = digest.digest('hex');
  fs.writeFileSync(path.join(archive, 'personal-bots/prospective-input.json'), JSON.stringify({ inputsFrozenAt: now, fingerprint, fingerprintFiles, featureSchema: dataset.featureSchema, rows }));
}
