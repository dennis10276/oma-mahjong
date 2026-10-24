'use strict';
const assert = require('assert/strict');
const { firstClearCampaigns, initialBoard, loadRecordedClears } = require('./human_reference_catalog.js');
const { passes, selectEntries } = require('./human_reference_screen.js');

async function test() {
  const event = (kind, time, level, at, aid, extra = {}) => ({ k: kind, t: time, lv: level, at, aid, v: '1.55', ...extra });
  const raw = [event('start', 1, 100, 1, 'first'), event('end', 2, 100, 1, 'first', { r: 'restart' }),
    event('start', 3, 100, 2, 'second'), event('end', 4, 100, 2, 'second', { r: 'win' }),
    event('start', 5, 100, 3, 'replay'), event('end', 6, 100, 3, 'replay', { r: 'win' }),
    event('start', 7, 101, 1, 'missing'), event('end', 8, 101, 1, 'missing', { r: 'win' }),
    event('end', 9, 17, 1, undefined, { r: 'win', v: '1.10' })];
  const init = { key: 'L100', at: 1, tiles: [[0, 0, 0], [4, 0, 0]],
    state: { a: [1, 1], d: [0, 0], f: [1, 1], tr: [], m: 0, p: -1, ob: null, ck: null } };
  const chunks = { first: { seq: 0, data: JSON.stringify({ init }) } };
  assert.deepEqual(firstClearCampaigns(raw).map(row => row.level), [17, 100, 101]);
  assert.equal(initialBoard(chunks).level, 100);
  assert.equal(initialBoard({ first: { seq: 1, data: JSON.stringify({ init }) } }), null);
  const catalog = await loadRecordedClears({ raw, cached: { first: chunks }, buildBoard: (version, level) => level === 17
    ? { game: initialBoard(chunks).game, boardSource: 'currentClassicDefinitionAspect1.5', historicalBoardExact: false } : null, get: async resource => {
    assert(resource.endsWith('/missing')); return null;
  } });
  assert.equal(catalog.rows.length, 3);
  const hundred = catalog.rows.find(row => row.lv === 100);
  assert.equal(hundred.status, 'available'); assert.equal(hundred.wonOn, 2); assert.equal(hundred.openingAid, 'first');
  assert.equal(catalog.rows.find(row => row.lv === 101).status, 'missingExactOpeningBoard');
  const older = catalog.rows.find(row => row.lv === 17);
  assert.equal(older.status, 'available'); assert.equal(older.wonOn, 1); assert.equal(older.historicalBoardExact, false);
  const scoped = await loadRecordedClears({ raw, cached: { first: chunks }, selectedLevels: [100],
    get: async () => { throw Error('Requested an unrelated replay'); }, buildBoard: () => { throw Error('Built an unrelated board'); } });
  assert.equal(scoped.rows.length, 3); assert.equal(scoped.rows.filter(row => row.status === 'available').length, 1);
  assert(scoped.rows.filter(row => row.lv !== 100).every(row => row.status === 'notRequested'));
  assert(passes(1, 1)); assert(!passes(1, 2)); assert(passes(2, 1)); assert(!passes(2, 2)); assert(!passes(3, null));
  const unsupported = await loadRecordedClears({ raw: [{ k: 'end', r: 'win', lv: 17, at: 1, t: 1 }], cached: {},
    get: async () => { throw Error('Unexpected unsupported-board read'); } });
  assert.deepEqual(unsupported.rows, [{ name: 'Dennisisdebeste', lv: 17, status: 'unsupportedOlderEventFormat' }]);
  assert.throws(() => selectEntries([...unsupported.rows, hundred]), /unavailable boards/);
  assert.deepEqual(selectEntries([...unsupported.rows, hundred], [100]), [hundred]);
  assert.throws(() => selectEntries([hundred], [100, 101]), /missing from the catalog/);
  assert.throws(() => selectEntries([hundred, hundred]), /Duplicate/);
  const unrequested = await loadRecordedClears({ raw: [{ k: 'end', r: 'win', lv: 17, at: 1, t: 1 }], cached: {}, selectedLevels: [] });
  assert.equal(unrequested.rows[0].status, 'notRequested');
  console.log('PASS recorded-clear catalog keeps all levels and missing evidence, uses exact first-opening boards, counts restarts, ignores easier replay wins, and enforces the strict per-level Dennis gate');
}

if (require.main === module) test().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = test;
