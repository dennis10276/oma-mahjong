'use strict';
const fs = require('fs'), path = require('path');
const { outcomesOf } = require('./attempt_count.js');
const { rebuildFeatures } = require('./attempt_features.js');
const { NAMES, fit, predict, conditional } = require('./personal_model.js');
const archive = path.resolve(__dirname, '../../../analysis/archive/personal-bots');
const filename = path.join(archive, 'attempt-count-data.json');
const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
const outcomes = new Map(NAMES.flatMap(name => outcomesOf(name).map(episode => [name + '|' + episode.start, episode])));
const trials = NAMES.flatMap(name => JSON.parse(fs.readFileSync(path.join(archive, name.replace(/[^A-Za-z]/g, '') + '.json'), 'utf8')).rows);
for (const row of data.rows) {
  const episode = outcomes.get(row.name + '|' + row.start);
  if (!episode || episode.board !== row.board) throw new Error('Measured episode no longer matches current data');
  for (const field of ['firstAttempt', 'wonOn', 'loggedFirstAttempt', 'loggedWonOn', 'observedAttempts']) row[field] = episode[field];
}
for (const row of data.rows) {
  const model = fit(trials.filter(trial => trial.t < row.start));
  let remaining = 1;
  row.distribution = Array.from({ length: 20 }, (_, index) => {
    const probability = predict(model, { name: row.name, at: row.loggedFirstAttempt + index, board: row.board,
      raw: conditional(row.chain, index + 1) });
    const mass = remaining * probability;
    remaining *= 1 - probability;
    return mass;
  });
  row.beyond20 = remaining;
  row.openingPrediction = row.distribution.indexOf(Math.max(...row.distribution)) + 1;
}
rebuildFeatures(data);
fs.writeFileSync(filename, JSON.stringify(data));
console.log('Preserved logged attempt counters and normalized confirmed replay episodes.');
