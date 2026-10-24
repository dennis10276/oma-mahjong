'use strict';
const assert = require('assert/strict');
const { keyOf } = require('./public_witness_search.js');
const { legal } = require('./known_tray_plan.js');

function createKnownLossMemory(game) {
  const positions = new Map();
  return {
    recordActual(state, report, actions) {
      if (!report.knownDead) return false;
      assert(!report.knownWin && !report.boundary, 'A bounded search is not a remembered loss proof');
      assert(Number.isInteger(state.physicalTaps) && state.physicalTaps >= 0, 'Record only an actual observed position');
      const certificate = report.deadCertificate;
      assert(certificate?.exhaustedKnownGraph === true && certificate.reachableUnknown === false
        && certificate.unsupported === false && certificate.prunedOnlyCertifiedLosses === true);
      assert.equal(report.unknownTransitions, 0); assert.equal(report.unsupportedTransitions, 0);
      const free = legal(game, state).free, roots = new Set(actions.map(action => action.index));
      if (roots.size !== free.length || free.some(index => !roots.has(index))) return false;
      const signature = keyOf(game, state);
      if (positions.has(signature)) return false;
      positions.set(signature, { physicalTaps: state.physicalTaps, certificate: { ...certificate } });
      return true;
    },
    knowsLoss(state) { return positions.has(keyOf(game, state)); },
    entries() { return [...positions].map(([signature, value]) => ({ signature,
      physicalTaps: value.physicalTaps, certificate: { ...value.certificate } })); },
  };
}

module.exports = { createKnownLossMemory };
