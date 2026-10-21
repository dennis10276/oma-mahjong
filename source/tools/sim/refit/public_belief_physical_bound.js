'use strict';
const assert = require('assert/strict');

function physicalBound(result) {
  assert.equal(result.status, 'exact');
  const parents = result.nodes.map(() => new Set()), canWin = result.nodes.map(() => new Set()), queue = [];
  for (const node of result.nodes) {
    for (const action of node.actions) for (const child of action.children) parents[child].add(node.id);
    if (node.public.type === 'productionPhysicalEnd-v1' && node.public.win) for (const worldId of node.worldIds) {
      canWin[node.id].add(worldId); queue.push({ node: node.id, worldId });
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const reachable = queue[cursor];
    for (const parent of parents[reachable.node]) if (!canWin[parent].has(reachable.worldId)) {
      canWin[parent].add(reachable.worldId); queue.push({ node: parent, worldId: reachable.worldId });
    }
  }
  const physicallyClearableWorlds = result.roots.reduce((sum, root) => sum + canWin[root].size, 0);
  assert(physicallyClearableWorlds >= result.winningWorlds);
  return { physicallyClearableWorlds, physicallyUnclearableWorlds: result.totalWorlds - physicallyClearableWorlds,
    humanInformationOptimalWins: result.winningWorlds,
    informationRestrictionCost: physicallyClearableWorlds - result.winningWorlds,
    note: 'Audit-only per-world physical reachability upper bound over the complete supplied graph. Different hidden worlds may choose different actions here; that is explicitly omniscient and never passed to the reference or public-belief policy. Separates physically impossible synthetic deals from the cost of acting without hidden identities. Requires independently grounded complete graph; not a real-level impossibility certificate.' };
}

module.exports = { physicalBound };
