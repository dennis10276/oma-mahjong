'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createSessionFactory } = require('./production_physical_session.js');

function verifyGrounding(result) {
  assert.equal(result.status, 'exact');
  const problem = result.problem, neighbors = Layouts.neighbors(problem.tiles);
  const construct = createSessionFactory();
  let replays = 0, taps = 0, branches = 0;
  const inspect = (worldId, history) => {
    const faces = result.worlds[worldId], session = construct({ tiles: problem.tiles, nb: neighbors,
      faces, down: problem.down, rules: null, clock: problem.clock || null }, { seed: result.settings.seed, choiceLimit: 4096, tapMs: 1000 });
    const remembered = Array(faces.length).fill(null);
    const observe = frame => {
      for (let index = 0; index < faces.length; index++) {
        const covered = problem.tiles.some((tile, above) => frame.state.alive[above] && tile.x === problem.tiles[index].x
          && tile.y === problem.tiles[index].y && tile.z > problem.tiles[index].z);
        if (frame.state.alive[index] && (frame.state.openPeek === index || !frame.state.down[index] && !covered)) remembered[index] = faces[index];
      }
      const state = Object.fromEntries(Object.entries(frame.state).filter(([key]) => !['physicalTaps', 'observationTime'].includes(key)));
      state.pictures = remembered.map((picture, index) => state.alive[index] ? picture : null);
      state.down = state.down.map((value, index) => state.pictures[index] !== null || frame.legalTiles.includes(index) ? value : 0);
      return { type: frame.type, state, memory: remembered.slice(), legalTiles: frame.legalTiles.slice(),
        ...(frame.type === 'productionPhysicalEnd-v1' ? { win: frame.win, why: frame.why } : {}) };
    };
    let observed = observe(session.view()); replays++;
    for (const index of history) { observed = observe(session.tap(index)); taps++; }
    return observed;
  };
  for (const node of result.nodes) {
    assert.deepEqual(node.representatives.map(record => record.worldId), node.worldIds);
    for (const record of node.representatives) {
      assert.deepEqual(inspect(record.worldId, record.history), node.public);
      for (const action of node.actions) {
        const children = action.children.filter(child => result.nodes[child].worldIds.includes(record.worldId)); assert.equal(children.length, 1);
        assert.deepEqual(inspect(record.worldId, record.history.concat(action.index)), result.nodes[children[0]].public); branches++;
      }
    }
  }
  construct.verifySource();
  return { productionReplays: replays, productionTaps: taps, groundedWorldActionBranches: branches,
    note: 'Every representative history and every legal world/action branch replayed through production createSession. Observation independently reconstructed using fully aligned public geometry and observed-only memory. No shared solver observation function or SCC/value algorithm.' };
}

module.exports = { verifyGrounding };
