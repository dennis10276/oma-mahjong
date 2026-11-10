'use strict';
/**
 * components.js - Modular puzzle components for builder-next.
 * Encapsulates verified puzzle primitives:
 * 1. Base Bodies (recognizable shapes >= 72 tiles with normal skilled baseline)
 * 2. Keyed Preludes (visible key pairs unlocking the clock or a gateway tile)
 * 3. Thaw Prerequisites (ice obstacles on gateway tiles, requiring neighbor clearance)
 * 4. Pacing & Clock Controls (spare tuning: spare 1 vs spare 2)
 */

const E = require('../builder/engine.js');
const K = require('../builder/knobs.js');
const VC = require('../builder/visible_choice.js');
const PS = require('../factory/placement_score.js');

// G9 construction bodies; historical ratings below are not used as B3 calibration.
const BASE_BODIES = {
  ushape: { layout: 22, shape: 'ushape', stage: 'edge', seed: 1, tiles: 76, baseS: 2.98, baseD: 3.175 },
  arch: { layout: 0, shape: 'arch', stage: 'edge', seed: 1, tiles: 80, baseS: 3.95, baseD: 1.940 },
  castle: { layout: 20, shape: 'castle · two islands', stage: 'top', seed: 2, tiles: 84, baseS: 3.45, baseD: 1.315 },
  hourglass: { layout: 14, shape: 'hourglass', stage: 'edge', seed: 2, tiles: 80, baseS: 3.10, baseD: 1.205 }
};

/**
 * Builds the base visible-choice body for a given layout and seed.
 */
function buildBase(layout = 22, shape = 'ushape', stage = 'edge', seed = 1, options = {}) {
  const brief = {
    layout, shape, story: 'deepClock', stage,
    seed, mode: 'visibleChoice',
    frame: { spare: 2 },
    targets: { trayRoom: 2, hiddenOnWay: 0, maxDown: 0, tailPairWidth: 2, ...(options.traps ? { traps: options.traps } : {}) }
  };
  return VC.build(brief, { wallMs: options.wallMs || 60000 });
}

/**
 * Classifies tiles on a board by structural layer and topological position.
 * Layer 1 wing tiles are safe for ice/locks (minimal repeated blunders B7).
 * Layers >= 3 in dense stacks cause severe B7 repeat inflation and must be avoided.
 */
function analyzeTileTopography(design) {
  const tiles = design.tiles.map(t => Array.isArray(t) ? { x: t[0], y: t[1], z: t[2] } : t);
  const layer1Wings = [];
  const denseStack = [];

  tiles.forEach((t, i) => {
    if (t.z === 1) layer1Wings.push(i);
    else if (t.z >= 3) denseStack.push(i);
  });

  return { layer1Wings, denseStack };
}

/**
 * Builds a component candidate by composing base + keys + ice + spare.
 * Supports single ice obstacle or multi-ice wing obstacles.
 */
function composeCandidate(baseDesign, recipe, options = {}) {
  const spare = recipe.spare ?? 1;

  if (recipe.design) {
    const d = JSON.parse(JSON.stringify(recipe.design));
    const k = recipe.clockK ?? (d.clock.n - (recipe.priorSpare ?? recipe.spare ?? 1));
    if (recipe.spare != null) {
      d.clock.n = k + recipe.spare;
    }
    return {
      ok: true,
      design: d,
      proof: { minimum: k, spare, changed: ['clock.n'] },
      k,
      clockN: d.clock.n,
      spare,
      recipe
    };
  }

  const proofOpts = { ...(recipe.lockTile != null ? { lockTile: recipe.lockTile } : {}), ...options };

  let built;
  // Check if ice is a multi-tile ice map { tile1: h1, tile2: h2 }
  const isMultiIce = recipe.ice && typeof recipe.ice === 'object' && !('tile' in recipe.ice);

  if (isMultiIce) {
    const keyBuilt = K.clockKeys(baseDesign, recipe.keys, spare, proofOpts);
    if (keyBuilt.fail) return keyBuilt;

    const d = JSON.parse(JSON.stringify(keyBuilt.design));
    d.obst = d.obst || {};
    d.obst.ice = { ...(d.obst.ice || {}), ...recipe.ice };
    d.clock.n = 99;

    // Verify visibility of all ice tiles
    const tiles = d.tiles.map(p => Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p);
    const vis = require('../sim/refit/human_board_visibility.js').tileVisibility(
      tiles,
      { alive: new Uint8Array(tiles.length).fill(1), down: new Uint8Array(tiles.length), openPeek: -1 },
      d.clock
    ).tiles;

    for (const iceTileStr of Object.keys(recipe.ice)) {
      const it = Number(iceTileStr);
      if (!vis[it] || !vis[it].role) return { fail: `iceNotVisible: tile ${it}` };
    }

    const limits = { nodes: 400000, totalNodes: 700000, ms: Infinity, finishNodes: 200000, finishMs: Infinity, ...options };
    const way = E.clockShortest(E.game(d), limits);
    if (!way || way.unsure) return { fail: 'minimumUnproven' };
    if (way.k <= keyBuilt.proof.minimum && Object.keys(recipe.ice).length > 0) return { fail: 'idleIce' };
    if (way.k + spare > 19) return { fail: 'clockTooDeep', minimum: way.k };

    const strict = E.clockShortest(E.game(d, { strict: true }), limits);
    if (!strict || strict.unsure || strict.k !== way.k) return { fail: 'strictMinimumUnproven' };

    d.clock.n = way.k + spare;
    d.solution = E.flatten(strict.path);
    if (!E.replay(d, d.solution, { strict: true }).ok) return { fail: 'witnessUnproven' };

    built = {
      design: d,
      proof: {
        ...keyBuilt.proof,
        ice: recipe.ice,
        minimum: way.k,
        spare,
        changed: ['obst.keys', 'obst.locks', 'obst.ice', 'clock.n', 'solution']
      }
    };
  } else if (recipe.ice) {
    built = K.clockKeyIce(baseDesign, recipe.keys, recipe.ice, spare, proofOpts);
  } else if (recipe.keys) {
    built = K.clockKeys(baseDesign, recipe.keys, spare, proofOpts);
  } else {
    // Plain clock spare adjustment
    built = K.clockSpare(baseDesign, spare);
  }

  if (built.fail || !built.design) {
    return { fail: built.fail || 'buildFailed', detail: built };
  }

  const d = built.design;

  // Place controlled face-down tiles if requested (Dennis's rule: background only or at most 1 on route)
  const downCount = recipe.downCount ?? (recipe.maxDown ? Math.round(recipe.maxDown * d.tiles.length) : 0);
  if (downCount > 0 && (!d.down || d.down.length === 0)) {
    const g = E.game(d);
    const special = new Set([d.clock?.i, ...(d.obst?.keys || []), ...(d.obst?.locks || []), ...Object.keys(d.obst?.ice || {}).map(Number)]);
    const clockIdx = d.solution ? d.solution.indexOf(d.clock?.i) : -1;
    const route = new Set(clockIdx >= 0 ? d.solution.slice(0, clockIdx + 1) : []);
    const down = [];
    const hiddenOnWay = Math.min(1, recipe.hiddenOnWay ?? 0);
    if (hiddenOnWay > 0 && d.solution) {
      const routeCands = d.solution.filter(i => route.has(i) && !special.has(i) && g.nb.above[i].length > 0 && i !== d.clock?.i);
      if (routeCands.length > 0) down.push(routeCands[0]);
    }
    const bg = [];
    for (let i = 0; i < d.tiles.length; i++) {
      if (!special.has(i) && !route.has(i) && g.nb.above[i].length > 0 && !down.includes(i)) bg.push(i);
    }
    for (const t of bg) {
      if (down.length >= downCount) break;
      down.push(t);
    }
    d.down = down;
  }

  // Verify readability
  const isReadable = PS.readable(d);
  if (!isReadable) return { fail: 'unreadableDesign' };

  // Verify strict witness
  const strictWitness = E.replay(d, d.solution, { strict: true }).ok;
  if (!strictWitness) return { fail: 'strictWitnessFailed' };

  return {
    ok: true,
    design: d,
    proof: built.proof,
    k: built.proof.minimum,
    clockN: d.clock.n,
    spare,
    recipe
  };
}

module.exports = {
  BASE_BODIES,
  buildBase,
  analyzeTileTopography,
  composeCandidate
};
