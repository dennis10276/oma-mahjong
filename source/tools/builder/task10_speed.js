'use strict';
// Screening wraps the unchanged bot. Survivors always receive the original full protocol.
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js');
const R = require('./task10_report.js'), S = require('./task10_study.js');
const read = f => JSON.parse(fs.readFileSync(f));
const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
const score = r => r.wonOn == null ? r.attempts.length : r.wonOn;
function prefix(m) { return m?.valid && m.results?.length >= 20 ? avg(m.results.slice(0, 20).map(score)) : null; }
function outside(x, lo, hi, margin) { return x != null && (x < lo - margin || x > hi + margin); }
function calibrate(root) {
  const cache = require('../factory/empirical_cache.js').inspector(), legacy = path.resolve(__dirname, '../../build/batch-200-225-v14');
  const candidates = read(path.join(legacy, 'pool.json')).map(r => ({ id: r.id, design: r.design, source: 'task9-pool' }));
  for (const folder of ['builder-knobs-clock-1', 'builder-knobs-clock-2']) {
    const file = path.resolve(__dirname, '../../build', folder, 'plan.json');
    if (fs.existsSync(file)) for (const b of read(file).boards) for (const kind of ['tight', 'loose']) if (b[kind]?.design) candidates.push({ id: b.id + '-' + kind, design: b[kind].design, source: folder });
  }
  const seen = new Set(), family = [], skilled = [];
  for (const b of candidates) {
    const key = M.boardKey(b.design); if (seen.has(key)) continue; seen.add(key);
    const get = (setting, seed) => (cache.full(b.design, setting, seed, 'tail') || cache.full(b.design, setting, seed))?.result;
    const a = get('family', 4711), v = get('family', 18427), p = get('planner', 4711);
    if (a?.valid && v?.valid && prefix(a) != null) {
      const full = (a.expectedTries + v.expectedTries) / 2;
      // One row per board. Check every curve target for which this full rating could qualify.
      const targets = Array.from({ length: 25 }, (_, i) => 10 + i / 12).concat(13).filter(t => Math.abs(full - t) <= 1 + 1e-9);
      family.push({ key, source: b.source, prefix: prefix(a), full, targets });
    }
    if (p?.valid && prefix(p) != null) skilled.push({ key, source: b.source, prefix: prefix(p), full: p.expectedTries });
  }
  function choose(rows, margins, eligible, reject) {
    const q = rows.filter(eligible), checks = margins.map(margin => {
      const rejected = q.filter(r => reject(r, margin)).length;
      return { margin, eligible: q.length, falselyStopped: rejected, fraction: q.length ? rejected / q.length : null };
    });
    const found = checks.find(c => c.eligible > 0 && c.fraction < 0.02);
    return { enabled: !!found, margin: found?.margin ?? null, checks };
  }
  const result = { created: new Date().toISOString(), bot: cache.fingerprint, familyRows: family.length, skilledRows: skilled.length,
    family: choose(family, [4, 4.5, 5, 6, 7, 9], r => r.targets.length > 0, (r, m) => r.targets.some(t => outside(r.prefix, t, t, m))),
    skilled: choose(skilled, [1, 1.5, 2, 3, 4], r => r.full >= 2.5 && r.full <= 6, (r, m) => outside(r.prefix, 2.5, 6, m)),
    note: 'Read-only replay of retained first20 campaign outcomes against full scores. Family checks every eligible curve target once per board. Planner stores only the winning full style: its prefix rejection is a conservative upper bound for the both-styles screening rule. This is empirical calibration, not a statistical guarantee. No bot/profile changes. Survivors run the unchanged full protocol; screening overhead is counted.',
    familyEvidence: family, skilledEvidence: skilled };
  M.atomicJson(path.join(root, 'speed-calibration.json'), result); return result;
}
function models(root) {
  const d = S.collect(root), stories = Object.keys(require('./stories.js').STORIES), requested = {}, actual = {};
  const cell = b => ({ story: b.brief.story, way: b.card.clock.fewestMoves, three: b.card.tray.three, luck: b.card.tray.luck, traps: b.card.traps.tempting });
  for (const profile of ['family', 'skilled']) {
    const rows = d.boards.filter(b => ['range', 'traps'].includes(b.stage) && !b.fail && b[profile] && !R.folds(b.cell));
    const groups = new Map();
    for (const b of rows) { const key = JSON.stringify([b.cell.story, b.cell.way, b.cell.three, b.cell.luck, b.cell.traps]); const g = groups.get(key) || { cell: b.cell, values: [] }; g.values.push(b[profile].exp); groups.set(key, g); }
    requested[profile] = R.leastSquares([...groups.values()].map(g => R.features(g.cell, stories)), [...groups.values()].map(g => avg(g.values)));
    actual[profile] = R.leastSquares(rows.map(b => R.features(cell(b), stories)), rows.map(b => b[profile].exp));
  }
  return { stories, requested, actual, trainingOnly: true, spare: 1, note: 'Plain additive fits, with requested descriptors and actual card descriptors reported separately. Both must agree beyond the three-try buffer to skip. Only spare1 is supported; no extrapolation to other spare values.' };
}
function filter(row, model) {
  const b = row.builderBrief, c = row.builderCard, prediction = {};
  if (b.frame.spare !== model.spare) return { skip: false, reason: 'unsupportedSpare', prediction };
  const requested = { story: b.story, way: b.frame.way, three: b.targets.three, luck: b.targets.luck, traps: b.targets.traps };
  const actual = { story: b.story, way: c.clock.fewestMoves, three: c.tray.three, luck: c.tray.luck, traps: c.traps.tempting };
  let skip = false;
  for (const [profile, [lo, hi]] of Object.entries({ family: [10, 13], skilled: [2.5, 6] })) {
    const a = R.predict(model.requested[profile], R.features(requested, model.stories)), z = R.predict(model.actual[profile], R.features(actual, model.stories));
    prediction[profile] = { brief: a, card: z };
    if (a != null && z != null && ((a < lo - 3 && z < lo - 3) || (a > hi + 3 && z > hi + 3))) skip = true;
  }
  return { skip, audit: skip && parseInt(M.digest(row.id).slice(0, 8), 16) % 5 === 0, prediction };
}
function screen(meter, design, setting, target, calibration) {
  const config = calibration[setting === 'family' ? 'family' : 'skilled'];
  if (!config.enabled) return { stopped: false, campaigns: 0, disabled: true };
  const styles = setting === 'planner' ? ['route', 'plain'] : [undefined], values = [], blocks = [];
  for (const plannerStyle of styles) {
    const runs = [];
    for (let block = 0; block < 2; block++) {
      const m = meter.measure(design, { setting, seed: (4711 + Math.imul(block * 10, 0x9e3779b9)) | 0, runs: 10, seeds: 1, capture: 'tail', ...(plannerStyle ? { plannerStyle } : {}) });
      blocks.push({ style: plannerStyle || 'family', block, valid: m.valid, exp: m.expectedTries });
      if (!m.valid) return { stopped: false, campaigns: blocks.length * 10, invalid: true, blocks };
      runs.push(...m.results.map(score));
    }
    values.push(avg(runs));
  }
  const [lo, hi] = setting === 'family' ? [target, target] : [2.5, 6];
  // For planner, both styles must be clearly on the same side. Never minimize each block separately.
  const stopped = values.every(x => x < lo - config.margin) || values.every(x => x > hi + config.margin);
  return { stopped, campaigns: blocks.length * 10, values, margin: config.margin, blocks };
}
function replay(root) {
  const data = S.collect(root), model = models(root), cache = require('../factory/empirical_cache.js').inspector(), calibration = read(path.join(root, 'speed-calibration.json'));
  const rows = data.boards.filter(b => b.stage === 'range' && !b.fail && b.family && b.skilled).map(b => {
    const f = filter({ id: b.id, builderBrief: b.brief, builderCard: b.card }, model), m = cache.full(b.design, 'family', 4711)?.result;
    const early = prefix(m), jointBand = b.family.exp >= 10 && b.family.exp <= 13 && b.skilled.exp >= 2.5 && b.skilled.exp <= 6;
    return { id: b.id, heldout: R.folds(b.cell), filter: f, jointBand, family: b.family.exp, skilled: b.skilled.exp,
      familyFirst20: early, wouldFamilyStop: calibration.family.enabled && outside(early, 11.5, 11.5, calibration.family.margin) };
  });
  const skipped = rows.filter(r => r.filter.skip), audits = skipped.filter(r => r.filter.audit), held = rows.filter(r => r.heldout), hskip = held.filter(r => r.filter.skip);
  const result = { created: new Date().toISOString(), mode: 'retrospective-only', actualCampaignsSaved: 0, actualFullCampaigns: rows.length * 160,
    note: 'The speed section was noticed after the main range measurements completed. Those measurements were not shortened: zero actual savings in the original grid. This replays filtering on existing full results; no new bot calls. All fully measured skipped cells can be checked, in addition to the deterministic20% audit. Training-grid replay is in-sample; held-out results are separated. Family screen replay uses the range-band centre11.5, not a slot-specific target. Planner has only the full winning-style trace in the old cache, so no invented exact two-style prefix saving is reported.',
    filter: { rated: rows.length, skipped: skipped.length, audits: audits.length, auditFalseSkips: audits.filter(r => r.jointBand).length, allFalseSkips: skipped.filter(r => r.jointBand).length,
      heldoutRated: held.length, heldoutSkipped: hskip.length, heldoutFalseSkips: hskip.filter(r => r.jointBand).length },
    screening: { wouldStop: rows.filter(r => r.wouldFamilyStop).length, falseStopsOfJointBand: rows.filter(r => r.wouldFamilyStop && r.jointBand).length }, rows };
  M.atomicJson(path.join(root, 'speed-range-replay.json'), result); return result;
}
if (require.main === module) {
  const root = path.resolve(process.argv[2]); console.log(JSON.stringify(process.argv[3] === 'replay' ? replay(root) : calibrate(root), (k, v) => k.endsWith('Evidence') || k === 'rows' ? undefined : v, 2));
}
module.exports = { calibrate, models, filter, screen, prefix, outside, replay };
