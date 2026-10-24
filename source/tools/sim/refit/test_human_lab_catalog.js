'use strict';
const assert = require('assert/strict');
const { labDevelopmentClears, loadDevelopmentClears } = require('./human_reference_catalog.js');
const { decodeGame } = require('./personal_game_io.js');
const { passes } = require('./human_reference_screen.js');
const source = require('../../../analysis/lab-clears.json');

async function test() {
  const rows = labDevelopmentClears();
  assert.equal(rows.length, 15);
  assert(rows.every(entry => entry.lv !== 10031));
  assert.deepEqual(rows.map(entry => entry.lv), source.rows.filter(entry => entry.lv !== 10031).map(entry => entry.lv));
  for (const entry of rows) {
    const game = decodeGame(entry.game);
    const roles = [...Object.keys(game.rules.ice).map(Number), ...(game.rules.locks || []), ...game.rules.keys];
    assert.equal(new Set(roles).size, roles.length);
    assert(game.rules.keys.length === 0 || game.rules.keys.length === 2);
    assert(Object.values(game.rules.ice).every(hits => hits === 1 || hits === 2));
    assert(passes(entry.wonOn, 1));
    assert(!passes(entry.wonOn, entry.wonOn + 1));
    if (entry.wonOn > 1) assert(!passes(entry.wonOn, entry.wonOn));
  }
  rows[0].game.faces.fill(99);
  assert.notDeepEqual(rows[0].game.faces, source.rows[0].game.faces);
  const invalid = structuredClone(source);
  invalid.rows[0].stackedRoles = true;
  assert.throws(() => labDevelopmentClears(invalid));
  assert.throws(() => labDevelopmentClears({ rows: source.rows.slice(1) }));
  const selected = await loadDevelopmentClears({ raw: {}, cached: {}, selectedLevels: [10011],
    get: async () => { throw Error('Unexpected remote read'); } });
  assert.equal(selected.rows.length, 15);
  assert.equal(selected.rows.filter(entry => entry.status === 'available').length, 1);
  assert(selected.rows.filter(entry => entry.lv !== 10011).every(entry => entry.status === 'notRequested' && !entry.game));
  assert.deepEqual(selected.excluded.map(entry => entry.level), [10031]);
  console.log('PASS all15 authorized lab boards enter the development catalog with exact boards, strict try scoring and only the explicit10031 exclusion; scoped runs retain unresolved rows without decoding other boards');
}

if (require.main === module) test().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = test;
