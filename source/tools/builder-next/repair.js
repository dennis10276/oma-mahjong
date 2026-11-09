'use strict';
/**
 * repair.js - Causal diagnosis and targeted structural repair engine.
 * Instead of blind random retries, analyzes measured miss (D, S, B6, B7)
 * and determines the exact structural adjustment needed.
 */

/**
 * Diagnoses a candidate's evaluation against target and quality thresholds.
 */
function diagnoseMiss(evalResult, target = 10, options = {}) {
  const tol = options.tol ?? 1.0;
  const skilledBand = options.skilledBand || [2.5, 6.0];
  const issues = [];

  const { D, S, traces, staticPass } = evalResult;

  if (!staticPass) {
    issues.push({ code: 'STATIC_FAILURE', desc: 'Failed static structural gates', detail: evalResult.failedGates });
  }

  // Difficulty target check
  if (D < target - tol) {
    issues.push({
      code: 'TOO_EASY',
      delta: target - D,
      desc: `Family difficulty D=${D.toFixed(2)} is below target band [${(target - tol).toFixed(1)}, ${(target + tol).toFixed(1)}]`
    });
  } else if (D > target + tol) {
    issues.push({
      code: 'TOO_HARD',
      delta: D - target,
      desc: `Family difficulty D=${D.toFixed(2)} is above target band [${(target - tol).toFixed(1)}, ${(target + tol).toFixed(1)}]`
    });
  }

  // Skilled difficulty check
  if (S != null && S < skilledBand[0]) {
    issues.push({
      code: 'SKILLED_TOO_EASY',
      desc: `Skilled difficulty S=${S.toFixed(2)} is below normal minimum ${skilledBand[0]}`
    });
  } else if (S != null && S > skilledBand[1]) {
    issues.push({
      code: 'SKILLED_TOO_HARD',
      desc: `Skilled difficulty S=${S.toFixed(2)} exceeds normal maximum ${skilledBand[1]}`
    });
  }

  // Trace quality gate checks
  if (traces) {
    if (traces.B6 > 0.65) {
      issues.push({
        code: 'PACING_FAILURE_B6',
        desc: `Post-clock loss share B6=${traces.B6.toFixed(3)} exceeds 0.65 (clock taken too early; puzzle at very end)`
      });
    }
    if (traces.inflated || (traces.B7_repeat != null && traces.B7_repeat > 0.50)) {
      issues.push({
        code: 'REPEAT_INFLATION_B7',
        desc: `Repeated blunder share B7=${traces.B7_repeat?.toFixed(3)} exceeds 0.50 (obstacle in dense stack causes repeated errors)`
      });
    }
  }

  return {
    hasIssues: issues.length > 0,
    issues
  };
}

/**
 * Computes a targeted structural repair for the current candidate based on diagnosis.
 */
function computeStructuralRepair(candidate, diagnosis, target = 10, options = {}) {
  const recipe = JSON.parse(JSON.stringify(candidate.recipe));
  const issues = diagnosis.issues;

  // Priority 1: Fix repeat inflation (B7) - obstacle in dense stack
  const b7Issue = issues.find(i => i.code === 'REPEAT_INFLATION_B7');
  if (b7Issue) {
    // If ice was on a dense stack tile (e.g. 72, 68, 73, 63), relocate to clean wing tile (44 or 61)
    if (recipe.ice && (typeof recipe.ice === 'object' && [72, 68, 73, 63].includes(recipe.ice.tile))) {
      const prevTile = recipe.ice.tile;
      recipe.ice = { tile: 44, h: 2 };
      return {
        repairedRecipe: recipe,
        reason: `Relocated ice prerequisite from dense stack tile ${prevTile} to clean layer-1 wing tile 44 to eliminate B7 repeat inflation`,
        editType: 'RELOCATE_OBSTACLE'
      };
    }
  }

  // Priority 2: Fix skilled difficulty too hard (S > 6.0)
  const skilledHardIssue = issues.find(i => i.code === 'SKILLED_TOO_HARD');
  if (skilledHardIssue) {
    // If keys were asymmetric (like [12, 16]), switch to balanced wing keys [5, 9]
    if (recipe.keys && (recipe.keys.includes(12) || recipe.keys.includes(16))) {
      recipe.keys = [5, 9];
      return {
        repairedRecipe: recipe,
        reason: `Replaced asymmetric peeling keys [12, 16] with balanced wing keys [5, 9] to bring skilled S into [2.5, 6.0]`,
        editType: 'BALANCE_KEYS'
      };
    }
    // If spare is 1, loosening to spare 2 may relieve skilled bot
    if (recipe.spare === 1) {
      recipe.spare = 2;
      return {
        repairedRecipe: recipe,
        reason: `Relaxed clock spare from 1 to 2 to relieve skilled difficulty`,
        editType: 'RELAX_SPARE'
      };
    }
  }

  // Priority 3: Fix pacing failure (B6 > 0.65) - clock taken too early
  const b6Issue = issues.find(i => i.code === 'PACING_FAILURE_B6');
  if (b6Issue) {
    // Deepen clock prelude by adding thaw prerequisite or deeper key pair
    if (!recipe.ice) {
      recipe.ice = { tile: 44, h: 2 };
      recipe.keys = [5, 9];
      return {
        repairedRecipe: recipe,
        reason: `Added wing thaw prerequisite (tile 44, h=2) on keys [5, 9] to increase clock depth and eliminate post-clock losses (B6)`,
        editType: 'DEEPEN_PRELUDE'
      };
    }
  }

  // Priority 4: Family D Too Easy (D < target - tol)
  const tooEasyIssue = issues.find(i => i.code === 'TOO_EASY');
  if (tooEasyIssue) {
    // Action A: If spare is 2 and we have dual ice, tighten to spare 1 (lifts D from ~8.09 to ~11.91)
    const isMultiIce = recipe.ice && typeof recipe.ice === 'object' && !('tile' in recipe.ice);
    if (recipe.spare === 2 && isMultiIce) {
      recipe.spare = 1;
      return {
        repairedRecipe: recipe,
        reason: `Tightened clock deadline from spare 2 to spare 1 on dual wing thaw to increase family difficulty by ~3.8 tries`,
        editType: 'TIGHTEN_SPARE'
      };
    }

    // Action B: If single ice on tile 44 with spare 1 and target >= 12, try high-challenge peeling keys [12, 16]
    if (recipe.ice && recipe.ice.tile === 44 && recipe.ice.h === 2 && recipe.spare === 1 && target >= 12) {
      if (recipe.keys && (recipe.keys[0] !== 12 || recipe.keys[1] !== 16)) {
        recipe.keys = [12, 16];
        return {
          repairedRecipe: recipe,
          reason: `Switched from balanced keys [5, 9] to deeper asymmetric peeling keys [12, 16] to reach high family difficulty target ${target}`,
          editType: 'DEEPEN_PEELING_KEYS'
        };
      }
    }

    // Action C: If spare is 2, tighten to spare 1
    if (recipe.spare === 2) {
      recipe.spare = 1;
      return {
        repairedRecipe: recipe,
        reason: `Tightened clock deadline from spare 2 to spare 1 to increase family difficulty by +1.5 to +2.0 tries`,
        editType: 'TIGHTEN_SPARE'
      };
    }

    // Action D: If no ice prerequisite, add wing thaw
    if (!recipe.ice) {
      recipe.ice = { tile: 44, h: 2 };
      recipe.keys = [5, 9];
      return {
        repairedRecipe: recipe,
        reason: `Added wing thaw prerequisite { tile: 44, h: 2 } on keys [5, 9] to increase family difficulty toward target ${target}`,
        editType: 'ADD_THAW'
      };
    }

    // Action E: If single ice is h=1, upgrade to h=2
    if (recipe.ice && recipe.ice.h === 1) {
      recipe.ice.h = 2;
      recipe.ice.tile = 44;
      recipe.keys = [5, 9];
      return {
        repairedRecipe: recipe,
        reason: `Upgraded thaw requirement from h=1 to h=2 on wing tile 44 to increase family challenge`,
        editType: 'UPGRADE_THAW'
      };
    }
  }

  // Priority 5: Family D Too Hard (D > target + tol)
  const tooHardIssue = issues.find(i => i.code === 'TOO_HARD');
  if (tooHardIssue) {
    const isMultiIce = recipe.ice && typeof recipe.ice === 'object' && !('tile' in recipe.ice);

    // Action A: If dual ice with spare 1, relax to spare 2 (drops D from ~11.91 to ~8.09)
    if (isMultiIce && recipe.spare === 1) {
      recipe.spare = 2;
      return {
        repairedRecipe: recipe,
        reason: `Relaxed dual wing thaw deadline from spare 1 to spare 2 to lower family difficulty toward target ${target}`,
        editType: 'RELAX_SPARE'
      };
    }

    // Action B: If dual ice with spare 2, reduce to single wing thaw { tile: 44, h: 2 }
    if (isMultiIce && recipe.spare === 2) {
      recipe.ice = { tile: 44, h: 2 };
      recipe.spare = 1;
      return {
        repairedRecipe: recipe,
        reason: `Reduced dual wing thaw to single wing thaw { tile: 44, h: 2 } to decrease family difficulty`,
        editType: 'REDUCE_DUAL_TO_SINGLE_THAW'
      };
    }

    // Action C: If spare is 1, relax to spare 2
    if (recipe.spare === 1) {
      recipe.spare = 2;
      return {
        repairedRecipe: recipe,
        reason: `Relaxed clock deadline from spare 1 to spare 2 to lower family difficulty`,
        editType: 'RELAX_SPARE'
      };
    }

    // Action D: If ice is h=2, reduce to h=1
    if (recipe.ice && recipe.ice.h === 2) {
      recipe.ice.h = 1;
      recipe.ice.tile = 61;
      recipe.keys = [0, 40];
      return {
        repairedRecipe: recipe,
        reason: `Reduced thaw requirement to h=1 on tile 61 to lower family difficulty toward target ${target}`,
        editType: 'REDUCE_THAW'
      };
    }

    // Action E: Remove ice prerequisite
    if (recipe.ice) {
      delete recipe.ice;
      recipe.spare = 1;
      recipe.keys = [5, 9];
      return {
        repairedRecipe: recipe,
        reason: `Removed ice prerequisite to reduce difficulty to pure key challenge`,
        editType: 'REMOVE_ICE'
      };
    }
  }

  return {
    repairedRecipe: null,
    reason: 'No further structural repair rule available for this state',
    editType: 'NONE'
  };
}

module.exports = {
  diagnoseMiss,
  computeStructuralRepair
};
