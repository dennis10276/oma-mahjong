'use strict';
const assert = require('assert/strict');
const { performance } = require('perf_hooks');
const Layouts = require('../../../www/layouts.js');
const Hard = require('../../../www/hard.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { createSessionFactory, parameters } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createObstacleFrontier } = require('./public_obstacle_frontier.js');
const { reference } = require('./public_witness_reference.js');
const { REFERENCE_PARAMETERS, search: searchPublicWitness } = require('./public_witness_search.js');
const { advance } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');
const { knownCleanup } = require('./public_unique_cleanup.js');
const { createExposureFrontier, passiveExposureMode } = require('./public_exposure_frontier.js');
const { createDrawnRoleFrontier, drawnRolePlanningAllowed } = require('./public_drawn_role_frontier.js');
const { inferMatchedPicture } = require('./public_matched_picture.js');
const { preferKnownRecovery, openTwinRecovery } = require('./public_recovery_priority.js');
const { describeInformation } = require('./public_information_audit.js');
const { createRetryRiskMemory, createFailedRouteMemory } = require('./public_retry_risk_memory.js');
const { retryExploration } = require('./public_retry_exploration.js');
const { clockRetryExploration } = require('./public_clock_retry_exploration.js');
const { createAcceptedTapMemory } = require('./public_accepted_tap_memory.js');
const { createKnownLossMemory } = require('./public_known_loss_memory.js');
const { createClearedRoleMemory } = require('./public_cleared_role_memory.js');
const { createKeyIdentityMemory, keyPlanningAllowed } = require('./public_key_identity_memory.js');
const { createAvailabilityTransfer } = require('./public_availability_transfer.js');
const { createObservedSafetyTransfer, observedSafetyPlanningAllowed } = require('./public_observed_safety_transfer.js');
const { createBlockedTapMemory } = require('./public_blocked_tap_memory.js');
const { rankHypothesisActions } = require('./public_anytime_hypotheses.js');
const { rankBudgetedHypotheses } = require('./public_budgeted_hypotheses.js');
const { rankInformationActions } = require('./public_information_sampling.js');
const { informationActions } = require('./public_information_actions.js');
const { saltedPublicSeed } = require('./public_sampling_seed.js');
const { createHypothesisPhysics } = require('./public_hypothesis_physics.js');
const { createPublicActionVisits } = require('./public_action_visits.js');
const { publicActionOrder } = require('./public_action_order.js');
const { retryCompleteSearch } = require('./public_retry_complete.js');
const { retryInformationSearch } = require('./public_retry_information.js');
const { safeClosedInspection } = require('./public_safe_closed_inspection.js');
const { survivalBranchSearch } = require('./public_survival_branches.js');
const { createKnownWitnessPortfolio } = require('./public_known_witness_portfolio.js');
const { openingPlanningController } = require('./public_opening_planning.js');
const { learnedEscapePlan } = require('./public_learned_escape.js');
const { trayInformationGuard } = require('./public_tray_information_guard.js');
const { createCleanupIntention } = require('./public_cleanup_intention.js');

function createHumanController(tiles, options = {}, publicContext = {}) {
  assert(options.learnedEscapePlanning === undefined || typeof options.learnedEscapePlanning === 'boolean');
  assert(options.avoidThirdTrayInformation === undefined || typeof options.avoidThirdTrayInformation === 'boolean');
  assert(options.trayGuardClockSlack === undefined || typeof options.trayGuardClockSlack === 'boolean');
  assert(options.openingTrayGuardPlanning === undefined || typeof options.openingTrayGuardPlanning === 'boolean');
  assert(!options.openingTrayGuardPlanning||options.openingConditionalPlanning===true);
  assert(options.retainCleanupIntention === undefined || typeof options.retainCleanupIntention === 'boolean');
  assert(options.learnedEscapeContinuationRanking === undefined || typeof options.learnedEscapeContinuationRanking === 'boolean');
  assert(options.openingLearnedEscapePlanning === undefined || typeof options.openingLearnedEscapePlanning === 'boolean');
  assert(!options.openingLearnedEscapePlanning || options.openingConditionalPlanning === true);
  assert(options.openingConditionalPlanning === undefined || typeof options.openingConditionalPlanning === 'boolean');
  assert(options.openingReusablePlanning === undefined || typeof options.openingReusablePlanning === 'boolean');
  assert(!options.openingReusablePlanning || options.openingConditionalPlanning === true);
  assert(options.openingRetryRiskLearning === undefined || typeof options.openingRetryRiskLearning === 'boolean');
  assert(!options.openingRetryRiskLearning || options.openingReusablePlanning === true);
  assert(options.openingRetryPictureLearning === undefined || typeof options.openingRetryPictureLearning === 'boolean');
  assert(!options.openingRetryPictureLearning || options.openingRetryRiskLearning === true);
  assert(options.openingBroadInformationPlanning === undefined || typeof options.openingBroadInformationPlanning === 'boolean');
  assert(!options.openingBroadInformationPlanning || options.openingConditionalPlanning === true);
  assert(options.openingBroadReusablePlanning === undefined || typeof options.openingBroadReusablePlanning === 'boolean');
  assert(!options.openingBroadReusablePlanning || options.openingBroadInformationPlanning === true);
  if (options.openingConditionalPlanning) return openingPlanningController(options,
    planning => createHumanController(tiles, planning, publicContext));
  assert(options.publicActionSalt === undefined || Number.isInteger(options.publicActionSalt)
    && options.publicActionSalt > 0 && options.publicActionSalt <= 0x7fffffff);
  assert(options.choiceLimit === undefined || Number.isInteger(options.choiceLimit) && options.choiceLimit > 0);
  assert(options.retryCompleteWitness === undefined || typeof options.retryCompleteWitness === 'boolean');
  assert(options.knownWitnessPortfolio === undefined || typeof options.knownWitnessPortfolio === 'boolean');
  assert(options.knownWitnessMs === undefined || options.knownWitnessPortfolio === true
    && Number.isFinite(options.knownWitnessMs) && options.knownWitnessMs > 0 && options.knownWitnessMs <= 500);
  assert(options.knownWitnessNodes === undefined || options.knownWitnessPortfolio === true
    && Number.isInteger(options.knownWitnessNodes) && options.knownWitnessNodes > 0);
  assert(options.retryCompleteMs === undefined || options.retryCompleteWitness === true
    && Number.isFinite(options.retryCompleteMs) && options.retryCompleteMs > 0 && options.retryCompleteMs <= 500);
  assert(options.retryCompleteNodes === undefined || options.retryCompleteWitness === true
    && Number.isInteger(options.retryCompleteNodes) && options.retryCompleteNodes > 0);
  assert(options.retryInformationWitness === undefined || typeof options.retryInformationWitness === 'boolean');
  assert(options.retryInformationMs === undefined || options.retryInformationWitness === true
    && Number.isFinite(options.retryInformationMs) && options.retryInformationMs > 0 && options.retryInformationMs <= 500);
  assert(options.retryInformationNodes === undefined || options.retryInformationWitness === true
    && Number.isInteger(options.retryInformationNodes) && options.retryInformationNodes > 0);
  assert(options.retryInformationPeekTrayLimit === undefined || options.retryInformationWitness === true
    && Number.isInteger(options.retryInformationPeekTrayLimit) && options.retryInformationPeekTrayLimit >= 0
    && options.retryInformationPeekTrayLimit <= 2);
  assert(options.retryInformationPreferPeek === undefined || typeof options.retryInformationPreferPeek === 'boolean');
  assert(options.retryInformationPreferPeek !== true || options.retryInformationWitness === true);
  assert(Object.keys(publicContext).every(key => key === 'boardMode'));
  assert(publicContext.boardMode === undefined || ['standard', 'lab'].includes(publicContext.boardMode));
  assert(options.inspectBeforeCommit === undefined || [false, true, 'recovery'].includes(options.inspectBeforeCommit));
  assert(options.safeClockInspection === undefined || typeof options.safeClockInspection === 'boolean');
  assert(options.safeClockInspectionBudgetRange === undefined || options.safeClockInspection === true
    && Array.isArray(options.safeClockInspectionBudgetRange) && options.safeClockInspectionBudgetRange.length === 2
    && options.safeClockInspectionBudgetRange.every(value => Number.isInteger(value) && value > 0)
    && options.safeClockInspectionBudgetRange[0] <= options.safeClockInspectionBudgetRange[1]);
  assert(options.clockSlackRanking === undefined || typeof options.clockSlackRanking === 'boolean');
  assert(options.clockSlackRankingBudgetRange === undefined || options.clockSlackRanking === true
    && Array.isArray(options.clockSlackRankingBudgetRange) && options.clockSlackRankingBudgetRange.length === 2
    && options.clockSlackRankingBudgetRange.every(value => Number.isInteger(value) && value > 0)
    && options.clockSlackRankingBudgetRange[0] <= options.clockSlackRankingBudgetRange[1]);
  assert(options.safeClockInspection !== true || !!options.inspectBeforeCommit);
  assert(options.exclusiveRoles === undefined || [false, true, 'clock'].includes(options.exclusiveRoles));
  assert(options.patientSingleCarry === undefined || typeof options.patientSingleCarry === 'boolean');
  assert(options.uniqueKnownCleanup === undefined || typeof options.uniqueKnownCleanup === 'boolean');
  assert(options.protectOpenTwin === undefined || typeof options.protectOpenTwin === 'boolean');
  assert(options.probeUnknownClock === undefined || typeof options.probeUnknownClock === 'boolean');
  assert(options.clockProbeTrayLimit === undefined || options.probeUnknownClock === true
    && Number.isInteger(options.clockProbeTrayLimit) && options.clockProbeTrayLimit >= 0 && options.clockProbeTrayLimit <= 2);
  assert(options.retryRiskLearning === undefined || typeof options.retryRiskLearning === 'boolean');
  assert(options.retryPictureLearning === undefined || typeof options.retryPictureLearning === 'boolean');
  assert(!options.retryPictureLearning || options.retryRiskLearning === true);
  assert(options.retryFailedRouteLearning === undefined || typeof options.retryFailedRouteLearning === 'boolean');
  assert(!options.retryFailedRouteLearning || options.retryRiskLearning === true,
    'Failed-route preferences require the guarded actual-retry exploration');
  assert(options.clockRetryLearning === undefined || typeof options.clockRetryLearning === 'boolean');
  assert(!options.clockRetryLearning || options.retryRiskLearning, 'Clock retry exploration requires actual retry learning');
  assert(options.rememberAcceptedTaps === undefined || typeof options.rememberAcceptedTaps === 'boolean');
  assert(options.deadEndInformation === undefined || typeof options.deadEndInformation === 'boolean');
  assert(!options.deadEndInformation || options.retryInformationWitness === true,
    'Dead-end information recovery shares the retry-information search budget');
  assert(options.rememberKnownLosses === undefined || typeof options.rememberKnownLosses === 'boolean');
  assert(options.rememberLossInspections === undefined || typeof options.rememberLossInspections === 'boolean');
  assert(!options.rememberLossInspections || options.rememberKnownLosses === true,
    'Inspection loss deductions require actual exhausted loss memory');
  assert(options.rememberProvedContinuations === undefined || typeof options.rememberProvedContinuations === 'boolean');
  assert(!options.rememberProvedContinuations || options.rememberKnownLosses === true && options.deadEndInformation === true,
    'Continuation loss deductions require actual loss memory and the complete public information frontier');
  assert(options.rememberClearedRoles === undefined || typeof options.rememberClearedRoles === 'boolean');
  assert(options.rememberKeyIdentities === undefined || typeof options.rememberKeyIdentities === 'boolean');
  assert(options.keyPlanningCrowdedAfterClock === undefined || typeof options.keyPlanningCrowdedAfterClock === 'boolean');
  assert(!options.keyPlanningCrowdedAfterClock || options.rememberKeyIdentities === true);
  assert(options.keyPlanningCrowdedTrayMin === undefined || options.keyPlanningCrowdedAfterClock === true
    && Number.isInteger(options.keyPlanningCrowdedTrayMin) && options.keyPlanningCrowdedTrayMin >= 2 && options.keyPlanningCrowdedTrayMin <= 3);
  assert(options.keyPlanningBeforeCrowding === undefined || typeof options.keyPlanningBeforeCrowding === 'boolean');
  assert(!options.keyPlanningBeforeCrowding || options.rememberKeyIdentities === true);
  assert(!options.keyPlanningCrowdedAfterClock || !options.keyPlanningBeforeCrowding);
  assert(options.keyAwareTrayRecovery === undefined || typeof options.keyAwareTrayRecovery === 'boolean');
  assert(!options.keyAwareTrayRecovery || options.keyPlanningCrowdedAfterClock === true);
  assert(!options.keyAwareTrayRecovery || !options.avoidThirdTrayInformation,
    'Choose conditional key-aware or global tray recovery explicitly');
  assert(options.keyPlanningSlackAbove === undefined || options.rememberKeyIdentities === true
    && Number.isInteger(options.keyPlanningSlackAbove) && options.keyPlanningSlackAbove >= 0);
  assert(!options.rememberKeyIdentities || !options.hypothesisSampling,
    'Typed key identity memory needs corresponding history constraints before combining with hypothetical worlds');
  assert(options.rememberBlockedTaps === undefined || typeof options.rememberBlockedTaps === 'boolean');
  assert(options.hypothesisSampling === undefined || typeof options.hypothesisSampling === 'boolean');
  assert(options.informationSampling === undefined || typeof options.informationSampling === 'boolean');
  assert(options.hypothesisRunSalt === undefined || [1, 2, 3].includes(options.hypothesisRunSalt));
  assert(options.informationScoreMode === undefined || ['clear', 'progress'].includes(options.informationScoreMode));
  assert(options.informationConfidenceSE === undefined || Number.isFinite(options.informationConfidenceSE)
    && options.informationConfidenceSE >= 0 && options.informationConfidenceSE <= 8);
  assert(options.informationActionPaths === undefined || typeof options.informationActionPaths === 'boolean');
  assert(options.informationPrimitivePeeks === undefined || typeof options.informationPrimitivePeeks === 'boolean');
  assert(options.informationExactUnknownLimit === undefined || Number.isInteger(options.informationExactUnknownLimit)
    && options.informationExactUnknownLimit >= 0 && options.informationExactUnknownLimit <= 512);
  assert(!options.informationSampling || options.hypothesisSampling === true);
  assert(options.informationSchedule === undefined || ['sequential', 'interleaved'].includes(options.informationSchedule));
  assert(options.informationPicturePrior === undefined || ['uniform', 'diverse'].includes(options.informationPicturePrior));
  assert(options.informationPrimaryMs === undefined || Number.isFinite(options.informationPrimaryMs)
    && options.informationPrimaryMs > 0 && options.informationPrimaryMs <= 500);
  assert(options.informationPlayoutNodes === undefined || Number.isInteger(options.informationPlayoutNodes)
    && options.informationPlayoutNodes > 0 && options.informationPlayoutNodes <= 64);
  assert(options.hypothesisActionMs === undefined || options.hypothesisSampling === true
    && Number.isFinite(options.hypothesisActionMs) && options.hypothesisActionMs > 0 && options.hypothesisActionMs <= 1500);
  assert(!options.hypothesisSampling || options.exclusiveRoles === true && ['standard', 'lab'].includes(publicContext.boardMode),
    'Hypotheses require declared public board and exclusive obstacle contracts');
  for (const [field, maximum] of [['hypothesisMaximumWorlds', 128], ['hypothesisNodesPerAction', 4096]]) {
    assert(options[field] === undefined || Number.isInteger(options[field]) && options[field] > 0 && options[field] <= maximum);
  }
  assert(options.usePlacementContract === undefined || typeof options.usePlacementContract === 'boolean');
  assert(options.causalAvailabilityMemory === undefined || typeof options.causalAvailabilityMemory === 'boolean');
  assert(!options.causalAvailabilityMemory || options.exclusiveRoles === true
    && (options.rememberAcceptedTaps || options.rememberClearedRoles), 'Causal availability requires declared production bounds and actual safety memory');
  assert(options.observedSafetyTransfer === undefined || typeof options.observedSafetyTransfer === 'boolean');
  assert(options.observedSafetyClockOnly === undefined || typeof options.observedSafetyClockOnly === 'boolean');
  assert(!options.observedSafetyClockOnly || options.observedSafetyTransfer === true);
  assert(options.observedSafetyMaxClockSlack === undefined || options.observedSafetyClockOnly === true
    && Number.isInteger(options.observedSafetyMaxClockSlack) && options.observedSafetyMaxClockSlack >= 0);
  assert(!options.observedSafetyTransfer || !options.causalAvailabilityMemory
    && options.rememberKeyIdentities === true && (options.rememberAcceptedTaps || options.rememberClearedRoles),
  'Observed safety transfer requires retained actual keys and original-rule safety witnesses without a bounded placement contract');
  const excludeClosedObstacles = !!options.usePlacementContract && publicContext.boardMode === 'standard';
  assert(options.passiveInformation === undefined || [false, true, 'roles', 'frontierRoles', 'immediateRoles', 'shortRoles', 'shortAll'].includes(options.passiveInformation));
  assert(options.passiveInformationClockMin === undefined || options.passiveInformation === 'shortAll'
    && Number.isInteger(options.passiveInformationClockMin) && options.passiveInformationClockMin >= 0);
  assert(options.clockOrphanPreparation === undefined || typeof options.clockOrphanPreparation === 'boolean');
  assert(!options.clockOrphanPreparation || options.clockInformationBeforeRisk === true);
  assert(options.reusablePublicPlanning === undefined || typeof options.reusablePublicPlanning === 'boolean');
  assert(!options.reusablePublicPlanning || options.retryInformationWitness === true && options.deadEndInformation === true
    && !options.retryInformationPreferPeek);
  assert(options.reusableContinueAfterInformation === undefined || typeof options.reusableContinueAfterInformation === 'boolean');
  assert(!options.reusableContinueAfterInformation || options.reusablePublicPlanning === true);
  assert(options.reusablePrepareCrowded === undefined || typeof options.reusablePrepareCrowded === 'boolean');
  assert(!options.reusablePrepareCrowded || options.reusablePublicPlanning === true);
  assert(options.reusablePreparationClockRange === undefined || options.reusablePrepareCrowded === true);
  assert(options.reusableRetainInvestedWork === undefined || typeof options.reusableRetainInvestedWork === 'boolean');
  assert(!options.reusableRetainInvestedWork || options.reusablePublicPlanning === true);
  assert(options.reusableWarmPlanning === undefined || typeof options.reusableWarmPlanning === 'boolean');
  assert(!options.reusableWarmPlanning || options.reusablePublicPlanning === true && options.reusableContinueAfterInformation === true);
  assert(options.reusableRetainRoute === undefined || typeof options.reusableRetainRoute === 'boolean');
  assert(!options.reusableRetainRoute || options.reusablePublicPlanning === true);
  assert(options.reusableSimplifyPrefixes === undefined || typeof options.reusableSimplifyPrefixes === 'boolean');
  assert(!options.reusableSimplifyPrefixes || options.reusablePublicPlanning === true);
  assert(options.survivalBranches === undefined || typeof options.survivalBranches === 'boolean');
  assert(options.survivalBacktracking === undefined || typeof options.survivalBacktracking === 'boolean');
  assert(!options.survivalBacktracking || options.survivalBranches === true);
  assert(options.survivalEarlyForks === undefined || typeof options.survivalEarlyForks === 'boolean');
  assert(!options.survivalEarlyForks || options.survivalBacktracking === true);
  assert(options.drawnRoleInformation === undefined || typeof options.drawnRoleInformation === 'boolean');
  assert(options.drawnRoleClockSlackRange === undefined || options.drawnRoleInformation === true
    && Array.isArray(options.drawnRoleClockSlackRange) && options.drawnRoleClockSlackRange.length === 2
    && options.drawnRoleClockSlackRange.every(value => Number.isInteger(value) && value >= 0)
    && options.drawnRoleClockSlackRange[0] <= options.drawnRoleClockSlackRange[1]);
  const inspectionTrayLimit = options.inspectionTrayLimit ?? 3;
  assert(Number.isInteger(inspectionTrayLimit) && inspectionTrayLimit >= 0 && inspectionTrayLimit <= 3);
  const geometry = { tiles: tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })) };
  const orderedIndices = indices => options.publicActionSalt && options.publicActionSalt !== 1
    ? publicActionOrder(indices.map(index => ({ index })), options.publicActionSalt).map(action => action.index) : indices;
  geometry.nb = Layouts.neighbors(geometry.tiles);
  const iceNb = Layouts.iceNeighbors(geometry.tiles);
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(geometry, field, { get() { throw Error('Policy accessed private ' + field); } });
  const pictures = tiles.map(() => null), down = tiles.map(() => null), initialRoles = tiles.map(() => null);
  let attempt = 0, frontier, planner, roleSignature, roles, blocked, blockedAlive, current, clock = null, manualChoice = false;
  let lastAcceptedIndex = null;
  let observedSafetyPlanningActive = false;
  let retryRiskMemory = null;
  let failedRouteMemory = null, startingRetryKnowledge = null;
  const transfer = options.observedSafetyTransfer ? createObservedSafetyTransfer(geometry.tiles)
    : options.causalAvailabilityMemory ? createAvailabilityTransfer(geometry.tiles, { exclusiveRoles: true }) : null;
  const transferProofLabel = options.observedSafetyTransfer ? 'observedKeyAndNeighborCount' : 'publicObstacleBounds';
  const transferStats = { queries: 0, provedTransfers: 0,
    ...(options.observedSafetyClockOnly ? { clockGateSkips: 0 } : {}) };
  const transferProof = transfer ? (...args) => {
    if (options.observedSafetyClockOnly && !observedSafetyPlanningActive) {
      transferStats.clockGateSkips++; return null;
    }
    transferStats.queries++;
    const proof = transfer(...args);
    transferStats.provedTransfers += +!!proof;
    return proof;
  } : null;
  const acceptedTapMemory = options.rememberAcceptedTaps ? createAcceptedTapMemory(tiles.length, { transferProof, transferProofLabel }) : null;
  const knownLossMemory = options.rememberKnownLosses ? createKnownLossMemory(geometry,
    { inspectionSuccessors: options.rememberLossInspections, provedContinuations: options.rememberProvedContinuations }) : null;
  const clearedRoleMemory = options.rememberClearedRoles ? createClearedRoleMemory(geometry.tiles, { transferProof, transferProofLabel }) : null;
  const keyIdentityMemory = options.rememberKeyIdentities ? createKeyIdentityMemory(tiles.length) : null;
  const typedKeyKnowledge = () => keyIdentityMemory ? { keyIdentities: keyIdentityMemory.keys() } : {};
  const retryKnowledge = () => ({ pictures, down, initialRoles, ...typedKeyKnowledge() });
  const blockedTapMemory = options.rememberBlockedTaps || options.hypothesisSampling ? createBlockedTapMemory(geometry.tiles,
    { exclusiveRoles: options.exclusiveRoles === true }) : null;
  const episodes = [], hypothesisStats = { decisions: 0, changed: 0, generatedWorlds: 0, completeWorlds: 0,
    preferredWorlds: 0, unresolvedWorlds: 0, excludedByWinnabilityPreference: 0, incompleteWorlds: 0,
    verifiedHypotheticalClears: 0, rejectedAssignments: 0, thinRolloutClears: 0, wideRolloutClears: 0,
    unresolvedRollouts: 0, certifiedRolloutLosses: 0, historyReplays: 0, assignments: 0,
    cycleFilteredRoots: 0, cycleLimitedDecisions: 0, preparationCalls: 0, budgetedActions: 0, actionDeadlineStops: 0,
    contestedDecisions: 0, safetyVetoes: 0, informationEvaluations: 0, informationClears: 0,
    informationLosses: 0, informationUnresolved: 0, informationCycleStops: 0,
    exactSearchCalls: 0, exactSearchNodes: 0, exactExhaustedLosses: 0,
    optionDecisions: 0, optionChanges: 0, compoundChoices: 0, retainedOptionTaps: 0, invalidatedOptions: 0,
    confidenceDecisions: 0, confidenceOverrides: 0, confidenceSuppressed: 0 };
  const hypothesisVisits = options.hypothesisSampling ? createPublicActionVisits() : null;
  let decisionPosition = null;
  let observedTakeable = null, observedAliveKey = null, observedArrivingKey = null;
  let pendingInformationAction = null;
  let pendingEscapePlan = null;
  const cleanupIntention=options.retainCleanupIntention?createCleanupIntention():null;
  const cleanupKnowledge=()=>JSON.stringify([pictures,down,initialRoles,typedKeyKnowledge()]);
  const informationSignature = () => JSON.stringify({ pictures, down, initialRoles, roles, ...typedKeyKnowledge() });
  const physicalSignature = position => JSON.stringify(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving']
    .map(field => position[field]));
  const knowledgeSignature = () => JSON.stringify({ pictures, down, initialRoles, roles, ...typedKeyKnowledge(),
    accepted: acceptedTapMemory?.entries() ?? [], cleared: clearedRoleMemory?.entries() ?? [],
    blocked: blockedTapMemory?.entries() ?? [], knownLosses: knownLossMemory?.entries() ?? [] });
  const frontierCache = new Map();
  const settings = { ...REFERENCE_PARAMETERS, replanOnInformation: true, decisionMs: 1500, ...options,
    replanOnRetryCost: options.retryFailedRouteLearning === true };
  let decisionDeadline = Infinity;
  const baseSearch = options.hypothesisSampling ? (game, state, actions, searchOptions) => {
    const contested = options.informationSampling && state.pictures.some((picture, index) => state.alive[index] && picture === null);
    return searchPublicWitness(game, state, actions, { ...searchOptions,
      decisionMs: undefined,
      deadline: Math.min(decisionDeadline, searchOptions.deadline ?? Infinity,
        contested ? Date.now() + (options.informationPrimaryMs ?? 200) : Infinity) });
  } : searchPublicWitness;
  const retrySearchFactory = options.clockRetryLearning ? clockRetryExploration : retryExploration;
  const runRetrySearch = options.retryRiskLearning ? retrySearchFactory(baseSearch) : null;
  const completeRetrySearch = options.retryCompleteWitness ? retryCompleteSearch(runRetrySearch || baseSearch, () => attempt,
    { milliseconds: options.retryCompleteMs ?? 250, nodes: options.retryCompleteNodes ?? 2000, choices: options.choiceLimit ?? 512 }) : null;
  const informationRetry = options.retryInformationWitness ? retryInformationSearch(completeRetrySearch || runRetrySearch || baseSearch,
    { milliseconds: options.retryInformationMs ?? 250, nodes: options.retryInformationNodes ?? 2000,
      choices: options.choiceLimit ?? 512, deadEndInformation: options.deadEndInformation,
      peekTrayLimit: options.retryInformationPeekTrayLimit ?? 1, preferActualPeek: options.retryInformationPreferPeek,
      reusablePlanning: options.reusablePublicPlanning,
      continueAfterInformation: options.reusableContinueAfterInformation,
      prepareCrowded: options.reusablePrepareCrowded,
      preparationClockRange: options.reusablePreparationClockRange,
      retainInvestedWork: options.reusableRetainInvestedWork,
      warmPlanning: options.reusableWarmPlanning,
      retainRoute: options.reusableRetainRoute,
      simplifyPrefixes: options.reusableSimplifyPrefixes,
      rootCost: options.reusablePublicPlanning && options.retryRiskLearning ? index => geometry.publicRetryCost(index) : undefined,
      contextVersion: options.reusablePublicPlanning ? () => JSON.stringify([pictures, down, initialRoles, roles,
        typedKeyKnowledge(), acceptedTapMemory?.entries() ?? [], clearedRoleMemory?.entries() ?? [],
        blockedTapMemory?.entries() ?? [], observedTakeable, Array.from(blocked), observedSafetyPlanningActive,
        physicalSignature(current)]) : undefined }) : null;
  const knownPortfolio = options.knownWitnessPortfolio ? createKnownWitnessPortfolio(
    informationRetry?.search || completeRetrySearch || runRetrySearch || baseSearch,
    { milliseconds: options.knownWitnessMs ?? 250, nodes: options.knownWitnessNodes ?? 4096,
      choices: options.choiceLimit ?? 512 }, baseSearch) : null;
  const survivalSearch = options.survivalBranches ? survivalBranchSearch(knownPortfolio?.search || informationRetry?.search
    || completeRetrySearch || runRetrySearch || baseSearch,
  { nodes: options.survivalNodes ?? 2048, milliseconds: options.survivalMs ?? 100, width: options.survivalBranchWidth ?? 3,
    backtracking: options.survivalBacktracking, earlyForks: options.survivalEarlyForks }) : null;
  const resetPlanner = () => {
    const selectedSearch = survivalSearch?.search || knownPortfolio?.search || informationRetry?.search || completeRetrySearch || runRetrySearch || (options.hypothesisSampling ? baseSearch : null);
    planner = selectedSearch ? reference(settings, selectedSearch) : reference(settings);
  };
  if (options.retryRiskLearning) geometry.publicRetryCost = index => retryRiskMemory && current ? Math.max(
    retryRiskMemory.cost(current, index),
    options.retryPictureLearning ? retryRiskMemory.pictureCost(current,pictures[index],!observedTakeable || observedTakeable.some((yes,mate)=>
      yes&&mate!==index&&current.alive[mate]&&pictures[mate]===pictures[index])) : 0,
    failedRouteMemory?.cost(current, index, JSON.stringify(retryKnowledge())) ?? 0) : 0;
  if (knownLossMemory) geometry.publicKnownLoss = position => knownLossMemory.knowsLoss(position);
  if (options.rememberProvedContinuations) geometry.publicRetainKnownLoss = (origin, path, target, report) => {
    assert(current && origin.physicalTaps === current.physicalTaps && physicalSignature(origin) === physicalSignature(current));
    assert.deepEqual(origin.pictures, current.pictures); assert.deepEqual(origin.down, current.down);
    return knownLossMemory.recordContinuation(origin, path, target, report);
  };
  return {
    rememberPublic(memory) {
      assert.equal(attempt, 0, 'Seed a fresh same-level policy before its first frame');
      assert.deepEqual(Object.keys(memory).sort(), ['down', 'initialRoles', 'pictures']);
      assert(['pictures', 'down', 'initialRoles'].every(field => Array.isArray(memory[field]) && memory[field].length === tiles.length));
      assert(memory.pictures.every(value => value === null || Number.isInteger(value) && value >= 0 && value <= 101));
      assert(memory.down.every(value => value === null || value === 0 || value === 1));
      assert(memory.initialRoles.every(value => value === null || ['none', 'ice', 'ice2', 'key', 'lock'].includes(value)));
      for (const [index, picture] of memory.pictures.entries()) pictures[index] = picture;
      for (const [index, value] of memory.down.entries()) down[index] = value;
      for (const [index, value] of memory.initialRoles.entries()) initialRoles[index] = value;
    },
    beginAttempt() {
      startingRetryKnowledge = JSON.stringify(retryKnowledge());
      failedRouteMemory?.beginAttempt(startingRetryKnowledge);
      informationRetry?.beginAttempt(retryKnowledge());
      survivalSearch?.beginAttempt();
      attempt++; frontier = createObstacleFrontier(tiles, { exclusiveRoles: !!options.exclusiveRoles }); roleSignature = null;
      roles = tiles.map(() => null); blocked = new Set(); blockedAlive = null; current = null;
      observedTakeable = null; observedAliveKey = null; observedArrivingKey = null;
      lastAcceptedIndex = null;
      observedSafetyPlanningActive = false;
      retryRiskMemory?.beginAttempt();
      blockedTapMemory?.beginAttempt();
      if (options.hypothesisSampling) episodes.push({ actions: [], frames: [] });
      hypothesisVisits?.beginAttempt(); decisionPosition = null;
      pendingInformationAction = null;
      pendingEscapePlan = null;
      cleanupIntention?.clear();
      resetPlanner();
    },
    observe(state, observed) {
      frontierCache.clear();
      assert(attempt > 0);
      assert(!current || state.physicalTaps > current.physicalTaps);
      if (current && lastAcceptedIndex !== null) {
        retryRiskMemory?.observeTransition(current, lastAcceptedIndex, state);
        failedRouteMemory?.observeTransition(current, lastAcceptedIndex, state);
        acceptedTapMemory?.observeAccepted(lastAcceptedIndex, current, state);
        const inferred = inferMatchedPicture(current, lastAcceptedIndex, { alive: state.alive, tray: state.tray,
          moves: state.moves, openPeek: state.openPeek, physicalTaps: state.physicalTaps });
        if (inferred) {
          assert(pictures[inferred.index] === null || pictures[inferred.index] === inferred.picture);
          pictures[inferred.index] = inferred.picture;
        }
      }
      lastAcceptedIndex = null;
      if (options.hypothesisSampling) episodes.at(-1).frames.push({
        state: Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving', 'physicalTaps']
          .map(field => [field, structuredClone(state[field])])), roles: observed.roles.slice() });
      observed.pictures.forEach((picture, index) => {
        if (picture !== null) { assert(pictures[index] === null || pictures[index] === picture); pictures[index] = picture; }
        if (observed.down[index] !== null) { assert(down[index] === null || down[index] === observed.down[index]); down[index] = observed.down[index]; }
      });
      if (observed.clock) clock = { i: observed.clock.i, n: observed.clock.n };
      if (options.retryRiskLearning && !retryRiskMemory) retryRiskMemory = createRetryRiskMemory(clock,{generalizePictures:options.retryPictureLearning});
      if (options.retryFailedRouteLearning && !failedRouteMemory) {
        failedRouteMemory = createFailedRouteMemory(clock);
        failedRouteMemory.beginAttempt(startingRetryKnowledge);
      }
      const rows = [];
      observed.roles.forEach((role, index) => {
        const value = role ?? (state.physicalTaps === 0 ? initialRoles[index] : null);
        if (value === null || !state.alive[index]) return;
        roles[index] = value;
        let initialRole = state.physicalTaps === 0 ? value : null;
        if (options.exclusiveRoles && ['key', 'lock'].includes(role)) initialRole = role;
        if (options.exclusiveRoles && role?.startsWith('ice')) {
          const initialHits = (role === 'ice2' ? 2 : 1) + iceNb[index].filter(neighbor => !state.alive[neighbor]).length;
          assert(initialHits === 1 || initialHits === 2, 'Observed ice contradicts the declared one/two-hit contract');
          initialRole = initialHits === 2 ? 'ice2' : 'ice';
        }
        if (initialRole !== null) {
          assert(initialRoles[index] === null || initialRoles[index] === initialRole, 'Observed role contradicts learned starting role');
          initialRoles[index] = initialRole;
        }
        rows.push({ index, observation: { roles: [value], knownRole: value } });
      });
      frontier.observe({ alive: state.alive, physicalTaps: state.physicalTaps }, rows);
      clearedRoleMemory?.observe(state, observed.roles);
      keyIdentityMemory?.observe(state, observed.roles, attempt);
      informationRetry?.observe(retryKnowledge());
      current = { ...structuredClone(state), down: down.map((value, index) => state.alive[index] ? value : 0),
        pictures: pictures.map((picture, index) => state.alive[index] ? picture : null) };
      assert(observed.takeable === undefined || Array.isArray(observed.takeable)
        && observed.takeable.length === tiles.length && observed.takeable.every(value => value === null || typeof value === 'boolean'));
      observedTakeable = observed.takeable?.slice() ?? null;
      if (observedTakeable) acceptedTapMemory?.observeAvailable(observedTakeable, state);
      observedAliveKey = aliveSignature(state.alive);
      observedArrivingKey = (state.arriving ?? []).join(',');
      const aliveKey = state.alive.join('');
      if (aliveKey !== blockedAlive) { blocked.clear(); blockedAlive = aliveKey; }
      const signature = roles.join(',');
      if (roleSignature !== signature && !planner.report()?.knownWin) resetPlanner();
      roleSignature = signature;
      geometry.clock = clock;
      geometry.rules = { iceNb, ice: Object.fromEntries(roles.flatMap((role, index) => role?.startsWith('ice')
        ? [[index, startingIceHits(role, initialRoles[index], iceNb[index].filter(neighbor => !state.alive[neighbor]).length)]] : [])),
        locks: new Set(roles.flatMap((role, index) => role === 'lock' ? [index] : [])),
        keys: roles.flatMap((role, index) => role === 'key' ? [index] : []) };
      let observedKeys = initialRoles.flatMap((role, index) => role === 'key' ? [index] : []);
      if (keyIdentityMemory) {
        const knownKeys = keyIdentityMemory.keys();
        const keys = [...new Set([...geometry.rules.keys, ...knownKeys])].sort((left, right) => left - right);
        const publicKeyGame = { tiles: geometry.tiles, nb: geometry.nb, rules: { ...geometry.rules, keys }, clock };
        if (keyPlanningAllowed(publicKeyGame, current, options.keyPlanningSlackAbove, !!options.keyPlanningCrowdedAfterClock, !!options.keyPlanningBeforeCrowding, options.keyPlanningCrowdedTrayMin??2)) {
          geometry.rules.keys = keys;
          observedKeys = [...new Set([...observedKeys, ...knownKeys])].sort((left, right) => left - right);
        }
      }
      observedSafetyPlanningActive = !!options.observedSafetyTransfer && observedSafetyPlanningAllowed(geometry, current,
        !!options.observedSafetyClockOnly, options.observedSafetyMaxClockSlack, keyIdentityMemory.keys());
      const availabilityKeys = options.observedSafetyTransfer
        ? [...new Set([...observedKeys, ...keyIdentityMemory.keys()])].sort((left, right) => left - right) : observedKeys;
      geometry.publicFrontier = position => {
        Object.freeze(position.alive);
        const aliveKey = aliveSignature(position.alive);
        const sameObserved = !!observedTakeable && aliveKey === observedAliveKey && position.moves === current.moves
          && position.openPeek === current.openPeek && !!position.relieved === !!current.relieved
          && position.tray.join(',') === current.tray.join(',') && (position.arriving ?? []).join(',') === observedArrivingKey;
        const cacheKey = +!!position.relieved + '|' + +(position.tray.length < Layouts.SLOTS) + '|' + aliveKey + '|observed:' + +sameObserved;
        if (frontierCache.has(cacheKey)) return frontierCache.get(cacheKey);
        if (sameObserved) {
          const result = { free: orderedIndices(observedTakeable.flatMap((value, index) => value === true ? [index] : [])),
            uncertain: [], relieved: !!position.relieved };
          frontierCache.set(cacheKey, result); return result;
        }
        const queried = frontier.query(position.alive, options.exclusiveRoles === 'clock'
          ? !!(clock && position.alive[clock.i]) : !!options.exclusiveRoles);
        const sameBoard = aliveKey === blockedAlive;
        let free = position.relieved ? position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, geometry.nb) ? [index] : [])
          : [...queried.free, ...queried.uncertain];
        free = free.filter(index => (!sameBoard || !blocked.has(index))
          && !blockedTapMemory?.knowsBlocked(index, position.alive, observedKeys, !!position.relieved));
        let relieved = !!position.relieved;
        if (!relieved && !free.length && position.tray.length < Layouts.SLOTS) {
          free = position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, geometry.nb) ? [index] : []);
          relieved = free.length > 0;
        }
        const result = { free: orderedIndices(free), relieved,
          uncertain: relieved ? [] : queried.uncertain.filter(index => free.includes(index) && (!sameBoard || !blocked.has(index))
            && !(excludeClosedObstacles && down[index] === 1)
            && !acceptedTapMemory?.knowsAvailable(index, position.alive, availabilityKeys)
            && !clearedRoleMemory?.knowsAvailable(index, position.alive, availabilityKeys)) };
        frontierCache.set(cacheKey, result); return result;
      };
      const drawnRoleActive = options.drawnRoleInformation
        && drawnRolePlanningAllowed(geometry, current, options.drawnRoleClockSlackRange, keyIdentityMemory?.keys() ?? []);
      const exposureFactory = drawnRoleActive ? createDrawnRoleFrontier : createExposureFrontier;
      if (drawnRoleActive) geometry.publicRoleExposure = createDrawnRoleFrontier(geometry.tiles, { ...current, roles }, 'roles');
      else delete geometry.publicRoleExposure;
      const exposure = options.passiveInformation ? exposureFactory(geometry.tiles, { ...current, roles },
        passiveExposureMode(options.passiveInformation, current, clock, options.passiveInformationClockMin)) : undefined;
      geometry.publicExposure = options.passiveInformation === 'frontierRoles' ? position => {
        const gained = exposure(position);
        if (!gained.length) return gained;
        const available = geometry.publicFrontier(position);
        return gained.filter(index => available.free.includes(index));
      } : exposure;
      if (options.deadEndInformation) geometry.publicInformationExposure = createExposureFrontier(
        geometry.tiles, { ...current, roles }, 'all', true);
      else delete geometry.publicInformationExposure;
    },
    decide() {
      const escapeDeadline = Date.now() + 1900;
      decisionDeadline = options.hypothesisSampling ? Date.now() + (options.informationSampling ? 1300 : 1500) : Infinity;
      const available = geometry.publicFrontier(current);
      let actions = publicActionOrder(available.free.map(index => ({ index })), options.publicActionSalt ?? 1);
      const initialActions = actions.slice();
      if (!actions.length) return null;
      if (pendingInformationAction) {
        const pending = pendingInformationAction; pendingInformationAction = null;
        if (pending.expected === physicalSignature(current) && pending.knowledge === informationSignature()
          && actions.some(action => action.index === pending.index)) {
          const predicted = advance(geometry, current, pending.index);
          if (predicted.uncertain || !predicted.lost) {
            hypothesisStats.retainedOptionTaps++;
            manualChoice = true; resetPlanner();
            return { plan: { index: pending.index, path: [pending.index], goal: 'sampledOptionContinuation',
              knownWin: !predicted.uncertain && predicted.win, knownDead: false, knownProgress: predicted.removed ?? 0,
              nodes: 0, boundary: !!predicted.uncertain, information: !!predicted.uncertain }, predicted };
          }
        }
        hypothesisStats.invalidatedOptions++;
      }
      if (hypothesisVisits) decisionPosition = JSON.stringify(Object.fromEntries(
        ['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving'].map(field => [field, current[field]])));
      const finalizeStrategy = selected => {
        if (options.learnedEscapePlanning) {
          const protectedPlan = selected.plan.knownWin || selected.plan.safeClockExit
            || selected.plan.survivalBranches?.necessaryIfSolvable || selected.plan.deadCertificate?.exhaustedKnownGraph;
          const retained = pendingEscapePlan; pendingEscapePlan = null;
          let replacement = null;
          if (!protectedPlan && retained?.expected === physicalSignature(current)
            && retained.knowledge === informationSignature()
            && initialActions.some(action => action.index === retained.plan.path[0])
            && !available.uncertain.includes(retained.plan.path[0])
            && !selected.plan.provedDeadRoots?.includes(retained.plan.path[0])) {
            const moved = advance(geometry, current, retained.plan.path[0]);
            if (!moved.uncertain && !moved.lost) replacement = { ...retained.plan,
              index: retained.plan.path[0], learnedEscape: { ...retained.plan.learnedEscape, retainedKnownPrefix: true } };
          }
          if (!replacement && !protectedPlan) replacement = learnedEscapePlan(geometry, current, initialActions,
            selected.plan, { roles, knownKeys: keyIdentityMemory?.keys() ?? [] },
            { deadline: escapeDeadline, continuationRanking: options.learnedEscapeContinuationRanking });
          if (replacement) {
            const predicted = advance(geometry, current, replacement.index);
            if (replacement.path.length > 1 && !predicted.uncertain && !predicted.lost) pendingEscapePlan = {
              expected: physicalSignature(predicted.state), knowledge: informationSignature(),
              plan: { ...replacement, path: replacement.path.slice(1) } };
            manualChoice = true; resetPlanner(); selected = { plan: replacement, predicted };
          }
        }
        if (options.informationSampling && selected.plan.knownDead && selected.plan.deadCertificate?.exhaustedKnownGraph) return selected;
        if (!options.hypothesisSampling || !options.informationSampling && (selected.plan.knownWin || selected.plan.safeClockExit
          || selected.plan.knownDead || current.tray.length < 2) || !current.pictures.some((picture, index) => current.alive[index] && picture === null)
          || Date.now() >= decisionDeadline) return selected;
        const knowledge = knowledgeSignature();
        const candidates = options.informationSampling ? initialActions.filter(action => {
          const predicted = advance(geometry, current, action.index);
          return (predicted.uncertain || !predicted.lost) && !selected.plan.provedDeadRoots?.includes(action.index);
        }) : actions.filter(action => action.index === selected.plan.index
          || !hypothesisVisits.hasTried(decisionPosition, knowledge, action.index));
        const removed = options.informationSampling ? 0 : actions.length - candidates.length;
        hypothesisStats.cycleFilteredRoots += removed; hypothesisStats.cycleLimitedDecisions += +(removed > 0);
        if (candidates.length < 2) {
          if (options.informationSampling && candidates.length && candidates[0].index !== selected.plan.index) {
            const index = candidates[0].index, predicted = advance(geometry, current, index);
            manualChoice = true; resetPlanner();
            return { plan: { ...selected.plan, index, path: [index], goal: 'onlyUnprovedLosingAction',
              knownWin: !!predicted.win, knownDead: false, safeClockExit: false }, predicted };
          }
          return selected;
        }
        let publicHash = 2166136261;
        for (const character of JSON.stringify({ tiles: geometry.tiles, pictures, down, initialRoles,
          alive: current.alive, tray: current.tray, moves: current.moves, openPeek: current.openPeek })) {
          publicHash = Math.imul(publicHash ^ character.charCodeAt(0), 16777619) >>> 0;
        }
        const random = Layouts.rng(saltedPublicSeed(publicHash, options.hypothesisRunSalt ?? 1));
        const createPolicy = options.informationSampling ? deadline => createHumanController(geometry.tiles,
          { ...options, hypothesisSampling: false, informationSampling: false, hypothesisActionMs: undefined,
            causalAvailabilityMemory: false, rememberAcceptedTaps: false, rememberClearedRoles: false,
            rememberKnownLosses: false, rememberBlockedTaps: true, keyAccessMacros: false,
            goalRecovery: false, obstacleFrontier: false, alternativeGoalRoutes: false, alternativeRecoveryRoutes: false,
            preservePairFlexibility: false, pruneDead: false, continuationPruning: false,
            inspectBeforeCommit: true, inspectionTrayLimit: 3,
            nodes: options.informationPlayoutNodes ?? 1, beam: 1, taps: 4, finishKnown: false, proofNodes: 2,
            decisionMs: undefined, deadline }, publicContext) : null;
        const physics = createHypothesisPhysics({ tiles: geometry.tiles, rememberedPictures: pictures, rememberedDown: down,
          initialRoles, episodes, blockedFacts: blockedTapMemory.entries(), boardMode: publicContext.boardMode, clock }, { random, createPolicy });
        const problem = { rememberedPictures: pictures, actions: candidates.map(action => action.index),
          fallbackIndex: candidates.some(action => action.index === selected.plan.index) ? selected.plan.index : candidates[0].index };
        const actionOptions = options.informationSampling && options.informationActionPaths
          ? informationActions(Object.fromEntries(['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure']
            .map(field => [field, geometry[field]])), current, problem.actions,
          { primitivePeeks: options.informationPrimitivePeeks ?? true }) : null;
        const fallbackOption = actionOptions && (actionOptions.find(choice => choice.index === problem.fallbackIndex
          && choice.path.every((index, offset) => selected.plan.path?.[offset] === index))
          ?? actionOptions.find(choice => choice.index === problem.fallbackIndex));
        const samplingProblem = actionOptions ? { ...problem, actions: actionOptions.map(choice => choice.id),
          actionPaths: actionOptions.map(choice => choice.path), fallbackIndex: fallbackOption.id } : problem;
        const rankOptions = { deadline: decisionDeadline, random,
          maximumWorlds: options.hypothesisMaximumWorlds, nodesPerAction: options.hypothesisNodesPerAction };
        const ranking = options.informationSampling ? rankInformationActions({ ...samplingProblem,
          unseenCount: current.pictures.filter((picture, index) => current.alive[index] && picture === null).length,
          unseenFraction: current.pictures.filter((picture, index) => current.alive[index] && picture === null).length
            / current.alive.reduce((sum, alive) => sum + alive, 0) }, {
          deadline: Math.min(decisionDeadline, Date.now() + 1300), random, physics, schedule: options.informationSchedule ?? 'sequential',
          picturePrior: options.informationPicturePrior ?? 'uniform',
          exactUnknownLimit: options.informationExactUnknownLimit ?? 8,
          scoreMode: options.informationScoreMode ?? 'clear', confidenceSE: options.informationConfidenceSE ?? 0,
          maximumWorlds: options.hypothesisMaximumWorlds ?? 128 }) : options.hypothesisActionMs === undefined
          ? rankHypothesisActions(problem, { ...rankOptions, evaluate: physics.evaluate })
          : rankBudgetedHypotheses(problem, { ...rankOptions, physics, actionMs: options.hypothesisActionMs });
        const rankedPath = actionOptions ? actionOptions.find(choice => choice.id === ranking.index).path : [ranking.index];
        const rankedIndex = rankedPath[0];
        hypothesisStats.optionDecisions += +!!actionOptions;
        hypothesisStats.optionChanges += +(!!actionOptions && ranking.index !== fallbackOption.id);
        hypothesisStats.compoundChoices += +(rankedPath.length > 1);
        if (ranking.confidence?.thresholdSE > 0) {
          hypothesisStats.confidenceDecisions++;
          hypothesisStats.confidenceOverrides += +ranking.confidence.overrideAllowed;
          hypothesisStats.confidenceSuppressed += +(ranking.confidence.rawWinner !== ranking.confidence.primaryIndex
            && !ranking.confidence.overrideAllowed);
        }
        const physicalStats = physics.stats(), predicted = advance(geometry, current, rankedIndex);
        const changed = rankedIndex !== selected.plan.index && (predicted.uncertain || !predicted.lost);
        const sampledChange = changed && rankedIndex !== problem.fallbackIndex;
        hypothesisStats.decisions++; hypothesisStats.changed += +sampledChange;
        hypothesisStats.safetyVetoes += +(problem.fallbackIndex !== selected.plan.index);
        hypothesisStats.contestedDecisions += +!!options.informationSampling;
        for (const field of ['informationEvaluations', 'informationClears', 'informationLosses', 'informationUnresolved',
          'informationCycleStops', 'exactSearchCalls', 'exactSearchNodes', 'exactExhaustedLosses']) hypothesisStats[field] += physicalStats[field];
        for (const field of ['generatedWorlds', 'completeWorlds', 'preferredWorlds', 'unresolvedWorlds',
          'excludedByWinnabilityPreference', 'incompleteWorlds']) hypothesisStats[field] += ranking[field];
        for (const field of ['preparationCalls', 'budgetedActions', 'actionDeadlineStops']) hypothesisStats[field] += ranking[field] ?? 0;
        for (const field of ['verifiedHypotheticalClears', 'rejectedAssignments', 'thinRolloutClears', 'wideRolloutClears',
          'unresolvedRollouts', 'certifiedRolloutLosses', 'historyReplays', 'assignments']) hypothesisStats[field] += physicalStats[field];
        const audit = { ...ranking, ...physicalStats, primaryOptionId: samplingProblem.fallbackIndex,
          changed: sampledChange, safetyVetoed: problem.fallbackIndex !== selected.plan.index,
          primaryIndex: selected.plan.index,
          sharedDeadline: decisionDeadline };
        if (rankedPath.length > 1) {
          assert(!predicted.uncertain && !predicted.lost && predicted.removed === 0);
          pendingInformationAction = { index: rankedPath[1], expected: physicalSignature(predicted.state), knowledge: informationSignature() };
        }
        if (!changed && rankedPath.length === 1) return { ...selected, plan: { ...selected.plan, hypothesisAudit: audit } };
        manualChoice = true; resetPlanner();
        return { plan: { index: rankedIndex, path: rankedPath, goal: rankedPath.length > 1 ? 'hypothesisOption' : 'hypothesisChoice', knownWin: false, knownDead: false,
          knownProgress: predicted.uncertain ? 0 : predicted.removed, information: !!predicted.uncertain,
          boundary: true, nodes: selected.plan.nodes + ranking.nodes, hypothesisAudit: audit }, predicted };
      };
      const finalize = selected => {
        const resumed=cleanupIntention?.propose(geometry,current,selected.plan,cleanupKnowledge());
        if(resumed){manualChoice=true;resetPlanner();pendingEscapePlan=null;pendingInformationAction=null;}
        const chosen = resumed?{plan:resumed,predicted:advance(geometry,current,resumed.index)}:finalizeStrategy(selected);
        const keyAwareRecovery=options.keyAwareTrayRecovery&&(!clock||!current.alive[clock.i])
          &&current.tray.length>=(options.keyPlanningCrowdedTrayMin??2)&&current.tray.length<=3;
        if (!options.avoidThirdTrayInformation&&!keyAwareRecovery) return chosen;
        const guarded = trayInformationGuard(geometry,current,chosen.plan,
          {deadline:escapeDeadline,knownKeys:keyIdentityMemory?.keys()??[],preserveClockSlack:!!options.trayGuardClockSlack});
        if (!guarded) return chosen;
        if (guarded.noOverride) return {...chosen,plan:{...chosen.plan,traySafety:guarded.traySafety}};
        cleanupIntention?.remember(chosen.plan,cleanupKnowledge());
        pendingEscapePlan=null;pendingInformationAction=null;manualChoice=true;resetPlanner();
        return {plan:guarded,predicted:advance(geometry,current,guarded.index)};
      };
      if (options.probeUnknownClock && clock && current.alive[clock.i] && !planner.report()?.knownWin
        && actions.some(action => action.index === clock.i)) {
        const freePeek = current.down[clock.i] === 1 && current.openPeek !== clock.i;
        const trayMatch = current.pictures[clock.i] !== null && current.tray.includes(current.pictures[clock.i]);
        if (freePeek || trayMatch || current.tray.length <= (options.clockProbeTrayLimit ?? 1)) {
          const predicted = advance(geometry, current, clock.i);
          if (predicted.uncertain) {
            manualChoice = true; resetPlanner();
            return { plan: { index: clock.i, path: [clock.i], goal: 'publicClockProbe', knownWin: false,
              knownDead: false, knownProgress: 0, information: true, boundary: true, nodes: 0 }, predicted };
          }
        }
      }
      const inspectionClockActive = !!(clock && current.alive[clock.i]);
      const inspectionBudgetRange = options.safeClockInspectionBudgetRange;
      const clockInspectionAllowed = inspectionClockActive && options.safeClockInspection
        && (!inspectionBudgetRange || clock.n >= inspectionBudgetRange[0] && clock.n <= inspectionBudgetRange[1]);
      const discoveries = options.inspectBeforeCommit && current.tray.length <= inspectionTrayLimit
        && (!inspectionClockActive || clockInspectionAllowed)
        ? actions.filter(action => current.down[action.index] === 1 && current.openPeek !== action.index && current.pictures[action.index] === null
          && (!inspectionClockActive || safeClosedInspection(current, action.index, clock, true))) : [];
      manualChoice = false;
      const discover = () => {
        manualChoice = true;
        const recovered = options.protectOpenTwin ? openTwinRecovery(geometry, current) : null;
        if (recovered) {
          resetPlanner();
          const won = !recovered.moved.state.alive.some(Boolean) && !recovered.moved.state.tray.length;
          return { plan: { index: recovered.index, path: [recovered.index], goal: won ? 'win' : 'knownOpenTwin',
            knownWin: won, knownDead: false, knownProgress: 2, information: false, boundary: !won, nodes: 0 },
          predicted: recovered.moved };
        }
        const index = discoveries[0].index;
        resetPlanner();
        return { plan: { index, path: [index], goal: 'closedTileDiscovery', knownWin: false, knownDead: false,
          knownProgress: 0, information: true, boundary: true, nodes: 0 }, predicted: advance(geometry, current, index) };
      };
      if (discoveries.length && options.inspectBeforeCommit !== 'recovery') return finalize(discover());
      if (options.patientSingleCarry && current.tray.length === 1 && !(clock && current.alive[clock.i])) {
        const guaranteed = actions.filter(action => !available.uncertain.includes(action.index));
        const ready = guaranteed.filter(action => {
          const picture = current.pictures[action.index];
          return picture !== null && (picture === current.tray[0] || guaranteed.some(partner =>
            partner.index !== action.index && current.pictures[partner.index] === picture));
        });
        if (ready.length) actions = ready;
      }
      const cleanup = options.uniqueKnownCleanup ? knownCleanup(geometry, current, actions) : null;
      if (cleanup) {
        manualChoice = true; resetPlanner();
        const index = cleanup.path[0], won = !cleanup.state.alive.some(Boolean) && !cleanup.state.tray.length;
        return finalize({ plan: { index, path: cleanup.path, goal: won ? 'win' : 'knownUniqueCleanup', knownWin: won,
          knownDead: false, knownProgress: cleanup.removed, information: false, boundary: !won, nodes: 0 },
        predicted: advance(geometry, current, index) });
      }
      const activeClock = !!(clock && current.alive[clock.i]);
      const mayExploreRetry = !activeClock || options.clockRetryLearning && !planner.report()?.safeClockExit;
      if (retryRiskMemory && !options.retryFailedRouteLearning && mayExploreRetry && !planner.report()?.knownWin
        && actions.some(action => geometry.publicRetryCost(action.index) > 0)) resetPlanner();
      planner.physicalTrayPlanning(geometry, current, actions);
      const plan = planner.report();
      if (knownLossMemory) knownLossMemory.recordActual(current, plan, actions);
      if (discoveries.length && !discoveries.some(action => action.index === plan.index)
        && !preferKnownRecovery(geometry, current, plan)) return finalize(discover());
      const predicted = advance(geometry, current, plan.index);
      return finalize({ plan: structuredClone(plan), predicted });
    },
    acknowledge(index, accepted) {
      cleanupIntention?.acknowledge(index,accepted);
      survivalSearch?.acknowledge(index, accepted);
      lastAcceptedIndex = accepted ? index : null;
      if (accepted && hypothesisVisits) hypothesisVisits.recordActual(decisionPosition, knowledgeSignature(), index);
      if (accepted && options.hypothesisSampling) episodes.at(-1).actions.push(index);
      if (accepted) { if (!manualChoice) planner.acknowledgeTile(index); }
      else {
        assert(geometry.publicFrontier(current).uncertain.includes(index), 'A guaranteed public tap was rejected by production');
        blockedTapMemory?.observeBlocked(index, { alive: current.alive, physicalTaps: current.physicalTaps,
          relieved: !!current.relieved });
        blocked.add(index); frontierCache.clear(); resetPlanner();
      }
    },
    known() { return { pictures: pictures.slice(), down: down.slice(), initialRoles: initialRoles.slice() }; },
    completeAttempt(status) {
      if (options.hypothesisSampling) episodes.at(-1).status = status;
      informationRetry?.finish(status, retryKnowledge());
      survivalSearch?.finish(status);
      const routePreferences = failedRouteMemory?.finish(status, JSON.stringify(retryKnowledge())) ?? 0;
      const risk = retryRiskMemory?.finish(status) ?? null;
      return routePreferences ? { ...risk, failedRoutePreferences: routePreferences } : risk;
    },
    retryEvidence() { return [...(retryRiskMemory?.entries() ?? []), ...(failedRouteMemory?.entries() ?? [])]; },
    retryCompletionStats() { return completeRetrySearch?.stats() ?? null; },
    retryInformationStats() { return informationRetry?.stats() ?? null; },
    knownPortfolioStats() { return knownPortfolio?.stats() ?? null; },
    survivalBranchStats() { return survivalSearch?.stats() ?? null; },
    acceptedEvidence() { return acceptedTapMemory?.entries() ?? []; },
    knownLossEvidence() { return knownLossMemory?.entries() ?? []; },
    clearedRoleEvidence() { return clearedRoleMemory?.entries() ?? []; },
    keyIdentityEvidence() { return keyIdentityMemory?.entries() ?? []; },
    blockedEvidence() { return blockedTapMemory?.entries() ?? []; },
    causalAvailabilityStats() { return { ...transferStats }; },
    hypothesisStats() { return { ...hypothesisStats }; },
    knowledgeSignature,
    state() { return structuredClone(current); },
    explainInformation(path) { return describeInformation(geometry, current, path, roles); },
  };
}

function startingIceHits(currentRole, rememberedRole, removedNeighbors) {
  if (rememberedRole?.startsWith('ice')) return rememberedRole === 'ice2' ? 2 : 1;
  return (currentRole === 'ice2' ? 2 : 1) + removedNeighbors;
}

function visibleRole(game, state, index) {
  if (!game.rules || state.relieved) return 'none';
  const rules = game.rules, gone = rules.iceNb[index].filter(neighbor => !state.alive[neighbor]).length;
  const remaining = Math.max(0, (rules.ice[index] || 0) - gone);
  if (remaining) return remaining > 1 ? 'ice2' : 'ice';
  const keysLeft = (rules.keys || []).some(key => state.alive[key]);
  if (keysLeft && rules.locks?.has(index)) return 'lock';
  if (keysLeft && (rules.keys || []).includes(index)) return 'key';
  return 'none';
}

function verifyAttempt(encoded, actions, settings, audit) {
  if (!actions.length) { assert.equal(audit.physicalLog.length, 0); return 0; }
  const replaySettings = audit.result ? settings : { ...settings, choiceLimit: actions.length };
  const replay = { ...decodeGame(encoded), physicalLog: [] }, trace = [];
  let available, cursor = 0;
  const result = Hard.play(replay, { ...parameters(encoded.tiles.length, replaySettings),
    physicalTrayPlanning(game, state, candidates) { available = candidates; return { features: candidates.map(() => []), nodes: 0, boundaries: 0 }; },
    physicalChoice() {
      const requested = actions[cursor++], selected = available.findIndex(action => action.index === requested);
      assert(selected >= 0, JSON.stringify({ message: 'Independent replay rejected a recorded physical action', cursor,
        requested: actions[cursor - 1], available: available.map(action => action.index), total: actions.length })); return selected;
    } }, settings.seed, trace);
  assert.equal(cursor, actions.length);
  if (audit.result) assert.deepEqual(result, audit.result);
  else assert.equal(result.why, 'contextChoiceLimit');
  assert.deepEqual(replay.physicalLog, audit.physicalLog); assert.deepEqual(trace, audit.trace);
  return actions.length;
}

function playHumanCampaign(input, options = {}) {
  assert(Object.keys(options).every(key => ['maximumAttempts', 'choiceLimit', 'planning', 'captureDecisions', 'captureInformation', 'publicContext'].includes(key)));
  assert(options.captureInformation === undefined || typeof options.captureInformation === 'boolean');
  assert(!options.captureInformation || options.captureDecisions);
  const settings = { seed: 20261111, choiceLimit: options.choiceLimit ?? 512, tapMs: 1000 };
  const maximumAttempts = options.maximumAttempts ?? 3;
  assert(Number.isInteger(maximumAttempts) && maximumAttempts > 0);
  const encoded = encodeGame(input), game = decodeGame(encoded), controller = createHumanController(game.tiles,
    { ...options.planning, choiceLimit: settings.choiceLimit }, options.publicContext);
  if ((options.planning?.usePlacementContract || options.planning?.hypothesisSampling) && options.publicContext?.boardMode === 'standard') {
    const specials = new Set([...(game.rules?.keys || []), ...(game.rules?.locks || []),
      ...Object.keys(game.rules?.ice || {}).filter(index => game.rules.ice[index] > 0).map(Number)]);
    assert([...specials].every(index => !game.down[index]), 'Standard placement contract forbids ice, locks or keys on initially closed tiles');
  }
  if (options.planning?.exclusiveRoles && game.rules) {
    const keys = game.rules.keys || [], locks = [...(game.rules.locks || [])];
    const ice = Object.keys(game.rules.ice || {}).filter(index => game.rules.ice[index] > 0).map(Number);
    assert(keys.length === 0 || keys.length === 2, 'Exclusive production-role contract requires zero or two keys');
    const special = [...keys, ...locks, ...ice];
    assert.equal(new Set(special).size, special.length, 'Exclusive production-role contract forbids stacked roles');
    assert(ice.every(index => game.rules.ice[index] <= 2), 'Exclusive production-role contract supports one/two-hit ice');
  }
  if ((options.planning?.causalAvailabilityMemory || options.planning?.rememberBlockedTaps || options.planning?.hypothesisSampling) && game.rules) {
    const ordered = rows => Array.from(rows, row => Array.from(row).sort((left, right) => left - right));
    assert.deepEqual(ordered(game.rules.iceNb), ordered(Layouts.iceNeighbors(game.tiles)), 'Public obstacle memory requires the public geometric ice neighborhood');
  }
  if (options.planning?.hypothesisSampling) {
    const odd = new Set();
    for (const picture of game.faces) { if (odd.has(picture)) odd.delete(picture); else odd.add(picture); }
    assert.equal(odd.size, 0, 'Hypothesis sampling requires paired initial pictures');
    assert(game.faces.filter(picture => picture === 101).length <= 2, 'Hypothesis sampling requires at most two initial Jokers');
  }
  const factory = createSessionFactory(), attempts = [];
  let slowestMs = 0, controls = 0, verifiedTaps = 0, rejected = 0, decision = null;
  let decisionCount = 0, totalDecisionMs = 0, dominanceStops = 0;
  const clockRetry = options.planning?.clockRetryLearning ? { decisionsAudited: 0, decisionsUsingAlternative: 0 } : null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
    controller.beginAttempt();
    const session = factory(game, settings), actions = [], decisions = [];
    let status = null, previousTap = -1, lastPlan = null;
    for (;;) {
      const started = performance.now(), actual = session.view(), state = actual.state;
      if (state.physicalTaps > previousTap) {
        const publicLegal = new Set(actual.legalTiles ?? []);
        const publicBoard = observeBoard(game.tiles, state, game.clock,
          { picture: index => game.faces[index], role: index => visibleRole(game, state, index),
            takeable: index => publicLegal.has(index) });
        controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
          relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps }, publicBoard);
        previousTap = state.physicalTaps;
      }
      if (actual.type === 'productionPhysicalEnd-v1') break;
      const selected = controller.decide(), elapsed = performance.now() - started;
      decisionCount++; totalDecisionMs += elapsed;
      dominanceStops += +(!!selected?.plan.dominanceStop);
      if (elapsed > slowestMs) { slowestMs = elapsed; decision = { attempt, physicalTaps: state.physicalTaps }; }
      if (!selected) { status = 'unresolvedPublicFrontier'; break; }
      const index = selected.plan.index, accepted = actual.legalTiles.includes(index);
      if (clockRetry && selected.plan.clockRetryExploration) {
        clockRetry.decisionsAudited++;
        clockRetry.decisionsUsingAlternative += +selected.plan.clockRetryExploration.adopted;
      }
      if (options.captureDecisions) decisions.push({ state: controller.state(), index, accepted,
        knowledgeSignature: controller.knowledgeSignature(),
        plan: { goal: selected.plan.goal, path: selected.plan.path, progress: selected.plan.knownProgress,
          boundary: selected.plan.boundary, knownDead: selected.plan.knownDead, nodes: selected.plan.nodes,
          ...(selected.plan.hypothesisAudit ? { hypothesis: Object.fromEntries(['changed', 'primaryIndex', 'preferredWorlds', 'completeWorlds',
            'index', 'primaryOptionId', 'totals', 'informationWeight', 'unseenCount', 'exactUnknownLimit', 'confidence', 'scoreMode']
            .map(field => [field, selected.plan.hypothesisAudit[field]])) } : {}) },
        ...(options.captureInformation ? { informationAudit: controller.explainInformation(selected.plan.path) } : {}) });
      controller.acknowledge(index, accepted);
      lastPlan = selected.plan;
      if (!accepted) { rejected++; continue; }
      actions.push(index);
      const after = session.tap(index), predicted = selected.predicted;
      if (!predicted.uncertain) {
        for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(after.state[field], predicted.state[field],
          JSON.stringify({ field, index, publicState: controller.state(), predicted: predicted.state, actual: after.state }));
        controls++;
      }
    }
    const terminal = session.view(), audit = session.audit();
    verifiedTaps += verifyAttempt(encoded, actions, settings, audit);
    if (status === null) {
      status = terminal.computationCensored ? 'unresolvedBudget' : terminal.win ? 'cleared'
        : ['tray', 'clock', 'stuck'].includes(terminal.why) ? 'physicalLoss' : 'unresolved';
    }
    const learnedRisk = controller.completeAttempt(status);
    attempts.push({ attempt, status, why: terminal.why ?? status, taps: actions.length,
      ...(options.planning?.retryRiskLearning ? { learnedRisk } : {}),
      left: terminal.state.alive.reduce((sum, alive) => sum + alive, 0), tray: terminal.state.tray,
      last: { alive: terminal.state.alive, openPeek: terminal.state.openPeek, moves: terminal.state.moves,
        pictures: controller.known().pictures, plan: lastPlan }, actions, ...(options.captureDecisions ? { decisions } : {}) });
    if (status !== 'physicalLoss') break;
  }
  factory.verifySource();
  return { wonOn: attempts.at(-1).status === 'cleared' ? attempts.length : null, status: attempts.at(-1).status,
    slowestMs, decisionCount, meanDecisionMs: decisionCount ? totalDecisionMs / decisionCount : 0,
    dominanceStops, decision, attempts, controls, verifiedTaps, rejected,
    ...(clockRetry ? { clockRetry } : {}),
    ...(options.planning?.causalAvailabilityMemory ? { causalAvailability: controller.causalAvailabilityStats() } : {}),
    ...(options.planning?.observedSafetyTransfer ? { observedSafetyTransfer: controller.causalAvailabilityStats() } : {}),
    ...(options.planning?.rememberBlockedTaps ? { blockedTapFacts: controller.blockedEvidence().length } : {}),
    ...(options.planning?.hypothesisSampling ? { hypothesis: controller.hypothesisStats() } : {}),
    ...(options.planning?.retryRiskLearning ? { retryRisks: controller.retryEvidence() } : {}),
    ...(options.planning?.retryCompleteWitness ? { retryCompletion: controller.retryCompletionStats() } : {}),
    ...(options.planning?.retryInformationWitness ? { retryInformation: controller.retryInformationStats() } : {}),
    ...(options.planning?.knownWitnessPortfolio ? { knownWitnessPortfolio: controller.knownPortfolioStats() } : {}),
    ...(options.planning?.survivalBranches || options.planning?.openingConditionalPlanning ? { survivalBranches: controller.survivalBranchStats() } : {}),
    ...(options.planning?.openingConditionalPlanning ? { openingPlanning: controller.openingSelectionStats() } : {}),
    ...(options.planning?.rememberKeyIdentities ? { keyIdentityEvidence: controller.keyIdentityEvidence() } : {}),
    ...(options.planning?.rememberKnownLosses ? { rememberedLosses: controller.knownLossEvidence() } : {}),
    note: 'Game-state visibility gate; no pixels or full hidden rules. Search stops at unobserved identities, orientations and roles. Rejected uncertain taps do not advance moves or create retries. Retry memory uses actual board observations and unambiguous actual matches to previously seen tray/open pictures; no removed hidden picture is read. Starting-role memory uses observations and rule-supported deductions, never late none as starting safety. Completed attempts independently replayed through unmodified production. Finite failure is not impossibility.' };
}

module.exports = { createHumanController, playHumanCampaign, visibleRole, verifyAttempt, startingIceHits };
