'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const model = require('../tools/sim/refit/personal_model.js');
const { episodesOf, currentTarget } = require('../tools/sim/refit/personal_bot.js');
const { normalizeAttempts } = require('../tools/sim/refit/attempt_count_labels.js');
const game = () => ({ tiles: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }], faces: [1, 1], down: [0, 0], rules: null, clock: null });

module.exports = [
  {
    name: 'personal bots: constructive information escapes reopen known routes without an unsafe tray endpoint',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_information_escape.js'); },
  },
  {
    name: 'personal bots: reference failure forensics preserves public boundaries and distinguishes risks from proofs',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_reference_failure_trace.js'); },
  },
  {
    name: 'personal bots: known continuation proofs retain safe removals and restore roots after inspection cycles',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_known_continuation.js'); },
  },
  {
    name: 'personal bots: continuation pruning rejects publicly proven losing commitments without hidden-face optimism',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_continuation_pruning.js'); },
  },
  {
    name: 'personal bots: source-pinned production batches preserve complete physics and explicit integrity validation',
    cpu: true,
    async run() { require('../tools/sim/refit/test_production_session_factory.js'); },
  },
  {
    name: 'personal bots: exact public-belief policies preserve production actions and independently certify uncertain decisions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_belief_exact.js'); },
  },
  {
    name: 'personal bots: physical pixel controls distinguish production parity from changed planner reports',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pixel_session_compare.js'); },
  },
  {
    name: 'personal bots: independent screenshot replay preserves the production prior contract',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pixel_reference_verify.js'); },
  },
  {
    name: 'personal bots: incomplete pixel prefixes bind all completed artifacts without inventing a full rollout',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pixel_opaque_inset_audit.js'); },
  },
  {
    name: 'personal bots: observed retry memory preserves provenance and actual attempt boundaries',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_observed_memory.js'); },
  },
  {
    name: 'personal bots: strengthened reference preserves physical witnesses and newly informed routes',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_witness_integration.js'); },
  },
  {
    name: 'personal bots: productive reopen witnesses share budgets and repair false root-death certificates',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_witness_reopen_guard.js'); },
  },
  {
    name: 'personal bots: screenshot singleton memory survives closed peeks without hidden rereads',
    cpu: true,
    async run() { await require('../tools/sim/refit/test_public_pixel_memory.js')(); },
  },
  {
    name: 'personal bots: production scene tracks physical ice, key, lock and clock transitions',
    cpu: true,
    async run() { await require('../tools/sim/refit/test_production_scene_renderer.js').test(); },
  },
  {
    name: 'personal bots: parallel public templates preserve alphabet, context and failure cleanup',
    cpu: true,
    async run() { await require('../tools/sim/refit/test_public_pixel_parallel.js')(); },
  },
  {
    name: 'personal bots: resumable production physical environment preserves taps and hides private decisions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_production_physical_session.js'); },
  },
  {
    name: 'personal bots: independent screenshot replay verifies candidate support and earlier public context',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pixel_capture_verify.js'); },
  },
  {
    name: 'personal bots: public screenshot templates exclude hidden markup and retain rounded corner clues',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_pixel_scene.js'); },
  },
  {
    name: 'personal bots: learned known-inspection sequence preferences remain optional and preserve exact disabled behavior',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_witness_streak_choice.js'); },
  },
  {
    name: 'personal bots: known-inspection choice streaks distinguish repeated checks from new-information actions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_known_inspection_streak.js'); },
  },
  {
    name: 'personal bots: public witness loop diagnostics distinguish repeated observations from physical progress',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_witness_loop_probe.js'); },
  },
  {
    name: 'personal bots: observed opening identities never fall back to actual hidden tile faces',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_observed_opening.js'); },
  },
  {
    name: 'personal bots: bounded pixel matching retains all candidates under declared raster rounding noise',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_pixel_match.js'); },
  },
  {
    name: 'personal bots: screenshot observations derive opening knowledge without private picture metadata',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_pixel_capture.js'); },
  },
  {
    name: 'personal bots: pixel visibility retains exposed rounded tile edges without private picture metadata',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_tile_pixels.js'); },
  },
  {
    name: 'personal bots: partial-pixel beliefs retain ambiguity and never substitute actual hidden inventory',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_pixel_belief.js'); },
  },
  {
    name: 'personal bots: trusted pixel-opening masks remove covered identity leakage without root runtime edits',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pixel_opening_prototype.js'); },
  },
  {
    name: 'personal bots: pixel partitions preserve ambiguous observations without discarding all partial symbols',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_pixel_partition.js'); },
  },
  {
    name: 'personal bots: bounded witness cache preserves complete public-state search semantics',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_witness_cache.js'); },
  },
  {
    name: 'personal bots: public witness count grid retains all declared own confidence and recall interactions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_witness_count.js'); },
  },
  {
    name: 'personal bots: learned public witness choices stay optional and delegate exact disabled behavior',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_witness_choice.js'); },
  },
  {
    name: 'personal bots: public witness signals extend own continuous preferences without changing prior observations',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_witness_features.js'); },
  },
  {
    name: 'personal bots: public dead ends require proofs rather than inspection timeouts',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_dead_end.js'); },
  },
  {
    name: 'personal bots: dead-end acknowledgement preserves personal policies outside proved losses',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_dead_end_choice.js'); },
  },
  {
    name: 'personal bots: witness runtime plans through real taps and resets at actual attempt boundaries',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_witness_reference.js'); },
  },
  {
    name: 'personal bots: stronger witness search stays public and returns physical routes rather than hidden winning branches',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_witness_search.js'); },
  },
  {
    name: 'personal bots: public count screen binds all learning, recall and confidence settings',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_retention_count.js'); },
  },
  {
    name: 'personal bots: public preference models refuse private or mismatched-prior observations',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_retention_choice.js'); },
  },
  {
    name: 'personal bots: public replay controls compare knowledge within the same retention mode',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_retention_data.js'); },
  },
  {
    name: 'personal bots: information-limited engine prototype keeps legacy controls and public prior invariance',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_engine_prototype.js'); },
  },
  {
    name: 'personal bots: unknown-match expectations use an explicit public alphabet prior',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_picture_prior.js'); },
  },
  {
    name: 'personal bots: hidden-inventory contract spans physical tray, geometry and clock states',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_observation_contract.js'); },
  },
  {
    name: 'personal bots: observation audits compare hidden inventories, not just permutations',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_hidden_inventory_audit.js'); },
  },
  {
    name: 'personal bots: joint preference count grid preserves declared confidence interactions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retention_attention_count.js'); },
  },
  {
    name: 'personal bots: joint retention attention distinguishes useful reopens from repeated inspections',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retention_attention.js'); },
  },
  {
    name: 'personal bots: inspection loop probes count actual removals without replacing outcomes',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retention_loop_probe.js'); },
  },
  {
    name: 'personal bots: own move preferences adapt through a retention-matched public residual',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retention_residual.js'); },
  },
  {
    name: 'personal bots: matched retry annotations cannot use later or other-campaign pictures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retention_residual_data.js'); },
  },
  {
    name: 'personal bots: sparse adaptive choice references preserve public-feature coordinates',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retention_residual_audit.js'); },
  },
  {
    name: 'personal bots: carried retry knowledge changes knowledge stamps, not observed physical outcomes',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_online_recall_audit.js'); },
  },
  {
    name: 'personal bots: person-local policies can switch repeatedly without future-outcome learning',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_online_strategy.js'); },
  },
  {
    name: 'personal bots: chronological replay evidence preserves resumed attempts and own retry knowledge',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_online_strategy_data.js'); },
  },
  {
    name: 'personal bots: chronological action scores use immutable opening weights',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_online_strategy_measure.js'); },
  },
  {
    name: 'personal bots: retry-route diagnostics separate exposed pictures from actual human recall',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retry_route_audit.js'); },
  },
  {
    name: 'personal bots: live replay fidelity never promotes partial auto prefixes to complete-game proof',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_live_replay_audit.js'); },
  },
  {
    name: 'personal bots: current later checks refresh outcomes without replacing reused controller simulations',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_preparation_later.js'); },
  },
  {
    name: 'personal bots: fine clock-preparation count grid retains every own strength and retry setting',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_preparation_count.js'); },
  },
  {
    name: 'personal bots: fitted clock preparation has causal own intents and exact disabled controls',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_preparation_choice.js'); },
  },
  {
    name: 'personal bots: route retry experiments preserve fresh seeds and pending/overlap cases',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_route_blend_data.js'); },
  },
  {
    name: 'personal bots: phase diagnostics distinguish nonclock from before-clock failures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_phase_audit.js'); },
  },
  {
    name: 'personal bots: route interactions preserve exact endpoints and actual latent observations',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_route_blend_choice.js'); },
  },
  {
    name: 'personal bots: passive clock telemetry preserves exact choices and state',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_failure_probe.js'); },
  },
  {
    name: 'personal bots: clock preparation respects known exit support and preserves existing dig behavior',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_preparation.js'); },
  },
  {
    name: 'personal bots: later capacity checks retain pending and fit-overlap campaigns without prospective credit',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pair_capacity_later.js'); },
  },
  {
    name: 'personal bots: capacity-preserving pair preparation is an optional recovery intent',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pair_capacity_intents.js'); },
  },
  {
    name: 'personal bots: pair capacity distinguishes temporary third spots from unmatched commitments',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pair_capacity.js'); },
  },
  {
    name: 'personal bots: full kind-within interaction grid preserves exact reuse and own settings',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_factorized_joint_data.js'); },
  },
  {
    name: 'personal bots: factorized diagnostics distinguish action-kind and tile likelihood',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_factorized_action_audit.js'); },
  },
  {
    name: 'personal bots: factorized count calibration binds the complete own confidence grid',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_factorized_count_data.js'); },
  },
  {
    name: 'personal bots: factorized confidence separates action type from tile option count',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_factorized_choice.js'); },
  },
  {
    name: 'personal bots: planning-risk diagnostics distinguish uncertainty from proven traps',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_planning_risk_audit.js'); },
  },
  {
    name: 'personal bots: conditional sequencing is fitted on the exact own attention baseline',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_attention_handoff_choice.js'); },
  },
  {
    name: 'personal bots: new handoff count proposals bind the entire own retry policy',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_attention_handoff_counts.js'); },
  },
  {
    name: 'personal bots: passive tray-failure telemetry cannot change selector choices or public features',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_tray_failure_probe.js'); },
  },
  {
    name: 'personal bots: source-bound future inputs retain whole exact unopened cohorts',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_source_bound_causal_data.js'); },
  },
  {
    name: 'personal bots: fresh follow-through rates preserve own versions and optional sequencing',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_fresh_follow.js'); },
  },
  {
    name: 'personal bots: count inputs bind new first-attempt signals to unchanged actor bodies',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_first_count_data.js'); },
  },
  {
    name: 'personal bots: first-try signals preserve exact seeded per-attempt policy lifecycle',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_first_signals.js'); },
  },
  {
    name: 'personal bots: distinct route features retain remaining aliases and refuse censored paths',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_distinct_route_count_data.js'); },
  },
  {
    name: 'personal bots: reference difficulty covariates do not replace personalized behavioral policies',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_reference_count_data.js'); },
  },
  {
    name: 'personal bots: fresh known-route policies replace aliases without changing own retry membership',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_fresh_known_counts.js'); },
  },
  {
    name: 'personal bots: expanded count inputs bind reproduced variants and retain policy-source shifts',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_variant_count_data.js'); },
  },
  {
    name: 'personal bots: full26 summaries preserve original failures and separate corrected public pairs',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_causal_full26_summary.js'); },
  },
  {
    name: 'personal bots: full26 reproduction checks omitted metadata without injecting expected features',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_causal_full26_audit.js'); },
  },
  {
    name: 'personal bots: whole capacity proposals preserve own retry memory and failure learning',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_capacity_count_data.js'); },
  },
  {
    name: 'personal bots: changed clock first-attempt probes cannot masquerade as complete count calibration',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_capacity_first_data.js'); },
  },
  {
    name: 'personal bots: uncertain clock routes retain optional own pair preparation without forced matches',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_capacity_choice.js'); },
  },
  {
    name: 'personal bots: count training uses only reproduced own factors and exact board bindings',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_verified_count_data.js'); },
  },
  {
    name: 'personal bots: verified physical factors preserve retry lifecycle and reject computation failures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_verified_factor_features.js'); },
  },
  {
    name: 'personal bots: independent generator audit distinguishes exact cached and own recent-model provenance',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_causal_generator_audit.js'); },
  },
  {
    name: 'personal bots: recall count policies retain mistake avoidance and bind their own confidence and picture memory',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_attention_memory_data.js'); },
  },
  {
    name: 'personal bots: selected own future policies exclude real openings and replay counters',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_attention_future_data.js'); },
  },
  {
    name: 'personal bots: attention count calibration binds the exact own changed controller',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_attention_count_data.js'); },
  },
  {
    name: 'personal bots: own public count features cannot consume target outcomes or other-person predictions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_count_data.js'); },
  },
  {
    name: 'personal bots: bounded cycle diagnosis requires public repeats and no physical progress',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_temperature_cycle_audit.js'); },
  },
  {
    name: 'personal bots: learned inspection attention stays personal and preserves first openings and immediate matches',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_attention_choice.js'); },
  },
  {
    name: 'personal bots: public opening difficulty preserves hidden-picture boundaries and physical lock transport',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_public_opening.js'); },
  },
  {
    name: 'personal bots: count calibration uses exact own prior boards rather than replay or other-person chains',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_policy_temperature_data.js'); },
  },
  {
    name: 'personal bots: count-calibrated temperature remains personal rather than forcing generic greedy finishing',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_tempered_choice.js'); },
  },
  {
    name: 'personal bots: cached clock planning preserves exact features and search-budget semantics',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_clock_strategy_fast.js'); },
  },
  {
    name: 'personal bots: recall diagnostics score real options without target outcomes or pooled-person accuracy',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_recall_coverage.js'); },
  },
  {
    name: 'personal bots: first changed autonomous handoff tap requires an eligible public cue',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_handoff_first.js'); },
  },
  {
    name: 'personal bots: targeted handoff cues do not imply generic greed or an unseen bee mate',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_handoff_cues.js'); },
  },
  {
    name: 'personal bots: the clarified bee and exact clock-prefix controls stay distinct from full paths',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_joint_intents.js'); },
  },
  {
    name: 'personal bots: clock annotations preserve exact prefix choices and availability',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_fresh_clock_data.js'); },
  },
  {
    name: 'personal bots: fresh numeric forecasts exclude existing openings and duplicate future coverage',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_fresh_forecasts.js'); },
  },
  {
    name: 'personal bots: exact board transport preserves locks and typed orientation flags',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_game_io.js'); },
  },
  {
    name: 'personal bots: delaying the level150 bee preserves exact physics without future-picture choice or extra taps',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_recovery_case.js'); },
  },
  {
    name: 'personal bots: recovery graphs distinguish constructive escapes from unknown or bounded uniqueness claims',
    cpu: true,
    async run() { require('../tools/sim/refit/test_public_recovery_graph.js'); },
  },
  {
    name: 'personal bots: crowding diagnostics distinguish public clock/pair support from hidden outcomes',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_crowding.js'); },
  },
  {
    name: 'personal bots: clock strategy models pairing before the clock and known tray escape within the real budget',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_clock_strategy.js'); },
  },
  {
    name: 'personal bots: clock digging distinguishes public probing and changing tray pressure without forced priorities',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_clock_dig.js'); },
  },
  {
    name: 'personal bots: public clock route support is bounded, physical and never a forced greedy preference',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_clock_plan.js'); },
  },
  {
    name: 'personal bots: clock exit diagnosis separates generic controller decisions and censored human openings',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_clock_exit.js'); },
  },
  {
    name: 'personal bots: imported worker helpers cannot execute a different task or post unrelated rows',
    cpu: true,
    async run() { await require('../tools/sim/refit/test_known_worker_imports.js')(); },
  },
  {
    name: 'personal bots: bitset planning preserves geometry, unsigned tile lanes and exact bounded-search behavior',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_tray_plan_bits.js'); },
  },
  {
    name: 'personal bots: optimized known-only search preserves exact physical planning features and budgets',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_tray_plan_fast.js'); },
  },
  {
    name: 'personal bots: public planning cache preserves exact features across isolated boards, knowledge and candidate masks',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_tray_plan_cache.js'); },
  },
  {
    name: 'personal bots: known-plan instrumentation excludes discarded suffixes without dropping retained boundary prefixes',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_known_plan_data.js'); },
  },
  {
    name: 'personal bots: own-person known-plan preferences can oppose route progress without forced greed',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_known_plan_choice.js'); },
  },
  {
    name: 'personal bots: known-only tray plans preserve physical mechanics and distinguish bounded uncertainty from traps',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_tray_plan.js'); },
  },
  {
    name: 'personal bots: tray planning receives frozen public knowledge without covered picture or orientation leaks',
    cpu: true,
    async run() { require('../tools/sim/refit/test_known_tray_runtime.js'); },
  },
  {
    name: 'personal bots: terminal retry memory retains actual face-up exposure without inspecting unknown pictures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_terminal_memory.js'); },
  },
  {
    name: 'personal bots: terminal observation audit excludes unseen pictures and removed tiles',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_terminal_observation.js'); },
  },
  {
    name: 'personal bots: failure stage uses observations before the final tap rather than its reveal',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_failure_stage.js'); },
  },
  {
    name: 'personal bots: episode components initialize once per attempt without leaking states or reusing unrelated runs',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_plan_choice.js'); },
  },
  {
    name: 'personal bots: contextual runtime sees only physical known features and preserves followed controls',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_context_choice.js'); },
  },
  {
    name: 'personal bots: restart diagnostics retain unsupported states and do not invent empty-player accuracy',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_restart_audit.js'); },
  },
  {
    name: 'personal bots: route-value features use actual taps without revealing unknown future pictures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_value.js'); },
  },
  {
    name: 'personal bots: persistent tray-target observations preserve clock priority and actual knowledge',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_tray_goal.js'); },
  },
  {
    name: 'personal bots: earlier confirmed endings can establish observed memory without hiding late telemetry availability',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_late_memory_audit.js'); },
  },
  {
    name: 'personal bots: memory-feature audits retain actual choices and reject future observation dependencies',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_memory_audit.js'); },
  },
  {
    name: 'personal bots: retry training inherits only earlier available observations on the exact campaign board',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retry_memory.js'); },
  },
  {
    name: 'personal bots: retry memory diagnostics separate earlier observed pictures from assumed human recall',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_retry_knowledge_audit.js'); },
  },
  {
    name: 'personal bots: verified board-equivalent releases retain new-level coverage without guessing future versions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_board_versions.js'); },
  },
  {
    name: 'personal bots: pair-plan follow-through is measured from consecutive observed legal actions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_pair_followthrough.js'); },
  },
  {
    name: 'personal bots: learned pair-preparation observations distinguish free known twins without forcing greed',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_relations.js'); },
  },
  {
    name: 'personal bots: personal follow-through models only observed known-match cues, not global greed',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_followthrough.js'); },
  },
  {
    name: 'personal bots: single-step features remove unexecuted followups without removing real automatic twins',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_single_step.js'); },
  },
  {
    name: 'personal bots: physical scoring audit distinguishes actual taps from heuristic followup credit',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_scoring_audit.js'); },
  },
  {
    name: 'personal bots: retry diagnostics separate repeated openings from repeated terminal decisions',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_retry_audit.js'); },
  },
  {
    name: 'personal bots: physical key routes respect actual taps, inspection and clock priority',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_key_plan.js'); },
  },
  {
    name: 'personal bots: joint actors compare all physical taps with personal context and goal values',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_joint.js'); },
  },
  {
    name: 'personal bots: human-state handoffs are validated diagnostic states, never forecast evidence',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_handoff_audit.js'); },
  },
  {
    name: 'personal bots: campaigns retain initial openings and deduplicate resumed failures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_attempt_campaigns.js'); },
  },
  {
    name: 'personal bots: physical finishing uses legal known matches and inspections without hidden-picture shortcuts',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_safety.js'); },
  },
  {
    name: 'personal bots: tray failure diagnostics use pre-action knowledge, not later pictures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_tray_audit.js'); },
  },
  {
    name: 'personal bots: physical clock planning uses legal taps without a macro or hidden pictures',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_clock_plan.js'); },
  },
  {
    name: 'personal bots: failure audits preserve explicit denominators and empty samples',
    cpu: true,
    async run() { require('../tools/sim/refit/test_physical_failure_audit.js'); },
  },
  {
    name: 'personal bots: a retry policy changes only attempts after the initial loss',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 0, 1, 2, 3, 3], down: Array(8).fill(0) };
      const spatial = Array(Hard.POLICY_FEAT.length - Hard.FEAT.length).fill(0); spatial[0] = -1000;
      const persona = { ...Hard.P, physicalFlips: true, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, forceMatches: false,
        w: Array(Hard.FEAT.length).fill(0), spatial, memory: 0,
        kinds: { 't0n-': { single: 1 }, 't1n-': { single: 1 }, 't2n-': { single: 1 }, 't3n-': { fatal: 1 } } };
      const original = Hard.rateChain(board, 1, 1, persona, 0, 2);
      const phased = Hard.rateChain(board, 1, 1, { ...persona, retryPolicy: { forceMatches: true } }, 0, 2);
      assert.equal(original.first, 0);
      assert.deepEqual(original.within, [0, 0]);
      assert.equal(phased.first, original.first);
      assert.deepEqual(phased.within, [0, 1]);
    },
  },
  {
    name: 'personal bots: physical count actors reject future and target-trajectory models',
    cpu: true,
    async run() {
      const { selectModels, actorOf } = require('../tools/sim/refit/physical_count_data.js');
      const Hard = require('../www/hard.js');
      const row = { name: 'Dennis', start: 10, excludedAids: ['target'] };
      const model = { id: 'prior', trainingCut: 3, availableThrough: 2, trainedAids: ['previous'],
        withinWeights: Array(Hard.POLICY_FEAT.length + Hard.GOAL_FEAT.length).fill(0), kindModel: { weights: {} } };
      const bank = { selections: [{ name: 'Dennis', start: 10, models: { all: 'prior' } }], models: [model] };
      assert.equal(selectModels(bank, row).all.id, 'prior');
      assert.equal(actorOf(model).plan, 0);
      assert.equal(actorOf(model).forceMatches, false);
      model.trainedAids = ['target'];
      assert.throws(() => selectModels(bank, row));
      model.trainedAids = []; model.availableThrough = 10;
      assert.throws(() => selectModels(bank, row));
    },
  },
  {
    name: 'personal bots: progression follows saved level 106, not recent replays of 53 and 54',
    cpu: true,
    async run() {
      const { progressionTargets, missingProgressionTasks } = require('../tools/sim/refit/progression_targets.js');
      const events = [{ k: 'end', lv: 105, r: 'win', t: 1, v: '1.52' }, { k: 'start', lv: 106, t: 2, v: '1.52' },
        { k: 'end', lv: 53, r: 'win', t: 3, v: '1.55' }, { k: 'start', lv: 54, at: 3, t: 4, v: '1.55' },
        { k: 'end', lv: 200, m: 'd', r: 'win', t: 5, v: '1.55' }];
      const target = progressionTargets(events, { level: 106 });
      assert.equal(target.first, 106);
      assert.equal(target.currentLevelAlreadyOpened, true);
      assert.deepEqual(target.levels.slice(0, 3), [106, 107, 108]);
      assert.equal(target.levels.length, 24);
      assert.equal(progressionTargets(events, null).first, 106);
      assert(!target.levels.includes(53));
      assert.throws(() => progressionTargets(events, { level: 106 }, 0));
      const recorded = [{ forecasts: target.levels.map(lv => ({ name: 'Dennis', lv, version: target.version })) }];
      assert.deepEqual(missingProgressionTasks({ Dennis: target }, recorded), []);
      const advanced = { ...target, levels: Array.from({ length: 24 }, (_, index) => 111 + index) };
      assert.deepEqual(missingProgressionTasks({ Dennis: advanced }, recorded).map(row => row.lv), [130, 131, 132, 133, 134]);
    },
  },
  {
    name: 'personal bots: the physical-tap actor obeys inspection, open-twin and terminal tray rules',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_physical.js'); },
  },
  {
    name: 'personal bots: natural-prefix training retains restarts but excludes post-help and missing chunks',
    cpu: true,
    async run() { require('../tools/sim/refit/test_personal_prefix_data.js'); },
  },
  {
    name: 'personal bots: full-choice instrumentation learns a visible tray match without changing defaults',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1], down: [0, 0, 0, 0], start: [0], follow: [1] };
      const ordinary = { ...board, log: [], policyLog: [] }, full = { ...board, log: [], policyLog: [], logMatches: true };
      const original = Hard.play(ordinary, Hard.P, 1), recorded = Hard.play(full, Hard.P, 1);
      for (const field of ['at', 'moves', 'left', 'why', 'win']) assert.deepEqual(original[field], recorded[field]);
      assert.equal(ordinary.policyLog.length, 0);
      assert.equal(full.policyLog.length, 1);
      const decision = full.policyLog[0];
      assert.equal(decision.F[decision.k][Hard.POLICY_FEAT.indexOf('visibleTrayMatch')], 1);
      assert.equal(decision.kindContext[Hard.KIND_CONTEXT.indexOf('hasTrayMatch')], 1);
    },
  },
  {
    name: 'personal bots: a blind automatic match is one unknown choice, not a second observed decision',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1], down: [0, 1, 0, 0], start: [0],
        follow: [1], log: [], policyLog: [], logMatches: true };
      const result = Hard.play(board, Hard.P, 1);
      assert.equal(result.moves, 2);
      assert.equal(board.policyLog.length, 1);
      const decision = board.policyLog[0];
      assert.equal(decision.F[decision.k][19], 1);
      assert.equal(decision.F[decision.k][Hard.POLICY_FEAT.indexOf('visibleTrayMatch')], 0);
    },
  },
  {
    name: 'personal bots: a full-choice actor can choose against a visible match without changing the original actor',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 0, 1, 2, 3, 3], down: Array(8).fill(0), start: [0, 1, 2] };
      const persona = { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
        kinds: { 't3n-': { fatal: 1 }, 't3p-': { fatal: 1 } } };
      assert.equal(Hard.play(board, persona, 1).win, true);
      assert.equal(Hard.play(board, { ...persona, forceMatches: false }, 1).why, 'tray');
    },
  },
  {
    name: 'personal bots: automatic Joker twins prefer geometric freedom even through ice',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [[20, 10, 0], [24, 10, 0], [0, 0, 0], [4, 0, 1], [8, 0, 0],
        [4, 0, 2], [8, 0, 1], [28, 10, 0], [32, 10, 0], [36, 10, 0]].map(([x, y, z]) => ({ x, y, z }));
      const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces: [0, 101, 0, 0, 0, 1, 1, 2, 2, 101],
        down: Array(10).fill(0), rules: { ice: { 2: 1 }, iceNb: L.iceNeighbors(tiles), keys: [], locks: null },
        start: [0], follow: [1], log: [] }, Hard.P, 1);
      assert.equal(result.at[2], 2);
      assert.equal(result.at[3], -1);
    },
  },
  {
    name: 'personal bots: disabling search cannot draw randomness based on unseen pictures',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2, 3, 3], down: [0, 1, 0, 0, 1, 1, 0, 0], start: [0] };
      const persona = { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 0, plan: 0 };
      for (let seed = 1; seed <= 20; seed++) {
        const original = [], disabled = [];
        const first = Hard.play(board, persona, seed, original);
        const second = Hard.play(board, { ...persona, search: 0 }, seed, disabled);
        assert.deepEqual(first, second);
        assert.deepEqual(original, disabled);
      }
    },
  },
  {
    name: 'personal bots: known Jokers rescue a three-tile tray instead of being classified fatal',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../analysis/personal-bots/joker-full-tray-repro.json'), 'utf8'));
      const tiles = fixture.tiles.map(([x, y, z]) => ({ x, y, z }));
      const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces: fixture.faces, down: fixture.down, start: fixture.start },
        { ...Hard.P, ...fixture.persona }, fixture.seed);
      assert.equal(result.win, true);
      assert(result.moves > 3);
    },
  },
  {
    name: 'personal bots: Joker target, automatic twin and terminal bonus match the game rules',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 10, z: 0 }, { x: 4, y: 10, z: 0 }, { x: 8, y: 10, z: 0 },
        { x: 12, y: 10, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 101, 0, 1, 2, 2, 101], down: Array(8).fill(0), start: [0, 1] };
      const first = Hard.play({ ...board, follow: [2], log: [] }, Hard.P, 1);
      assert.equal(first.at[4], 3);
      assert.equal(first.at[3], -1);
      assert.equal(first.seen[4], 4);
      const finished = Hard.play({ ...board, follow: [2, 4, 3, 5, 6, 7], log: [] }, Hard.P, 1);
      assert.equal(finished.win, true);
      assert.equal(finished.moves, 7);
    },
  },
  {
    name: 'personal bots: hypothetical Joker effects cannot inspect the location of an unseen twin',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 20, y: 10, z: 0 }, { x: 24, y: 10, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 }, { x: 8, y: 0, z: 1 }, { x: -2, y: 0, z: 0 }, { x: -4, y: 0, z: 0 },
        { x: 28, y: 10, z: 0 }, { x: 32, y: 10, z: 0 }];
      const features = [[0, 101, 0, 1, 3, 3, 2, 2, 1, 101], [0, 101, 1, 0, 3, 3, 2, 2, 1, 101]].map(faces => {
        const board = { tiles, nb: L.neighbors(tiles), faces, down: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0], start: [0],
          follow: [4], log: [], policyLog: [] };
        Hard.play(board, Hard.P, 1);
        return board.policyLog[0].F;
      });
      assert.deepEqual(features[0], features[1]);
    },
  },
  {
    name: 'personal bots: a known Joker is not a nonmatching match-error candidate',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 })), stats = {};
      const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 101, 0, 1, 2, 101], down: Array(8).fill(0), start: [0, 1, 2] },
        { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 0, plan: 0, matchError: 1, stats }, 1);
      assert.equal(result.win, true);
      assert.equal(stats.missedMatchFatal || 0, 0);
    },
  },
  {
    name: 'personal bots: future profile coverage includes hard replays and ignores daily progress',
    cpu: true,
    async run() {
      require('../tools/sim/refit/test_count_profile_prospective.js');
    },
  },
  {
    name: 'personal bots: clock planning inspects a free unknown blocker using geometry, not its picture',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, ...Array.from({ length: 6 }, (_, index) => ({ x: (index + 1) * 4, y: 0, z: 0 }))];
      const inspected = [[0, 1, 1, 0, 2, 2, 2, 2], [0, 2, 1, 0, 2, 2, 1, 2]].map(faces => {
        const trace = [], stats = {};
        const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces, down: [0, 1, 0, 0, 0, 0, 1, 1], clock: { i: 0, n: 3 } },
          { ...Hard.P, allMoves: true, flips: true, peek: 0, plan: 3, end: 0, stats }, 1, trace);
        assert.equal(trace[0].inspection, 1);
        assert.equal(trace[0].moves, 0);
        assert.equal(stats.clockInspections, 1);
        assert(result.at[0] >= 0 && result.at[0] < 3);
        return trace[0];
      });
      assert.deepEqual(inspected[0], inspected[1]);
    },
  },
  {
    name: 'personal bots: a clock plan can expose an unknown clock without using its hidden picture',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, ...Array.from({ length: 6 }, (_, index) => ({ x: (index + 1) * 4, y: 0, z: 0 }))];
      const prefixes = [[0, 1, 1, 0, 2, 2, 2, 2], [2, 1, 1, 0, 2, 2, 0, 2]].map(faces => {
        const stats = {}, result = Hard.play({ tiles, nb: L.neighbors(tiles), faces, down: [0, 0, 0, 0, 0, 0, 1, 1], clock: { i: 0, n: 3 } },
          { ...Hard.P, allMoves: true, flips: true, peek: 0, plan: 3, end: 0, spatial: [100], stats }, 1);
        assert(stats.clockPrefixPlans > 0);
        assert.equal(result.at[1], 0);
        assert.equal(result.at[0], 1);
        return Array.from(result.at).map((move, index) => [index, move]).filter(([, move]) => move === 0);
      });
      assert.deepEqual(prefixes[0], prefixes[1]);
    },
  },
  {
    name: 'personal bots: a clock route can reveal successive unknown blockers without assuming their pictures',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 },
        { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }], stats = {};
      const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces: [0, 2, 1, 0, 1, 2], down: [0, 0, 0, 0, 0, 0], clock: { i: 0, n: 3 } },
        { ...Hard.P, allMoves: true, flips: true, peek: 0, plan: 3, end: 0, kinds: { 't0p-': { pair: 1 } }, stats }, 1);
      assert.equal(result.win, true);
      assert.equal(result.at[2], 0);
      assert.equal(result.at[1], 1);
      assert.equal(result.at[0], 2);
      assert.equal(stats.clockPrefixPlans, 2);
    },
  },
  {
    name: 'personal bots: exposing a face-down clock still requires a real inspection',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }], stats = {};
      const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces: [0, 1, 1, 0], down: [1, 0, 0, 0], clock: { i: 0, n: 3 } },
        { ...Hard.P, allMoves: true, flips: true, peek: 0, plan: 3, end: 0, kinds: { t0n: { flip: 1 } }, stats }, 1);
      assert.equal(result.win, true);
      assert(result.at[0] <= 2);
      assert.equal(stats.clockInspections, 1);
    },
  },
  {
    name: 'personal bots: learned visible-match errors can fail despite a known exit without using unseen faces',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 7 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const persona = { ...Hard.P, allMoves: true, flips: true, peek: 0, plan: 0, end: 0, matchError: 1, learnFromLoss: true };
      const traces = [[0, 1, 2, 0, 3, 1, 2], [0, 1, 2, 0, 3, 2, 1]].map(faces => {
        const board = { tiles, nb: L.neighbors(tiles), faces, down: [0, 0, 0, 0, 0, 1, 1], start: [0, 1, 2] };
        const trace = [], result = Hard.play(board, persona, 1, trace);
        assert.equal(result.why, 'tray');
        assert.equal(result.moves, 4);
        assert.deepEqual(trace[0].pick, [4]);
        assert.equal(result.seen[3], 4);
        assert.equal(result.seen[5], 0);
        assert.equal(result.seen[6], 0);
        const retry = Hard.play({ ...board, avoidMoves: new Map([[trace[0].state, new Set(['fatal'])]]) }, persona, 1);
        assert(retry.moves > result.moves);
        return trace;
      });
      assert.deepEqual(traces[0], traces[1]);
    },
  },
  {
    name: 'personal bots: visible-match errors are disabled at zero and during active clock planning',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 0, 1, 2], down: [0, 0, 0, 0, 0, 0], start: [0, 1, 2] };
      const persona = { ...Hard.P, allMoves: true, flips: true, peek: 0, plan: 0, end: 0 };
      assert.deepEqual(Hard.play(board, persona, 1), Hard.play(board, { ...persona, matchError: 0 }, 1));
      const result = Hard.play({ ...board, clock: { i: 3, n: 6 } }, { ...persona, matchError: 1 }, 1);
      assert.equal(result.win, true);
    },
  },
  {
    name: 'personal bots: visible-match error profiles use physical human choices available before opening',
    cpu: true,
    async run() {
      require('../tools/sim/refit/test_personal_match_error.js');
    },
  },
  {
    name: 'personal bots: clock-planning depth learns from strictly earlier own and family recordings',
    cpu: true,
    async run() {
      require('../tools/sim/refit/test_personal_clock_plan.js');
    },
  },
  {
    name: 'personal bots: failure diagnostics distinguish known exits from clock losses without peeking',
    cpu: true,
    async run() {
      require('../tools/sim/refit/test_failure_audit.js');
    },
  },
  {
    name: 'personal bots: every actual inspection is available to retry recall, even before an early stop',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0], down: [1, 1], follow: [-1], log: [] };
      const result = Hard.play(board, Hard.P, 1);
      assert.equal(result.why, 'stopped');
      assert.equal(result.seen[0], 1);
      assert.equal(result.seen[1], 0);
    },
  },
  {
    name: 'personal bots: before-match inspection uses only novel free tiles, not their hidden pictures',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const persona = { ...Hard.P, flips: true, allMoves: true, peek: 0, end: 0, plan: 0, scanBeforeMatch: 1 };
      const traces = [[0, 0, 1, 1, 2, 2], [0, 0, 2, 1, 1, 2]].map(faces => {
        const trace = [], stats = {};
        const board = { tiles, nb: L.neighbors(tiles), faces, down: [0, 0, 1, 1, 1, 1], start: [0],
          memory: [0, 0, 0, 1, 0, 0], peekedAtStart: [5] };
        const result = Hard.play(board, { ...persona, stats }, 1, trace);
        const inspections = trace.filter(event => event.beforeMatch);
        assert.deepEqual(inspections.map(event => event.inspection).sort(), [2, 4]);
        assert.equal(stats.scanBeforeMatch, 2);
        assert.equal(result.win, true);
        assert.equal(result.moves, 6);
        return inspections;
      });
      assert.deepEqual(traces[0], traces[1]);
      const trace = [];
      const blocked = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2], down: [0, 0, 1, 1, 1, 1], start: [0],
        rules: { iceNb: L.iceNeighbors(tiles), ice: { 2: 1 }, keys: [], locks: null } };
      Hard.play(blocked, persona, 1, trace);
      assert(!trace.some(event => event.beforeMatch && event.moves === 1 && event.inspection === 2));
    },
  },
  {
    name: 'personal bots: zero inspection rate preserves seeded play and active clocks suppress the experiment',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1], down: [0, 0, 1, 1], start: [0] };
      const persona = { ...Hard.P, flips: true, allMoves: true, peek: 0, plan: 0, end: 0 };
      for (let seed = 1; seed <= 6; seed++) {
        assert.deepEqual(Hard.play(board, persona, seed), Hard.play(board, { ...persona, scanBeforeMatch: 0 }, seed));
      }
      const trace = [];
      Hard.play({ ...board, clock: { i: 1, n: 2 } }, { ...persona, scanBeforeMatch: 1 }, 1, trace);
      assert.equal(trace.filter(event => event.beforeMatch).length, 0);
    },
  },
  {
    name: 'personal bots: personal inspection profiles reject future and unfinished later chunks',
    cpu: true,
    async run() {
      require('../tools/sim/refit/test_personal_inspection.js');
    },
  },
  {
    name: 'personal bots: retry memory makes a remembered hidden tray match immediately usable',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 4 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 0, 1], down: [0, 0, 1, 1], start: [0, 1] };
      const persona = { ...Hard.P, flips: true, allMoves: true, peek: 0, end: 0, plan: 0,
        kinds: { t2n: { flip: 1 }, t1n: { flip: 1 } } };
      const recalled = Hard.play({ ...board, memory: [0, 0, 1, 1] }, persona, 1);
      const unseen = Hard.play(board, persona, 1);
      assert.equal(recalled.win, true);
      assert.equal(recalled.decisions, 0);
      assert.equal(unseen.decisions, 2);
      assert.equal(recalled.moves, unseen.moves);
    },
  },
  {
    name: 'personal bots: following a remembered reopening does not invent a new inspection decision',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0], down: [0, 1], start: [0],
        memory: [0, 1], follow: [-2, 1], log: [] };
      const result = Hard.play(board, Hard.P, 1);
      assert.equal(result.win, true);
      assert.equal(board.log.length, 0);
    },
  },
  {
    name: 'personal bots: an urgent known match on the clock itself remains a safe follow-up',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
        { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 1, 0], down: new Uint8Array(5),
        clock: { i: 0, n: 3 }, memory: [1, 0, 0, 0, 0], start: [4], follow: [1, 0, 2, 3], log: [], policyLog: [] };
      Hard.play(board, Hard.P, 1);
      const decision = board.policyLog[0], chosen = decision.F[decision.k];
      assert.equal(chosen[10], 0);
      assert.equal(chosen[11], 0);
      assert.equal(chosen[17], 0);
      assert.equal(decision.goals[decision.k][3], 1);
    },
  },
  {
    name: 'personal bots: move scoring does not force tray matches past a clock deadline',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
        { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 }];
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 1, 2], down: new Uint8Array(5),
        clock: { i: 0, n: 3 }, start: [4], follow: [1, 0, 2, 3], log: [] };
      Hard.play(board, Hard.P, 1);
      const decision = board.log[0], chosen = decision.F[decision.k];
      assert.equal(chosen[10], 0);
      assert.equal(chosen[17], 0);
      assert.equal(decision.F.find(feature => feature[14])[10], 1);
    },
  },
  {
    name: 'personal bots: a fitted visible-key preference can choose the key pair first',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0, 1, 1, 2, 2, 3, 3], down: new Uint8Array(8),
        rules: { iceNb: L.iceNeighbors(tiles), ice: {}, keys: [0, 1], locks: new Set([6, 7]) } };
      const trace = [];
      const result = Hard.play(board, { ...Hard.P, w: Array(Hard.FEAT.length).fill(0), plan: 0, end: 0,
        kinds: { 't0p-': { pair: 1 } }, goalWeights: [100, 0, 0, 0, 0, 0, 0, 0] }, 1, trace);
      assert.equal(result.win, true);
      assert.deepEqual(trace[0].pick, [0, 1]);
    },
  },
  {
    name: 'personal bots: zero goal weights preserve every seeded move and retry result',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 3, 0, 1, 2, 3], down: [1, 0, 1, 0, 0, 1, 0, 1],
        rules: { iceNb: L.iceNeighbors(tiles), ice: {}, keys: [1, 6], locks: new Set([2]) }, clock: { i: 3, n: 7 } };
      const persona = { ...Hard.P, flips: true, allMoves: true, peek: 0, plan: 0, end: 0,
        kinds: { t0n: { flip: 1 }, t0p: { pair: 1 }, 't0p-': { pair: 1 } } };
      for (let seed = 1; seed <= 6; seed++) {
        assert.deepEqual(Hard.play(board, persona, seed), Hard.play(board, { ...persona, goalWeights: Array(Hard.GOAL_FEAT.length).fill(0) }, seed));
      }
      assert.deepEqual(Hard.rateChain(board, 8, 1, persona, 0.5, 4), Hard.rateChain(board, 8, 1,
        { ...persona, goalWeights: Array(Hard.GOAL_FEAT.length).fill(0) }, 0.5, 4));
    },
  },
  {
    name: 'personal bots: goal features do not reward a key hidden behind an unseen tile',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 4, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 1, 0], down: [1, 0, 0, 0],
        rules: { iceNb: L.iceNeighbors(tiles), ice: {}, keys: [0, 3], locks: null }, follow: [1, 2], log: [], policyLog: [] };
      Hard.play(board, Hard.P, 1);
      const decision = board.policyLog[0];
      assert.equal(decision.F[decision.k][14], 1);
      assert.deepEqual(decision.goals[decision.k], Array(Hard.GOAL_FEAT.length).fill(0));
    },
  },
  {
    name: 'personal bots: prospective coverage includes an opening before its first end event',
    cpu: true,
    async run() {
      const { includePendingOpenings } = require('../tools/sim/refit/prospective_openings.js');
      const events = [{ k: 'end', lv: 53, v: '1.55', at: 2, t: 100, r: 'win', aid: 'old' },
        { k: 'start', lv: 54, v: '1.55', at: 3, t: 101, aid: 'new' },
        { k: 'start', lv: 54, v: '1.55', at: 3, t: 102, aid: 'new', res: true }];
      const pending = includePendingOpenings('Gerda', [], events, () => 'exact');
      assert.equal(pending.length, 1);
      assert.equal(pending[0].start, 101);
      assert.equal(pending[0].board, 'exact');
      assert.equal(pending[0].firstAttempt, 1);
      assert.equal(pending[0].wonOn, null);
      events.push({ k: 'end', lv: 54, v: '1.55', at: 3, t: 110, aid: 'new', r: 'stuck' },
        { k: 'start', lv: 54, v: '1.55', at: 4, t: 111, aid: 'retry' });
      assert.deepEqual(includePendingOpenings('Gerda', [], events), []);
    },
  },
  {
    name: 'personal bots: clock planning cannot use the picture of an unseen clock tile',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }], stats = {};
      const board = { tiles, nb: L.neighbors(tiles), faces: [0, 0], down: [1, 0], clock: { i: 0, n: 2 } };
      const result = Hard.play(board, { ...Hard.P, flips: true, allMoves: true, peek: 0, plan: 2, end: 0,
        kinds: { t0n: { flip: 1 } }, stats }, 1);
      assert.equal(result.win, true);
      assert.equal(stats.clockInspections, 1);
    },
  },
  {
    name: 'personal bots: move-type context is unchanged when unseen pictures swap positions',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 5 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      const contexts = [[0, 1, 2, 0, 3], [0, 1, 2, 3, 0]].map(faces => {
        const board = { tiles, nb: L.neighbors(tiles), faces, down: [0, 0, 0, 1, 1], start: [0, 1, 2],
          follow: [-4, 3], log: [], policyLog: [] };
        Hard.play(board, Hard.P, 1);
        assert.equal(board.policyLog[0].kindContext.length, Hard.KIND_CONTEXT.length);
        return board.policyLog[0].kindContext;
      });
      assert.deepEqual(contexts[0], contexts[1]);
    },
  },
  {
    name: 'personal bots: contextual move-type probabilities mask unavailable actions',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }], stats = {};
      const model = { weights: { pair: [2000], fatal: [5000], flip: [1000] } };
      const result = Hard.play({ tiles, nb: L.neighbors(tiles), faces: [0, 0], down: [1, 1] },
        { ...Hard.P, flips: true, allMoves: true, peek: 0, end: 0, plan: 0, kindModel: model, stats }, 1);
      assert.equal(result.win, true);
      assert.equal(stats.sit.t0n.flip, 2);
      assert.equal(stats.sit['t0p-'].pair, 1);
    },
  },
  {
    name: 'personal bots: an unseen tile cannot be classified as a safe tray match',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 5 }, (_, index) => ({ x: index * 4, y: 0, z: 0 }));
      for (const faces of [[0, 1, 2, 0, 3], [0, 1, 2, 3, 0]]) {
        const stats = {}, board = { tiles, nb: L.neighbors(tiles), faces, down: [0, 0, 0, 1, 1], start: [0, 1, 2] };
        Hard.play(board, { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 0, plan: 0,
          kinds: { t3n: { single: 1 } }, stats }, 1);
        assert(stats.sit.t3n.flip >= 1);
        assert.equal(stats.sit.t3n.single, 0);
      }
    },
  },
  {
    name: 'personal bots: rebuilding features preserves all profiles and replaces stale values',
    cpu: true,
    async run() {
      const { GROUPS, rebuildFeatures } = require('../tools/sim/refit/attempt_features.js');
      const chain = () => ({ cond: [0.2, 0.3, 0.4, 0.5], within: [0.2, 0.44, 0.664, 0.832] });
      const row = { name: 'Gerda', lv: 63, start: 100, end: 200, firstAttempt: 1, wonOn: null,
        board: 'test', physical: Array(11).fill(0), reference: { strong: 0.7, average: 0.4 }, chain: chain() };
      for (const [group, profiles] of Object.entries(GROUPS)) row[group] = Object.fromEntries([...profiles].reverse().map(profile => [profile, chain()]));
      const data = rebuildFeatures({ rows: [row] }), original = [...row.features];
      assert.equal(original.length, 66);
      rebuildFeatures(data);
      assert.deepEqual(row.features, original);
      row.memoryChains.fourPictures.cond[0] = 0.9;
      rebuildFeatures(data);
      const index = data.featureSchema.names.indexOf('memoryChains.fourPictures.conditional1');
      assert.equal(row.features[index], 0.9);
      assert.equal(row.features.length, 66);
      delete row.retryChains.keys;
      assert.throws(() => rebuildFeatures(data), /Incomplete retryChains/);
    },
  },
  {
    name: 'personal bots: history is ordered by completion and cannot inspect the target outcome',
    cpu: true,
    async run() {
      const { histories } = require('../tools/sim/refit/attempt_features.js');
      const earlier = Array.from({ length: 22 }, (_, index) => ({ name: 'Gerda', board: 'old',
        firstAttempt: 1, wonOn: index + 1, start: 0, end: index + 1 }));
      const target = { name: 'Gerda', board: 'new', start: 100, end: 200, firstAttempt: 1, wonOn: 50 };
      const history = histories([...earlier].reverse().concat(target), target);
      assert.equal(history[0], 20);
      assert.equal(history[3], 12.5);
      target.wonOn = 1;
      assert.deepEqual(histories([...earlier, target], target), history);
    },
  },
  {
    name: 'personal bots: limited picture memory makes a forgotten picture an observable flip again',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [0, 1, 2, 3].map(index => ({ x: index * 4, y: 0, z: 0 }));
      const base = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 0, 1], down: new Uint8Array(4).fill(1), follow: [-1, -2, -3, -1] };
      const full = { ...base, log: [] }, limited = { ...base, log: [] };
      Hard.play(full, Hard.P, 1);
      Hard.play(limited, { ...Hard.P, shortMemory: 2 }, 1);
      assert.equal(full.log.length, 3);
      assert.equal(limited.log.length, 4);
    },
  },
  {
    name: 'personal bots: limited memory cannot get stuck endlessly reopening tiles',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 6 }, (_, index) => ({ x: index * 2, y: 0, z: 0 }));
      const state = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 3, 4, 5], down: new Uint8Array(6).fill(1) };
      const kinds = Object.fromEntries([0, 1, 2, 3].map(tray => ['t' + tray + 'n', { flip: 1 }]));
      const result = Hard.play(state, { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 0, shortMemory: 2, kinds }, 1);
      assert.equal(result.win, false);
      assert(result.decisions < 100);
    },
  },
  {
    name: 'personal bots: a remembered fatal decision is avoided on the same visible state',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = Array.from({ length: 8 }, (_, index) => ({ x: index * 2, y: 0, z: 0 }));
      const state = { tiles, nb: L.neighbors(tiles), faces: [0, 1, 2, 3, 0, 1, 2, 3], down: new Uint8Array(8).fill(1), start: [0, 1, 2] };
      const persona = { ...Hard.P, allMoves: true, flips: true, peek: 0, end: 0, learnFromLoss: true, kinds: { t3n: { fatal: 1, flip: 0 } } };
      const trace = [];
      const failed = Hard.play(state, persona, 1, trace);
      assert.equal(failed.why, 'tray');
      assert.equal(trace.at(-1).chosen, 'fatal');
      const previous = trace.at(-1);
      const remembered = Hard.play({ ...state, avoidMoves: new Map([[previous.state, new Set(['fatal'])]]) }, persona, 1);
      assert(remembered.moves > failed.moves);
    },
  },
  {
    name: 'personal bots: key planning respects the actual lock and key rules',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [0, 1, 2, 3].map(index => ({ x: index * 2, y: 0, z: 0 }));
      const state = { tiles, nb: L.neighbors(tiles), faces: [1, 1, 2, 2], down: new Uint8Array(4),
        rules: { iceNb: L.iceNeighbors(tiles), ice: {}, locks: new Set([2, 3]), keys: [0, 1] } };
      const result = Hard.play(state, { ...Hard.persona('strong'), keyPlan: 4 }, 1);
      assert.equal(result.win, true);
      assert(result.at[0] < result.at[2] && result.at[1] < result.at[3]);
    },
  },
  {
    name: 'personal bots: policy instrumentation preserves replay and never encodes unseen pictures',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [0, 1, 2, 3].map(index => ({ x: index * 2, y: 0, z: 0 }));
      const base = { tiles, nb: L.neighbors(tiles), faces: [5, 5, 2, 2], down: new Uint8Array([1, 0, 0, 0]), follow: [-1, 0, 1, 2, 3] };
      const ordinary = { ...base, log: [] }, instrumented = { ...base, log: [], policyLog: [] };
      assert.deepEqual(Hard.play(ordinary, Hard.P, 1), Hard.play(instrumented, Hard.P, 1));
      assert.deepEqual(ordinary.log, instrumented.log);
      assert(instrumented.policyLog.length > 0);
      for (const decision of instrumented.policyLog) for (const feature of decision.F) {
        assert.equal(feature.length, Hard.POLICY_FEAT.length);
        if (feature[19]) assert.equal(feature.slice(Hard.FEAT.length + 6).reduce((sum, value) => sum + value, 0), 0);
      }
    },
  },
  {
    name: 'personal bots: learned spatial choice can steer a visible move',
    cpu: true,
    async run() {
      const Hard = require('../www/hard.js'), L = require('../www/layouts.js');
      const tiles = [0, 1, 2, 3].map(index => ({ x: index * 2, y: 0, z: 0 }));
      const state = { tiles, nb: L.neighbors(tiles), faces: [1, 1, 2, 2], down: new Uint8Array(4) };
      const spatial = new Array(Hard.POLICY_FEAT.length - Hard.FEAT.length).fill(0); spatial[0] = 100;
      const trace = [];
      Hard.play(state, { ...Hard.P, w: new Array(Hard.FEAT.length).fill(0), spatial, end: 0 }, 1, trace);
      assert.deepEqual(trace[0].pick, [3]);
    },
  },
  {
    name: 'personal bots: retained app counters preserve exact winning-try labels on replays',
    cpu: true,
    async run() {
      assert.deepEqual(normalizeAttempts(6, 6, true), { firstAttempt: 1, loggedFirstAttempt: 6, loggedWonOn: 6, wonOn: 1 });
      assert.equal(normalizeAttempts(2, 6, true).wonOn, 5);
      assert.equal(normalizeAttempts(3, 6, false).wonOn, 6);
      assert.equal(normalizeAttempts(3, 6, false).firstAttempt, 3);
      assert.equal(normalizeAttempts(2, null, true).wonOn, null);
      assert.throws(() => normalizeAttempts(6, 5, true));
    },
  },
  {
    name: 'personal bots: offline classic boards ignore wall-clock deadlines',
    cpu: true,
    async run() {
      const boards = require('../tools/sim/refit/boards.js'), originalClock = Date.now;
      let ticks = 0;
      try {
        Date.now = () => { ticks += 1000; return ticks; };
        const slowClock = model.boardId(boards.classic(56, 1.6));
        Date.now = () => 0;
        assert.equal(model.boardId(boards.classic(56, 1.6)), slowClock);
        assert.equal(ticks, 0);
      } finally {
        Date.now = originalClock;
      }
    },
  },
  {
    name: 'personal bots: future and unfinished recordings cannot supply habits',
    cpu: true,
    async run() {
      const source = fs.readFileSync(path.resolve(__dirname, '../tools/sim/refit/kinds.js'), 'utf8');
      const data = { feat: ['flip', 'overflow', 'isPair'], games: [{ t: 100, availableAt: 200,
        decisions: [{ tray: 0, k: 0, F: [[1, 0, 0], [0, 0, 1]] }] }] };
      const context = { module: { exports: {} }, __dirname: '.', require: name => name === 'fs' ? { readFileSync: () => JSON.stringify(data) } : require(name) };
      vm.runInNewContext(source, context);
      const { kindsAt } = context.module.exports;
      assert.equal(JSON.stringify(kindsAt('Gerda', 0)), '{}');
      assert.equal(JSON.stringify(kindsAt('Gerda', 150)), '{}');
      assert.equal(JSON.stringify(kindsAt('Gerda', 200)), '{}');
      assert.equal(kindsAt('Gerda', 201).t0p.flip, 1);
    },
  },
  {
    name: 'personal bots: board identity includes clock, ice, keys and locks',
    cpu: true,
    async run() {
      const original = game(), identity = model.boardId(original);
      assert.notEqual(model.boardId({ ...original, clock: { i: 0, n: 2 } }), identity);
      assert.notEqual(model.boardId({ ...original, rules: { ice: { 0: 1 }, locks: null, keys: [] } }), identity);
      assert.notEqual(model.boardId({ ...original, rules: { ice: {}, locks: new Set([0]), keys: [1] } }), identity);
      assert.equal(model.boardId({ ...original, faces: new Uint8Array([1, 1]), down: new Uint8Array([0, 0]) }), identity);
      const left = { ...original, rules: { ice: { 0: 1, 1: 2 }, locks: new Set([1, 0]), keys: [1, 0] } };
      const right = { ...original, rules: { ice: { 1: 2, 0: 1 }, locks: new Set([0, 1]), keys: [0, 1] } };
      assert.equal(model.boardId(left), model.boardId(right));
    },
  },
  {
    name: 'personal bots: versions and restarted attempts stay in separate episodes',
    cpu: true,
    async run() {
      const first = game(), changed = { ...game(), clock: { i: 0, n: 2 } };
      const episodes = episodesOf([{ g: first, at: 1, startedAt: 1 }, { g: first, at: 2, startedAt: 2 },
        { g: changed, at: 3, startedAt: 3 }, { g: changed, at: 1, startedAt: 4 }]);
      assert.deepEqual(episodes.map(episode => episode.tries.length), [2, 1, 1]);
      assert.deepEqual(episodes.map(episode => episode.attemptOffset), [0, 2, 0]);
    },
  },
  {
    name: 'personal bots: retries retain exact conditional probabilities beyond four tries',
    cpu: true,
    async run() {
      assert.equal(model.conditional({ cond: [0.995, 0.4, null, null], within: [0.995, 0.997, 0.997, 0.997] }, 2), 0.4);
      assert.equal(model.conditional({ cond: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8], within: [0.3] }, 6), 0.8);
      assert.equal(model.conditional({ cond: [0.3, null], within: [0.3] }, 9), 0.3);
      assert.deepEqual(model.cumulative([0.5, 0.5, 0.5, 0.5]), [0.5, 0.75, 0.875, 0.9375]);
      assert.throws(() => model.cumulative([NaN]));
    },
  },
  {
    name: 'personal bots: current target follows actual play instead of highest saved level',
    cpu: true,
    async run() {
      const events = { old: { k: 'end', lv: 105, at: 1, r: 'win', t: 1, v: '1.54' },
        current: { k: 'start', lv: 53, at: 2, t: 2, v: '1.55' }, daily: { k: 'end', lv: 1, r: 'win', m: 'd', t: 3 } };
      assert.equal(currentTarget(events).lv, 53);
      assert.equal(currentTarget(events).at, 2);
      assert.equal(currentTarget(events).active, true);
      events.end = { k: 'end', lv: 53, at: 2, r: 'stuck', t: 4, v: '1.55' };
      assert.equal(currentTarget(events).at, 3);
      events.win = { k: 'end', lv: 53, at: 3, r: 'win', t: 5, v: '1.55' };
      assert.equal(currentTarget(events).lv, 54);
      assert.equal(currentTarget(events).at, 1);
    },
  },
  {
    name: 'personal bots: corrections learn individual rates and keep unseen boards neutral',
    cpu: true,
    async run() {
      const rows = Array.from({ length: 24 }, (_, index) => ({ name: 'Dennisisdebeste', t: index, at: 1,
        board: 'seen', raw: 0.5, won: index < 20 }));
      const fitted = model.fit(rows);
      const neutral = model.predict(fitted, { name: 'Dennisisdebeste', at: 1, raw: 0.5, board: 'unseen' });
      const seen = model.predict(fitted, { name: 'Dennisisdebeste', at: 1, raw: 0.5, board: 'seen' });
      assert(neutral > 0.5 && seen > neutral && seen < 1);
      assert.equal(model.predict(model.fit([]), { name: 'Gerda', at: 1, raw: 0.5, board: 'unseen' }), 0.5);
      assert.throws(() => model.predict(fitted, { name: 'Unknown', at: 1, raw: 0.5, board: 'seen' }));
    },
  },
];

if (require.main === module) {
  (async () => {
    for (const test of module.exports) {
      await test.run();
      console.log('PASS ' + test.name);
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
