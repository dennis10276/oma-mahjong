'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), S = require('./task10_study.js');
const E = require('./engine.js');
const median = a => { const x = a.filter(Number.isFinite).slice().sort((a, b) => a - b); return x.length ? (x[(x.length - 1) >> 1] + x[x.length >> 1]) / 2 : null; };
const mean = a => a.length ? a.reduce((a, b) => a + b, 0) / a.length : null;
const round = x => x == null ? '—' : x.toFixed(2);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const CELL = c => JSON.stringify([c.story, c.way, c.three, c.luck, c.traps]);
function folds(c) { return S.heldout({ ...c, traps: 0 }); } // paired trap doses share their parent cell's fold
function columns(stories) { return stories.map(s => 'story:' + s).concat(['way:+4', 'three:+3', 'luck:+1', 'trap:+1']); }
function features(c, stories) { return stories.map(s => Number(c.story === s)).concat([(c.way - 10) / 4, (c.three - 2) / 3, c.luck, c.traps]); }
// Ordinary least squares, with explicit null-space checks: do not invent an unidentifiable coefficient.
function leastSquares(X, y) {
  if (!X.length) return null;
  const n = X[0].length, a = Array.from({ length: n }, (_, j) => Array.from({ length: n + 1 }, (_, k) => X.reduce((s, x, i) => s + x[j] * (k === n ? y[i] : x[k]), 0)));
  let row = 0; const pivots = [];
  for (let col = 0; col < n && row < n; col++) {
    let pivot = row; for (let k = row + 1; k < n; k++) if (Math.abs(a[k][col]) > Math.abs(a[pivot][col])) pivot = k;
    if (Math.abs(a[pivot][col]) < 1e-8) continue;
    [a[row], a[pivot]] = [a[pivot], a[row]]; const scale = a[row][col]; a[row] = a[row].map(v => v / scale);
    for (let k = 0; k < n; k++) if (k !== row) { const scale = a[k][col]; for (let j = 0; j <= n; j++) a[k][j] -= scale * a[row][j]; }
    pivots.push(col); row++;
  }
  const particular = Array(n).fill(0); pivots.forEach((col, i) => particular[col] = a[i][n]);
  const free = [...Array(n).keys()].filter(j => !pivots.includes(j));
  const nullspace = free.map(col => { const v = Array(n).fill(0); v[col] = 1; pivots.forEach((p, i) => v[p] = -a[i][col]); return v; });
  const coefficients = particular.map((v, i) => nullspace.some(z => Math.abs(z[i]) > 1e-7) ? null : v);
  return { rank: row, n, coefficients, particular, nullspace };
}
function predict(fit, x) { return !fit || fit.nullspace.some(z => Math.abs(dot(z, x)) > 1e-6) ? null : dot(fit.particular, x); }
function additive(boards, profile, stories) {
  const groups = new Map();
  for (const b of boards.filter(b => ['range', 'traps'].includes(b.stage) && b[profile] && !b.fail)) {
    const key = CELL(b.cell), g = groups.get(key) || { cell: b.cell, boards: [], scores: [] }; g.scores.push(b[profile].exp); g.boards.push(b.id); groups.set(key, g);
  }
  const cells = [...groups.values()].map(g => ({ ...g, y: mean(g.scores), heldout: folds(g.cell) }));
  const train = cells.filter(c => !c.heldout), test = cells.filter(c => c.heldout);
  const fit = leastSquares(train.map(c => features(c.cell, stories)), train.map(c => c.y));
  const score = arr => arr.map(c => { const p = predict(fit, features(c.cell, stories)); return { cell: CELL(c.cell), observed: c.y, predicted: p, error: p == null ? null : Math.abs(p - c.y), replicas: c.scores.length }; });
  const training = score(train), heldout = score(test);
  const [lo, hi] = profile === 'family' ? [10, 13] : [2.5, 6];
  const bandTests = heldout.filter(c => c.observed >= lo && c.observed <= hi && c.error != null);
  return { columns: columns(stories), coefficients: fit?.coefficients || null, rank: fit?.rank || 0, trainingCells: train.length, heldoutCells: test.length,
    predictedHeldout: heldout.filter(x => x.predicted != null).length, medianAbsoluteError: median(heldout.map(c => c.error)), trainingMedianAbsoluteError: median(training.map(c => c.error)),
    heldoutBandCells: bandTests.length, heldoutBandMedianAbsoluteError: median(bandTests.map(c => c.error)),
    note: 'One row per cell mean, not one per replicate. A trap variant shares the parent zero-trap fold. No clipping of predictions; unidentified coefficients/predictions are null.', heldout, training };
}
function knobSummary(boards, knob, profile) {
  const variants = boards.filter(b => b.stage === 'knobs' && b.knob === knob), bases = new Map(boards.filter(b => b.stage === 'knobs' && b.knob === 'base').map(b => [b.id, b]));
  const dir = knob === 'spare' ? -1 : 1, requestedStep = { three2: 2, three4: 4, luck1: 1, luck2: 2, traps1: 1, traps2: 2, spare: 1 }[knob];
  const descriptor = c => knob.startsWith('three') ? c.tray.three : knob.startsWith('luck') ? c.tray.luck : knob.startsWith('traps') ? c.traps.tempting : c.clock.spare;
  const pairs = variants.map(v => {
    const b = bases.get(v.base), valid = !!(b?.[profile] && v[profile] && !v.fail && v.isolation?.samePuzzle);
    const delta = valid ? v[profile].exp - b[profile].exp : null;
    const dose = !v.fail && b ? descriptor(v.card) - descriptor(b.card) : null;
    const controls = valid && (knob === 'spare' || ['three', 'luck', 'traps', 'way'].filter(d => !knob.startsWith(d)).every(d => v.isolation[d] === 0));
    return { base: v.base, story: b?.brief.story, built: !v.fail && !!v.design, fail: v.fail || null, detail: v.detail || null, valid, delta, dose, controls,
      before: b?.[profile]?.exp ?? null, after: v[profile]?.exp ?? null, cliff: valid && Math.abs(delta) > 5 };
  });
  const valid = pairs.filter(p => p.valid), expected = valid.filter(p => dir * p.delta >= -1e-9).length, cliffs = valid.filter(p => p.cliff);
  const controlled = valid.filter(p => p.controls);
  const split = {};
  for (const story of [...new Set(pairs.map(p => p.story))]) { const ps = valid.filter(p => p.story === story); split[story] = { measured: ps.length, median: median(ps.map(p => p.delta)), expected: ps.filter(p => dir * p.delta >= -1e-9).length, cliffs: ps.filter(p => p.cliff).length }; }
  return { requested: pairs.length, built: pairs.filter(p => p.built).length, measured: valid.length, expected, share: valid.length ? expected / valid.length : null,
    strict: valid.filter(p => dir * p.delta > 1e-9).length, tied: valid.filter(p => Math.abs(p.delta) <= 1e-9).length, opposite: valid.filter(p => dir * p.delta < -1e-9).length,
    descriptorMoved: valid.filter(p => p.dose > 0).length, controlsMatched: valid.filter(p => p.controls).length,
    controlledSubset: { measured: controlled.length, expected: controlled.filter(p => dir * p.delta >= -1e-9).length,
      median: median(controlled.map(p => p.delta)), cliffs: controlled.filter(p => p.cliff).length },
    median: median(valid.map(p => p.delta)), stepMedian: median(valid.map(p => p.delta / requestedStep)),
    actualStepMedian: median(valid.filter(p => p.dose > 0).map(p => p.delta / p.dose)), cliffs: cliffs.length,
    meetsDirection: valid.length > 0 && expected / valid.length >= 0.8, keptGlobally: valid.length > 0 && expected / valid.length >= 0.8 && !cliffs.length && valid.some(p => p.dose > 0),
    typicalEffectPositive: valid.length > 0 && dir * median(valid.map(p => p.delta)) > 1e-9,
    split, pairs };
}
function report(dir) {
  const data = S.collect(dir), stories = Object.keys(require('./stories.js').STORIES), summary = { bot: data.protocol.bot, plan: data.plan.fingerprint, knobs: {}, models: {}, range: {} };
  for (const knob of data.protocol.construction.variants) summary.knobs[knob] = Object.fromEntries(['family', 'skilled'].map(p => [p, knobSummary(data.boards, knob, p)]));
  for (const p of ['family', 'skilled']) summary.models[p] = additive(data.boards, p, stories);
  const grid = data.boards.filter(b => ['range', 'traps'].includes(b.stage));
  const band = b => b.family && b.skilled && b.family.exp >= 10 && b.family.exp <= 13 && b.skilled.exp >= 2.5 && b.skilled.exp <= 6;
  summary.observedBand = data.boards.filter(band).map(b => ({ id: b.id, stage: b.stage, brief: b.brief, family: b.family, skilled: b.skilled, card: b.card }));
  summary.range = { requests: grid.length, built: grid.filter(b => !b.fail && b.design).length, rated: grid.filter(b => b.family && b.skilled).length,
    band: grid.filter(band).map(b => ({ id: b.id, cell: b.cell, family: b.family, skilled: b.skilled, card: b.card })), repeats: [] };
  const groups = new Map(); for (const b of grid) { const k = CELL(b.cell), a = groups.get(k) || []; a.push(b); groups.set(k, a); }
  for (const [cell, rows] of groups) if (rows.length > 1) {
    const family = rows.filter(b => b.family).map(b => b.family.exp), skilled = rows.filter(b => b.skilled).map(b => b.skilled.exp);
    summary.range.repeats.push({ cell, requested: rows.length, built: rows.filter(b => !b.fail && b.design).length,
      n: rows.filter(b => b.family && b.skilled).length, family, skilled,
      familySpread: family.length > 1 ? Math.max(...family) - Math.min(...family) : null,
      skilledSpread: skilled.length > 1 ? Math.max(...skilled) - Math.min(...skilled) : null,
      seeds: rows.map(b => ({ seed: b.cell.seed, fail: b.fail || null, family: b.family?.exp ?? null, skilled: b.skilled?.exp ?? null })) });
  }
  summary.byStory = Object.fromEntries(stories.map(story => {
    const rows = data.boards.filter(b => b.brief?.story === story && b.family && b.skilled);
    return [story, { rated: rows.length, familyMedian: median(rows.map(b => b.family.exp)), skilledMedian: median(rows.map(b => b.skilled.exp)),
      familyAtCap: rows.filter(b => b.family.exp >= 20 - 1e-9).length, skilledAtCap: rows.filter(b => b.skilled.exp >= 20 - 1e-9).length, jointBand: rows.filter(band).length }];
  }));
  const failures = {}; for (const b of data.boards.filter(b => b.fail)) failures[b.fail] = (failures[b.fail] || 0) + 1; summary.failures = failures;
  const records = [...data.records.values()]; summary.measurements = { records: records.length, invalid: records.filter(r => !r.valid).length,
    calls: records.reduce((s, r) => s + r.calls, 0), hits: records.reduce((s, r) => s + r.hits, 0) };
  M.atomicJson(path.join(dir, 'summary.json'), summary);
  const lines = ['# Task 10: builder controls and range', '', `Frozen bot: ${summary.bot}. ${summary.measurements.records} campaign measurements; ${summary.measurements.invalid} invalid.`, '',
    '## Same-puzzle knobs', '', 'Ties count for the requested monotone-direction benchmark, but are shown separately. Failed/unproven requests receive no rating. Descriptor movement and non-target drift are reported independently. A knob with a cliff is not retained globally.', '',
    '| knob | built / requested | family pairs | family expected / ties | median change | per requested unit | cliffs | skilled pairs | skilled expected / ties | skilled median change |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [k, v] of Object.entries(summary.knobs)) { const f = v.family, s = v.skilled; lines.push(`| ${k} | ${f.built}/${f.requested} | ${f.measured} | ${f.expected}/${f.measured}, ties ${f.tied} | ${round(f.median)} | ${round(f.stepMedian)} | ${f.cliffs} | ${s.measured} | ${s.expected}/${s.measured}, ties ${s.tied} | ${round(s.median)} |`); }
  lines.push('', '| knob | actual descriptor increased | other descriptors matched | controlled family direction | controlled median change | skilled cliffs |', '|---|---:|---:|---:|---:|---:|');
  for (const [k, v] of Object.entries(summary.knobs)) { const f = v.family, c = f.controlledSubset; lines.push(`| ${k} | ${f.descriptorMoved}/${f.measured} | ${f.controlsMatched}/${f.measured} | ${c.expected}/${c.measured} | ${round(c.median)} | ${v.skilled.cliffs} |`); }
  lines.push('', 'Targets allow a tolerance of one: increasing a requested luck count by one can leave its measured count unchanged. The luck knob also raises hiddenOnWay, as requested; it is a combined luck/hidden-route control. Spare uses an exact clock-only transform; its copied base intent text/forced-pressure annotation is historical, not a new claim at the relaxed deadline. Its unchanged witness and new minimum-plus-spare deadline are independently replayed by knobs.js.');
  lines.push('', '## Range', '', `${summary.range.requests} requests, ${summary.range.built} built, ${summary.range.rated} fully rated; ${summary.range.band.length} in both bands.`, '');
  lines.push('| story, both experiments | rated | family median | family at20 | skilled median | skilled at20 | joint band |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [story, s] of Object.entries(summary.byStory)) lines.push(`| ${story} | ${s.rated} | ${round(s.familyMedian)} | ${s.familyAtCap} | ${round(s.skilledMedian)} | ${s.skilledAtCap} | ${s.jointBand} |`);
  lines.push('');
  for (const story of stories) {
    lines.push('### ' + story, '', '| way | three | luck | traps | seed | actual way / three / luck / traps | family | skilled | band | failure |', '|---:|---:|---:|---:|---:|---|---:|---:|---|---|');
    for (const b of grid.filter(b => b.cell.story === story).sort((a, b) => a.id.localeCompare(b.id))) { const c = b.cell;
      lines.push(`| ${c.way} | ${c.three} | ${c.luck} | ${c.traps} | ${c.seed} | ${b.card ? [b.card.clock.fewestMoves, b.card.tray.three, b.card.tray.luck, b.card.traps.tempting].join(' / ') : '—'} | ${round(b.family?.exp)} | ${round(b.skilled?.exp)} | ${band(b) ? 'yes' : ''} | ${b.fail || ''} |`); }
    lines.push('');
  }
  lines.push('## Observed points in both bands', '', `${summary.observedBand.length} points across both studies. This includes knob variants outside the range grid; none are silently discarded when deciding whether to run the pilot.`, '', '| board | source | family | skilled |', '|---|---|---:|---:|');
  for (const b of summary.observedBand) lines.push(`| ${b.id} | ${b.stage} | ${round(b.family.exp)} | ${round(b.skilled.exp)} |`);
  lines.push('', '## Repeated construction seeds', '', 'All bot seeds/settings stay fixed. These cells vary builder seeds1,2,3. Failed seeds are retained; a single rated seed does not establish a zero spread.', '',
    '| cell | built / requested | fully rated | family scores | family spread | skilled scores | skilled spread |', '|---|---:|---:|---|---:|---|---:|');
  for (const r of summary.range.repeats) lines.push(`| ${r.cell} | ${r.built}/${r.requested} | ${r.n} | ${r.family.map(round).join(', ')} | ${round(r.familySpread)} | ${r.skilled.map(round).join(', ')} | ${round(r.skilledSpread)} |`);
  lines.push('## Plain additive tables', '', 'Rating ≈ story base at way10/three2/luck0/traps0 + way-step × (way−10)/4 + three-step × (three−2)/3 + luck-step × luck + trap-step × traps. These are measured associations among returned boards; compare held-out errors before using the table.', '',
    '| coefficient | family | skilled |', '|---|---:|---:|');
  const names = columns(stories); names.forEach((n, i) => lines.push(`| ${n} | ${round(summary.models.family.coefficients?.[i])} | ${round(summary.models.skilled.coefficients?.[i])} |`));
  for (const [p, m] of Object.entries(summary.models)) lines.push('', `${p}: ${m.trainingCells} training cells; ${m.heldoutCells} held-out cells (${m.predictedHeldout} estimable); held-out median absolute error ${round(m.medianAbsoluteError)} tries. Among ${m.heldoutBandCells} held-out cells actually in this profile's target band: ${round(m.heldoutBandMedianAbsoluteError)}. Unidentified coefficients/predictions remain null.`);
  lines.push('', 'Repeated cells and all per-pair effects/cliffs: summary.json. Full boards and failed requests: boards.json and plan.json. Sampling is conditional on the builder returning a proven board; no impossible request has been given a fabricated rating.', '');
  fs.writeFileSync(path.join(dir, 'REPORT.md'), lines.join('\n'));
  return summary;
}
function diagnostics(dir) {
  const data = S.collect(dir), out = path.join(dir, 'diagnostics'), file = path.join(out, 'plan.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file));
  const choices = data.boards.filter(b => !b.fail && b.brief?.story === 'frozenGuards' && b.family && b.skilled);
  const ordered = choices.slice().sort((a, b) => a.family.exp - b.family.exp || a.id.localeCompare(b.id));
  const picks = ordered.length ? [ordered[0], ordered[ordered.length - 1]].filter((x, i, a) => a.findIndex(y => M.boardKey(x.design) === M.boardKey(y.design)) === i) : [];
  const boards = [];
  for (const b of picks) for (const variant of ['original', 'noIce', 'noIceSameSpare', 'noLocks', 'noLocksSameSpare', 'oneKeyIceSameSpare', 'noClock', 'allFaceUp']) {
    const design = structuredClone(b.design);
    if (variant.startsWith('noIce')) design.obst.ice = {};
    if (variant.startsWith('noLocks')) { design.obst.locks = []; design.obst.keys = []; }
    if (variant === 'oneKeyIceSameSpare') {
      for (const k of design.obst.keys) delete design.obst.ice[k];
      if (design.obst.keys.length) design.obst.ice[design.obst.keys[0]] = 1;
    }
    if (variant === 'noClock') design.clock = null;
    if (variant === 'allFaceUp') design.down = [];
    let minimum = null;
    if (variant.includes('SameSpare')) {
      const cs = E.clockShortest(E.game(design), { nodes: 400000, ms: 5000 });
      if (!cs || cs.unsure) { boards.push({ id: b.id + ':' + variant, parent: b.id, variant, stage: 'diagnostics', fail: 'unprovenMinimum', brief: b.brief }); continue; }
      minimum = cs.k; design.clock.n = cs.k + b.card.clock.spare; design.solution = E.flatten(cs.path);
    }
    const g = E.game(design), witness = E.replay(design, design.solution).ok;
    const proof = witness ? { result: 'win' } : E.winnable(g, E.start(g), { nodes: 400000, ms: 2000 });
    boards.push({ id: b.id + ':' + variant, parent: b.id, variant, stage: 'diagnostics', design, card: b.card, brief: b.brief,
      proof: proof.result, originalSpare: b.card.clock.spare, retimedMinimum: minimum,
      note: 'card is the original design card; clock/obstacle changes are in design and the diagnostic metadata.',
      ...(proof.result !== 'win' ? { fail: 'unprovenAblation' } : {}) });
  }
  fs.mkdirSync(out, { recursive: true }); M.atomicJson(path.join(out, 'protocol.json'), data.protocol);
  const plan = { schema: data.protocol.schema, protocol: M.digest(data.protocol), bot: data.protocol.bot, worker: data.protocol.worker,
    rule: 'lowest and highest pooled-family frozenGuards boards, id breaks ties; original, no ice, no locks, no clock, all face-up; additionally no ice/no locks/one frozen key with the clock re-timed to the same exact spare. Full matching campaign settings. Face-up also removes peek-pair shortcuts, so its effect is not pure information.', boards };
  plan.fingerprint = M.digest(plan); M.atomicJson(file, plan); return plan;
}
function diagnosticReport(dir) {
  const data = S.collect(path.join(dir, 'diagnostics')), cache = require('../factory/empirical_cache.js').inspector();
  const rows = data.boards.map(b => ({ id: b.id, parent: b.parent, variant: b.variant, proof: b.proof, fail: b.fail || null,
    family: b.family, skilled: b.skilled, clock: b.design?.clock || null, minimum: b.retimedMinimum, originalSpare: b.originalSpare,
    ice: b.design?.obst?.ice || null, down: b.design?.down?.length ?? null,
    plannerStyles: !b.fail && b.skilled ? cache.full(b.design, 'planner', 4711)?.result?.plannerStyles || null : null,
    samples: b.design ? data.protocol.settings.map(s => data.records.get(S.keyFor(b.design, s, data.protocol.bot))).filter(Boolean) : [] }));
  M.atomicJson(path.join(dir, 'frozen-guards.json'), { bot: data.protocol.bot, rows });
  const lines = ['# Frozen-key diagnostics', '',
    'Builder v2 frozenGuards is a locked clock with frozen keys. The older lab recipe of the same name freezes the clock covers instead. These labels do not identify the same mechanism.', '',
    'The game and frozen observer show a frozen key as ice until it thaws. The planner constructs keyTiles from visible key roles, and its route heuristic follows those keys. Source: tools/sim/refit/human_factory_controller.js (keyTiles/usableIn/needLeft), human_style_environment.js (visibleRole), www/js/specials.js (obKind). This is a source-based hypothesis about a hidden-role planning blind spot, not a measured claim about human difficulty.', '',
    'Removing ice or locks can shorten the required route while leaving more spare. The SameSpare variants reset the timer to the new proven minimum plus the original spare. The one-key variant leaves only one key frozen at strength1. AllFaceUp also removes peek-pair shortcuts; it is not a pure information intervention. Unknown or losing counterfactuals get no rating.', '',
    '| source | intervention | timer | retimed minimum | family | skilled | planner route / plain | proof/failure |', '|---|---|---:|---:|---:|---:|---|---|'];
  for (const r of rows) lines.push(`| ${r.parent} | ${r.variant} | ${r.clock?.n ?? 'none'} | ${r.minimum ?? '—'} | ${round(r.family?.exp)} | ${round(r.skilled?.exp)} | ${r.plannerStyles ? round(r.plannerStyles.route) + ' / ' + round(r.plannerStyles.plain) : '—'} | ${r.fail || r.proof} |`);
  lines.push('', 'Loss counts and individual seed results are in frozen-guards.json. A rating of20 is the capped retry yardstick, not proof that humans need exactly20 attempts. Only completed valid campaign measurements are compared.', '');
  fs.writeFileSync(path.join(dir, 'FROZEN-GUARDS.md'), lines.join('\n'));
  return rows;
}
if (require.main === module) {
  const [action, dir] = process.argv.slice(2);
  if (action === 'report') console.log(JSON.stringify(report(path.resolve(dir)).range));
  else if (action === 'diagnostics') console.log('Frozen diagnostic designs:', diagnostics(path.resolve(dir)).boards.length);
  else if (action === 'diagnostic-report') console.log('Diagnostic rows:', diagnosticReport(path.resolve(dir)).length);
  else throw Error('report <dir> | diagnostics <dir> | diagnostic-report <dir>');
}
module.exports = { leastSquares, predict, features, folds, additive, knobSummary, report, diagnostics, diagnosticReport, median };
