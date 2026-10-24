'use strict';
const assert = require('assert/strict'), Layouts = require('../../../www/layouts.js');
const { guardedSearch } = require('./public_witness_reopen_guard.js');
const tiles = [0, 1, 2, 3].map(index => ({ x: index * 8, y: 0, z: 0 }));
const game = { tiles, nb: Layouts.neighbors(tiles), rules: null, clock: { i: 0, n: 1 } };
Object.defineProperty(game, 'faces', { get() { throw Error('Private picture access'); } });
const state = { alive: [1, 1, 1, 1], pictures: [1, 1, 2, 2], down: [1, 0, 1, 0], tray: [], moves: 0, openPeek: 2, relieved: false, arriving: [] };
const actions = [{ index: 0, inspect: true }, { index: 1, inspect: false }, { index: 2, inspect: false }, { index: 3, inspect: false }];
const primary = { index: 1, path: [1], knownWin: false, knownDead: true, deadCertificate: { exhaustedKnownGraph: true },
  safeClockExit: false, knownProgress: 0, nodes: 2, boundary: false, goal: 'knownDeadEnd' };
let calls = [];
const winning = guardedSearch((game, state, actions, settings) => {
  calls.push({ actions, settings });
  return actions.length > 1 ? { ...primary } : { ...primary, index: 0, path: [0, 0, 1, 2, 3], knownWin: true,
    knownDead: false, deadCertificate: null, nodes: 3, goal: 'win' };
});
const result = winning(game, state, actions, { nodes: 8 });
assert(result.knownWin && result.index === 0 && !result.knownDead); assert.equal(result.nodes, 5);
assert.equal(calls.length, 2); assert.equal(calls[1].settings.nodes, 6);
assert.deepEqual(calls[1].actions, [actions[0]]);
let boundedCalls = 0;
const bounded = guardedSearch(() => { boundedCalls++; return { ...primary }; })(game, state, actions, { nodes: 2 });
assert.equal(boundedCalls, 1); assert(!bounded.knownDead && bounded.boundary); assert.equal(bounded.deadCertificate, null);
const noWitness = guardedSearch((game, state, actions) => actions.length > 1 ? { ...primary }
  : { ...primary, knownDead: false, deadCertificate: null, nodes: 1, knownProgress: 0 });
const unresolved = noWitness(game, state, actions, { nodes: 8 });
assert.equal(unresolved.index, 1); assert(!unresolved.knownDead); assert.equal(unresolved.goal, 'unresolvedHeuristicRootPruning');
let completeCalls = 0;
const complete = guardedSearch(() => { completeCalls++; return { ...primary, knownWin: true, knownDead: false }; })(game, state, actions, { nodes: 8 });
assert(complete.knownWin); assert.equal(completeCalls, 1);
const certified = guardedSearch(() => ({ ...primary, nodes: 1 }))(game, state, actions, { nodes: 8 });
assert(certified.knownDead && certified.deadCertificate);
let unknownCalls = 0;
const unknownState = { ...state, pictures: [1, 1, 2, null] };
const noPossibleWitness = guardedSearch(() => { unknownCalls++; return { ...primary }; })({ ...game, clock: null }, unknownState, actions, { nodes: 8 });
assert.equal(unknownCalls, 1); assert(!noPossibleWitness.knownDead && noPossibleWitness.deadCertificate === null);
assert.equal(noPossibleWitness.reopenAudit.tested, 0);
let coveredCalls = 0;
const covered = guardedSearch(() => {
  coveredCalls++;
  return { ...primary, deadCertificate: { exhaustedKnownGraph: true, allRequestedRoots: actions.map(action => action.index) } };
})({ ...game, clock: null }, unknownState, actions, { nodes: 8 });
assert(covered.knownDead); assert.equal(coveredCalls, 1);
const incomplete = guardedSearch(() => ({ ...primary,
  deadCertificate: { exhaustedKnownGraph: true, allRequestedRoots: [1, 2, 3] } }))(
{ ...game, clock: null }, unknownState, actions, { nodes: 8 });
assert.equal(incomplete.knownDead, false);
assert.throws(() => guardedSearch(null)); assert.throws(() => guardedSearch(() => primary, { oracle: true }));
console.log('PASS reopen guard requires constructive witnesses, shares the node budget, keeps existing wins, and refuses death certificates from unexamined heuristic exclusions');
