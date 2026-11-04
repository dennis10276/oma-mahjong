'use strict';
const F = require('./piles_for.js');
const { digest } = require('./meter.js');
const fs = require('fs'), vm = require('vm');
const layoutKeys = new Map(), puzzleKeys = new Map();
function memo(cache, signature, calculate) {
  if (cache.has(signature)) return cache.get(signature);
  const value = calculate();
  if (cache.size >= 4096) cache.delete(cache.keys().next().value);
  cache.set(signature, value); return value;
}

function previousBoards(levels, levelTable) {
  const Hard = require('../../www/hard.js'), saved = global.HARD_LEVELS;
  try {
    if (levelTable) global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(levelTable, 'utf8') + ';HARD_LEVELS');
    const replacing = new Set(levels.map(r => r.level)), table = global.HARD_LEVELS;
    const last = Math.max(Math.max(...replacing) + 10, table ? table.from + table.levels.length - 1 : 0), rows = [];
    for (let level = 70; level <= last; level++) if (!replacing.has(level)) rows.push({ level, design: Hard.get(level) });
    return rows;
  } finally { global.HARD_LEVELS = saved; }
}

const tilesOf = d => d.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]);
function transforms(tiles) {
  return Array.from({ length: 8 }, (_, k) => {
    const a = tiles.map(([x, y, z]) => {
      if (k & 4) [x, y] = [y, x];
      return [k & 1 ? -x : x, k & 2 ? -y : y, z];
    });
    const x0 = Math.min(...a.map(t => t[0])), y0 = Math.min(...a.map(t => t[1]));
    return a.map(([x, y, z]) => [x - x0, y - y0, z]);
  });
}
function layoutKey(d) {
  const tiles = tilesOf(d);
  return memo(layoutKeys, JSON.stringify(tiles), () => digest(transforms(tiles).map(a => JSON.stringify(a.slice().sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]))).sort()[0]));
}
// Picture identities are cosmetic: canonicalize the matching relationships.
function puzzleKey(d) {
  return memo(puzzleKeys, JSON.stringify([tilesOf(d), d.faces, d.down, d.obst, d.clock]), () => digest(transforms(tilesOf(d)).map(a => {
    const order = a.map((_, i) => i).sort((i, j) => a[i][2] - a[j][2] || a[i][1] - a[j][1] || a[i][0] - a[j][0]);
    const pictures = new Map(), ob = d.obst || {}, down = new Set(d.down || []);
    const rows = order.map(i => {
      if (!pictures.has(d.faces[i])) pictures.set(d.faces[i], pictures.size);
      return [...a[i], pictures.get(d.faces[i]), +down.has(i), ob.ice?.[i] || 0,
        +(ob.keys || []).includes(i), +(ob.locks || []).includes(i), +(d.clock?.i === i)];
    });
    return JSON.stringify([rows, d.clock?.n ?? null]);
  }).sort()[0]));
}
function originOf(d, creationId, brief, seed) {
  return { kind: 'fresh-design', creationId, brief, seed, initialLayout: layoutKey(d),
    method: 'new-pile-and-authored-trap', transforms: [] };
}
function checkOrigin(row) {
  const o = row.origin;
  if (!o || o.kind !== 'fresh-design' || !o.creationId || !o.brief) return 'missingFreshDesign';
  if (o.method !== 'new-pile-and-authored-trap' || o.parentLevel != null) return 'copiedLevel';
  if (o.initialLayout !== layoutKey(row.design)) return 'changedOrTrimmedLayout';
  if ((o.transforms || []).some(t => /trim|crop|mirror|reskin|scale|shift|transplant/i.test(t))) return 'derivedBoard';
  return null;
}
function compare(a, b, maxShare = .75) {
  if (layoutKey(a.design) === layoutKey(b.design)) return 'sameLayout';
  if (puzzleKey(a.design) === puzzleKey(b.design)) return 'samePuzzle';
  if (!fitsLayouts(tilesOf(a.design), [F.spots(tilesOf(b.design))[0]], maxShare)) return 'tooMuchSharedLayout';
  return null;
}
function fitsLayouts(tiles, masks, maxShare = .75) {
  const views = transforms(tiles).map(t => new Set(t.map(p => p.join(',')))), own = views[0];
  const within = (a, b) => {
    let shared = 0; for (const k of a) if (b.has(k)) shared++;
    // A small crop of a large board must not evade the larger-board denominator.
    if (a.size !== b.size && shared === Math.min(a.size, b.size)) return false;
    return shared / Math.max(a.size, b.size) <= maxShare;
  };
  return masks.every(mask => {
    if (!views.every(view => within(view, mask))) return false;
    let other = maskViews.get(mask);
    if (!other) {
      other = transforms([...mask].map(s => s.split(',').map(Number))).map(t => new Set(t.map(p => p.join(','))));
      maskViews.set(mask, other);
    }
    return other.every(view => within(view, own));
  });
}
const maskViews = new WeakMap();
function assertOriginalBatch(rows, previous = [], options = {}) {
  const ids = new Set(), recipes = new Map(), maxShare = options.maxLayoutShare ?? .75;
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k], issue = checkOrigin(r);
    if (issue) throw Error('Originality: ' + issue + ' at ' + r.level);
    if (ids.has(r.origin.creationId)) throw Error('Originality: two levels from one design');
    ids.add(r.origin.creationId);
    if (!r.recipe?.length) throw Error('Originality: a level needs an authored puzzle recipe');
    const recipe = [...new Set(r.recipe)].sort().join('+'), n = (recipes.get(recipe) || 0) + 1;
    recipes.set(recipe, n);
    if (n > (options.maxSameRecipe ?? 3)) throw Error('Originality: the same puzzle recipe is overused');
    for (const other of [...previous, ...rows.slice(0, k)]) {
      const why = compare(r, other, maxShare);
      if (why) throw Error('Originality: ' + why + ' at ' + r.level + ' versus ' + other.level);
    }
  }
}
module.exports = { layoutKey, puzzleKey, originOf, checkOrigin, compare, assertOriginalBatch, fitsLayouts, previousBoards };
