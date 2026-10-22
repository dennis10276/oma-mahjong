'use strict';

const modules = [
  'test_human_board_visibility.js',
  'test_human_reference_campaign.js',
  'test_human_reference_budget.js',
  'test_human_reference_catalog.js',
  'test_public_goal_frontier.js',
  'test_public_information_revision.js',
  'test_public_frontier_plan.js',
  'test_public_obstacle_frontier.js',
  'test_personal_observed_memory.js',
  'test_production_physical_session.js',
  'test_production_session_factory.js',
  'test_public_belief_exact.js',
  'test_public_continuation_pruning.js',
  'test_public_dead_end.js',
  'test_public_known_continuation.js',
  'test_public_witness_cache.js',
  'test_public_witness_integration.js',
  'test_public_witness_reference.js',
  'test_public_witness_reopen_guard.js',
  'test_public_witness_search.js',
];

module.exports = modules.map(filename => ({
  name: 'human reference: ' + filename.replace(/^test_/, '').replace(/\.js$/, ''),
  cpu: true,
  async run() {
    const loaded = require('../tools/sim/refit/' + filename);
    if (typeof loaded === 'function') await loaded();
    else if (typeof loaded.test === 'function') await loaded.test();
  },
}));
