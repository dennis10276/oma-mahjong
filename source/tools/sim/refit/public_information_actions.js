'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');

function informationActions(game, state, roots) {
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure'].includes(key)));
  assert(Array.isArray(roots) && new Set(roots).size === roots.length);
  assert(roots.every(index => Number.isInteger(index) && legal(game, state).free.includes(index)));
  const options = [];
  const append = (path, kind) => options.push({ id: options.length, index: path[0], path, kind });
  for (const index of roots) {
    const first = advance(game, state, index);
    if (first.uncertain || first.lost || first.removed > 0 || first.win) {
      append([index], first.uncertain ? 'information' : 'physical'); continue;
    }
    const before = options.length;
    for (const target of legal(game, first.state).free) {
      const second = advance(game, first.state, target);
      if (second.uncertain || !second.lost && (second.removed > 0 || second.win)) {
        append([index, target], second.uncertain ? 'knownPeekThenInformation' : 'knownPeekThenProgress');
      }
    }
    if (before === options.length) append([index], 'unresolvedPeek');
  }
  return options;
}

module.exports = { informationActions };
