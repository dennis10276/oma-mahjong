/* Phase 3 of the level builder plan: knobs that do one thing (Claude, 2026-11-06).
   Plan (doc "Level builder plan"): each knob changes one descriptor; measure each knob with the bots on built
   boards; keep a knob when it moves the family rating the same way on at least 80% of boards; ban or split cliffs.

   A base brief is built; each variant changes ONE brief field and is built from the same story, layout and seed.
   A "null" variant is the base with another seed: the bot noise plus the builder's other choices. Every board is
   rated by the family bot (2 x 2 x 20 games: seeds 4711 and 18427, pooled, as the factory does) and the skilled
   planner (2 x 20 at 4711).

     node knobs.js plan [out=knobs-plan.json] [--bases 24]     base briefs + variants (only bases that build)
     node knobs.js measure <plan> <outdir> [--jobs N]            build + measure every board (resumable)
     node knobs.js report <outdir>                               per knob: deltas, share the expected way, noise
   Results: <outdir>/boards.jsonl (one line per board: id, base, knob, brief, card, family, skilled, design).    */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const BASE = { frame: { spare: 1, way: 12 }, targets: { trayRoom: 0, three: 3, luck: 1, hiddenOnWay: 1, traps: 0, maxDown: 0.3 } };
// knob: what changes, and which way the level should get harder (+1) or easier (-1)
const KNOBS = {
  null: { why: 'same brief, another seed: noise', set: b => ({ ...b, seed: b.seed + 1000 }), dir: 0 },
  three: { why: 'two more moves with 3 waiting', set: b => tgt(b, { three: b.targets.three + 2 }), dir: 1, card: c => c.tray.three },
  luck: { why: 'one more luck moment', set: b => tgt(b, { luck: b.targets.luck + 1, hiddenOnWay: b.targets.hiddenOnWay + 1 }), dir: 1, card: c => c.tray.luck },
  trap: { why: 'one decision trap on the way', set: b => tgt(b, { traps: 1 }), dir: 1, card: c => c.traps?.designed ?? 0 },
  way: { why: 'the way to the clock four moves longer', set: b => ({ ...b, frame: { ...b.frame, way: b.frame.way + 4 } }), dir: 1, card: c => c.clock.fewestMoves },
  spare: { why: 'one more spare clock move', set: b => ({ ...b, frame: { ...b.frame, spare: b.frame.spare + 1 } }), dir: -1, card: c => c.clock.spare },
  room: { why: 'one tray spot more on the dig (trayRoom 1)', set: b => tgt(b, { trayRoom: 1, luck: 0 }), dir: -1, card: c => c.trayCap },
};
function tgt(b, t) { return { ...b, targets: { ...b.targets, ...t } }; }
const STORIES = ['keysFarSide', 'clockInSight', 'iceLockClock', 'lockBeside', 'frozenGuards', 'roomInTrayLocked', 'roomInTrayFrozen', 'deepClock', 'keysOnIsland'];

function plan(nBases) {
  const B = require('./builder.js'), bases = [];
  for (let round = 0; bases.length < nBases && round < 6; round++) for (const story of STORIES) {
    if (bases.length >= nBases) break;
    const layout = (STORIES.indexOf(story) * 7 + round * 11) % B.LAYOUTS.length;
    if (!B.fits(story, B.LAYOUTS[layout].tiles)) continue;
    const brief = { id: `${story}-L${layout}`, story, layout, stage: null, seed: 1 + round, ...JSON.parse(JSON.stringify(BASE)) };
    const r = B.build(brief, {});
    if (r.fail) { process.stderr.write(`skip ${brief.id}: ${r.fail}\n`); continue; }
    bases.push(brief); process.stderr.write(`base ${brief.id} ok (${r.ms} ms)\n`);
  }
  const boards = [];
  for (const b of bases) for (const [knob, k] of Object.entries({ base: { set: x => x }, ...KNOBS })) boards.push({ id: `${b.id}:${knob}`, base: b.id, knob, brief: k.set(JSON.parse(JSON.stringify(b))) });
  return { version: 1, made: new Date().toISOString(), knobs: Object.fromEntries(Object.entries(KNOBS).map(([k, v]) => [k, { why: v.why, dir: v.dir }])), bases: bases.length, boards };
}

// ---------- worker: build + measure one board ----------
if (!isMainThread) {
  const B = require('./builder.js'), { createMeter } = require('../factory/meter.js'), meter = createMeter();
  parentPort.on('message', job => {
    const out = { id: job.id, base: job.base, knob: job.knob, brief: job.brief };
    try {
      const r = B.build(job.brief, {});
      if (r.fail) { out.fail = r.fail; out.detail = r.detail; parentPort.postMessage(out); return; }
      out.card = r.card; out.design = r.design; out.buildMs = r.ms;
      const opt = { runs: workerData.runs, seeds: 2, setting: 'family' };
      const a = meter.measure(r.design, { ...opt, seed: 4711 }), b = meter.measure(r.design, { ...opt, seed: 18427 });
      const s = meter.measure(r.design, { ...opt, seed: 4711, setting: 'planner' });
      out.family = { exp: (a.expectedTries + b.expectedTries) / 2, a: a.expectedTries, b: b.expectedTries, first: (a.firstTryRate + b.firstTryRate) / 2, valid: a.valid && b.valid };
      out.skilled = { exp: s.expectedTries, first: s.firstTryRate, valid: s.valid };
      out.fingerprint = meter.fingerprint;
    } catch (e) { out.fail = 'error'; out.detail = String(e && e.stack || e).slice(0, 400); }
    parentPort.postMessage(out);
  });
  return;
}

function measureAll(planFile, dir, jobs, runs) {
  const P = JSON.parse(fs.readFileSync(planFile, 'utf8')), file = path.join(dir, 'boards.jsonl');
  fs.mkdirSync(dir, { recursive: true });
  const done = new Set(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
  const todo = P.boards.filter(b => !done.has(b.id));
  console.log(`${todo.length} boards to do (${done.size} done), ${jobs} workers`);
  let next = 0, active = 0, finished = 0; const t0 = Date.now();
  return new Promise(resolve => {
    if (!todo.length) return resolve();
    for (let w = 0; w < Math.min(jobs, todo.length); w++) {
      const worker = new Worker(__filename, { workerData: { runs } }); active++;
      const feed = () => { if (next < todo.length) worker.postMessage(todo[next++]); else { worker.terminate(); if (--active === 0) resolve(); } };
      worker.on('message', out => {
        fs.appendFileSync(file, JSON.stringify(out) + '\n'); finished++;
        const eta = (Date.now() - t0) / finished * (todo.length - finished) / 60000;
        console.log(`${finished}/${todo.length} ${out.id} ${out.fail ? 'FAIL ' + out.fail : 'family ' + out.family.exp.toFixed(2) + ' skilled ' + out.skilled.exp.toFixed(2)}  (eta ${eta.toFixed(0)} min)`);
        feed();
      });
      worker.on('error', e => { console.error('worker error', e); feed(); });
      feed();
    }
  });
}

function report(dir) {
  const rows = fs.readFileSync(path.join(dir, 'boards.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const by = new Map(rows.map(r => [r.id, r])), med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
  const bases = [...new Set(rows.map(r => r.base))], lines = [];
  const noise = { family: [], skilled: [] };
  for (const b of bases) { const x = by.get(b + ':base'), y = by.get(b + ':null'); if (x?.family && y?.family) { noise.family.push(Math.abs(y.family.exp - x.family.exp)); noise.skilled.push(Math.abs(y.skilled.exp - x.skilled.exp)); } }
  const nf = med(noise.family), ns = med(noise.skilled);
  lines.push(`# Knob measurements (${rows.length} boards, ${bases.length} bases)`, '',
    `Noise (base vs the same brief with another seed): family median |change| ${nf?.toFixed(2)} tries, skilled ${ns?.toFixed(2)}.`, '',
    '| knob | what | pairs | built | descriptor moved | family: median change | family: share the expected way | beyond noise | skilled: median change | skilled: share the expected way | cliffs (family change > 5) |',
    '|---|---|---|---|---|---|---|---|---|---|---|');
  const summary = {};
  for (const [k, K] of Object.entries(KNOBS)) {
    if (k === 'null') continue;
    const pairs = bases.map(b => [by.get(b + ':base'), by.get(b + ':' + k)]).filter(([x, y]) => x && y);
    const ok = pairs.filter(([x, y]) => x.family && y.family);
    const df = ok.map(([x, y]) => y.family.exp - x.family.exp), ds = ok.map(([x, y]) => y.skilled.exp - x.skilled.exp);
    const moved = ok.filter(([x, y]) => K.card && K.card(y.card) !== K.card(x.card)).length;
    const way = d => K.dir > 0 ? d > 0 : d < 0;
    const sf = df.filter(way).length / (df.length || 1), ss = ds.filter(way).length / (ds.length || 1);
    const beyond = df.filter(d => way(d) && Math.abs(d) > nf).length / (df.length || 1);
    const cliffs = df.filter(d => Math.abs(d) > 5).length;
    summary[k] = { pairs: pairs.length, built: ok.length, moved, family: { median: med(df), share: sf, beyondNoise: beyond }, skilled: { median: med(ds), share: ss }, cliffs };
    lines.push(`| ${k} | ${K.why} | ${pairs.length} | ${ok.length} | ${moved} | ${med(df)?.toFixed(2)} | ${(100 * sf).toFixed(0)}% | ${(100 * beyond).toFixed(0)}% | ${med(ds)?.toFixed(2)} | ${(100 * ss).toFixed(0)}% | ${cliffs} |`);
  }
  lines.push('', 'Keep a knob when the family moves the expected way on at least 80% of boards (plan, phase 3). "Beyond noise": the change is larger than the median noise.',
    '', 'Failed builds: ' + rows.filter(r => r.fail).map(r => `${r.id} (${r.fail})`).join(', '));
  fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ noise: { family: nf, skilled: ns }, knobs: summary }, null, 1));
  console.log(lines.join('\n'));
}

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2), arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
  if (cmd === 'plan') { const p = plan(arg('bases', 24)); fs.writeFileSync(a || 'knobs-plan.json', JSON.stringify(p, null, 1)); console.log(p.bases, 'bases,', p.boards.length, 'boards'); }
  else if (cmd === 'measure') measureAll(a, b, arg('jobs', Math.max(1, os.cpus().length - 1)), arg('runs', 20)).then(() => console.log('done'));
  else if (cmd === 'report') report(a);
  else console.log('usage: knobs.js plan|measure|report (see the header)');
}
module.exports = { KNOBS, BASE, plan, report };
