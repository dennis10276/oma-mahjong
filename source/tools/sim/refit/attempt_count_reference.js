'use strict';
const fs = require('fs'), path = require('path');
const { outcomesOf } = require('./attempt_count.js');
const { NAMES } = require('./personal_model.js');
const { rebuildFeatures } = require('./attempt_features.js');
const Hard = require('../../../www/hard.js');
const filename = path.resolve(__dirname, '../../../analysis/archive/personal-bots/attempt-count-data.json');
const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
const games = new Map(NAMES.flatMap(name => outcomesOf(name).map(episode => [name + '|' + episode.start, episode.game])));
let done = 0;
for (const row of data.rows) {
  if (!row.reference) {
    const game = games.get(row.name + '|' + row.start);
    if (!game) throw new Error('Missing reference board');
    row.reference = { strong: Hard.rate(game, 128, 20261019, Hard.persona('strong')).rate,
      average: Hard.rate(game, 128, 20261019, Hard.persona('average')).rate };
  }
  done++;
  if (done % 20 === 0) {
    fs.writeFileSync(filename, JSON.stringify(data));
    console.log('Board difficulty reference:', done + '/' + data.rows.length);
  }
}
rebuildFeatures(data);
fs.writeFileSync(filename, JSON.stringify(data));
console.log('Added person-independent board difficulty.');
