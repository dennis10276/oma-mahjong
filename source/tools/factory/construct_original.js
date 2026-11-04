'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const I = require('../lab/ideas.js'), Hard = require('../../www/hard.js'), L = global.Layouts;
const { applyRecipe, roomProfile } = require('./design_traps.js');
const { originOf } = require('./originality.js');
const { atomicJson, boardKey, digest, sourceHash } = require('./meter.js');

function construct(pile, spec, plan, attempt, diagnostic = {}) {
  const fail = stage => { diagnostic.stage = stage; return null; };
  const brief = attempt >= 8 && spec.alternatives?.length ? spec.alternatives[Math.floor((attempt - 8) / 8) % spec.alternatives.length] : spec;
  I.setExact(true, { nodes: plan.routeNodes ?? 12000, milliseconds: plan.routeMilliseconds ?? 350 });
  const seed = (plan.seed || 81000) + spec.level * 31 + attempt * 1777;
  const raw = Hard.makeNow(spec.level, 1.6, 1, seed, { tiles: pile.tiles.map(([x, y, z]) => ({ x, y, z })) });
  if (!raw.solution) return fail('pairing');
  const base = { ...raw, obst: { ice: {}, locks: [], keys: [] }, clock: null };
  if (!I.valid(base)) return fail('baseSolution');
  const placed = applyRecipe(base, brief.recipe, I.rngOf(seed * 13 + 7));
  let d = placed && I.fix(placed, brief.spare ?? 2);
  if (!placed) return fail('recipe');
  if (!d?.clock || !I.valid(d)) return fail('clockRoute');
  let room = roomProfile(d), edits = [];
  for (let k = 0; room.ok && room.unrelieved > 1 && k < base.tiles.length; k++) {
    const i = room.tightTiles.at(-1), tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles);
    const alive = new Uint8Array(tiles.length).fill(1), after = alive.slice();
    for (const j of room.path.slice(0, room.path.indexOf(i))) alive[j] = 0;
    after.set(alive); after[i] = 0;
    const candidates = d.down.filter(j => after[j] && !L.isFree(j, alive, nb) && L.isFree(j, after, nb));
    const reveal = candidates[0]; if (reveal === undefined) break;
    d = { ...d, down: d.down.filter(j => j !== reveal) }; edits.push({ kind: 'faceUpForRelief', index: reveal });
    room = roomProfile(d);
  }
  if (!room.ok || room.unrelieved > 1 || !I.valid(d)) return fail('relief');
  const origin = originOf(d, plan.batchId + '/level-' + spec.level, brief.brief, seed);
  origin.intendedLevel = spec.level; origin.layoutSeed = pile.seed; origin.pairingSeed = seed;
  return { id: boardKey(d).slice(0, 16), level: spec.level, target: spec.target, shape: pile.shape,
    recipe: brief.recipe, brief: brief.brief, n: d.tiles.length, design: d, room, origin,
    seedSource: 'fresh-designed', constructionEdits: edits, attempt };
}
if (!isMainThread) parentPort.on('message', job => {
  const started = Date.now();
  const diagnostic = {};
  try { parentPort.postMessage({ level: job.spec.level, attempt: job.attempt, row: construct(job.pile, job.spec, job.plan, job.attempt, diagnostic), ...diagnostic, seconds: (Date.now() - started) / 1000 }); }
  catch (e) { parentPort.postMessage({ level: job.spec.level, attempt: job.attempt, error: e.message }); }
});
else {
  async function run(planFile, dir, jobs = 6, wanted = 3) {
    const plan = JSON.parse(fs.readFileSync(planFile)), piles = JSON.parse(fs.readFileSync(path.resolve(path.dirname(planFile), plan.piles)));
    fs.mkdirSync(dir, { recursive: true });
    const output = path.join(dir, 'original-seeds.json'), progressFile = path.join(dir, 'construction.json');
    const config = digest({ plan, piles, schema: 'fresh-brief-v2',
      implementation: [__filename, '../lab/ideas.js', '../lab/exact.js', './piles_for.js', '../../www/hard.js', '../../www/layouts.js']
        .map(f => sourceHash(path.resolve(__dirname, f))) });
    const state = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile)) : { config, done: [], results: [] };
    if (state.config !== config) throw Error('Fresh construction inputs changed; use a new output directory');
    const rows = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : [], counts = {};
    for (const r of rows) {
      const spec = plan.levels.find(s => s.level === r.level);
      const recipe = x => [...new Set(x)].sort().join('+');
      if (spec && [spec, ...(spec.alternatives || [])].some(b => recipe(b.recipe) === recipe(r.recipe)))
        counts[r.level] = (counts[r.level] || 0) + 1;
    }
    const done = new Set(state.done), queue = [];
    for (let attempt = 0; attempt < (plan.seedAttempts || 8); attempt++) for (const spec of plan.levels)
      if (!done.has(spec.level + '/' + attempt)) queue.push({ spec, pile: piles.find(p => p.level === spec.level), plan, attempt });
    await Promise.all(Array.from({ length: jobs }, () => new Promise((resolve, reject) => {
      const w = new Worker(__filename); w.on('error', reject);
      const next = () => {
        let job; while (queue.length) { const q = queue.shift(); if ((counts[q.spec.level] || 0) < wanted) { job = q; break; } }
        if (job) w.postMessage(job); else w.terminate().then(resolve, reject);
      };
      w.on('message', r => {
        done.add(r.level + '/' + r.attempt); state.done = [...done]; state.results.push({ ...r, row: undefined });
        if (r.row && !rows.some(x => x.id === r.row.id)) { rows.push(r.row); counts[r.level] = (counts[r.level] || 0) + 1; atomicJson(output, rows); }
        atomicJson(progressFile, state);
        console.log(r.level, 'attempt', r.attempt, r.row ? 'fresh puzzle' : r.error || r.stage || 'no suitable construction', r.seconds?.toFixed(1) + 's'); next();
      }); next();
    })));
    console.log('fresh designs', rows.length, 'levels', Object.keys(counts).length);
  }
  module.exports = { construct, run };
  if (require.main === module) run(process.argv[2], process.argv[3], +(process.argv[4] || 6), +(process.argv[5] || 3)).catch(e => { console.error(e); process.exitCode = 1; });
}
