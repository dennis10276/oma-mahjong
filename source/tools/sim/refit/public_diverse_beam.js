'use strict';
const assert = require('assert/strict');

function selectBeam(ranked, limit) {
  assert(Number.isInteger(limit) && limit > 0);
  if (ranked.length <= limit) return ranked;
  const roots = new Set(), selected = new Set();
  for (const candidate of ranked) {
    const root = candidate.path[0];
    assert(Number.isInteger(root));
    if (roots.has(root)) continue;
    roots.add(root); selected.add(candidate);
    if (selected.size === limit) break;
  }
  for (const candidate of ranked) {
    if (selected.size === limit) break;
    selected.add(candidate);
  }
  return ranked.filter(candidate => selected.has(candidate));
}

module.exports = { selectBeam };
