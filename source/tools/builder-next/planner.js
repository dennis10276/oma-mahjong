'use strict';
const M = require('../factory/meter.js');
const { HISTORICAL_RECIPES } = require('./recipes.js');

function structure(recipe) {
  return {
    keys: recipe.keys ?? null,
    ice: recipe.ice ?? null,
    lockTile: recipe.lockTile ?? null,
    downCount: recipe.downCount ?? null,
    baseId: recipe.id ? recipe.id.replace(/-spare\d+$/, '') : null,
    design: recipe.design ?? null,
    clockK: recipe.clockK ?? null
  };
}
const structureKey = r => M.digest(structure(r));
const recipeKey = r => M.digest({ ...structure(r), spare: r.spare });
function proposals(layout) {
  const tiers = HISTORICAL_RECIPES[layout];
  if (!tiers) throw Error(`No construction components registered for layout ${layout}`);
  const recipes = new Map();
  for (const entries of Object.values(tiers)) for (const old of entries) {
    // Old S belongs to a different bot. It is deliberately discarded.
    for (const spare of [1, 2, 3]) {
      const recipe = { ...structure(old), spare,
        id: `${old.id}-spare${spare}`, priorD: old.expectedD, priorSpare: old.spare };
      const key = recipeKey(recipe);
      if (!recipes.has(key) || spare === old.spare) recipes.set(key, recipe);
    }
  }
  return [...recipes.values()];
}

// A proposal's prior only chooses what to measure. A target hit always needs
// actual new-bot ratings and the quality checks on the complete composed board.
function rankProposals(pool, observed, request) {
  const { target, skilledBand = [2.5, 6] } = request;
  const rows = observed.filter(r => r.evaluation);
  return pool.map(recipe => {
    const same = rows.filter(r => structureKey(r.recipe) === structureKey(recipe));
    const nearest = same.filter(r => Number.isFinite(r.evaluation.D))
      .sort((a, b) => Math.abs(a.recipe.spare - recipe.spare) - Math.abs(b.recipe.spare - recipe.spare))[0];
    // Learn a clock response only from paired observations of this structure;
    // do not impose a monotone clock assumption or reuse an old skilled score.
    const slopes = [];
    for (let i = 0; i < same.length; i++) for (let j = i + 1; j < same.length; j++) {
      const a = same[i], b = same[j], dx = b.recipe.spare - a.recipe.spare;
      if (dx && Number.isFinite(a.evaluation.D) && Number.isFinite(b.evaluation.D))
        slopes.push((b.evaluation.D - a.evaluation.D) / dx);
    }
    const slope = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : 0;
    const predictedD = nearest ? nearest.evaluation.D + slope * (recipe.spare - nearest.recipe.spare) : recipe.priorD;
    const knownBadSkill = same.some(r => Number.isFinite(r.evaluation.S) &&
      (r.evaluation.S < skilledBand[0] || r.evaluation.S > skilledBand[1]));
    // After a skilled miss, try another matching/dependency structure before
    // spending the whole budget on its clock settings. No candidate is pruned.
    const score = Math.abs(predictedD - target) + (knownBadSkill ? 6 : 0)
      + (nearest ? Math.abs(recipe.spare - nearest.recipe.spare) * 0.05 : Math.abs(recipe.spare - recipe.priorSpare) * 0.05);
    return { recipe, predictedD, score, basis: nearest ? (slopes.length ? 'paired-response' : 'same-structure') : 'historical-family-prior' };
  }).sort((a, b) => a.score - b.score || recipeKey(a.recipe).localeCompare(recipeKey(b.recipe)));
}
module.exports = { structureKey, recipeKey, proposals, rankProposals };
