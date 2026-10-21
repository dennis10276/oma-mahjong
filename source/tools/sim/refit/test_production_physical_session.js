'use strict';
const assert = require('assert/strict'), Hard = require('../../../www/hard.js'), Layouts = require('../../../www/layouts.js');
const { createSession, parameters } = require('./production_physical_session.js');
const gameOf = (faces, extra = {}) => {
  const tiles = faces.map((face, index) => ({ x: index * 8, y: 0, z: 0 }));
  return { tiles, nb: Layouts.neighbors(tiles), faces, down: faces.map(() => 0), rules: null, clock: null, ...extra };
};

function compare(game, taps, options = {}) {
  const session = createSession(game, options), original = { ...game, physicalLog: [],
    ...(options.tapTimes ? { tapTimes: options.tapTimes } : {}), ...(options.settleBefore ? { settleBefore: options.settleBefore } : {}) };
  const trace = []; let available, cursor = 0;
  const result = Hard.play(original, { ...parameters(game.tiles.length, options),
    physicalTrayPlanning: (publicGame, state, actions) => { available = actions; return { features: actions.map(() => []), nodes: 0, boundaries: 0 }; },
    physicalChoice: () => {
      const requested = taps[cursor++], selected = available.findIndex(action => action.index === requested);
      assert(selected >= 0, JSON.stringify({ requested, cursor, available, physicalLog: original.physicalLog })); return selected;
    } }, options.seed ?? 1, trace);
  for (const index of taps) {
    if (session.view().type === 'productionPhysicalEnd-v1') break;
    session.tap(index);
  }
  assert.equal(cursor, session.audit().physicalLog.length);
  assert.deepEqual(session.audit().result, result); assert.deepEqual(session.audit().physicalLog, original.physicalLog);
  assert.deepEqual(session.audit().trace, trace);
  return session;
}

compare(gameOf([1, 1, 2, 2]), [0, 1, 2, 3]);
const down = compare(gameOf([1, 1, 2, 2], { down: [1, 1, 1, 1] }), [0, 1, 2, 2, 3]);
assert.equal(down.view().state.moves, 4); assert.equal(down.view().state.physicalTaps, 5);
compare(gameOf([1, 1], { clock: { i: 1, n: 1 } }), [0]);
compare(gameOf([1, 1], { clock: { i: 0, n: 1 } }), [0, 1]);
compare(gameOf([101]), [0]);
compare(gameOf([1, 101, 1, 2, 2]), [0, 1, 3, 4]);
compare(gameOf([101, 1, 1, 2, 2]), [0, 1, 3, 2], { tapTimes: [0, 10, 20, 30], settleBefore: [false, false, true, true] });
const reliefGame = gameOf([1, 1, 2, 2]);
reliefGame.rules = { ice: {}, iceNb: reliefGame.tiles.map(() => []), locks: new Set([0, 1, 2, 3]), keys: [0, 1] };
compare(reliefGame, [0, 1, 2, 3]);
const capped = compare(gameOf([1, 1], { down: [1, 1] }), [0], { choiceLimit: 1 });
assert.equal(capped.view().computationCensored, true); assert.equal(capped.view().why, 'contextChoiceLimit');
assert.throws(() => capped.tap(1));
const session = createSession(gameOf([1, 1], { down: [1, 1] }));
const before = session.view(); assert.throws(() => session.tap(99)); assert.deepEqual(session.view(), before);
before.state.alive[0] = 0; before.legalTiles.length = 0; assert.equal(session.view().state.alive[0], 1);
const inspected = session.tap(0); assert.equal(inspected.state.moves, 0); assert.equal(inspected.state.openPeek, 0);
assert.equal(inspected.state.physicalTaps, 1);
const different = createSession(gameOf([8, 8], { down: [1, 1] })); different.tap(0);
assert.deepEqual(different.view(), session.view());
for (const picture of require('./personal_public_picture_prior.js').SYMBOLS) {
  const alternative = createSession(gameOf([picture, picture], { down: [1, 1] }));
  alternative.tap(0); assert.deepEqual(alternative.view(), session.view());
}
assert(!JSON.stringify(session.view()).match(/faces|pictures|known|scores|inspect|decision|\bF\b/));
assert.throws(() => createSession(gameOf([1, 1]), { physicalPlan: 10 }));
console.log('PASS stepwise production sessions preserve complete traces/results for inspections, twins, clocks, jokers, arrival timing and relief; expose no hidden pictures/kinds/scores; retain caps as censored and forbid free restart');
