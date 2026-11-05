'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = require('./piles_for.js'), Hard = require('../../www/hard.js'), L = global.Layouts;
const { atomicJson } = require('./meter.js');
const { layoutKey, fitsLayouts, previousBoards } = require('./originality.js');
const Preferences = require('./shape_preferences.js');
const BRIEFS = [
  { recipe: ['chainReaction'], brief: 'Thaw the key guards, match the keys, then release the buried clock.', spare: 3 },
  { recipe: ['deepKeys', 'iceChain'], brief: 'Keep space while digging for distant keys; the final ice link guards the clock.', spare: 1 },
  { recipe: ['lockedPartners', 'frozenGuards'], brief: 'Carry the right singles while their partners are locked and the clock guards are frozen.', spare: 2 },
  { recipe: ['iceLockClock'], brief: 'Keys unlock the neighbours needed to melt the clock.', spare: 2 },
  { recipe: ['dontGrab', 'lockedPartners'], brief: 'Find a place for the clock partner before spending a tray slot on the visible clock.', spare: 2 },
  { recipe: ['keysAcross', 'frozenGuards'], brief: 'Choose which wing to open before thawing the clock guards.', spare: 2 },
  { recipe: ['clockOnTopLocked'], brief: 'The clock is visible; the key route, rather than the clock cover, is the opening puzzle.', spare: 2 },
  { recipe: ['trayJuggleFrozen'], brief: 'Choose the order of digging and thawing so the clock opening leaves a tray escape.', spare: 2 },
  { recipe: ['trayJuggleLocked'], brief: 'Reserve a tray spot until the buried keys free the waiting partners.', spare: 2 },
  { recipe: ['frozenGuards'], brief: 'Plan which neighbours to use to thaw the guards above the clock.', spare: 2 },
  { recipe: ['iceChain', 'blindTwins'], brief: 'Use visible ice as a guide while remembering the newly uncovered partners.', spare: 1 },
  { recipe: ['keyToEscape'], brief: 'Unlock a route to the clock partner before taking the tempting clock.', spare: 2 },
  { recipe: ['lockedClock'], brief: 'Bring both key pictures together before the buried locked clock runs out.', spare: 2 },
];
function shapeChoices(plan, made, spec, rng) {
  // Candidate IDs are creation slots, not adjacent campaign levels. Alternative
  // silhouettes may repeat here; assignment/verification enforce spacing at the
  // actual output levels. Global D4 novelty still applies to every whole layout.
  const recent = plan.outputLevels ? [] : made.filter(r => Math.abs(spec.level - r.level) <= 10).map(r => r.base);
  return Preferences.order(L.shuffleArr(rng, F.SHAPES.slice()), plan, spec.preferredShapes).filter(s => !recent.includes(s.shape));
}
function make(planFile, out) {
  const plan = JSON.parse(fs.readFileSync(planFile));
  global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.resolve(path.dirname(planFile), plan.levelTable), 'utf8') + ';HARD_LEVELS');
  const prior = previousBoards(plan.outputLevels || plan.levels, path.resolve(path.dirname(planFile), plan.levelTable));
  const past = prior.map(r => F.spots(r.design.tiles)[0]);
  const made = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)).filter(r =>
    r.originalityVersion === 'layout-d4-v1' && r.tiles.length >= Preferences.minimum(plan)) : [];
  const seen = new Set(made.map(r => layoutKey({ tiles: r.tiles })));
  for (let k = 0; k < plan.levels.length; k++) {
    const spec = plan.levels[k]; if (made.some(r => r.level === spec.level)) continue;
    const rng = L.rng(62000 + spec.level * 37), choices = shapeChoices(plan, made, spec, rng);
    let selected = null;
    for (const sh of choices) {
      for (let trial = 0; trial < (plan.layoutAttempts || 8) && !selected; trial++) {
        const sizes = plan.normalSizes || [76, 80, 84, 88];
        const seed = 73000 + spec.level * 103 + trial * 9973, n = spec.big ? 96 : sizes[(k + trial) % sizes.length];
        const tiles = F.candidate(sh, n, seed, t => {
          if (t.length < Preferences.minimum(plan)) return false;
          if (seen.has(layoutKey({ tiles: t }))) return false;
          return fitsLayouts(t, [...past, ...made.map(r => F.spots(r.tiles)[0])]);
        });
        if (tiles) selected = { level: spec.level, shape: sh.name, base: sh.shape, n: tiles.length, tiles, seed,
          layoutKey: layoutKey({ tiles }), originalityVersion: 'layout-d4-v1', generated: 'fresh-catalogue-pile', px: F.tilePx(tiles.map(([x, y, z]) => ({ x, y, z }))) };
      }
      if (selected) break;
    }
    if (!selected) throw Error('No sufficiently distinct fresh layout at ' + spec.level + '; completed layouts are saved');
    made.push(selected); seen.add(selected.layoutKey); atomicJson(out, made);
    console.log(spec.level, selected.shape, selected.n, 'fresh tiles');
  }
  plan.batchId ||= 'original-' + plan.from + '-' + plan.to;
  plan.piles = path.relative(path.dirname(planFile), out).replace(/\\/g, '/');
  plan.seed ??= 81000; plan.seedAttempts ??= 8;
  plan.originality = { required: true, maxLayoutShare: .75, maxSameRecipe: 3, noDerivedBoards: true };
  plan.levels = plan.levels.map((r, k) => ({ ...BRIEFS[k % BRIEFS.length], ...r,
    concept: r.concept || 'authored-' + (k % BRIEFS.length), pile: r.level }));
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n');
  return made.sort((a, b) => a.level - b.level);
}
module.exports = { make, BRIEFS, shapeChoices };
if (require.main === module) make(process.argv[2], process.argv[3]);
