'use strict';
const assert = require('assert/strict');

function firstVisit(visited, identity, taps) {
  if (visited.has(identity)) return false;
  visited.set(identity, taps); return true;
}

function withoutDischargedBounds(result) {
  const removed = new Set(result.reasons.filter(reason => reason.reason === 'AllSupportedObstaclesDischargedUnderPublicBounds').map(reason => reason.index));
  if (!removed.size) return result;
  const uncertain = [...result.uncertain, ...removed].sort((left, right) => left - right);
  return { ...result, free: result.free.filter(index => !removed.has(index)), uncertain, unresolved: uncertain.length > 0,
    reasons: result.reasons.map(reason => removed.has(reason.index) ? { ...reason, status: 'uncertain', reason: 'unobservedCurrentRole' } : reason) };
}

function install(mode) {
  assert(['current', 'firstVisit', 'noBounds', 'both'].includes(mode));
  for (const filename of ['./human_reference_campaign.js', './public_witness_search.js']) {
    assert(!require.cache[require.resolve(filename)], 'Install a diagnostic ablation before loading the policy');
  }
  if (mode === 'firstVisit' || mode === 'both') {
    const budget = require('./public_path_budget.js');
    budget.admitPath = firstVisit;
    budget.queuePath = (visited, frontier, identity, candidate) => {
      if (!firstVisit(visited, identity, candidate.path.length)) return false;
      frontier.set(identity, candidate); return true;
    };
  }
  if (mode === 'noBounds' || mode === 'both') {
    const module = require('./public_obstacle_frontier.js'), create = module.createObstacleFrontier;
    module.createObstacleFrontier = (...args) => {
      const frontier = create(...args), query = frontier.query.bind(frontier);
      frontier.query = (...parameters) => withoutDischargedBounds(query(...parameters));
      return frontier;
    };
  }
}

async function main(mode, levels, settings) {
  install(mode);
  const { loadRecordedClears } = require('./human_reference_catalog.js');
  const { screen } = require('./human_reference_screen.js');
  const selected = levels.split(',').map(Number), planning = JSON.parse(settings || '{}');
  const catalog = await loadRecordedClears({ selectedLevels: selected });
  const entries = catalog.rows.filter(row => selected.includes(row.lv));
  assert(entries.length === selected.length && entries.every(row => row.game));
  console.log(JSON.stringify({ diagnostic: true, mode, planning,
    note: 'Explicit in-memory ablation of public-only policy helpers. Not an unchanged canonical-policy claim. Production physics and every independent replay remain unmodified.' }));
  const rows = screen(entries, planning);
  console.log(JSON.stringify({ mode, passed: rows.filter(row => row.pass).length, cases: rows.length,
    slowestMs: Math.max(...rows.map(row => row.slowestMs)) }));
}

if (require.main === module) main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { firstVisit, withoutDischargedBounds, install };
