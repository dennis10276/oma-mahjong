#!/usr/bin/env node
'use strict';
// Plan traps first, then steer their measured difficulty. Nothing is published.
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = require('./piles_for.js');
const I = require('../lab/ideas.js'), Hard = require('../../www/hard.js');
const { CONCEPTS, applyRecipe } = require('./design_traps.js');
const { runFile, readRows } = require('./run_file.js');
const { digest, atomicJson } = require('./meter.js');

function targetAt(level, points) {
  if (!Array.isArray(points) || points.length < 2 || points.some((p, k) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || p[1] < 1 || p[1] > 20 || k && (p[0] <= points[k - 1][0] || p[1] < points[k - 1][1])))
    throw Error('curve must contain increasing level/target points, with nondecreasing targets from 1 to 20');
  if (level < points[0][0] || level > points.at(-1)[0]) throw Error('Level ' + level + ' is outside the curve; extend its anchors explicitly');
  let k = 0;
  while (k < points.length - 2 && level > points[k + 1][0]) k++;
  const [a, va] = points[k], [b, vb] = points[k + 1];
  return +(va + (vb - va) * (level - a) / (b - a)).toFixed(2);
}
const tileKey = tiles => digest(tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]));
function validatePiles(levels, piles) {
  const chosen = levels.map(s => {
    const p = piles.find(p => p.level === (s.pile ?? s.level));
    if (!Number.isInteger(s.level) || !p) throw Error('Unknown level or pile: ' + JSON.stringify(s));
    const tiles = p.tiles.map(([x, y, z]) => ({ x, y, z }));
    if (/^blob/i.test(p.shape) || !F.SHAPES.some(sh => sh.name === p.shape)) throw Error('Use an approved non-blob shape at ' + s.level);
    if (tiles.length % 2 || F.towers(tiles) || F.tilePx(tiles) < 52) throw Error('Pile at ' + s.level + ' needs even tiles, no towers and at least 52px tiles');
    if ((tiles.length > 88) !== (s.level % 10 === 0)) throw Error('Big boards belong on every tenth level: ' + s.level);
    return { ...p, level: s.level };
  });
  for (let a = 0; a < chosen.length; a++) for (let b = a + 1; b < chosen.length; b++) {
    const x = chosen[a], y = chosen[b];
    if (Math.abs(x.level - y.level) > 10) continue;
    if (x.shape.split(' · ')[0] === y.shape.split(' · ')[0] || F.share(x.tiles, F.spots(y.tiles)[0]) > 0.75)
      throw Error('Piles repeat a shape or share over 75% of spots within ten levels: ' + x.level + ', ' + y.level);
  }
  // The batch's boundary must also fit the levels people already play.
  const previous = global.HARD_LEVELS;
  try {
    global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
    const replacing = new Set(levels.map(s => s.level)), context = new Map();
    for (const p of chosen) {
      const neighbours = Array.from({ length: 21 }, (_, k) => p.level - 10 + k);
      for (const lv of new Set([...Array.from({ length: 95 }, (_, k) => 70 + k), ...neighbours])) {
        if (replacing.has(lv) || lv < 70) continue;
        if (!context.has(lv)) context.set(lv, F.spots(Hard.get(lv).tiles)[0]);
        if (F.share(p.tiles, context.get(lv)) > 0.75) throw Error('Pile at ' + p.level + ' shares over 75% of spots with kept level ' + lv);
      }
    }
  } finally { global.HARD_LEVELS = previous; }
}
function prepare(planFile, outFile) {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8').replace(/^\uFEFF/, ''));
  const relative = f => path.resolve(path.dirname(planFile), f);
  if (!plan.piles || !Array.isArray(plan.levels) || !plan.levels.length) throw Error('Plan needs piles and levels');
  const piles = JSON.parse(fs.readFileSync(relative(plan.piles), 'utf8'));
  validatePiles(plan.levels, piles);
  const inventory = readRows(plan.inventory ? relative(plan.inventory) : path.join(__dirname, '../../analysis/factory/fallback-g61.jsonl'));
  const config = digest({ plan, piles, inventory });
  const file = outFile + '.starts.json', saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { config, rows: [] };
  if (saved.config !== config) throw Error('Plan or seed inventory changed; use a new output file');
  const done = new Set(saved.rows.map(r => r.level));
  if (new Set(plan.levels.map(r => r.level)).size !== plan.levels.length) throw Error('Duplicate level in plan');
  I.setExact(true, { nodes: plan.routeNodes ?? 20000, milliseconds: plan.routeMilliseconds ?? 1500 });
  for (const spec of plan.levels) {
    if (done.has(spec.level)) continue;
    const pile = piles.find(p => p.level === (spec.pile ?? spec.level)), concept = CONCEPTS[spec.concept];
    if (!Number.isInteger(spec.level) || !pile || !concept) throw Error('Unknown level, pile or trap concept: ' + JSON.stringify(spec));
    const target = spec.target ?? targetAt(spec.level, plan.curve);
    if (!Number.isFinite(target) || target < 1 || target > 20) throw Error('Invalid target');
    const tiles = pile.tiles.map(([x, y, z]) => ({ x, y, z }));
    const wantedRecipe = [...concept.recipe, ...(spec.extra || [])];
    if ((spec.extra || []).some(k => !I.IDEAS[k])) throw Error('Unknown extra trap at ' + spec.level);
    // Reuse a measured trap on this exact pile before asking the designer again.
    const seeds = inventory.filter(r => r.design && tileKey(r.design.tiles) === tileKey(tiles) &&
      wantedRecipe.every(k => (r.recipe || []).includes(k)) && I.valid(r.design));
    seeds.sort((a, b) => Math.abs((a.g61?.exp ?? 20) - target) - Math.abs((b.g61?.exp ?? 20) - target));
    let design = seeds[0]?.design, recipe = seeds[0]?.recipe;
    for (let attempt = 0; !design && attempt < (plan.seedAttempts ?? 4); attempt++) {
      const salt = 70 + attempt, deal = Hard.makeNow(spec.level, 1.6, 1, salt, { tiles });
      if (!deal.solution || !I.valid(deal)) continue;
      const trapped = applyRecipe(deal, wantedRecipe, I.rngOf(spec.level * 31 + salt * 7));
      design = trapped && I.fix(trapped, concept.spare);
      if (design && !I.valid(design)) design = null;
      recipe = wantedRecipe;
    }
    if (!design) throw Error('No valid ' + spec.concept + ' trap on pile ' + pile.level + '; try another pile or concept. Prepared levels are saved.');
    saved.rows.push({ level: spec.level, target, concept: spec.concept, title: concept.title, recipe,
      shape: pile.shape, pile: pile.level, seedSource: seeds[0] ? 'inventory' : 'designed', design: { ...design, level: spec.level } });
    atomicJson(file, saved);
    console.log(spec.level, concept.title, 'target', target, seeds[0] ? '(reused trap)' : '(new trap)');
  }
  const starts = outFile + '.starts.jsonl';
  const tmp = starts + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, saved.rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.renameSync(tmp, starts);
  return starts;
}
function main(args = process.argv.slice(2)) {
  const [planFile, outFile] = args;
  if (!planFile || !outFile) throw Error('Usage: node source/tools/factory/build.js <plan.json> <out.jsonl>');
  const started = Date.now(), starts = prepare(planFile, outFile);
  const result = runFile(starts, outFile);
  console.log(result.rows.filter(r => r.pass).length + '/' + result.rows.length + ' pass; ' +
    result.stats.calls + ' bot calls, ' + result.stats.hits + ' cache hits, ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
}
if (require.main === module) { try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; } }
module.exports = { targetAt, validatePiles, prepare, main };
