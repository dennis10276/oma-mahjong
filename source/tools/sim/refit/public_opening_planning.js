'use strict';
const assert = require('assert/strict');

function openingPlanningController(options, createController) {
  const { openingConditionalPlanning, openingReusablePlanning = false, ...baseline } = options;
  assert.equal(openingConditionalPlanning, true);
  assert.equal(typeof openingReusablePlanning, 'boolean');
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
      selection = { kind: 'publicOpeningClockLockV1', startingClockBudget: budget,
        visibleLockSymbols: locks, enhanced, latchedForCampaign: true,
        ...(openingReusablePlanning ? { reusable, family: reusable ? 'reusable33' : enhanced ? 'survival39' : 'retained23' } : {}) };
      if (enhanced || reusable) {
        delegate = createController(reusable ? { ...baseline, reusablePublicPlanning: true,
          reusableContinueAfterInformation: true, reusablePrepareCrowded: true } : { ...baseline, survivalBranches: true, survivalBacktracking: true,
          survivalEarlyForks: true, clockOrphanPreparation: true, clockRecoveryMinSlack: 30 });
        delegate.beginAttempt();
      }
    }
    return delegate.observe(state, observed);
  };
  api.openingSelectionStats = () => selection ? { ...selection } : null;
  return api;
}

module.exports = { openingPlanningController };
