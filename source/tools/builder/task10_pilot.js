'use strict';
const fs = require('fs'), path = require('path');
const { isMainThread, parentPort } = require('worker_threads');
const M = require('../factory/meter.js'), B = require('./builder.js'), S = require('./task10_study.js');
const Speed = require('./task10_speed.js');
const O = require('../factory/originality.js'), F = require('../factory/piles_for.js'), { pool } = require('../factory/empirical_workers.js');
const read = f => JSON.parse(fs.readFileSync(f));
const save = (dir, file, value) => M.atomicJson(path.join(dir, file), value);
const missing = [208, 210, 215, 216, 217, 221];
// Preserve established names where the mechanisms agree. V2's frozen-key and clock-thaw chains have
// different mechanisms from the old frozenGuards/chainReaction recipes; keep that distinction explicit.
const RECIPE = { deepClock: 'trayJuggle', roomInTrayLocked: 'trayJuggleLocked', roomInTrayFrozen: 'trayJuggleFrozen',
  keysFarSide: 'keysAcross', keysOnIsland: 'keysOnIsland', clockInSight: 'clockOnTopLocked', iceLockClock: 'iceLockClock',
  lockBeside: 'clockUnderLockedCover', frozenGuards: 'frozenKeysClock', chainReaction: 'keyIceLockClock' };
function goldPair(design) {
  const d = structuredClone(design), ob = d.obst || {}, special = new Set([d.clock?.i, ...(ob.keys || []), ...(ob.locks || []), ...Object.keys(ob.ice || {}).map(Number)]);
  const groups = new Map(), pos = new Map(d.solution.map((i, k) => [i, k]));
  d.faces.forEach((f, i) => { const g = groups.get(f) || []; g.push(i); groups.set(f, g); });
  const pairs = [...groups.values()].filter(a => a.length === 2 && a.every(i => !special.has(i)));
  pairs.sort((a, b) => Math.abs((pos.get(a[0]) + pos.get(a[1])) / 2 - d.tiles.length * 0.62) - Math.abs((pos.get(b[0]) + pos.get(b[1])) / 2 - d.tiles.length * 0.62) || a[0] - b[0]);
  if (!pairs.length) throw Error('No normal matching gold pair');
  d.gold = pairs[0]; return d;
}
function hitRate(builds, first) {
  const built = builds.filter(x => x.proofBuilt), by = new Map(first.map(x => [x.task, x]));
  const measured = built.map(b => by.get(b.task)).filter(x => x?.search?.valid), seedHits = measured.filter(x => x.firstHit).length;
  const pooled = built.map(b => by.get(b.task)).filter(x => x?.search?.valid && x.validation?.valid);
  const hits = pooled.filter(x => x.pooledHit).length;
  return { built: built.length, validFirstChecks: pooled.length, firstHits: hits, firstCheckHitRate: built.length ? hits / built.length : null,
    complete: built.every(b => by.get(b.task)?.processed || (by.get(b.task)?.search?.valid && by.get(b.task)?.validation?.valid)), meets50percent: built.length > 0 && built.every(b => by.get(b.task)?.processed || (by.get(b.task)?.search?.valid && by.get(b.task)?.validation?.valid)) && hits / built.length >= 0.5,
    pooledHits: hits, pooledMeasured: pooled.length, seed4711Hits: seedHits, seed4711Measured: measured.length,
    seed4711HitRate: built.length ? seedHits / built.length : null,
    definition: 'Primary denominator: every successful builder output, including static-quality rejections and boards rejected by screening/filtering. Hits require initial pooled80-campaign family rating at4711+18427, before retuning/fresh seed. Stopped/skipped boards have no fabricated rating and cannot be hits. The initial4711 score is also reported.' };
}
function prepare(studyDir, dir) {
  if (fs.existsSync(path.join(dir, 'pilot-plan.json'))) return read(path.join(dir, 'pilot-plan.json'));
  const data = S.collect(studyDir);
  const points = data.boards.filter(b => !b.fail && b.family && b.skilled && b.family.exp >= 10 && b.family.exp <= 13 && b.skilled.exp >= 2.5 && b.skilled.exp <= 6);
  if (!points.length) throw Error('No measured point reaches both bands: Task10 stops before a pilot.');
  const legacyDir = path.resolve(__dirname, '../../build/batch-200-225-v14');
  const baseline = path.join(studyDir, 'baseline-levels.jsonl');
  const keptFile = fs.existsSync(baseline) ? baseline : path.resolve(__dirname, '../../../../codex-tasks/results/200-225-v14/levels.jsonl');
  const kept = fs.readFileSync(keptFile, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  if (kept.length !== 20) throw Error('Expected the preserved twenty-level checkpoint');
  const oldPlan = read(fs.existsSync(path.join(studyDir, 'baseline-plan.json')) ? path.join(studyDir, 'baseline-plan.json') : path.join(legacyDir, 'output-plan.json'));
  const palette = read(path.join(legacyDir, 'palette.json'));
  const past = O.previousBoards(oldPlan.levels, oldPlan.levelTable), masks = past.concat(kept).map(r => F.spots(r.design.tiles)[0]);
  const slots = [], requests = [];
  for (const level of missing) {
    const slot = oldPlan.levels.find(s => s.level === level), candidates = points.slice().sort((a, b) => Math.abs(a.family.exp - slot.target) - Math.abs(b.family.exp - slot.target) || a.id.localeCompare(b.id));
    const used = new Set(); let attempts = 0;
    for (const point of candidates) for (const lay of palette) {
      if (attempts >= 5) break;
      if (used.has(lay.layoutKey) || lay.base === 'block' || (level === 210 ? lay.n !== 96 : lay.n > 88) || lay.n < 72) continue;
      if (kept.some(k => Math.abs(k.level - level) <= 10 && k.shape.split(' · ')[0] === lay.base)) continue;
      if (!O.fitsLayouts(lay.tiles, masks, oldPlan.originality.maxLayoutShare)) continue;
      const brief = { ...structuredClone(point.brief), tiles: lay.tiles, shape: lay.shape, seed: 10000 + level * 10 + attempts };
      delete brief.layout;
      if (!B.fits(brief.story, lay.tiles, brief)) continue;
      const id = 'L' + level + '-a' + (attempts + 1), creation = 'task10-' + id + '-layout' + lay.level;
      requests.push({ id, level, target: slot.target, sourcePoint: point.id, sourceFamily: point.family.exp, sourceSkilled: point.skilled.exp,
        layout: lay.level, shape: lay.shape, brief, creation });
      used.add(lay.layoutKey); attempts++;
    }
    slots.push({ level, target: slot.target, requests: attempts, reason: attempts ? null : 'No original, size/shape-compatible layout fits an observed in-band brief.' });
  }
  const p = { schema: 'task10-pilot-v1', created: new Date().toISOString(), bot: data.protocol.bot, worker: M.sourceHash(__filename),
    studyPlan: data.plan.fingerprint, legacyDir, kept, legacyPlan: oldPlan, palette, slots, requests,
    speed: { calibration: read(path.join(studyDir, 'speed-calibration.json')), models: Speed.models(studyDir), audit: '20% deterministic hash sample of prediction skips; fully measure family and planner on audits, regardless of screening results.' },
    rule: 'Up to five different whole layouts per slot, fixed before bot checks. Choose observed in-band briefs by family distance; no bot-guided retries. Keep all20 existing levels. Every new qualifier must also pass29717 within±1 and total seed spread≤2.',
    firstCheck: 'Initial pooled family4711+18427, runs20/seeds2 each (80campaigns total), matching the curve metric. Also report4711 alone. Record every successful builder output, including subsequent static/quality rejections.' };
  p.fingerprint = M.digest(p); save(dir, 'pilot-plan.json', p); return p;
}
function check(dir) {
  const p = read(path.join(dir, 'pilot-plan.json')), { fingerprint, ...payload } = p;
  if (M.digest(payload) !== fingerprint || p.worker !== M.sourceHash(__filename) || p.bot !== M.createMeter().fingerprint) throw Error('Pilot input, code or bot changed');
  return p;
}
function sealBuilds(dir, p, builds) {
  if (builds.length !== p.requests.length) throw Error('Finish every registered construction before any first check');
  const actual = builds.slice().sort((a, b) => a.task.localeCompare(b.task)), file = path.join(dir, 'built-plan.json');
  if (fs.existsSync(file)) {
    const sealed = read(file); S.verifyPlan(sealed);
    if (sealed.pilot !== p.fingerprint || M.digest(sealed.builds) !== M.digest(actual)) throw Error('Pilot boards changed after sealing');
    return sealed;
  }
  const sealed = { created: new Date().toISOString(), pilot: p.fingerprint, builds: actual };
  sealed.fingerprint = M.digest(sealed); save(dir, 'built-plan.json', sealed); return sealed;
}
async function run(dir, action, workers = 4) {
  const p = check(dir), builds = [], first = [], tasks = [], results = [];
  const bd = path.join(dir, 'build'), fd = path.join(dir, 'first');
  for (const r of p.requests) {
    if (fs.existsSync(path.join(bd, r.id + '.json'))) builds.push(read(path.join(bd, r.id + '.json')));
    if (fs.existsSync(path.join(fd, r.id + '.json'))) first.push(read(path.join(fd, r.id + '.json')));
  }
  if (action !== 'build') sealBuilds(dir, p, builds);
  if (action === 'qualify') {
    const built = builds.filter(b => b.proofBuilt);
    if (first.length !== built.length) throw Error('Complete every first check before qualification');
    for (const r of first) { const b = built.find(b => b.task === r.task);
      if (!b || r.pilot !== p.fingerprint || r.bot !== p.bot || r.key !== M.boardKey(b.row.design)) throw Error('First score belongs to another pilot board'); }
  }
  if (action === 'build') for (const request of p.requests) tasks.push({ action, task: request.id, request, bot: p.bot });
  else if (action === 'first') for (const b of builds.filter(b => b.proofBuilt)) tasks.push({ action, task: b.task, row: b.row, target: b.target, bot: p.bot, speed: p.speed });
  else if (action === 'qualify') for (const b of builds.filter(b => b.proofBuilt)) tasks.push({ action, task: b.task, row: b.row, target: b.target, staticProblems: b.staticProblems,
    first: first.find(f => f.task === b.task), bot: p.bot });
  else throw Error('Unknown pilot action');
  const pending = tasks.filter(t => { const f = path.join(dir, action, t.task + '.json'); if (fs.existsSync(f)) { results.push(read(f)); return false; } return true; });
  await pool(pending, __filename, r => {
    r.pilot = p.fingerprint; save(dir, action + '/' + r.task + '.json', r); results.push(r);
    if (action === 'qualify') for (const mode of ['rate', 'quality', 'fresh']) if (r[mode]) save(dir, 'measurements/' + r.rowId + '.' + mode + '.json', r[mode]);
    console.log(action, results.length + '/' + tasks.length, r.task, r.fail || r.reason || (r.pooled ?? r.row?.id ?? 'built'));
  }, workers);
  return results;
}
function handback(dir, out) {
  const p = check(dir), builds = p.requests.flatMap(r => { const f = path.join(dir, 'build', r.id + '.json'); return fs.existsSync(f) ? [read(f)] : []; });
  const first = p.requests.flatMap(r => { const f = path.join(dir, 'first', r.id + '.json'); return fs.existsSync(f) ? [read(f)] : []; });
  sealBuilds(dir, p, builds);
  for (const b of builds.filter(b => b.proofBuilt)) {
    const file = path.join(dir, 'qualify', b.task + '.json');
    if (!fs.existsSync(file) || read(file).pilot !== p.fingerprint) throw Error('Complete every pilot qualification before handback');
  }
  const md = path.join(dir, 'measurements'); fs.mkdirSync(md, { recursive: true });
  for (const row of p.kept) for (const mode of ['rate', 'quality', 'fresh']) { const f = path.join(p.legacyDir, row.id + '.' + mode + '.json'); if (fs.existsSync(f)) fs.copyFileSync(f, path.join(md, path.basename(f))); }
  const plan = structuredClone(p.legacyPlan);
  for (const slot of plan.levels) { const row = p.kept.find(r => r.level === slot.level); if (row) { slot.keepId = row.id; slot.keepPattern = require('../factory/placement_score.js').patternKey(row.design); } }
  plan.batchId = 'task10-builder-v2-pilot'; plan.note += ' Task10: keep all20; pilot only the six missing slots.';
  plan.piles = path.resolve(dir, 'palette.json'); save(dir, 'palette.json', p.palette);
  save(dir, 'output-plan.json', plan); save(dir, 'pool.json', p.kept.concat(builds.filter(b => b.proofBuilt).map(b => b.row)));
  const result = require('../factory/handback.js').handback(path.join(dir, 'output-plan.json'), path.join(dir, 'pool.json'), md, out);
  const selected = fs.readFileSync(path.join(out, 'levels.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  for (const old of p.kept) if (!selected.some(r => r.level === old.level && r.id === old.id && M.digest(r.design) === M.digest(old.design))) throw Error('Preserved board changed');
  for (const row of selected.filter(r => missing.includes(r.level))) {
    const fresh = read(path.join(md, row.id + '.fresh.json')).fresh, rate = read(path.join(md, row.id + '.rate.json'));
    const target = p.legacyPlan.levels.find(s => s.level === row.level).target;
    const scores = [rate.train.exp, rate.validation.exp, fresh.exp];
    if (!fresh.valid || fresh.seed !== 29717 || Math.abs(fresh.exp - target) > 1 + 1e-9 || Math.max(...scores) - Math.min(...scores) > 2 + 1e-9) throw Error('Pilot fresh seed failed');
    row.family.fresh = fresh.exp; row.family.freshSeed = 29717; row.pilotFreshRequired = true;
  }
  fs.writeFileSync(path.join(out, 'levels.jsonl'), selected.map(r => JSON.stringify(r)).join('\n') + '\n');
  const freshLines = ['\n## Task10 fresh checks on new raw constructions', '', '| level | seed29717 | full seed spread |', '|---|---:|---:|'];
  for (const row of selected.filter(r => missing.includes(r.level))) freshLines.push(`| ${row.level} | ${row.family.fresh} | ${Math.max(row.family.search, row.family.validation, row.family.fresh) - Math.min(row.family.search, row.family.validation, row.family.fresh)} |`);
  fs.appendFileSync(path.join(out, 'RESULT.md'), freshLines.join('\n') + '\n');
  const statistics = { ...hitRate(builds, first), slots: p.slots, sourcePlan: p.fingerprint };
  const filters = first.filter(r => r.filter?.skip), audits = filters.filter(r => r.filter.audit);
  statistics.speed = { predictionSkips: filters.length, audits: audits.length, actualSkipped: filters.filter(r => !r.filter.audit).length,
    familyEarlyStops: first.filter(r => r.familyScreen?.stopped && !r.filter?.audit).length,
    plannerEarlyStops: first.filter(r => r.plannerScreen?.stopped).length,
    auditFalseSkips: audits.filter(r => r.pooledHit && r.auditSkilled?.valid && r.auditSkilled.exp >= 2.5 && r.auditSkilled.exp <= 6).length,
    campaignsPlayed: first.reduce((n, r) => n + (r.campaignsPlayed || 0), 0), fullFirstCheckCampaigns: builds.filter(b => b.proofBuilt).length * 80,
    fullFamilyAndPlannerCampaigns: builds.filter(b => b.proofBuilt).length * 160,
    note: 'Counts logical first-stage bot campaigns including screening overhead and planner styles. Nominal full-family-and-planner baseline160/board (family80, planner40 per style). Qualification/counterfactual/fresh campaigns are separate; planner audits are included in played counts. Cache hits are separately available in per-check records. Main range/knob study ran in full, saving zero campaigns there.' };
  save(dir, 'pilot-statistics.json', statistics); save(out, 'pilot-statistics.json', statistics); return result;
}
function worker(job, meter) {
  if (meter.fingerprint !== job.bot) throw Error('Bot changed');
  if (job.action === 'build') {
    const q = job.request, r = B.build(q.brief);
    if (r.fail) return { task: job.task, proofBuilt: false, fail: r.fail, detail: r.detail, ms: r.ms };
    const design = goldPair(r.design); design.level = q.level;
    const recipe = [RECIPE[q.brief.story] || q.brief.story, ...(r.card.traps.tempting ? ['visiblePairTrap'] : [])];
    const row = { id: M.boardKey(design).slice(0, 16), level: q.level, target: q.target, n: design.tiles.length, shape: q.shape, recipe,
      brief: r.card.sentence, design, origin: { ...O.originOf(design, q.creation, r.card.sentence, q.brief.seed), intendedLevel: q.level },
      seedSource: 'fresh-designed', forcePlanner: true, playerFeedback: true, builderStory: q.brief.story, builderBrief: q.brief,
      builderCard: r.card, studyPoint: q.sourcePoint, factoryKeep: false };
    const checks = require('./gate.js').checkDesign(design, q.brief), staticProblems = checks.problems.map(x => x.kind + ': ' + x.detail);
    if (!checks.strict) staticProblems.push('strictWitnessMissing');
    const spare = design.clock.n - design.solution.indexOf(design.clock.i) - 1;
    if (spare < 1 || spare > 3) staticProblems.push('stored strict spare outside1–3');
    if (!require('../factory/placement_score.js').readable(design)) staticProblems.push('blindObjectiveRoute');
    return { task: job.task, target: q.target, proofBuilt: true, staticProblems, row, ms: r.ms };
  }
  const opts = { setting: 'family', runs: 20, seeds: 2, seed: 4711 }, row = job.row, key = M.boardKey(row.design);
  if (job.action === 'first') {
    const filter = Speed.filter(row, job.speed.models), base = { task: job.task, rowId: row.id, key, bot: meter.fingerprint, processed: true, filter };
    if (filter.skip && !filter.audit) return { ...base, stopReason: 'predictionFilter', campaignsPlayed: 0, search: { valid: false, exp: null }, validation: { valid: false, exp: null }, pooled: null, pooledHit: false, firstHit: false };
    const familyScreen = filter.audit ? { stopped: false, campaigns: 0, auditBypass: true } : Speed.screen(meter, row.design, 'family', job.target, job.speed.calibration);
    if (familyScreen.stopped) return { ...base, familyScreen, stopReason: 'familyEarlyStop', campaignsPlayed: familyScreen.campaigns, search: { valid: false, exp: null }, validation: { valid: false, exp: null }, pooled: null, pooledHit: false, firstHit: false };
    const a = meter.measure(row.design, { ...opts, capture: 'tail' }), b = meter.measure(row.design, { ...opts, seed: 18427 });
    const pooled = a.valid && b.valid ? (a.expectedTries + b.expectedTries) / 2 : null;
    const pooledHit = pooled != null && Math.abs(pooled - job.target) <= 1 + 1e-9;
    let plannerScreen = null, auditSkilled = null, campaignsPlayed = familyScreen.campaigns + 80;
    if (filter.audit) { const z = meter.measure(row.design, { ...opts, setting: 'planner' }); auditSkilled = { valid: z.valid, exp: z.expectedTries }; campaignsPlayed += 80; }
    else if (pooledHit) { plannerScreen = Speed.screen(meter, row.design, 'planner', job.target, job.speed.calibration); campaignsPlayed += plannerScreen.campaigns; }
    return { ...base, familyScreen, plannerScreen, auditSkilled, campaignsPlayed, meterStats: { ...meter.stats }, search: { exp: a.valid ? a.expectedTries : null, valid: a.valid, first: a.firstTryRate },
      validation: { exp: b.valid ? b.expectedTries : null, valid: b.valid, first: b.firstTryRate, seed: 18427 }, pooled,
      firstHit: a.valid && Math.abs(a.expectedTries - job.target) <= 1 + 1e-9, pooledHit };
  }
  const first = job.first;
  if (!first) throw Error('First check must precede qualification');
  const rate = { id: row.id, key, bot: meter.fingerprint, mode: 'rate', train: first.search, validation: first.validation };
  const reason = job.staticProblems.length ? job.staticProblems.join('; ') : first.stopReason || (first.plannerScreen?.stopped ? 'plannerEarlyStop' : !first.pooledHit ? 'pooledFamilyOffCurve' : Math.abs(first.search.exp - first.validation.exp) > 2 ? 'familySeedGap' : null);
  if (reason) return { task: job.task, rowId: row.id, reason, rate, quality: { id: row.id, key, bot: meter.fingerprint, mode: 'quality', eligible: false, reason,
    supportFingerprint: require('../factory/trap_supports.js').fingerprint(row), skilledEvidenceFingerprint: require('../factory/skilled_evidence.js').fingerprint(row) } };
  const result = require('../factory/empirical_confirm.js').confirm(row, meter);
  if (!result.quality?.eligible) return { ...result, task: job.task, rowId: row.id, reason: result.quality?.reason || 'quality' };
  const f = meter.measure(row.design, { ...opts, seed: 29717 });
  const scores = [first.search.exp, first.validation.exp, f.expectedTries];
  const ok = f.valid && Math.abs(f.expectedTries - job.target) <= 1 + 1e-9 && Math.max(...scores) - Math.min(...scores) <= 2 + 1e-9;
  const quality = { ...result.quality, eligible: result.quality.eligible && ok, pilotFreshRequired: true, ...(ok ? {} : { reason: 'freshSeedOrSpread' }) };
  return { ...result, task: job.task, rowId: row.id, quality, reason: ok ? null : quality.reason,
    fresh: { id: row.id, key, bot: meter.fingerprint, mode: 'fresh', fresh: { exp: f.expectedTries, first: f.firstTryRate, valid: f.valid, seed: 29717 }, eligible: ok } };
}
if (!isMainThread) {
  process.env.FACTORY_RATE = '9,14'; process.env.FACTORY_SKILLED = '2.5,6';
  const meter = M.createMeter(); parentPort.on('message', job => { try { parentPort.postMessage(worker(job, meter)); } catch (e) { parentPort.postMessage({ error: e.stack }); } });
} else if (require.main === module) {
  const [action, first, second, third] = process.argv.slice(2);
  const f = action === 'prepare' ? () => prepare(path.resolve(first), path.resolve(second)) : action === 'handback' ? () => handback(path.resolve(first), path.resolve(second)) : () => run(path.resolve(first), action, +(second || 4));
  Promise.resolve().then(f).then(r => console.log('pilot', action, Array.isArray(r) ? r.length : 'saved')).catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { prepare, run, handback, goldPair, hitRate, sealBuilds };
