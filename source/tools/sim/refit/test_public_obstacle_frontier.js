'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createObstacleFrontier } = require('./public_obstacle_frontier.js');

function test() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 2, z: 0 },
    { x: 6, y: 0, z: 0 }, { x: 6, y: 2, z: 0 }, { x: 10, y: 0, z: 0 }];
  const neighbors = Layouts.neighbors(tiles), iceNb = Layouts.iceNeighbors(tiles), initial = tiles.map(() => 1);
  const unknown = { roles: ['none', 'ice', 'ice2', 'lock', 'key'], knownRole: null };
  const row = (index, role) => ({ index, observation: role === null ? unknown : { roles: [role], knownRole: role } });
  let controls = 0;
  for (const hits of [0, 1, 2]) for (const locked of [false, true]) for (const obscured of [false, true]) {
    const rules = { ice: hits ? { 0: hits } : {}, iceNb, locks: new Set(locked ? [0, 3] : []), keys: [4, 5] };
    const displayed = (index, alive) => {
      const left = (rules.ice[index] || 0) - iceNb[index].filter(neighbor => !alive[neighbor]).length;
      if (left > 0) return left > 1 ? 'ice2' : 'ice';
      const active = rules.keys.some(key => alive[key]);
      if (active && rules.locks.has(index)) return 'lock';
      if (active && rules.keys.includes(index)) return 'key';
      return 'none';
    };
    const policyGeometry = tiles.map(tile => {
      const copy = { ...tile }; Object.defineProperty(copy, 'face', { get() { throw Error('Frontier read a private picture'); } }); return copy;
    });
    const frontier = createObstacleFrontier(policyGeometry);
    frontier.observe({ alive: initial, physicalTaps: 0 }, tiles.map((tile, index) => row(index, obscured && index % 2 === 0 ? null : displayed(index, initial))));
    for (let mask = 0; mask < 64; mask++) {
      const alive = tiles.map((tile, index) => +(!!(mask & (1 << index)))), predicted = frontier.query(alive);
      for (const index of predicted.free) { assert.equal(Layouts.takeable(index, alive, neighbors, rules, initial), true); controls++; }
      for (const index of predicted.blocked) { assert.equal(Layouts.takeable(index, alive, neighbors, rules, initial), false); controls++; }
    }
  }
  const frontier = createObstacleFrontier(tiles);
  frontier.observe({ alive: initial, physicalTaps: 0 }, tiles.map((tile, index) => row(index, index === 0 ? 'ice2' : null)));
  const thawed = [1, 0, 0, 1, 1, 1]; assert(frontier.query(thawed).uncertain.includes(0));
  assert(!frontier.query(thawed).free.includes(0), 'A thawed ice overlay can hide a still-active lock');
  frontier.observe({ alive: thawed, physicalTaps: 2 }, [row(0, 'lock')]); assert(frontier.query(thawed).blocked.includes(0));
  const unlocked = [1, 0, 0, 1, 0, 0]; frontier.observe({ alive: unlocked, physicalTaps: 4 }, [row(0, 'none')]);
  assert(frontier.query(unlocked).free.includes(0));
  frontier.observe({ alive: unlocked, physicalTaps: 5 }, [row(0, null)]); assert(frontier.query(unlocked).free.includes(0));
  assert.throws(() => frontier.observe({ alive: initial, physicalTaps: 6 }, []), /restart/);
  assert.throws(() => frontier.observe({ alive: unlocked, physicalTaps: 5 }, []), /monotone/);
  assert.throws(() => frontier.observe({ alive: unlocked, physicalTaps: 6 }, [row(0, 'ice')]), /contradict/);
  assert.throws(() => createObstacleFrontier(tiles).observe({ alive: initial, physicalTaps: 0, rules: null }, []));
  console.log('PASS public obstacle frontier: ' + controls + ' production-rule controls; unknown roles stay uncertain, thawed ice can hide locks, remembered safety survives occlusion, and attempt restarts/private pictures are refused');
}

if (require.main === module) test();
module.exports = test;
