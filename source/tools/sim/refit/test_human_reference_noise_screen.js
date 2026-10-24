'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { LEVELS, GUARDS, SALTS, digest, runSaltScreen, assembleNoiseReport, renderNoiseReport } = require('./human_reference_noise_screen.js');

function test() {
  const tiles = Array.from({ length: 4 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [0, 0, 1, 1], down: [0, 0, 0, 0], rules: null, clock: null });
  const entries = LEVELS.map(level => ({ name: 'Dennisisdebeste', lv: level, wonOn: level === 150 ? 3 : 1,
    game, boardSource: 'recordedOpening' }));
  const input = { schema: 'human-reference-noise-input-v1', entries, inputHash: digest(entries) }, planning = { informationScoreMode: 'clear' };
  const before = JSON.stringify({ input, planning });
  const workers = (outcome, slowestMs = 20) => SALTS.map(salt => {
    let position = 0;
    const rows = runSaltScreen(input, planning, salt, { runCampaign(decoded, options) {
      assert.equal(options.maximumAttempts, 1); assert.equal(options.planning.hypothesisRunSalt, salt);
      assert.equal(options.planning.level, undefined); assert.equal(options.planning.name, undefined);
      assert.deepEqual(options.publicContext, { boardMode: 'standard' }); assert.equal(decoded.tiles.length, 4);
      const won = outcome(LEVELS[position++], salt);
      return { wonOn: won ? 1 : null, status: won ? 'cleared' : 'physicalLoss', attempts: [{}],
        verifiedTaps: 4, slowestMs, decisionCount: 4, hypothesis: { contestedDecisions: 2, changed: 1, completeWorlds: 6 } };
    } });
    assert.equal(position, 16); assert.equal(rows.length, 16);
    return { schema: 'human-reference-noise-salt-v1', salt, planning, inputHash: input.inputHash,
      sourceHash: 'fixture-source', sourceUnchanged: true, rows };
  });
  const baseline = assembleNoiseReport(workers(level => GUARDS.includes(level)));
  assert.equal(baseline.wins, 24); assert(baseline.valid); assert(!baseline.adoptable);
  const improved = assembleNoiseReport(workers((level, salt) => level === 81 || GUARDS.includes(level)
    && !(level === 134 && salt === 1)), baseline);
  assert.equal(improved.wins, 26); assert.equal(improved.gains, 3); assert.equal(improved.losses, 1); assert(improved.adoptable);
  const damaged = assembleNoiseReport(workers((level, salt) => level === 81 || GUARDS.includes(level)
    && !(level === 134 && salt <= 2)), baseline);
  assert.equal(damaged.wins, 25); assert(!damaged.adoptable);
  assert(!assembleNoiseReport(workers(level => GUARDS.includes(level)), baseline).adoptable);
  const partialBaseline = assembleNoiseReport(workers((level, salt) => GUARDS.includes(level) && !(level === 134 && salt === 3)));
  const exchanged = assembleNoiseReport(workers((level, salt) => level === 81 || GUARDS.includes(level)
    && (level !== 134 || salt === 3)), partialBaseline);
  assert(exchanged.wins > partialBaseline.wins); assert.equal(exchanged.guardChanges[0].losses, 2); assert(!exchanged.adoptable);
  const invalidWorkers = workers((level, salt) => { if (level === 81 && salt === 1) throw Error('Injected failure'); return true; });
  const invalid = assembleNoiseReport(invalidWorkers, baseline);
  assert.equal(invalid.rows.length, 48); assert.equal(invalid.rows[0].status, 'invalid'); assert(!invalid.valid); assert(!invalid.adoptable);
  const late = assembleNoiseReport(workers(() => true, 2001), baseline); assert(!late.valid); assert(!late.adoptable);
  const changedSource = workers(() => true); changedSource[0].sourceUnchanged = false;
  assert(!assembleNoiseReport(changedSource, baseline).valid);
  const table = renderNoiseReport(improved, baseline);
  assert(table.includes('26/48')); assert(table.includes('gains 3, losses 1'));
  assert.equal(table.split('\n').filter(line => /^\|\d/.test(line)).length, 16);
  assert.equal(JSON.stringify({ input, planning }), before);
  assert.throws(() => runSaltScreen({ ...input, entries: entries.slice(1) }, planning, 1));
  console.log('PASS all48 seeded noise-screen rows run exactly one attempt without passing player/level IDs to policy; total gains and paired guard losses govern adoption, errors finish remaining cases, source/timing failures prevent adoption, and one table reports gains and losses');
}

if (require.main === module) test();
module.exports = test;
