'use strict';
const { parentPort } = require('worker_threads');
const B = require('./builder.js'), M = require('../factory/meter.js');
const { clockSpare } = require('./knobs.js');
const meter = M.createMeter();
const clone = x => JSON.parse(JSON.stringify(x));
const TARGETS = { trayRoom: 0, three: 3, luck: 1, hiddenOnWay: 1, traps: 0, maxDown: 0.3 };
const CHANGE = { three2: { three: 5 }, three4: { three: 7 }, luck1: { luck: 2, hiddenOnWay: 2 }, luck2: { luck: 3, hiddenOnWay: 3 }, traps1: { traps: 1 }, traps2: { traps: 2 } };
const identity = r => M.digest({ tiles: r.design.tiles, clock: r.design.clock.i, obst: r.design.obst, P: r.keep.P, holders: r.keep.holders });
function build(brief, options) {
  const r = B.build(brief, options);
  return { brief, ...r };
}
function bases(job) {
  const trials = [], boards = [], used = new Set(), shapes = new Set();
  const order = B.LAYOUTS.map((_, i) => (i + job.storyIndex * 7) % B.LAYOUTS.length);
  for (const way of [18, 16, 14, 12, 10, 8, 6]) {
    for (const layout of order.slice().sort((a, b) => Number(shapes.has(B.LAYOUTS[a].base)) - Number(shapes.has(B.LAYOUTS[b].base)))) {
      if (boards.length >= job.quota) break;
      if (used.has(layout) || B.LAYOUTS[layout].base === 'block') continue;
      const brief = { story: job.story, layout, shape: B.LAYOUTS[layout].shape, stage: null, seed: 1,
        frame: { spare: 1, way }, targets: { ...TARGETS } };
      if (!B.fits(job.story, B.LAYOUTS[layout].tiles, brief)) { trials.push({ layout, way, fail: 'rolesDoNotFit' }); continue; }
      const initial = build(brief);
      if (initial.fail) { trials.push({ layout, way, fail: initial.fail, detail: initial.detail, ms: initial.ms }); continue; }
      // Standardize the baseline through keep too: role-placement RNG consumption then cannot confound variants.
      const r = build(brief, { keep: initial.keep });
      if (r.fail || identity(initial) !== identity(r)) { trials.push({ layout, way, fail: r.fail || 'keptPuzzleChanged', detail: r.detail }); continue; }
      const id = `${job.story}-L${layout}`;
      boards.push({ id, base: id, knob: 'base', stage: 'knobs', ...r }); used.add(layout); shapes.add(B.LAYOUTS[layout].base);
      trials.push({ layout, way, ok: true, id, ms: initial.ms + r.ms });
    }
    if (boards.length >= job.quota) break;
  }
  return { story: job.story, quota: job.quota, boards, trials };
}
function variant(job) {
  const base = job.base, brief = clone(base.brief);
  if (job.knob === 'spare') {
    const x = clockSpare(base.design, 2);
    if (x.fail) return { id: base.id + ':spare', base: base.id, knob: 'spare', stage: 'knobs', brief, ...x };
    brief.frame.spare = 2;
    return { ...clone(base), id: base.id + ':spare', knob: 'spare', brief, design: x.design,
      card: { ...base.card, clock: { ...base.card.clock, spare: 2, n: x.design.clock.n } }, isolation: { samePuzzle: true, clockOnly: true } };
  }
  brief.targets = { ...brief.targets, ...CHANGE[job.knob] };
  const r = build(brief, { keep: clone(base.keep) });
  const out = { id: base.id + ':' + job.knob, base: base.id, knob: job.knob, stage: 'knobs', ...r };
  if (!r.fail) {
    out.isolation = { samePuzzle: identity(base) === identity(r),
      three: r.card.tray.three - base.card.tray.three, luck: r.card.tray.luck - base.card.tray.luck,
      traps: r.card.traps.tempting - base.card.traps.tempting, way: r.card.clock.fewestMoves - base.card.clock.fewestMoves,
      hidden: r.card.faceDownOnDig - base.card.faceDownOnDig };
    if (!out.isolation.samePuzzle) return { ...out, fail: 'unproven', detail: 'The kept puzzle changed.', design: undefined };
  }
  return out;
}
function range(job) {
  const cells = [], trial = job.spec;
  if (trial.layout == null) return { id: trial.id, stage: 'range', cell: trial, fail: 'rolesDoNotFit' };
  const brief = { story: trial.story, layout: trial.layout, shape: B.LAYOUTS[trial.layout].shape, seed: trial.seed,
    frame: { spare: 1, way: trial.way }, targets: { ...TARGETS, three: trial.three, luck: trial.luck, hiddenOnWay: trial.luck, traps: trial.traps } };
  return { id: trial.id, stage: trial.stage || 'range', cell: trial, ...build(brief) };
}
function measure(job) {
  if (meter.fingerprint !== job.bot) throw Error('Frozen bot fingerprint changed');
  const before = { ...meter.stats }, t0 = Date.now();
  const r = meter.measure(job.design, job.settings);
  return { key: job.key, boardKey: M.boardKey(job.design), profile: job.settings.setting, seed: job.settings.seed,
    settings: job.settings, plan: job.plan, bot: meter.fingerprint, valid: r.valid === true,
    exp: r.valid ? r.expectedTries : null, first: r.firstTryRate, slowestMove: r.slowestMove,
    lossShares: r.lossShares || r.lossPhase || null, censoredCampaigns: r.censoredCampaigns,
    losses: (r.results || []).flatMap(r => r.attempts || []).filter(a => !a.win).reduce((a, x) => { a[x.why || 'unknown'] = (a[x.why || 'unknown'] || 0) + 1; return a; }, {}),
    calls: meter.stats.calls - before.calls, hits: meter.stats.hits - before.hits, ms: Date.now() - t0 };
}
parentPort.on('message', job => {
  try { parentPort.postMessage({ ...({ bases, variant, range, measure }[job.action])(job), task: job.task }); }
  catch (e) { parentPort.postMessage({ error: e.stack, task: job.task }); }
});
