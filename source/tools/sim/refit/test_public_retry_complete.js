'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { retryCompleteSearch } = require('./public_retry_complete.js');

function test() {
  const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
  const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: null };
  for (const field of ['faces', 'deck', 'seed']) Object.defineProperty(game, field, { get() { throw Error('Private ' + field); } });
  const state = { alive: tiles.map(() => 1), pictures: [1, 1, 2, 2, 3, 3, 4, 4], down: tiles.map(() => 0),
    tray: [], moves: 0, openPeek: -1, relieved: false, arriving: [], physicalTaps: 0 };
  const roots = tiles.map((tile, index) => ({ index }));
  const primary = { index: 0, path: [0], nodes: 1, knownWin: false, knownDead: false, information: false, boundary: true };
  let attempt = 1;
  const search = retryCompleteSearch(() => primary, () => attempt);
  assert.equal(search(game, state, roots, {}), primary, 'The first-try policy is untouched');
  assert.equal(search.stats().considered, 0);
  attempt = 2;
  const completed = search(game, state, roots, {});
  assert(completed.knownWin && !completed.knownDead && !completed.boundary);
  assert.equal(completed.path.length, 8);
  assert.deepEqual(search.stats().solvedAttempts, [2]);
  const hidden = { ...state, pictures: state.pictures.map((picture, index) => index === 0 ? null : picture) };
  assert.equal(search(game, hidden, roots, {}), primary);
  assert.equal(search.stats().incomplete, 1);
  const short = retryCompleteSearch(() => primary, () => 2, { choices: 4 });
  assert.equal(short(game, state, roots, {}), primary, 'A witness must fit the remaining real choice budget');
  const alreadyWon = { ...primary, knownWin: true };
  const protectedSearch = retryCompleteSearch(() => alreadyWon, () => 2);
  assert.equal(protectedSearch(game, state, roots, {}), alreadyWon);
  assert.equal(protectedSearch.stats().considered, 0);
  const realNow = Date.now;
  try {
    let now = 1000; Date.now = () => now;
    const slow = retryCompleteSearch(() => { now += 1900; return primary; }, () => 2);
    assert.equal(slow(game, state, roots, {}), primary);
    assert.equal(slow.stats().deadlineStops, 1);
    assert.equal(slow.stats().nodes, 0);
  } finally { Date.now = realNow; }
  console.log('PASS complete-route retry search preserves first tries and existing wins, overrides only with a constructive remembered-state win, respects choice/deadline limits, and keeps incomplete memory on the original policy');
}
if (require.main === module) test();
module.exports = test;
