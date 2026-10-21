'use strict';
const assert = require('assert/strict');

function verifyCertificate(result) {
  assert.equal(result.status, 'exact');
  const nodes = result.nodes, worlds = result.worlds;
  const roots = result.roots.flatMap(index => nodes[index].worldIds).sort((left, right) => left - right);
  assert.deepEqual(roots, worlds.map((unused, index) => index));
  let actions = 0, transitions = 0;
  for (const [index, node] of nodes.entries()) {
    assert.equal(node.id, index); assert(node.worldIds.length && new Set(node.worldIds).size === node.worldIds.length);
    assert(node.worldIds.every(world => Number.isInteger(world) && world >= 0 && world < worlds.length));
    assert(Number.isInteger(node.winningWorlds) && node.winningWorlds >= 0 && node.winningWorlds <= node.worldIds.length);
    assert(Number.isInteger(node.rank) && node.rank >= 0);
    if (node.public.type === 'productionPhysicalEnd-v1') {
      assert.equal(node.winningWorlds, node.public.win ? node.worldIds.length : 0);
      assert.equal(node.actions.length, 0); assert.equal(node.policyIndex, null); continue;
    }
    assert.deepEqual(node.actions.map(action => action.index), node.public.legalTiles);
    const selected = node.actions.find(action => action.index === node.policyIndex); assert(selected);
    for (const action of node.actions) {
      assert(action.children.length && new Set(action.children).size === action.children.length);
      const partition = action.children.flatMap(child => nodes[child].worldIds).sort((left, right) => left - right);
      assert.deepEqual(partition, node.worldIds);
      const numerator = action.children.reduce((sum, child) => sum + nodes[child].winningWorlds, 0);
      assert.equal(action.winningWorlds, numerator); assert(numerator <= node.winningWorlds, 'Bellman upper bound violated');
      if (action === selected) {
        assert.equal(numerator, node.winningWorlds, 'Policy fails to attain the claimed value');
        assert(action.children.every(child => nodes[child].rank < node.rank), 'Policy has an unproved recurrent branch');
      }
      actions++; transitions += action.children.length;
    }
  }
  assert.equal(result.winningWorlds, result.roots.reduce((sum, root) => sum + nodes[root].winningWorlds, 0));
  assert.equal(result.totalWorlds, worlds.length);
  return { states: nodes.length, actions, transitions, winningWorlds: result.winningWorlds, totalWorlds: worlds.length,
    proof: 'Rational Bellman upper bound on all actions plus an attaining policy with strictly decreasing rank on every branch. Validates the supplied transition graph independently of its SCC solver; production grounding and observation-contract checks are separate.' };
}

module.exports = { verifyCertificate };
