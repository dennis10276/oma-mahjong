'use strict';
const { legal, advance } = require('./known_tray_plan.js');

function analyzeRecovery(game, state, options = {}) {
  const nodeLimit = options.nodes ?? 100000;
  if (!Number.isInteger(nodeLimit) || nodeLimit < 1) throw new Error('Invalid public recovery graph node budget');
  const keyOf = position => position.alive.join('') + '|' + position.tray.slice().sort((left, right) => left - right).join(',')
    + '|' + position.openPeek + '|' + position.moves + '|' + +position.relieved + '|' + (position.arriving || []).join(',');
  const positions = [state], keys = new Map([[keyOf(state), 0]]), edges = [], parents = [[]], terminal = [];
  let boundary = false, uncertainTransitions = 0;
  for (let cursor = 0; cursor < positions.length; cursor++) {
    const position = positions[cursor];
    edges[cursor] = [];
    if (!position.alive.some(Boolean) && !position.tray.length) { terminal.push(cursor); continue; }
    if (position.tray.length >= 4 || game.clock && position.alive[game.clock.i] && position.moves >= game.clock.n) continue;
    for (const index of legal(game, position).free) {
      const moved = advance(game, position, index);
      if (moved.uncertain) { uncertainTransitions++; edges[cursor].push({ index, uncertain: moved.reason }); continue; }
      if (moved.lost) { edges[cursor].push({ index, removed: moved.removed, lost: true }); continue; }
      const key = keyOf(moved.state);
      let target = keys.get(key);
      if (target === undefined) {
        if (positions.length >= nodeLimit) { boundary = true; edges[cursor].push({ index, boundary: true }); continue; }
        target = positions.length;
        keys.set(key, target); positions.push(moved.state); parents.push([]);
      }
      edges[cursor].push({ index, removed: moved.removed, target });
      parents[target].push(cursor);
    }
  }
  const distance = new Map(terminal.map(index => [index, 0])), queue = terminal.slice();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const target = queue[cursor];
    for (const parent of parents[target]) if (!distance.has(parent)) {
      distance.set(parent, distance.get(target) + 1); queue.push(parent);
    }
  }
  const witness = target => {
    const result = [];
    while (distance.get(target) > 0) {
      const edge = edges[target].find(edge => edge.target !== undefined && distance.get(edge.target) === distance.get(target) - 1);
      if (!edge) throw new Error('Public recovery witness lost a verified graph edge');
      result.push(edge.index); target = edge.target;
    }
    return result;
  };
  const firstActions = edges[0].map(edge => ({ ...edge,
    knownWinningRoute: edge.target !== undefined && distance.has(edge.target),
    ...(edge.target !== undefined && distance.has(edge.target) ? { witness: [edge.index, ...witness(edge.target)] } : {}) }));
  return { nodes: positions.length, boundary, uncertainTransitions, complete: !boundary && uncertainTransitions === 0,
    knownWinningRoute: distance.has(0), minimumKnownTaps: distance.get(0) ?? null,
    firstActions, productiveWinningFirstActions: firstActions.filter(action => action.removed > 0 && action.knownWinningRoute).map(action => action.index),
    note: 'Exhaustive finite graph within declared node budget uses only public currently/previously seen pictures. '
      + 'Unseen reveals and automatic Joker twins are unresolved, never replaced by recorded hidden faces. '
      + 'A found route is a constructive witness; absence/uniqueness is proven only when complete is true. '
      + 'Inspection-only detours are distinguished from productive first removals.' };
}

module.exports = { analyzeRecovery };
