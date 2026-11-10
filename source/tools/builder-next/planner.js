'use strict';
/**
 * planner.js - Proposal generation, target ranking, and dynamic repair.
 * Plans parameterized topological proposals and learns from observed measurements.
 */

const M = require('../factory/meter.js');
const C = require('./components.js');
const { RECIPES_BY_LAYOUT, genericRecipesForLayout } = require('./recipes.js');

function structure(recipe) {
  return {
    layout: recipe.layout ?? null,
    story: recipe.story ?? null,
    stage: recipe.stage ?? null,
    depth: recipe.depth ?? null,
    trayRoom: recipe.trayRoom ?? 0,
    maxDown: recipe.maxDown ?? 0.30,
    hiddenOnWay: recipe.hiddenOnWay ?? 1,
    baseId: recipe.id ? recipe.id.replace(/-sp\d+$/, '') : null,
    design: recipe.design ?? null
  };
}

const structureKey = r => M.digest(structure(r));
const recipeKey = r => M.digest({ ...structure(r), spare: r.spare });

function proposals(layout, target = 10) {
  const meta = C.getLayoutMeta(layout);
  const baseList = RECIPES_BY_LAYOUT[meta.layout] || genericRecipesForLayout(meta.layout, meta.shape, meta.bigBoard);
  const recipes = new Map();

  for (const base of baseList) {
    for (const spare of [1, 2, 3]) {
      const priorDelta = (base.spare - spare) * 2.0;
      const recipe = {
        ...base,
        spare,
        id: `${base.id.replace(/-sp\d+$/, '')}-sp${spare}`,
        priorD: base.expectedD ? Math.max(1, base.expectedD + priorDelta) : 10,
        priorSpare: base.spare
      };
      const key = recipeKey(recipe);
      if (!recipes.has(key) || spare === base.spare) recipes.set(key, recipe);
    }
  }

  return [...recipes.values()];
}

/**
 * Ranks proposals by target proximity, learning from measured boards in scope.
 */
function rankProposals(pool, observed, request) {
  const { target, skilledBand = [2.5, 6] } = request;
  const rows = observed.filter(r => r.evaluation);

  return pool.map(recipe => {
    const same = rows.filter(r => structureKey(r.recipe) === structureKey(recipe));
    const nearest = same.filter(r => Number.isFinite(r.evaluation.D))
      .sort((a, b) => Math.abs(a.recipe.spare - recipe.spare) - Math.abs(b.recipe.spare - recipe.spare))[0];

    // Compute empirical clock slope if available
    const slopes = [];
    for (let i = 0; i < same.length; i++) {
      for (let j = i + 1; j < same.length; j++) {
        const a = same[i], b = same[j];
        const dx = b.recipe.spare - a.recipe.spare;
        if (dx && Number.isFinite(a.evaluation.D) && Number.isFinite(b.evaluation.D)) {
          slopes.push((b.evaluation.D - a.evaluation.D) / dx);
        }
      }
    }

    const slope = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : -2.0;
    const predictedD = nearest
      ? Math.max(1, nearest.evaluation.D + slope * (recipe.spare - nearest.recipe.spare))
      : (recipe.priorD ?? 10);

    const knownBadSkill = same.some(r => Number.isFinite(r.evaluation.S) &&
      (r.evaluation.S < skilledBand[0] || r.evaluation.S > skilledBand[1]));

    const score = Math.abs(predictedD - target)
      + (knownBadSkill ? 6 : 0)
      + (nearest ? Math.abs(recipe.spare - nearest.recipe.spare) * 0.05 : Math.abs(recipe.spare - (recipe.priorSpare ?? 2)) * 0.05);

    return {
      recipe,
      predictedD,
      score,
      basis: nearest ? (slopes.length ? 'paired-response' : 'same-structure') : 'historical-prior'
    };
  }).sort((a, b) => a.score - b.score || recipeKey(a.recipe).localeCompare(recipeKey(b.recipe)));
}

module.exports = {
  structureKey,
  recipeKey,
  proposals,
  rankProposals
};
