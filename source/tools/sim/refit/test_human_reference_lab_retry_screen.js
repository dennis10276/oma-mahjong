'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { encodeGame } = require('./personal_game_io.js');
const { digest, SALTS } = require('./human_reference_noise_screen.js');
const { LAB_LEVELS, runLabSalt, assembleLabReport, renderLabReport } = require('./human_reference_lab_retry_screen.js');

function test() {
  const tiles = Array.from({ length: 8 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = encodeGame({ tiles, nb: Layouts.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2, 3, 3],
    down: tiles.map(() => 0), rules: null, clock: null });
  const entries = LAB_LEVELS.map(level => ({ lv: level, name: 'Dennisisdebeste', boardSource: 'levelLab',
    wonOn: level === 10052 ? 3 : 5, game }));
  const input = { schema: 'human-reference-lab-retry-input-v1', entries, inputHash: digest(entries) };
  const planning = { informationExactUnknownLimit: 8 };
  const workers = SALTS.map(salt => {
    const rows = runLabSalt(input, planning, salt, { runCampaign(actual, options) {
      assert.equal(actual.tiles.length, 8); assert.equal(options.maximumAttempts, 4); assert(options.captureDecisions);
      assert.equal(options.planning.hypothesisRunSalt, salt); assert.equal(options.planning.level, undefined);
      const attempts = [8, 4, 2].map((unseen, offset) => {
        const ending = offset === 2 ? 0 : unseen / 2;
        return { attempt: offset + 1, status: offset === 2 ? 'cleared' : 'physicalLoss', taps: 2,
          decisions: [{ state: { alive: tiles.map(() => 1), pictures: tiles.map((unused, index) => index < unseen ? null : 0) } }],
          last: { pictures: tiles.map((unused, index) => index < ending ? null : 0) } };
      });
      return { wonOn: 3, status: 'cleared', attempts, verifiedTaps: 6, slowestMs: 10,
        hypothesis: { exactSearchCalls: 1, exactSearchNodes: 2048 } };
    } });
    assert.equal(rows.length, 4); assert.deepEqual(rows[0].attempts.map(attempt => attempt.unseenAtStart), [8, 4, 2]);
    assert(rows.slice(0, 3).every(row => row.strictPass)); assert(!rows[3].strictPass);
    return { schema: 'human-reference-lab-retry-salt-v1', salt, planning, inputHash: input.inputHash,
      sourceHash: 'fixture', sourceUnchanged: true, rows };
  });
  const report = assembleLabReport(workers);
  assert(report.valid); assert.equal(report.clearsWithinFour, 12); assert.equal(report.strictPasses, 9);
  assert.equal(renderLabReport(report).split('\n').filter(line => /^\|\d/.test(line)).length, 4);
  let calls = 0;
  const failures = runLabSalt(input, planning, 1, { runCampaign() { calls++; throw Error('Injected physical failure'); } });
  assert.equal(calls, 4); assert(failures.every(row => row.status === 'invalid'));
  console.log('PASS twelve lab/salt diagnostics preserve actual retry-memory accounting, cap real starts at four, distinguish a late clear from the strict human-try gate, continue all cases after errors and produce one compact memory table');
}

if (require.main === module) test();
module.exports = test;
