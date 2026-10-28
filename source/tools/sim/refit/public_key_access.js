'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { goalRoutes } = require('./public_goal_routes.js');
const { aliveSignature } = require('./public_alive_signature.js');

function keyAccessPath(game, state, firstIndex, tapLimit, nodeLimit = 64, deadline = Infinity, trayCeiling = 3, shortestKnown = false) {
  assert(Number.isInteger(tapLimit) && tapLimit >= 1 && tapLimit <= 96);
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  assert(deadline === Infinity || Number.isFinite(deadline));
  assert(Number.isInteger(trayCeiling) && trayCeiling >= 0 && trayCeiling <= 3);
  assert.equal(typeof shortestKnown,'boolean');
  const keys = game.rules?.keys;
  const report = (nodes, boundary, selected = null) => ({ nodes, boundary,
    path: selected?.path ?? null, state: selected?.state ?? null,
    removed: selected ? state.alive.reduce((sum, alive, index) => sum + +(alive && !selected.state.alive[index]), 0) : 0 });
  if (!Array.isArray(keys) || keys.length !== 2 || new Set(keys).size !== 2 || !keys.some(index => state.alive[index])
    || Date.now() >= deadline) return report(0, Date.now() >= deadline);
  const initialDependencies = new Set(keys.filter(index => state.alive[index]).flatMap(target => [...goalRoutes(game, state, target).frontier]));
  const initialPictures = new Set([...initialDependencies].map(index => state.pictures[index]).filter(picture => picture !== null));
  if (!initialDependencies.has(firstIndex) && !initialPictures.has(state.pictures[firstIndex])) return report(0, false);
  const root = advance(game, state, firstIndex);
  if (root.uncertain || root.lost || root.state.tray.length > trayCeiling) return report(0, false);
  const identity = position => aliveSignature(position.alive) + '|' + position.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + position.openPeek + '|' + +!!position.relieved + '|' + (game.clock && position.alive[game.clock.i] ? position.moves : '-');
  const queue = [{ state: root.state, path: [firstIndex] }], seen = new Map([[identity(root.state), 1]]);
  let nodes = 0, boundary = false;
  const remaining = position => keys.filter(index => position.alive[index]);
  const rank = node => shortestKnown ? [node.path.length,node.state.tray.length,remaining(node.state).length]
    : [remaining(node.state).length,node.state.tray.length,node.path.length];
  while (queue.length) {
    if (nodes >= nodeLimit || Date.now() >= deadline) return report(nodes, true);
    queue.sort((left, right) => {
      const leftRank = rank(left), rightRank = rank(right);
      for (let part = 0; part < leftRank.length; part++) if (leftRank[part] !== rightRank[part]) return leftRank[part] - rightRank[part];
      return 0;
    });
    const node = queue.shift();
    nodes++;
    if (!remaining(node.state).length && node.state.tray.length <= state.tray.length && node.path.length > 1) return report(nodes, boundary, node);
    if (node.path.length >= tapLimit) { boundary = true; continue; }
    const dependencies = new Set(remaining(node.state).flatMap(target => [...goalRoutes(game, node.state, target).frontier]));
    const relevantPictures = new Set([...dependencies].map(index => node.state.pictures[index]).filter(picture => picture !== null));
    const allowed = legal(game, node.state);
    const candidates = allowed.free.filter(index => !allowed.uncertain?.includes(index) && node.state.pictures[index] !== null
      && (dependencies.has(index) || relevantPictures.has(node.state.pictures[index]) || node.state.tray.includes(node.state.pictures[index])));
    for (const index of candidates) {
      if (Date.now() >= deadline) return report(nodes, true);
      const moved = advance(game, node.state, index);
      if (moved.uncertain || moved.lost || moved.state.tray.length > trayCeiling) continue;
      const paths = [{ state: moved.state, path: node.path.concat(index) }];
      if (node.path.length + 1 < tapLimit) {
        const partners = legal(game, moved.state);
        for (const mate of partners.free) {
          if (Date.now() >= deadline) return report(nodes, true);
          if (mate === index || partners.uncertain?.includes(mate) || moved.state.pictures[mate] !== moved.state.pictures[index]) continue;
          const paired = advance(game, moved.state, mate);
          if (!paired.uncertain && !paired.lost && moved.removed + paired.removed === 2)
            paths.push({ state: paired.state, path: node.path.concat(index, mate) });
        }
      }
      for (const next of paths) {
        const signature = identity(next.state), previous = seen.get(signature);
        if (previous !== undefined && previous <= next.path.length) continue;
        seen.set(signature, next.path.length); queue.push(next);
      }
    }
  }
  return report(nodes, boundary);
}

module.exports = { keyAccessPath };
