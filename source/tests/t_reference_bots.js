'use strict';

const modules = [
  "test_public_unknown_controller.js",
  "test_public_action_outcome.js",
  "test_public_tray_pixels.js",
  "test_public_observed_controller.js",
  "test_public_tile_edge_support.js",
  "test_public_frontier_plan.js",
  "test_public_obstacle_frontier.js",
  "test_public_tile_observation.js",
  "test_public_role_pixels.js",
  "test_public_role_capture.js",
  "test_public_role_verify.js",
  "test_public_role_presentation.js",
  "test_public_role_geometry.js",
  "test_public_information_revision.js",
  "test_public_goal_frontier.js",
  "test_optimal_reference_bot.js",
  "test_reference_campaign.js",
  "test_reference_campaign_verify.js",
  "test_reference_campaign_human_compare.js",
  "test_personal_observed_memory.js",
  "test_personal_pixel_capture_verify.js",
  "test_personal_pixel_opaque_inset_audit.js",
  "test_personal_pixel_reference_verify.js",
  "test_personal_pixel_session_compare.js",
  "test_personal_public_picture_prior.js",
  "test_personal_reference_failure_trace.js",
  "test_production_physical_session.js",
  "test_production_scene_renderer.js",
  "test_production_session_factory.js",
  "test_public_belief_exact.js",
  "test_public_continuation_pruning.js",
  "test_public_dead_end.js",
  "test_public_dead_end_choice.js",
  "test_public_information_escape.js",
  "test_public_known_continuation.js",
  "test_public_observed_opening.js",
  "test_public_pixel_belief.js",
  "test_public_pixel_capture.js",
  "test_public_pixel_match.js",
  "test_public_pixel_memory.js",
  "test_public_pixel_parallel.js",
  "test_public_pixel_partition.js",
  "test_public_pixel_scene.js",
  "test_public_tile_pixels.js",
  "test_public_witness_cache.js",
  "test_public_witness_integration.js",
  "test_public_witness_reference.js",
  "test_public_witness_reopen_guard.js",
  "test_public_witness_search.js"
];

module.exports = modules.map(filename => ({
  name: 'reference bots: ' + filename.replace(/^test_/, '').replace(/\.js$/, ''),
  cpu: true,
  async run() {
    const loaded = require('../tools/sim/refit/' + filename);
    if (typeof loaded === 'function') await loaded();
    else if (typeof loaded.test === 'function') await loaded.test();
  },
}));
