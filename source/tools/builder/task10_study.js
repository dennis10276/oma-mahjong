'use strict';
const fs = require('fs'), path = require('path');
const B = require('./builder.js'), M = require('../factory/meter.js'), { pool } = require('../factory/empirical_workers.js');
const WORKER = path.join(__dirname, 'task10_worker.js');
const read = f => JSON.parse(fs.readFileSync(f));
const save = (dir, file, x) => M.atomicJson(path.join(dir, file), x);
const stories = Object.keys(B.STORIES);
const keyFor = (design, settings, bot) => M.digest({ boardKey: M.boardKey(design), settings, bot });
function verifyPlan(plan) {
  const { fingerprint, ...contents } = plan;
  if (M.digest(contents) !== fingerprint) throw Error('Frozen plan contents changed');
}
function protocol() {
  return { schema: 'task10-v1', created: new Date().toISOString(), upstream: '7677864', bot: M.createMeter().fingerprint,
    worker: M.sourceHash(WORKER), construction: { quota: '2 per story, plus one for keysFarSide, iceLockClock, frozenGuards, deepClock',
      ways: [18, 16, 14, 12, 10, 8, 6], selection: 'first successful layouts in fixed story-rotated order, prefer different silhouettes; no bot outcomes',
      baseline: { three: 3, luck: 1, traps: 0, spare: 1, trayRoom: 0, maxDown: 0.3 },
      variants: ['three2', 'three4', 'luck1', 'luck2', 'traps1', 'traps2', 'spare'],
      isolation: 'identical geometry, clock tile, obstacles, planned dig and holders; spare changes only clock.n; record every descriptor delta and failed request' },
    settings: [{ setting: 'family', seed: 4711, runs: 20, seeds: 2 }, { setting: 'family', seed: 18427, runs: 20, seeds: 2 }, { setting: 'planner', seed: 4711, runs: 20, seeds: 2 }],
    decision: { direction: 'non-decreasing family for three/luck/traps, non-increasing for spare; ties count but are reported separately', threshold: 0.8, cliff: 5,
      exclusions: 'failed/unproven/changed-puzzle variants get no bot call; report missing coverage and actual descriptor movement separately' },
    range: { ways: [10, 14, 18], three: [2, 5, 8], luck: [0, 1, 2], traps: 0, seed: 1,
      repeats: 'middle cell way14/three5/luck1, seeds2,3 on story indices 0,2,3,4,5,9',
      heldout: 'entire cell, including repeats, hash(story,way,three,luck,traps) mod5 ==0; frozen before ratings',
      trapAddendum: 'one most promising built cell per story, ranked by distance to both requested bands, then id; freeze exact briefs before new bot calls' },
    bands: { family: [10, 13], skilled: [2.5, 6] } };
}
function check(dir) {
  const p = read(path.join(dir, 'protocol.json'));
  if (p.bot !== M.createMeter().fingerprint || p.worker !== M.sourceHash(WORKER)) throw Error('Frozen implementation/bot changed. Use a new directory.');
  return p;
}
async function jobs(dir, stage, tasks, workers) {
  const done = [], queue = [];
  for (const job of tasks) {
    const file = path.join(dir, 'construction', stage, job.task + '.json');
    if (fs.existsSync(file)) done.push(read(file)); else queue.push(job);
  }
  console.log(stage, queue.length, 'new,', done.length, 'saved');
  await pool(queue, WORKER, r => { save(dir, `construction/${stage}/${r.task}.json`, r); done.push(r);
    console.log(stage, done.length + '/' + tasks.length, r.task, r.fail || (r.boards ? r.boards.length + ' bases' : 'built'), r.ms ?? ''); }, workers);
  return done;
}
function cellId(x) { return `${x.story}-w${x.way}-t${x.three}-l${x.luck}-x${x.traps}-s${x.seed}`; }
function heldout(x) { return parseInt(M.digest({ story: x.story, way: x.way, three: x.three, luck: x.luck, traps: x.traps }).slice(0, 8), 16) % 5 === 0; }
async function prepare(dir, workers = 4) {
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, 'protocol.json'))) save(dir, 'protocol.json', protocol());
  const p = check(dir);
  const groups = await jobs(dir, 'bases', stories.map((story, storyIndex) => ({ action: 'bases', story, storyIndex,
    quota: 2 + Number(['keysFarSide', 'iceLockClock', 'frozenGuards', 'deepClock'].includes(story)), task: story })), workers);
  const bases = groups.flatMap(g => g.boards);
  const variants = await jobs(dir, 'variants', bases.flatMap(base => p.construction.variants.map(knob => ({ action: 'variant', base, knob, task: base.id + '-' + knob }))), workers);
  const specs = [];
  for (const [storyIndex, story] of stories.entries()) for (const way of p.range.ways) {
    const order = B.LAYOUTS.map((_, i) => (i + storyIndex * 7) % B.LAYOUTS.length);
    const layout = order.find(i => B.LAYOUTS[i].base !== 'block' && B.fits(story, B.LAYOUTS[i].tiles, { frame: { way, spare: 1 } }));
    for (const three of p.range.three) for (const luck of p.range.luck) {
      const seeds = way === 14 && three === 5 && luck === 1 && [0, 2, 3, 4, 5, 9].includes(storyIndex) ? [1, 2, 3] : [1];
      for (const seed of seeds) { const x = { story, way, three, luck, traps: 0, seed, layout: layout ?? null }; x.id = cellId(x); x.heldout = heldout(x); specs.push(x); }
    }
  }
  save(dir, 'range-requests.json', specs);
  const range = await jobs(dir, 'range', specs.map(spec => ({ action: 'range', spec, task: spec.id })), workers);
  const plan = { schema: p.schema, protocol: M.digest(p), bot: p.bot, worker: p.worker,
    boards: [...bases, ...variants, ...range].sort((a, b) => a.id.localeCompare(b.id)) };
  plan.fingerprint = M.digest(plan);
  const file = path.join(dir, 'plan.json');
  if (fs.existsSync(file) && read(file).fingerprint !== plan.fingerprint) throw Error('Existing frozen plan differs');
  save(dir, 'plan.json', plan);
  console.log('Frozen plan', plan.boards.length, 'requests,', plan.boards.filter(x => x.design && !x.fail).length, 'built; bot calls 0');
  return plan;
}
function rating(board, records, p) {
  if (board.fail || !board.design) return { family: null, skilled: null };
  const values = p.settings.map(s => records.get(keyFor(board.design, s, p.bot)));
  const family = values[0]?.valid && values[1]?.valid ? { exp: (values[0].exp + values[1].exp) / 2, seeds: [values[0].exp, values[1].exp], first: (values[0].first + values[1].first) / 2 } : null;
  const skilled = values[2]?.valid ? { exp: values[2].exp, first: values[2].first } : null;
  return { family, skilled };
}
function collect(dir) {
  const p = read(path.join(dir, 'protocol.json')), plan = read(path.join(dir, 'plan.json'));
  verifyPlan(plan);
  const records = new Map(), md = path.join(dir, 'measurements');
  if (fs.existsSync(md)) for (const f of fs.readdirSync(md).filter(f => f.endsWith('.json'))) { const x = read(path.join(md, f)); if (x.bot === p.bot) records.set(x.key, x); }
  const add = path.join(dir, 'trap-plan.json'), boards = plan.boards.concat(fs.existsSync(add) ? read(add).boards : []);
  return { protocol: p, plan, records, boards: boards.map(b => ({ ...b, ...rating(b, records, p) })) };
}
async function measure(dir, stage = 'all', workers = 6) {
  const p = check(dir), data = collect(dir), queue = [], seen = new Set();
  const sources = data.boards.filter(b => !b.fail && b.design && (stage === 'all' || b.stage === stage));
  for (const b of sources) for (const settings of p.settings) {
    const key = keyFor(b.design, settings, p.bot);
    if (seen.has(key)) continue; seen.add(key);
    const file = path.join(dir, 'measurements', key + '.json'), prior = fs.existsSync(file) ? read(file) : null;
    if (prior?.valid && prior.bot === p.bot && prior.key === key) continue;
    queue.push({ action: 'measure', task: key, key, design: b.design, settings, bot: p.bot, plan: data.plan.fingerprint });
  }
  const total = seen.size; let saved = total - queue.length;
  console.log('Measure', stage, queue.length, 'new,', saved, 'saved,', workers, 'workers');
  await pool(queue, WORKER, r => { save(dir, 'measurements/' + r.key + '.json', r); saved++;
    save(dir, 'progress.json', { stage, done: saved, total, date: new Date().toISOString() });
    console.log(saved + '/' + total, r.profile, r.seed, r.valid ? r.exp : 'INVALID', Math.round(r.ms / 1000) + 's'); }, workers);
  save(dir, 'boards.json', collect(dir).boards);
}
async function traps(dir, workers = 4) {
  check(dir);
  const file = path.join(dir, 'trap-plan.json'); if (fs.existsSync(file)) return read(file);
  const data = collect(dir), specs = [];
  const gap = (x, a, z) => Math.max(a - x, 0, x - z);
  for (const story of stories) {
    const choices = data.boards.filter(b => b.stage === 'range' && b.brief?.story === story && b.family && b.skilled && b.cell.seed === 1);
    choices.sort((a, b) => (gap(a.family.exp, 10, 13) + gap(a.skilled.exp, 2.5, 6)) - (gap(b.family.exp, 10, 13) + gap(b.skilled.exp, 2.5, 6)) || a.id.localeCompare(b.id));
    if (choices[0]) { const x = { ...choices[0].cell, traps: 1, stage: 'traps' }; x.id = cellId(x); x.heldout = heldout(x); specs.push(x); }
  }
  save(dir, 'trap-requests.json', { created: new Date().toISOString(), rule: data.protocol.range.trapAddendum, specs });
  const boards = await jobs(dir, 'traps', specs.map(spec => ({ action: 'range', spec, task: spec.id })), workers);
  const add = { created: new Date().toISOString(), parent: data.plan.fingerprint, boards }; add.fingerprint = M.digest(add);
  save(dir, 'trap-plan.json', add); return add;
}
if (require.main === module) {
  const [action, folder, part, jobsArg] = process.argv.slice(2), dir = path.resolve(folder);
  const f = { prepare: () => prepare(dir, +(part || 4)), measure: () => measure(dir, part || 'all', +(jobsArg || 6)), traps: () => traps(dir, +(part || 4)) }[action];
  if (!f) throw Error('prepare <dir> [jobs] | measure <dir> [all|knobs|range|traps] [jobs] | traps <dir> [jobs]');
  f().catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { protocol, prepare, measure, traps, collect, rating, heldout, cellId, keyFor, verifyPlan };
