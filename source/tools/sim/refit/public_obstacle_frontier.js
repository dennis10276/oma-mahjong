'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');

function createObstacleFrontier(tiles) {
  const geometry = tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z }));
  const neighbors = Layouts.neighbors(geometry), iceNeighbors = Layouts.iceNeighbors(geometry);
  const roles = ['none', 'ice', 'ice2', 'lock', 'key'], records = geometry.map(() => null);
  let previous = null;
  const validateAlive = alive => assert(Array.isArray(alive) && alive.length === geometry.length && alive.every(value => value === 0 || value === 1));
  return {
    observe(frame, rows) {
      assert.deepEqual(Object.keys(frame).sort(), ['alive', 'physicalTaps']); validateAlive(frame.alive);
      assert(Number.isInteger(frame.physicalTaps) && frame.physicalTaps >= 0);
      if (previous) {
        assert(frame.physicalTaps > previous.physicalTaps, 'Obstacle memory is confined to one monotone attempt');
        assert(frame.alive.every((value, index) => !value || previous.alive[index]), 'Obstacle memory cannot cross a restart');
      }
      assert(Array.isArray(rows) && new Set(rows.map(row => row.index)).size === rows.length);
      const next = structuredClone(records);
      for (const row of rows) {
        assert(Number.isInteger(row.index) && frame.alive[row.index]);
        const observation = row.observation;
        assert(Array.isArray(observation.roles) && observation.roles.length && new Set(observation.roles).size === observation.roles.length
          && observation.roles.every(role => roles.includes(role)));
        assert.equal(observation.knownRole, observation.roles.length === 1 ? observation.roles[0] : null);
        const role = observation.knownRole;
        if (role === null) continue;
        const retained = next[row.index];
        assert(!(retained && ['none', 'key'].includes(retained.role)) || ['none', 'key'].includes(role), 'Monotone obstacle observations contradict earlier mechanical safety');
        next[row.index] = { role, physicalTaps: frame.physicalTaps, alive: frame.alive.slice() };
      }
      next.forEach((record, index) => { records[index] = record; });
      previous = structuredClone(frame);
      return this.query(frame.alive);
    },
    query(alive) {
      assert(previous, 'Observe public roles before querying an obstacle frontier'); validateAlive(alive);
      assert(alive.every((value, index) => !value || previous.alive[index]), 'Hypothetical states cannot return removed tiles');
      const knownKeys = records.flatMap((record, index) => record?.role === 'key' ? [index] : []);
      const free = [], blocked = [], uncertain = [], reasons = [];
      for (const [index, present] of alive.entries()) {
        if (!present) continue;
        const record = records[index]; let status, reason;
        if (!Layouts.isFree(index, alive, neighbors)) { status = 'blocked'; reason = 'geometry'; }
        else if (record && ['none', 'key'].includes(record.role)) { status = 'free'; reason = 'observedMonotoneSafety'; }
        else if (record?.role.startsWith('ice') && iceNeighbors[index].filter(neighbor => record.alive[neighbor] && !alive[neighbor]).length < (record.role === 'ice2' ? 2 : 1)) {
          status = 'blocked'; reason = 'observedIceStillPresent';
        } else if (record?.role === 'lock' && (knownKeys.some(key => record.alive[key] && alive[key]) || alive.every((value, offset) => value === record.alive[offset]))) {
          status = 'blocked'; reason = 'observedLockStillPresent';
        } else { status = 'uncertain'; reason = record?.role.startsWith('ice') ? 'thawedMayConcealLockOrKey' : 'unobservedCurrentRole'; }
        ({ free, blocked, uncertain })[status].push(index); reasons.push({ index, status, reason });
      }
      return { free, blocked, uncertain, reasons, unresolved: uncertain.length > 0,
        note: 'Guaranteed public obstacle frontier, not full hidden rules. Thawing can reveal a lock/key; unknown roles never mean none. No free action is not a death or impossibility proof. This memory cannot cross an attempt restart.' };
    },
  };
}

module.exports = { createObstacleFrontier };
