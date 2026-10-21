'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSessionFactory } = require('./production_physical_session.js');

class CalculationLimit extends Error {}

function inventoryWorlds(problem, maximum) {
  assert(Object.keys(problem).every(key => ['tiles', 'down', 'clock', 'belief', 'openingPictures'].includes(key)), 'Accept an explicitly public synthetic problem, never a private game');
  const size = problem.tiles.length;
  assert(size > 0 && size <= 10 && problem.down.length === size && problem.down.every(value => value === 0 || value === 1));
  assert(problem.tiles.every(tile => ['x', 'y', 'z'].every(key => Number.isFinite(tile[key]))));
  for (let first = 0; first < size; first++) for (let second = 0; second < first; second++) {
    const left = problem.tiles[first], right = problem.tiles[second];
    assert(left.x === right.x && left.y === right.y && left.z !== right.z
      || Math.abs(left.x - right.x) >= 4 || Math.abs(left.y - right.y) >= 4,
    'Exact observation contract supports separated columns and completely aligned stacks, not arbitrary exposed-edge geometry');
  }
  assert.equal(problem.belief.kind, 'declared-public-inventory-uniform-v1');
  assert(Object.keys(problem.belief).every(key => ['kind', 'inventory'].includes(key)));
  const inventory = problem.belief.inventory;
  assert(inventory.length === size && inventory.every(picture => Number.isInteger(picture) && picture >= 0 && picture < 36),
    'Jokers and time-dependent arrivals require a different state-sufficiency proof');
  const opening = problem.openingPictures || Array(size).fill(null), neighbors = Layouts.neighbors(problem.tiles);
  assert(opening.length === size);
  for (let index = 0; index < size; index++) if (opening[index] !== null) {
    assert(!problem.down[index] && !neighbors.above[index].length, 'An opening constraint must be an initially visible picture');
    assert(Number.isInteger(opening[index]) && opening[index] >= 0 && opening[index] < 36);
  }
  const counts = new Map(); for (const picture of inventory) counts.set(picture, (counts.get(picture) || 0) + 1);
  const worlds = [], prefix = [];
  const visit = () => {
    if (prefix.length === size) {
      if (worlds.length >= maximum) throw new CalculationLimit('hypothesisBudget');
      worlds.push(prefix.slice()); return;
    }
    for (const picture of [...counts.keys()].sort((left, right) => left - right)) {
      if (!counts.get(picture) || opening[prefix.length] !== null && opening[prefix.length] !== picture) continue;
      counts.set(picture, counts.get(picture) - 1); prefix.push(picture); visit(); prefix.pop(); counts.set(picture, counts.get(picture) + 1);
    }
  };
  visit(); assert(worlds.length, 'Public opening has zero mass under the declared inventory'); return worlds;
}

function observationOf(problem, faces, frame, remembered) {
  const memory = remembered.slice(), neighbors = Layouts.neighbors(problem.tiles);
  for (let index = 0; index < faces.length; index++) if (frame.state.alive[index]
    && (frame.state.openPeek === index || !frame.state.down[index] && !neighbors.above[index].some(above => frame.state.alive[above]))) memory[index] = faces[index];
  const { physicalTaps, observationTime, ...physical } = frame.state;
  const pictures = memory.map((picture, index) => physical.alive[index] ? picture : null);
  const state = { ...physical, pictures, down: physical.down.map((value, index) => pictures[index] !== null || frame.legalTiles.includes(index) ? value : 0) };
  return { type: frame.type, state, memory, legalTiles: frame.legalTiles.slice(),
    ...(frame.type === 'productionPhysicalEnd-v1' ? { win: frame.win, why: frame.why } : {}) };
}

function componentsOf(nodes) {
  let ordinal = 0;
  const order = new Map(), low = new Map(), active = new Set(), stack = [], components = [];
  const visit = index => {
    order.set(index, ordinal); low.set(index, ordinal++); active.add(index); stack.push(index);
    for (const child of nodes[index].actions.flatMap(action => action.children)) {
      if (!order.has(child)) { visit(child); low.set(index, Math.min(low.get(index), low.get(child))); }
      else if (active.has(child)) low.set(index, Math.min(low.get(index), order.get(child)));
    }
    if (low.get(index) === order.get(index)) {
      const members = []; let child;
      do { child = stack.pop(); active.delete(child); members.push(child); } while (child !== index);
      components.push(members);
    }
  };
  for (let index = 0; index < nodes.length; index++) if (!order.has(index)) visit(index);
  return components;
}

function certify(nodes) {
  const components = componentsOf(nodes), owner = new Map(), done = new Set();
  components.forEach((members, component) => members.forEach(index => owner.set(index, component)));
  const solve = component => {
    if (done.has(component)) return;
    const members = components[component], terminal = members.filter(index => nodes[index].public.type === 'productionPhysicalEnd-v1');
    if (terminal.length) {
      assert.equal(members.length, 1);
      const node = nodes[members[0]]; node.winningWorlds = node.public.win ? node.worldIds.length : 0;
      node.rank = 0; node.componentHeight = 0; node.policyIndex = null; done.add(component); return;
    }
    const exits = [], internal = new Map(members.map(index => [index, []])); let height = 1;
    for (const index of members) for (const action of nodes[index].actions) {
      if (action.children.some(child => owner.get(child) === component)) {
        assert.equal(action.children.length, 1); assert.deepEqual(nodes[action.children[0]].worldIds, nodes[index].worldIds);
        internal.get(action.children[0]).push({ from: index, index: action.index });
      } else {
        for (const child of action.children) { solve(owner.get(child)); height = Math.max(height, nodes[child].componentHeight + 1); }
        const wins = action.children.reduce((sum, child) => sum + nodes[child].winningWorlds, 0);
        exits.push({ from: index, index: action.index, wins });
      }
    }
    const winningWorlds = exits.length ? Math.max(...exits.map(exit => exit.wins)) : 0;
    const distance = new Map(), policy = new Map(), queue = [];
    for (const exit of exits.filter(exit => exit.wins === winningWorlds).sort((left, right) => left.index - right.index)) {
      if (distance.has(exit.from)) continue;
      distance.set(exit.from, 0); policy.set(exit.from, exit.index); queue.push(exit.from);
    }
    for (let cursor = 0; cursor < queue.length; cursor++) for (const edge of internal.get(queue[cursor])) if (!distance.has(edge.from)) {
      distance.set(edge.from, distance.get(queue[cursor]) + 1); policy.set(edge.from, edge.index); queue.push(edge.from);
    }
    assert.equal(distance.size, members.length, 'A nonterminal production component must have an exit; do not silently certify a recurrent policy');
    for (const index of members) {
      const node = nodes[index]; node.winningWorlds = winningWorlds; node.componentHeight = height;
      node.rank = height * (nodes.length + 1) + distance.get(index); node.policyIndex = policy.get(index);
    }
    done.add(component);
  };
  for (let component = 0; component < components.length; component++) solve(component);
  for (const node of nodes) for (const action of node.actions) action.winningWorlds = action.children.reduce((sum, child) => sum + nodes[child].winningWorlds, 0);
  return { components: components.length, inspectionCycleComponents: components.filter(members => members.length > 1).length };
}

function solvePublicBelief(problem, options = {}) {
  assert(Object.keys(options).every(key => ['maximumWorlds', 'maximumNodes', 'maximumSimulatedTaps', 'seed'].includes(key)));
  const settings = { maximumWorlds: 512, maximumNodes: 10000, maximumSimulatedTaps: 2000000, seed: 73, ...options };
  assert(Object.values(settings).every(value => Number.isInteger(value) && value > 0));
  const nodes = [], roots = [], stats = { productionSessions: 0, simulatedPhysicalTaps: 0, graphTransitions: 0 };
  let construct = null;
  try {
    const worlds = inventoryWorlds(problem, settings.maximumWorlds), byKey = new Map();
    construct = createSessionFactory();
    const run = (worldId, history) => {
      const session = construct({ tiles: problem.tiles, nb: Layouts.neighbors(problem.tiles), faces: worlds[worldId],
        down: problem.down, clock: problem.clock || null, rules: null }, { seed: settings.seed, choiceLimit: 4096, tapMs: 1000 });
      stats.productionSessions++;
      let observed = observationOf(problem, worlds[worldId], session.view(), Array(problem.tiles.length).fill(null));
      for (const index of history) {
        if (++stats.simulatedPhysicalTaps > settings.maximumSimulatedTaps) throw new CalculationLimit('productionReplayBudget');
        const frame = session.tap(index);
        if (frame.computationCensored) throw new CalculationLimit('productionChoiceLimit');
        observed = observationOf(problem, worlds[worldId], frame, observed.memory);
      }
      return observed;
    };
    const groupsOf = records => {
      const groups = new Map();
      for (const record of records) {
        const signature = JSON.stringify(record.observed);
        if (!groups.has(signature)) groups.set(signature, []); groups.get(signature).push(record);
      }
      return [...groups.values()];
    };
    const intern = records => {
      records.sort((left, right) => left.worldId - right.worldId);
      const worldIds = records.map(record => record.worldId), key = JSON.stringify([records[0].observed, worldIds]);
      if (byKey.has(key)) return byKey.get(key);
      if (nodes.length >= settings.maximumNodes) throw new CalculationLimit('beliefGraphBudget');
      const index = nodes.length; byKey.set(key, index);
      nodes.push({ id: index, public: records[0].observed, worldIds,
        representatives: records.map(record => ({ worldId: record.worldId, history: record.history })), actions: [] }); return index;
    };
    for (const group of groupsOf(worlds.map((faces, worldId) => ({ worldId, history: [], observed: run(worldId, []) })))) roots.push(intern(group));
    for (let cursor = 0; cursor < nodes.length; cursor++) {
      const node = nodes[cursor];
      if (node.public.type === 'productionPhysicalEnd-v1') continue;
      for (const index of node.public.legalTiles) {
        const groups = groupsOf(node.representatives.map(record => {
          const history = record.history.concat(index); return { worldId: record.worldId, history, observed: run(record.worldId, history) };
        }));
        node.actions.push({ index, children: groups.map(intern) }); stats.graphTransitions++;
      }
    }
    construct.verifySource(); const certificate = certify(nodes);
    return { status: 'exact', targetMet: false, settings, stats, problem, worlds, roots, nodes, ...certificate,
      winningWorlds: roots.reduce((sum, root) => sum + nodes[root].winningWorlds, 0), totalWorlds: worlds.length,
      note: 'Exact finite synthetic public-belief reachability, not an omniscient route or a real-level inventory claim. Every branch is a production replay of an independently declared hypothetical deal. Completely aligned stacks/separated columns, perfect observed-picture recall, fixed1000ms taps, no Jokers/variable arrival timing/obstacles. Ordinary public arrival flags are retained. Inspection cycles are solved, not cut into losses. The serialized rational Bellman upper bound and decreasing-rank attaining policy can be checked independently. Not universal reference optimality, screenshot validation or personal forecast accuracy.' };
  } catch (error) {
    if (construct) construct.verifySource();
    if (!(error instanceof CalculationLimit)) throw error;
    return { status: 'unresolved', targetMet: false, settings, stats, problem, reason: error.message,
      exploredNodes: nodes.length, winningWorlds: null, totalWorlds: null };
  }
}

module.exports = { inventoryWorlds, observationOf, solvePublicBelief };
