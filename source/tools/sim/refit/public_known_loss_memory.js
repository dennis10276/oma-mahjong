'use strict';
const assert = require('assert/strict');
const { keyOf } = require('./public_witness_search.js');
const { legal, advance } = require('./known_tray_plan.js');

function createKnownLossMemory(game, options = {}) {
  assert(Object.keys(options).every(key => ['inspectionSuccessors', 'provedContinuations'].includes(key)));
  const inspectionSuccessors = options.inspectionSuccessors ?? false;
  const provedContinuations = options.provedContinuations ?? false;
  assert.equal(typeof inspectionSuccessors, 'boolean');
  assert.equal(typeof provedContinuations, 'boolean');
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
    recordContinuation(origin, path, target, report) {
      if (!provedContinuations || !report.knownDead) return false;
      const certificate = report.certificate;
      assert.equal(report.reason, 'exhaustedKnownContinuationGraph');
      assert(certificate?.includesSafeRemovalsAndInspections === true && certificate.reachableUnknown === false
        && certificate.knownWinningRoute === false && certificate.unsupportedTransition === false
        && certificate.budgetBoundary === false);
      assert(Number.isInteger(origin.physicalTaps) && origin.physicalTaps >= 0);
      assert(Array.isArray(path) && path.length > 0 && path.length <= 512
        && path.every(index => Number.isInteger(index) && index >= 0 && index < origin.alive.length));
      const signature = keyOf(game, target);
      if (positions.has(signature) || positions.size >= 8192) return false;
      let position = origin;
      for (const index of path) {
        if (!legal(game, position).free.includes(index)) return false;
        const moved = advance(game, position, index);
        if (moved.uncertain || moved.lost) return false;
        position = moved.state;
      }
      if (keyOf(game, position) !== signature) return false;
      assert.deepEqual(target.pictures, position.pictures, 'A retained public loss cannot contain imagined pictures');
      assert.deepEqual(target.down, position.down, 'A retained public loss cannot contain imagined orientations');
      const free = legal(game, position).free, roots = new Set(certificate.allRequestedRoots);
      if (roots.size !== free.length || free.some(index => !roots.has(index))) return false;
      positions.set(signature, { proof: { kind: 'exhaustedKnownContinuationFromActualRoot',
        parentSignature: keyOf(game, origin), path: path.slice(), actualParentPhysicalTaps: origin.physicalTaps,
        observedSuccessor: false, certificate: structuredClone(certificate) } });
      return true;
    },
    knowsLoss(state) { return positions.has(keyOf(game, state)); },
    entries() { return [...positions].map(([signature, value]) => ({ signature,
      ...(value.proof ? { proof: structuredClone(value.proof) }
        : { physicalTaps: value.physicalTaps, certificate: { ...value.certificate } }) })); },
  };
}

module.exports = { createKnownLossMemory };
