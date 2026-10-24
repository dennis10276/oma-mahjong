'use strict';
const assert = require('assert/strict');
const { legal } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');
const Layouts = require('../../../www/layouts.js');

function createKnownLegalCache(game) {
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock'].includes(key)));
  const rows = values => Array.from(values, row => Array.from(row));
  const base = { tiles: game.tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })),
    nb: Object.fromEntries(['above', 'left', 'right'].map(key => [key, rows(game.nb[key])])),
    rules: game.rules ? { ice: { ...game.rules.ice }, iceNb: rows(game.rules.iceNb),
      locks: game.rules.locks ? new Set(game.rules.locks) : null, keys: Array.from(game.rules.keys || []) } : null,
    clock: game.clock ? { i: game.clock.i, n: game.clock.n } : null };
  const byValue = new Map(), byArray = new WeakMap();
  let hits = 0, misses = 0;
  const query = state => {
    const variant = +!!state.relieved * 2 + +(state.tray.length < Layouts.SLOTS);
    const immutable = Object.isFrozen(state.alive);
    let variants = immutable ? byArray.get(state.alive) : null;
    if (variants?.[variant]) { hits++; return variants[variant]; }
    const signature = aliveSignature(state.alive) + '|' + variant;
    let allowed = byValue.get(signature);
    if (allowed) hits++;
    else {
      misses++;
      const calculated = legal(base, state);
      allowed = Object.freeze({ free: Object.freeze(calculated.free.slice()), relieved: calculated.relieved });
      byValue.set(signature, allowed);
    }
    if (immutable) {
      if (!variants) { variants = []; byArray.set(state.alive, variants); }
      variants[variant] = allowed;
    }
    return allowed;
  };
  return { geometry: { ...base, publicFrontier: query }, stats: () => ({ hits, misses, entries: byValue.size }) };
}

module.exports = { createKnownLegalCache };
