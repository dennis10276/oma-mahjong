'use strict';

// Stored cards keep their historical bands. New builds name their finish profile.
const PROFILES = {
  standard: { parks: 1.5, parksMax: 3, max3: .1 },
  'light-after-verdict': { parks: .5, parksMax: 1.5, max3: .05, greedyMin: .55 },
  'new-idea': { parks: 2, parksMax: 2, max3: .1 },
  'existing-idea': { parks: 3, parksMax: 5, max3: .25 },
};

function targetFor(idea) {
  const target = PROFILES[idea + '-idea'];
  if (!target) throw new Error('Expected --idea new or existing');
  return target;
}

function tuningTarget(arg, defaultIdea) {
  const target = targetFor(arg('idea', defaultIdea));
  const lower = arg('parks', null);
  const upper = arg('parks-max', lower == null ? target.parksMax : null);
  return {
    parks: lower == null ? target.parks : +lower,
    ...(upper == null ? {} : { parksMax: +upper }),
    max3: +arg('max3', target.max3),
  };
}

function meets(target, feel, tail) {
  const parks = +(feel.parkAt[1] + feel.parkAt[2]).toFixed(1);
  return parks >= target.parks && parks <= target.parksMax && feel.waiting[3] <= target.max3
    && !feel.lostGames && (target.greedyMin == null || tail.tailGreedyWin >= target.greedyMin);
}

function resolutionTiles(trap) {
  const tiles = new Set((trap?.effects ?? []).filter(effect =>
    effect.by === 'tailFork' || effect.by === 'tailGreedy').map(effect => effect.tile));
  const mechanism = trap?.mechanism;
  if (['tailIce', 'tailLock'].includes(mechanism?.mode) && Number.isInteger(mechanism.added)) {
    tiles.add(mechanism.added);
  }
  return [...tiles].sort((a,b) => a-b);
}

function measure(design, trap, afterTrap) {
  const { expert } = require('./bank/feel');
  const afterTiles = afterTrap ? resolutionTiles(trap) : [];
  const feel = expert(design, { playouts: 16, seed: 9, afterTiles });
  if (!afterTrap) return { feel };
  const independent = expert(design, { playouts: 64, seed: 844, wrong: false, afterTiles });
  const afterMove = Math.max(...[design.clock.i, ...afterTiles].map(i => design.solution.indexOf(i) + 1));
  return { feel, finishVerification: { afterTiles, afterMove, independent } };
}

function check(r, feel, tail) {
  const name = r.card.finishProfile || 'standard';
  const target = PROFILES[name];
  if (!target) return false;
  if (name === 'light-after-verdict' && (!r.reviewRevision?.sourceFile || !r.reviewRevision?.reason)) return false;
  return meets(target, feel, tail);
}

module.exports = { PROFILES, targetFor, tuningTarget, meets, check, resolutionTiles, measure };
