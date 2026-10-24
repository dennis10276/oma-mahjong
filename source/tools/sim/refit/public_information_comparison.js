'use strict';
const assert = require('assert/strict');

function createInformationComparison(actions, fallbackIndex, { scoreMode = 'clear', confidenceSE = 0 } = {}) {
  assert(['clear', 'progress'].includes(scoreMode));
  assert(Number.isFinite(confidenceSE) && confidenceSE >= 0 && confidenceSE <= 8);
  assert(actions.length > 1 && new Set(actions).size === actions.length && actions.includes(fallbackIndex));
  const primaryOffset = actions.indexOf(fallbackIndex);
  const totals = actions.map(index => ({ index, score: 0, informationClears: 0, exactClears: 0,
    informationProgress: 0, unresolved: 0, lost: 0, progress: 0, differenceSum: 0, differenceSquares: 0 }));
  let samples = 0;
  const better = (left, right) => left.score > right.score + 1e-12
    || Math.abs(left.score - right.score) <= 1e-12 && left.progress > right.progress;
  return {
    add(batch, informationWeight) {
      assert(batch.length === actions.length && informationWeight >= 0 && informationWeight <= 1);
      const values = batch.map(({ honest, exact }) => {
        assert(['cleared', 'lost', 'unresolved'].includes(honest.status));
        assert(['cleared', 'lost', 'unresolved'].includes(exact.status));
        const progress = honest.status === 'cleared' ? 1 : honest.progress ?? 0;
        assert(Number.isFinite(progress) && progress >= 0 && progress <= 1);
        return informationWeight * (scoreMode === 'progress' ? progress : +(honest.status === 'cleared'))
          + (1 - informationWeight) * +(exact.status === 'cleared');
      });
      const allExactLost = batch.every(row => row.exact.status === 'lost');
      samples++;
      batch.forEach(({ honest, exact }, offset) => {
        const total = totals[offset], difference = values[offset] - values[primaryOffset];
        total.score += values[offset]; total.informationClears += +(honest.status === 'cleared');
        total.exactClears += +(exact.status === 'cleared');
        total.informationProgress += honest.status === 'cleared' ? 1 : honest.progress ?? 0;
        total.unresolved += +(honest.status === 'unresolved'); total.lost += +(honest.status === 'lost');
        if (allExactLost) total.progress += exact.progress ?? 0;
        total.differenceSum += difference; total.differenceSquares += difference * difference;
      });
    },
    finish() {
      const rows = totals.map(total => {
        const meanDifference = samples ? total.differenceSum / samples : 0;
        const variance = samples >= 2 ? Math.max(0,
          (total.differenceSquares - total.differenceSum * total.differenceSum / samples) / (samples - 1)) : null;
        const standardError = variance === null ? null : Math.sqrt(variance / samples);
        return { ...total, samples, meanScore: samples ? total.score / samples : 0, meanDifference, standardError,
          clearlyBetter: samples >= 2 && meanDifference > Math.max(1e-12, confidenceSE * standardError) };
      });
      const primary = rows[primaryOffset];
      let rawWinner = primary, selected = primary;
      for (const row of rows) {
        if (better(row, rawWinner)) rawWinner = row;
        if ((!confidenceSE || row.clearlyBetter) && better(row, selected)) selected = row;
      }
      return { index: selected.index, totals: rows, scoreMode,
        confidence: { thresholdSE: confidenceSE, samples, primaryIndex: fallbackIndex,
          rawWinner: rawWinner.index, selected: selected.index, meanDifference: selected.meanDifference,
          standardError: selected.standardError, overrideAllowed: selected.index !== fallbackIndex,
          note: 'Paired Monte Carlo differences on identical completed fillings; conditional heuristic evidence, not a proof or a calibrated human success probability.' } };
    } };
}

module.exports = { createInformationComparison };
