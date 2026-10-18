'use strict';
const assert = require('assert/strict');
const { commonPrefix, identity, compareRetries, summarize } = require('./physical_retry_audit.js');
assert.equal(commonPrefix([0, 1, 2], [0, 1, 3]), 2);
assert.equal(commonPrefix([], [0]), 0);
assert.equal(identity({ alive: [1, 0], tray: [2, 1], openPeek: -1 }), identity({ alive: [1, 0], tray: [1, 2], openPeek: -1 }));
const game = { g: { faces: [0, 1, 2, 3], clock: null, rules: { keys: [] } }, availableAt: 5, t: 1,
  ending: 'stuck', stopReason: 'end', actions: [
    { kind: 'take', index: 0, alive: [0, 1, 1, 1], tray: [0], openPeek: -1, moves: 1 },
    { kind: 'take', index: 1, alive: [0, 0, 1, 1], tray: [0, 1, 2, 3], openPeek: -1, moves: 2 }] };
const repeated = compareRetries(game, { ...game, t: 10 });
assert.equal(repeated.sharedOpeningTakes, 2);
assert.equal(repeated.priorTerminalStateRevisited, true);
assert.equal(repeated.priorTerminalActionRepeated, true);
assert.equal(repeated.priorFailure, 'tray');
assert.equal(repeated.previousPrefixAvailableBeforeNextOpening, true);
const changed = compareRetries(game, { ...game, t: 4, actions: [game.actions[0], { ...game.actions[1], index: 2 }] });
assert.equal(changed.priorTerminalStateRevisited, true);
assert.equal(changed.priorTerminalActionRepeated, false);
assert.equal(changed.previousPrefixAvailableBeforeNextOpening, false);
const differentState = compareRetries(game, { ...game, actions: [{ ...game.actions[1], index: 3 }] });
assert.equal(differentState.priorTerminalStateRevisited, false);
assert.equal(differentState.priorTerminalActionRepeated, false);
assert.equal(summarize([repeated, changed, differentState]).terminalStateRevisited, 2);
assert.equal(summarize([repeated, changed, differentState]).terminalActionRepeated, 1);
assert.equal(summarize([]).meanSharedOpeningTakes, null);
console.log('PASS retry diagnostics distinguish route changes, actual state revisits and repeated terminal actions');
