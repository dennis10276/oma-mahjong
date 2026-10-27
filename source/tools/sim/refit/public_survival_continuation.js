'use strict';
const assert = require('assert/strict');
const { legal, advance, featuresOf } = require('./known_tray_plan.js');
const { createExposureFrontier } = require('./public_exposure_frontier.js');
const { aliveSignature } = require('./public_alive_signature.js');

function analyzeSurvival(game, state, actions, options = {}) {
  const began = Date.now(), nodeLimit = options.nodes ?? 2048, milliseconds = options.milliseconds ?? 150;
  const deadline = Math.min(options.deadline ?? Infinity, began + milliseconds);
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  assert(Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 500);
  assert(Number.isFinite(deadline));
  assert(Object.keys(game).every(key => ['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure',
    'publicRoleExposure', 'publicInformationExposure'].includes(key)));
  assert(state.alive.length === game.tiles.length && state.pictures.length === state.alive.length
    && state.down.length === state.alive.length && Array.isArray(state.tray));
  featuresOf(game.publicFrontier ? game : { ...game, publicFrontier: position => legal(game, position) },
    state, [], { taps: 1, nodes: 1, progress: 1 });
  assert(state.tray.length < 4 && (!game.clock || !state.alive[game.clock.i] || state.moves < game.clock.n),
    'Analyze active positions only; a terminal physical loss cannot be continued');
  const allowed = legal(game, state).free, requested = new Set(actions.map(action => action.index));
  assert(requested.size === actions.length && [...requested].every(index => allowed.includes(index)));
  const completeRootCoverage = allowed.every(index => requested.has(index));
  const depthFirst = options.depthFirst ?? false, rootPriority = options.rootPriority ?? actions.map(action => action.index);
  assert.equal(typeof depthFirst, 'boolean');
  assert(Array.isArray(rootPriority) && new Set(rootPriority).size === rootPriority.length
    && rootPriority.every(index => requested.has(index)));
  const order = new Map([...new Set([...rootPriority, ...requested])].map((index, rank) => [index, rank]));
  const pictureExposure = createExposureFrontier(game.tiles, state, 'all');
  const exposed = game.publicInformationExposure ?? (position => [...new Set([...pictureExposure(position),
    ...(game.publicExposure?.(position) ?? []), ...(game.publicRoleExposure?.(position) ?? [])])]);
  const identity = position => aliveSignature(position.alive) + '|' + JSON.stringify([position.tray,
    position.openPeek, !!position.relieved, position.arriving ?? [], position.moves]);
  const graph = [{ state, edges: [], parents: [], parent: null, via: null, boundary: false, expanded: false }];
  const identities = new Map(completeRootCoverage ? [[identity(state), 0]] : []);
  let transitions = 0, boundaryCount = 0, firstWin = !state.alive.some(Boolean) && !state.tray.length ? [] : null, rootExpanded = false;
  const pathTo = node => {
    const path = [];
    while (graph[node].parent !== null) { path.push(graph[node].via); node = graph[node].parent; }
    return path.reverse();
  };
  const pending = [0]; let breadthCursor = 0;
  while (depthFirst ? pending.length : breadthCursor < graph.length) {
    if (Date.now() >= deadline) break;
    const cursor = depthFirst ? pending.pop() : breadthCursor++;
    const node = graph[cursor], position = node.state;
    if (!position.alive.some(Boolean) && !position.tray.length) { node.win = true; node.expanded = true; continue; }
    if (cursor && exposed(position).length) { node.boundary = true; node.expanded = true; boundaryCount++; continue; }
    const candidates = legal(game, position).free.filter(index => cursor || requested.has(index));
    if (!cursor) candidates.sort((left, right) => order.get(left) - order.get(right));
    const discovered = [];
    for (const index of candidates) {
      if (Date.now() >= deadline) break;
      const moved = advance(game, position, index); transitions++;
      if (moved.uncertain) {
        node.edges.push({ index, boundary: true, reason: moved.reason }); boundaryCount++; continue;
      }
      if (moved.lost) { node.edges.push({ index, lost: true }); continue; }
      if (moved.win && firstWin === null) firstWin = pathTo(cursor).concat(index);
      const signature = identity(moved.state);
      let target = identities.get(signature);
      if (target === undefined) {
        if (graph.length >= nodeLimit) {
          node.edges.push({ index, boundary: true, reason: 'node_limit' }); boundaryCount++; continue;
        }
        target = graph.length; identities.set(signature, target);
        graph.push({ state: moved.state, edges: [], parents: [], parent: cursor, via: index,
          boundary: false, expanded: false, win: !!moved.win });
        discovered.push(target);
      }
      node.edges.push({ index, target }); graph[target].parents.push(cursor);
    }
    node.expanded = node.edges.length === candidates.length;
    if (!cursor) rootExpanded = node.expanded;
    if (depthFirst) for (let offset = discovered.length - 1; offset >= 0; offset--) pending.push(discovered[offset]);
  }
  const possible = new Set(), queue = [];
  for (let index = 0; index < graph.length; index++) {
    const node = graph[index];
    if (node.win || node.boundary || !node.expanded || node.edges.some(edge => edge.boundary)) {
      possible.add(index); queue.push(index);
    }
  }
  let propagated = true;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (Date.now() >= deadline) { propagated = false; break; }
    for (const parent of graph[queue[cursor]].parents) if (!possible.has(parent)) { possible.add(parent); queue.push(parent); }
  }
  const rootStatuses = actions.map(action => {
    const edge = graph[0].edges.find(candidate => candidate.index === action.index);
    if (!edge) return { index: action.index, status: 'unresolved', reason: 'unexpanded_root' };
    if (edge.lost) return { index: action.index, status: 'rejected', reason: 'immediate_physical_loss' };
    if (edge.boundary) return { index: action.index, status: 'unresolved', reason: edge.reason };
    if (!propagated) return { index: action.index, status: 'unresolved', reason: 'propagation_deadline' };
    return { index: action.index, status: possible.has(edge.target) ? 'possible' : 'rejected',
      reason: possible.has(edge.target) ? 'winning_information_or_unfinished_continuation' : 'exhausted_closed_known_component' };
  });
  const discardedRoots = propagated ? rootStatuses.filter(root => root.status === 'rejected').map(root => root.index) : [];
  const forcedPath = [], forcedSteps = [];
  let position = 0;
  if (propagated && completeRootCoverage && rootExpanded) {
    const visited = new Set();
    while (!visited.has(position) && Date.now() < deadline) {
      visited.add(position);
      const node = graph[position];
      if (!node.expanded || node.boundary || node.win) break;
      const viable = node.edges.filter(edge => !edge.lost && (edge.boundary || possible.has(edge.target)));
      if (viable.length !== 1) break;
      const only = viable[0];
      forcedPath.push(only.index);
      forcedSteps.push({ index: only.index, rejectedAlternatives: node.edges.filter(edge => edge !== only).map(edge => edge.index),
        survivingBoundary: only.boundary ? only.reason : null });
      if (only.boundary) break;
      position = only.target;
    }
  }
  return { forcedPath, forcedSteps, discardedRoots, rootStatuses,
    necessaryIfSolvable: forcedPath.length > 0, knownWin: firstWin !== null, winningPath: firstWin,
    knownDead: propagated && completeRootCoverage && rootExpanded && !possible.has(0),
    completeRootCoverage, propagationComplete: propagated, nodes: graph.length, transitions,
    boundary: boundaryCount > 0 || graph.some(node => !node.expanded),
    closedDeadStates: propagated ? graph.length - possible.size : 0,
    elapsedMs: Date.now() - began, searchOrder: depthFirst ? 'branch_depth_first' : 'breadth_first',
    reason: !propagated ? 'propagation_deadline' : !rootExpanded ? 'root_deadline' : 'public_survival_graph',
    proof: { allRejectedRootsExhausted: propagated, unknownsRemainPossible: true,
      unfinishedStatesRemainPossible: true, survivingRouteMayBeUnresolved: !firstWin,
      noImaginedPictures: true, necessityIsConditionalOnSolvability: true } };
}

module.exports = { analyzeSurvival };
