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

function candidatePaths(problem) {
  assert(Object.keys(problem).every(key => ['rememberedPictures', 'actions', 'fallbackIndex', 'unseenFraction', 'actionPaths'].includes(key)));
  const { actions, actionPaths, rememberedPictures } = problem;
  assert(actions.length > 1 && new Set(actions).size === actions.length && actions.includes(problem.fallbackIndex));
  assert(actions.every(index => Number.isInteger(index) && index >= 0));
  assert(actionPaths === undefined || Array.isArray(actionPaths) && actionPaths.length === actions.length);
  return new Map(actions.map((identifier, offset) => {
    const path = actionPaths === undefined ? [identifier] : actionPaths[offset];
    assert(Array.isArray(path) && path.length >= 1 && path.length <= 2);
    assert(path.every(index => Number.isInteger(index) && index >= 0 && index < rememberedPictures.length));
    return [identifier, path.slice()];
  }));
}

module.exports = { informationActions, candidatePaths };
