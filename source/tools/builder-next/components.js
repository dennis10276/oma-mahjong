'use strict';
/**
 * components.js - Modular puzzle components for builder-next.
 * Dynamically builds and composes puzzles topologically using visibleChoice.
 * Eliminates brittle hardcoded tile IDs in favor of structured parameterized proposals.
 */

const fs = require('fs'), path = require('path');
const E = require('../builder/engine.js');
const VC = require('../builder/visible_choice.js');
const PS = require('../factory/placement_score.js');

const LAYOUTS_FILE = path.resolve(__dirname, '../../analysis/builder/data/layouts.json');
const LAYOUTS = fs.existsSync(LAYOUTS_FILE) ? JSON.parse(fs.readFileSync(LAYOUTS_FILE, 'utf8')) : [];

function getLayoutMeta(layoutId) {
  if (typeof layoutId === 'number') {
    const l = LAYOUTS[layoutId];
    if (l) {
      const maxZ = Math.max(...l.tiles.map(t => t[2]));
      return { layout: layoutId, shape: l.shape, tiles: l.tiles.length, layers: maxZ + 1, bigBoard: l.tiles.length === 96 };
    }
  }
  const found = LAYOUTS.findIndex(l => l.shape === layoutId || l.base === layoutId);
  if (found >= 0) {
    const l = LAYOUTS[found];
    const maxZ = Math.max(...l.tiles.map(t => t[2]));
    return { layout: found, shape: l.shape, tiles: l.tiles.length, layers: maxZ + 1, bigBoard: l.tiles.length === 96 };
  }
  return { layout: 22, shape: 'ushape', tiles: 76, layers: 6, bigBoard: false };
}

const BASE_BODIES = {
  steps: { layout: 27, shape: 'steps', stage: 'edge', seed: 2, tiles: 96, bigBoard: true },
  pyramid: { layout: 6, shape: 'pyramid · tall', stage: 'top', seed: 4, tiles: 84, bigBoard: false },
  diamond: { layout: 30, shape: 'diamond', stage: 'edge', seed: 11, tiles: 80, bigBoard: false },
  ushape: { layout: 22, shape: 'ushape', stage: 'edge', seed: 1, tiles: 76, bigBoard: false },
  castle: { layout: 20, shape: 'castle · two islands', stage: 'top', seed: 2, tiles: 84, bigBoard: false },
  arch: { layout: 0, shape: 'arch', stage: 'edge', seed: 1, tiles: 80, bigBoard: false },
  letterH: { layout: 10, shape: 'letterH', stage: 'edge', seed: 2, tiles: 80, bigBoard: false },
  hourglass: { layout: 14, shape: 'hourglass', stage: 'edge', seed: 1, tiles: 80, bigBoard: false }
};

/**
 * Builds a puzzle candidate topologically from a parameterized proposal.
 */
function buildCandidate(layout, shape, seed, recipe, options = {}) {
  const meta = getLayoutMeta(layout);
  const layoutNum = meta.layout;
  const layoutShape = shape || meta.shape;

  const brief = {
    layout: layoutNum,
    shape: layoutShape,
    story: recipe.story || 'lockBeside',
    stage: recipe.stage || (meta.layers >= 5 ? 'top' : 'edge'),
    seed: seed ?? 1,
    mode: 'visibleChoice',
    frame: {
      spare: recipe.frameSpare ?? 2,
      ...(recipe.depth != null ? { depth: recipe.depth } : {}),
      ...(recipe.way != null ? { way: recipe.way } : {})
    },
    targets: {
      trayRoom: recipe.trayRoom ?? 0,
      hiddenOnWay: Math.min(3, recipe.hiddenOnWay ?? 1),
      maxDown: recipe.maxDown ?? 0.30,
      ...(recipe.tailPairWidth != null ? { tailPairWidth: recipe.tailPairWidth } : {}),
      ...(recipe.traps != null ? { traps: recipe.traps } : {})
    }
  };

  const res = VC.build(brief, { wallMs: options.wallMs || 30000 });
  if (!res.design) {
    return { ok: false, fail: res.fail || 'buildFailed', detail: res.fails };
  }

  const d = res.design;
  const cs = E.clockShortest(E.game(d));
  if (!cs || !cs.k || cs.unsure) {
    return { ok: false, fail: 'shortestUnproven' };
  }

  const spare = recipe.spare ?? 2;
  d.clock.n = cs.k + spare;
  if (!d.solution || !d.solution.length) {
    d.solution = E.flatten(cs.path);
  }

  if (!E.replay(d, d.solution, { strict: true }).ok) {
    return { ok: false, fail: 'strictWitnessFailed' };
  }

  // Ensure placement readability
  if (!PS.readable(d)) {
    return { ok: false, fail: 'unreadableDesign' };
  }

  return {
    ok: true,
    design: d,
    k: cs.k,
    clockN: d.clock.n,
    spare,
    recipe,
    brief,
    card: res.card
  };
}

/**
 * Legacy interface for composeCandidate: accepts either baseDesign + recipe or direct recipe.
 */
function composeCandidate(baseDesign, recipe, options = {}) {
  if (recipe.design) {
    const d = JSON.parse(JSON.stringify(recipe.design));
    const k = recipe.clockK ?? (d.clock.n - (recipe.priorSpare ?? recipe.spare ?? 1));
    if (recipe.spare != null) d.clock.n = k + recipe.spare;
    return {
      ok: true,
      design: d,
      proof: { minimum: k, spare: recipe.spare ?? 1, changed: ['clock.n'] },
      k,
      clockN: d.clock.n,
      spare: recipe.spare ?? 1,
      recipe
    };
  }

  const layout = recipe.layout ?? baseDesign?.layout ?? 22;
  const shape = recipe.shape ?? baseDesign?.shape ?? 'ushape';
  const seed = recipe.seed ?? options.seed ?? 1;

  return buildCandidate(layout, shape, seed, recipe, options);
}

function buildBase(layout = 22, shape = 'ushape', stage = 'edge', seed = 1, options = {}) {
  return buildCandidate(layout, shape, seed, { story: 'deepClock', stage, spare: 2, trayRoom: 0, maxDown: 0.30 }, options);
}

module.exports = {
  LAYOUTS,
  BASE_BODIES,
  getLayoutMeta,
  buildCandidate,
  composeCandidate,
  buildBase
};
