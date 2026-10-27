'use strict';
const assert = require('assert/strict');

function openingPlanningController(options, createController) {
  const { openingConditionalPlanning, openingReusablePlanning = false, reusableRetainRoute = false,
    reusableSimplifyPrefixes = false, openingRetryRiskLearning = false, openingRetryPictureLearning = false,
    openingBroadInformationPlanning = false, openingBroadReusablePlanning = false, ...baseline } = options;
  assert.equal(openingConditionalPlanning, true);
  assert.equal(typeof openingReusablePlanning, 'boolean');
  assert.equal(typeof reusableRetainRoute, 'boolean');
  assert(!reusableRetainRoute || openingReusablePlanning);
  assert.equal(typeof reusableSimplifyPrefixes, 'boolean');
  assert(!reusableSimplifyPrefixes || openingReusablePlanning);
  assert.equal(typeof openingRetryRiskLearning, 'boolean');
  assert(!openingRetryRiskLearning || openingReusablePlanning);
  assert.equal(typeof openingRetryPictureLearning,'boolean');
  assert(!openingRetryPictureLearning||openingRetryRiskLearning);
  assert.equal(typeof openingBroadInformationPlanning,'boolean');
  assert(!openingBroadInformationPlanning||!openingReusablePlanning,'Broad and heavy opening candidates must be evaluated separately');
  assert.equal(typeof openingBroadReusablePlanning,'boolean');
  assert(!openingBroadReusablePlanning||openingBroadInformationPlanning);
  assert.equal(typeof createController, 'function');
  let delegate = createController(baseline), selection = null, begun = false;
  const api = Object.fromEntries(Object.keys(delegate).map(method => {
    assert.equal(typeof delegate[method], 'function');
    return [method, (...args) => delegate[method](...args)];
  }));
  api.beginAttempt = () => { begun = true; return delegate.beginAttempt(); };
  api.observe = (state, observed) => {
    if (selection === null) {
      assert(begun && state.physicalTaps === 0 && state.moves === 0 && state.tray.length === 0,
        'Select planning only from the first public opening packet');
      assert(Array.isArray(observed.roles));
      const budget = observed.clock?.n ?? null;
      assert(budget === null || Number.isInteger(budget) && budget > 0);
      const locks = observed.roles.filter(role => role === 'lock').length;
      const enhanced = budget !== null && budget <= 50 && locks <= 3;
      const reusable = openingReusablePlanning && budget !== null && budget >= 30 && locks >= 4;
      const broad = openingBroadInformationPlanning && budget !== null && budget >= 20 && budget <= 40 && locks <= 4;
      selection = { kind: 'publicOpeningClockLockV1', startingClockBudget: budget,
        visibleLockSymbols: locks, enhanced, latchedForCampaign: true,
        ...(openingReusablePlanning ? { reusable, family: reusable ? 'reusable33' : enhanced ? 'survival39' : 'retained23' } : {}),
        ...(openingBroadInformationPlanning ? {broadInformation:broad,family:broad ? enhanced ? 'broadSurvival39':'broad23' : enhanced ? 'survival39':'retained23'} : {}),
        ...(openingBroadReusablePlanning ? {broadReusable:broad} : {}) };
      if (enhanced || reusable || broad) {
        const selected = reusable ? { ...baseline, reusablePublicPlanning: true,
          reusableContinueAfterInformation: true, reusablePrepareCrowded: true, retryInformationNodes: 32768,
          ...(reusableRetainRoute ? { reusableRetainRoute: true } : {}),
          ...(reusableSimplifyPrefixes ? {reusableSimplifyPrefixes:true} : {}),
          ...(openingRetryRiskLearning ? {retryRiskLearning:true} : {}),
          ...(openingRetryPictureLearning ? {retryPictureLearning:true} : {}) } : { ...baseline, survivalBranches: true, survivalBacktracking: true,
          survivalEarlyForks: true, clockOrphanPreparation: true, clockRecoveryMinSlack: 30 };
        // A broad baseline selection must not accidentally inherit the light-clock family.
        const base = !reusable && !enhanced ? baseline : selected;
        delegate = createController(broad ? {...base,passiveInformation:'shortAll',rememberProvedContinuations:true,
          ...(openingBroadReusablePlanning ? {reusablePublicPlanning:true,reusableContinueAfterInformation:true,
            reusablePrepareCrowded:true,retryInformationNodes:32768,reusableRetainRoute:true,reusableSimplifyPrefixes:true} : {})} : base);
        delegate.beginAttempt();
      }
    }
    return delegate.observe(state, observed);
  };
  api.openingSelectionStats = () => selection ? { ...selection } : null;
  return api;
}

module.exports = { openingPlanningController };
