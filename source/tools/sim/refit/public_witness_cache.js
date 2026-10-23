'use strict';
const assert = require('assert/strict'), crypto = require('crypto');
const { search, PARAMETERS } = require('./public_witness_search.js');
const { featuresOf } = require('./known_tray_plan.js');

function contextDependent(game, options) {
  return !!game.publicFrontier || game.publicExposure !== undefined
    || options.deadline !== undefined || options.decisionMs !== undefined;
}

function keyOf(game, state, actions, options) {
  assert(!contextDependent(game, options), 'Observation callbacks and live timing budgets cannot have a reusable witness cache key');
  featuresOf(game, state, [], { taps: 1, nodes: 1, progress: 1 });
  const publicGame = { tiles: game.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })),
    nb: { above: game.nb.above, left: game.nb.left, right: game.nb.right },
    clock: game.clock ? { i: game.clock.i, n: game.clock.n } : null,
    rules: game.rules ? { ice: game.rules.ice, iceNb: game.rules.iceNb,
      locks: game.rules.locks ? [...game.rules.locks].sort((left, right) => left - right) : null, keys: game.rules.keys } : null };
  const publicState = { alive: state.alive, pictures: state.pictures, down: state.down, tray: state.tray,
    moves: state.moves, openPeek: state.openPeek, relieved: state.relieved, arriving: state.arriving };
  const settings = { ...PARAMETERS, ...options };
  const bytes = JSON.stringify([publicGame, publicState, actions.map(action => ({ index: action.index, inspect: action.inspect })),
    Object.keys(settings).sort().map(name => [name, settings[name]])], (name, value) => {
    assert(typeof value !== 'function' && typeof value !== 'symbol', 'Opaque witness cache input');
    if (typeof value === 'number') assert(Number.isFinite(value), 'Invalid numeric witness cache input');
    return value;
  });
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function cachedSearch(capacity = 4096) {
  assert(Number.isInteger(capacity) && capacity > 0);
  const entries = new Map(), stats = { calls: 0, hits: 0, misses: 0, evictions: 0, bypasses: 0 };
  const choose = (game, state, actions, options = PARAMETERS) => {
    if (contextDependent(game, options)) {
      stats.calls++; stats.misses++; stats.bypasses++;
      return search(game, state, actions, options);
    }
    const identity = keyOf(game, state, actions, options); stats.calls++;
    if (entries.has(identity)) { stats.hits++; return structuredClone(entries.get(identity)); }
    stats.misses++;
    const report = search(game, state, actions, options);
    if (entries.size >= capacity) { entries.delete(entries.keys().next().value); stats.evictions++; }
    entries.set(identity, structuredClone(report)); return report;
  };
  choose.stats = () => ({ ...stats, entries: entries.size, capacity });
  return choose;
}

module.exports = { keyOf, cachedSearch };
