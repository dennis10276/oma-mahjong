'use strict';
const assert = require('assert/strict');
const { keyOf } = require('./public_witness_search.js');
const { legal, advance } = require('./known_tray_plan.js');

function createKnownLossMemory(game, options = {}) {
  assert(Object.keys(options).every(key => key === 'inspectionSuccessors'));
  const inspectionSuccessors = options.inspectionSuccessors ?? false;
  assert.equal(typeof inspectionSuccessors, 'boolean');
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
      if (inspectionSuccessors) for (const index of free) {
        const moved = advance(game, state, index);
        if (moved.uncertain || moved.lost || moved.removed !== 0 || moved.state.openPeek === state.openPeek
          || moved.state.moves !== state.moves || !!moved.state.relieved !== !!state.relieved
          || moved.state.alive.some((alive, target) => alive !== state.alive[target])
          || JSON.stringify(moved.state.tray) !== JSON.stringify(state.tray)
          || JSON.stringify(moved.state.arriving ?? []) !== JSON.stringify(state.arriving ?? [])) continue;
        const successor = keyOf(game, moved.state);
        if (positions.has(successor)) continue;
        positions.set(successor, { proof: { kind: 'knownInspectionSuccessorOfExhaustedLoss',
          parentSignature: signature, inspectedIndex: index, actualParentPhysicalTaps: state.physicalTaps,
          observedSuccessor: false } });
      }
      return true;
    },
    knowsLoss(state) { return positions.has(keyOf(game, state)); },
    entries() { return [...positions].map(([signature, value]) => ({ signature,
      ...(value.proof ? { proof: { ...value.proof } }
        : { physicalTaps: value.physicalTaps, certificate: { ...value.certificate } }) })); },
  };
}

module.exports = { createKnownLossMemory };
