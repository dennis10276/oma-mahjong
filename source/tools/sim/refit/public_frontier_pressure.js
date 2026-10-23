'use strict';
const assert = require('assert/strict');

function frontierPressure(state, frontier, target, allowed) {
  assert(frontier instanceof Set && frontier.has(target));
  const guaranteed = allowed.free.filter(index => state.alive[index] && !allowed.uncertain?.includes(index));
  if (guaranteed.includes(target)) return { overflow: 0, projected: Math.max(0, state.tray.length - 1), unresolvedBlockers: 0 };
  const waiting = new Set(state.tray), spent = new Set();
  for (const picture of [...waiting]) {
    if (picture === 101) continue;
    const mate = guaranteed.find(index => !spent.has(index) && state.pictures[index] === picture);
    if (mate !== undefined) { spent.add(mate); waiting.delete(picture); }
  }
  const outside = guaranteed.filter(index => !frontier.has(index));
  let unresolvedBlockers = 0;
  for (const index of frontier) {
    if (index === target || spent.has(index)) continue;
    const picture = state.pictures[index];
    if (picture === null || picture === 101) { unresolvedBlockers++; continue; }
    if (waiting.has(picture)) { waiting.delete(picture); continue; }
    const spare = outside.find(candidate => !spent.has(candidate) && state.pictures[candidate] === picture);
    if (spare !== undefined) spent.add(spare);
    else waiting.add(picture);
  }
  const projected = waiting.size + unresolvedBlockers;
  return { overflow: Math.max(0, projected - 3), projected, unresolvedBlockers };
}

module.exports = { frontierPressure };
