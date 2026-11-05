'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = require('./piles_for.js');
const Hard = require('../../www/hard.js');
const { digest, boardKey } = require('./meter.js');
const { checkOrigin, compare, previousBoards } = require('./originality.js');
const Final = require('./final_seed.js');
const Preferences = require('./shape_preferences.js');

function candidates(pool, dir) {
  const read = (r, mode) => { const f = path.join(dir, r.id + '.' + mode + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : null; };
  return pool.flatMap(r => {
    const rate = read(r, 'rate'), quality = read(r, 'quality');
    if (!rate?.train?.valid || !rate.validation?.valid || !quality?.eligible) return [];
    return [{ ...r, rate, quality, fresh: read(r, 'fresh'), exp: (rate.train.exp + rate.validation.exp) / 2,
      base: r.shape.split(' · ')[0], spots: F.spots(r.design.tiles)[0] }];
  });
}
function assign(plan, pool, dir, limit = 3000000, optimize = false, allowPartial = false) {
  const inv = candidates(pool, dir).filter(r => !plan.originality?.required || !checkOrigin(r)), levels = plan.levels;
  const context = [], live = new Set(), previous = global.HARD_LEVELS;
  try {
    if (plan.levelTable) global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(plan.levelTable, 'utf8') + ';HARD_LEVELS');
    const replacing = new Set(levels.map(s => s.level)), from = Math.min(...replacing), to = Math.max(...replacing);
    for (let lv = 70; lv <= Math.max(199, to + 10); lv++) if (!replacing.has(lv)) {
      const d = Hard.get(lv); live.add(boardKey(d));
      if (lv <= 164 || lv >= from - 10 && lv <= to + 10) context.push({ level: lv, spots: F.spots(d.tiles)[0] });
    }
  } finally { global.HARD_LEVELS = previous; }
  const past = plan.originality?.required ? previousBoards(levels, plan.levelTable) : [];
  const novel = inv.map(r => past.every(p => !compare(r, p, plan.originality?.maxLayoutShare)));
  const allowed = levels.map(s => inv.map((r, i) => ({ r, i })).filter(({ r, i }) => (r.n > 88) === s.big &&
    r.design.tiles.length >= Preferences.minimum(plan) &&
    (r.quality.skilled?.exp ?? 0) >= (plan.skilledMin ?? 0) &&
    (r.origin?.intendedLevel == null || r.origin.intendedLevel === s.level) && novel[i] &&
    !live.has(boardKey(r.design)) && context.every(c => c.level > 164 && Math.abs(c.level - s.level) > 10 || F.share(r.design.tiles, c.spots) <= 0.75) &&
    Math.abs(r.exp - s.target) <= plan.tolerance && Math.abs(r.rate.train.exp - r.rate.validation.exp) <= (plan.maxSeedGap ?? 2) &&
    Final.qualifies(r, r.rate, r.fresh, s, plan)));
  const compat = inv.map(() => []);
  const originalityCompat = inv.map(() => []);
  for (let a = 0; a < inv.length; a++) for (let b = a + 1; b < inv.length; b++) compat[a][b] = compat[b][a] =
    inv[a].base !== inv[b].base && F.share(inv[a].design.tiles, inv[b].spots) <= 0.75;
  if (plan.originality?.required) for (let a = 0; a < inv.length; a++) for (let b = a + 1; b < inv.length; b++)
    originalityCompat[a][b] = originalityCompat[b][a] = inv[a].origin.creationId !== inv[b].origin.creationId &&
      !compare(inv[a], inv[b], plan.originality.maxLayoutShare);
  const picks = Array(levels.length).fill(-1), used = new Set();
  let nodes = 0, best = null;
  function choices(k) {
    return allowed[k].filter(({ r, i }) => !used.has(i) && (!plan.originality?.required ||
      picks.filter(p => p >= 0 && [...new Set(inv[p].recipe)].sort().join('+') === [...new Set(r.recipe)].sort().join('+')).length < plan.originality.maxSameRecipe) && picks.every((p, j) => p < 0 ||
      (!plan.originality?.required || originalityCompat[i][p]) &&
      (Math.abs(levels[k].level - levels[j].level) > 10 || compat[i][p]) &&
      // Ratings are noisy, but do not knowingly make a large reverse step.
      (j !== k - 1 || inv[p].exp <= r.exp + (plan.maxReverseStep ?? 0.25)) &&
      (j !== k + 1 || r.exp <= inv[p].exp + (plan.maxReverseStep ?? 0.25))));
  }
  // Bound coverage using only candidates that can actually enter a slot. A
  // matching also detects several slots competing for the same creation.
  const eligible = [...new Set(allowed.flatMap(a => a.map(x => x.i)))].map(i => inv[i]);
  const identity = r => plan.originality?.required ? r.origin.creationId : r.id;
  const owners = new Map();
  function match(k, seen) {
    for (const { r } of allowed[k]) {
      const id = identity(r); if (seen.has(id)) continue; seen.add(id);
      if (!owners.has(id) || match(owners.get(id), seen)) { owners.set(id, k); return true; }
    }
    return false;
  }
  for (let k = 0; k < levels.length; k++) match(k, new Set());
  const recipeGroups = new Map();
  for (const r of eligible) {
    const recipe = [...new Set(r.recipe)].sort().join('+');
    if (!recipeGroups.has(recipe)) recipeGroups.set(recipe, new Set());
    recipeGroups.get(recipe).add(identity(r));
  }
  const recipeCapacity = plan.originality?.required ? [...recipeGroups.values()].reduce((sum, ids) =>
    sum + Math.min(plan.originality.maxSameRecipe, ids.size), 0) : levels.length;
  const capacity = Math.min(owners.size, recipeCapacity);
  function dfs(count, cost, filled = count) {
    if (++nodes > limit || best && (!allowPartial && (!optimize || cost >= best.cost) ||
      allowPartial && (!optimize && best.filled === capacity || filled + levels.length - count < best.filled))) return;
    if (count === levels.length) {
      if (!best || filled > best.filled || filled === best.filled && cost < best.cost) best = { cost, filled, picks: picks.slice() };
      return;
    }
    let k = -1, opts = null;
    for (let j = 0; j < levels.length; j++) if (picks[j] === -1) {
      const c = choices(j);
      if (!c.length && !allowPartial) return;
      if (!opts || c.length < opts.length) { k = j; opts = c; }
    }
    const preference = r => Math.abs(r.exp - levels[k].target) + Preferences.penalty(r.shape, plan);
    opts.sort((a, b) => preference(a.r) - preference(b.r));
    for (const { r, i } of opts) {
      picks[k] = i; used.add(i);
      dfs(count + 1, cost + Math.abs(r.exp - levels[k].target) + Preferences.penalty(r.shape, plan) + (r.quality.lateShare >= 0.3 ? 0.2 : 0), filled + 1);
      used.delete(i); picks[k] = -1;
    }
    if (allowPartial) { picks[k] = -2; dfs(count + 1, cost, filled); picks[k] = -1; }
  }
  if (allowPartial || capacity === levels.length && allowed.every(a => a.length)) dfs(0, 0, 0);
  const coverage = levels.map((s, k) => ({ level: s.level, target: s.target, big: s.big, choices: allowed[k].length,
    shapes: [...new Set(allowed[k].map(({ r }) => r.base))], selected: best?.picks[k] >= 0 ? inv[best.picks[k]].id : null }));
  if (!best) return { nodes, coverage, capacity, eligible: inv.length, rows: null, problem: { inv, allowed, compat } };
  const rows = best.picks.flatMap((i, k) => {
    if (i < 0) return [];
    const { spots, base, rate, quality, fresh, ...r } = inv[i], s = levels[k];
    return [{ ...r, level: s.level, target: s.target, authoredTarget: r.target, pass: true,
      reviewReasons: [], authoringReviewReasons: r.reviewReasons || [], grabFirst: quality.grabFirst ?? null,
      family: { exp: +inv[i].exp.toFixed(3),
      search: rate.train.exp, validation: rate.validation.exp, searchSeed: 4711, validationSeed: 18427,
      ...(Final.tuned(r) ? { fresh: fresh.fresh.exp, freshSeed: Final.SEED } : {}), version: rate.train.version },
      skilled: quality.skilled.exp, room: quality.room, atTrap: quality.atTrap, specials: quality.special,
      warnings: quality.lateShare >= 0.3 ? ['lateSqueeze'] : [], lateShare: quality.lateShare,
      clockSpare: r.design.clock.n - (r.design.solution.indexOf(r.design.clock.i) + 1),
      design: { ...r.design, level: s.level }, boardHash: boardKey(r.design), bot: rate.bot }];
  });
  return { nodes, coverage, capacity, eligible: inv.length, rows, cost: best.cost, complete: rows.length === levels.length };
}
module.exports = { assign, candidates };
if (require.main === module) {
  const [planFile, poolFile, dir, out] = process.argv.slice(2);
  const plan = JSON.parse(fs.readFileSync(planFile));
  if (plan.levelTable) plan.levelTable = path.resolve(path.dirname(planFile), plan.levelTable);
  const result = assign(plan, JSON.parse(fs.readFileSync(poolFile)), dir, 3000000, false, process.argv.includes('--partial'));
  console.log(JSON.stringify({ eligible: result.eligible, nodes: result.nodes, coverage: result.coverage, cost: result.cost }, null, 2));
  if (result.rows && out) fs.writeFileSync(out, result.rows.map(r => JSON.stringify(r)).join('\n') + '\n');
}
