'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { play, SETTINGS } = require('./public_witness_screen.js');
const { REFERENCE_PARAMETERS } = require('./public_witness_search.js');

function reproduce(progress = () => {}) {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/reference-baseline-29.json')));
  assert.equal(fixture.encoding, 'gzip-base64');
  const bytes = zlib.gunzipSync(Buffer.from(fixture.data, 'base64'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.sha256);
  const data = JSON.parse(bytes);
  assert.equal(data.version, 1);
  assert.equal(data.cases.length, 29);
  assert.deepEqual(data.settings, SETTINGS);
  const profiles = { legacy: { ...REFERENCE_PARAMETERS, continuationPruning: false }, canonical: REFERENCE_PARAMETERS };
  const scores = {};
  for (const [profile, options] of Object.entries(profiles)) {
    const rows = data.cases.map(entry => {
      const measured = play(entry, data.prior, options);
      assert.deepEqual(measured, entry.expected[profile], profile + ': ' + entry.name + ':' + entry.lv);
      progress({ profile, name: entry.name, level: entry.lv, outcome: measured.result.why });
      return { cohort: entry.cohort, ...measured };
    });
    scores[profile] = Object.fromEntries(['pinnedLaterResearch', 'priorCalibrationControl'].map(cohort => {
      const own = rows.filter(row => row.cohort === cohort);
      assert(own.every(row => !row.computationCensored && !row.unsupportedChoices && !row.autonomousUnmatchedFrames));
      return [cohort, { cases: own.length, wins: own.filter(row => row.result.win).length,
        knownPhysicalControls: own.reduce((sum, row) => sum + row.knownPhysicalControls, 0) }];
    }));
  }
  return { fixtureSha256: fixture.sha256, verifiedCasesPerProfile: 29, scores,
    note: 'Complete symbolic production replay and exact outcome/planner/physics-counter regression. Not screenshot validation, optimality or personal prediction accuracy.' };
}

if (require.main === module) console.log(JSON.stringify(reproduce(row => console.log(JSON.stringify(row)))));
module.exports = { reproduce };
