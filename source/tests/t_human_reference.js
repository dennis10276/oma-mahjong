'use strict';

const modules = [
  'test_human_board_visibility.js',
  'test_human_visibility_geometry.js',
  'test_human_reference_campaign.js',
  'test_human_initial_role_memory.js',
  'test_human_single_carry.js',
  'test_human_crowded_discovery.js',
  'test_human_reference_budget.js',
  'test_human_reference_catalog.js',
  'test_human_reference_ablation.js',
  'test_human_information_invariance.js',
  'test_public_analysis_cache.js',
  'test_public_diverse_beam.js',
  'test_public_diverse_witness.js',
  'test_public_unique_cleanup.js',
  'test_public_exposure_frontier.js',
  'test_public_path_budget.js',
  'test_public_uncertain_safety.js',
  'test_public_information_tap_safety.js',
  'test_public_pair_flexibility.js',
  'test_public_tray_burden.js',
  'test_public_frontier_pressure.js',
  'test_public_consumed_recovery.js',
  'test_public_direct_clock.js',
  'test_public_post_clock_recovery.js',
  'test_public_productive_reopen.js',
  'test_public_reopen_frontier.js',
  'test_public_faceup_pair_macro.js',
  'test_public_goal_frontier.js',
  'test_public_goal_routes.js',
  'test_public_information_revision.js',
  'test_public_frontier_plan.js',
  'test_public_obstacle_frontier.js',
  'test_public_discharged_obstacles.js',
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
