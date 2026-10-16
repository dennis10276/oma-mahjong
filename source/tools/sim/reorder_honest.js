/* Offline reorder of 92–269. See analysis/reorder-92-plan.md. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.resolve(__dirname, '../..'), MODEL = path.join(__dirname, 'honest');
const H = require(path.join(MODEL, 'hard')), L = require(path.join(MODEL, 'layouts'));
const profiles = require(path.join(MODEL, 'players.json')).bots;
const NAMES = ['Dennisisdebeste', 'Mrs. Doubtfire'];
const BASE = path.join(ROOT, 'analysis/levels-before-reorder-92.js');
const DATA = path.join(ROOT, 'analysis/reorder-92-measurements.json');
const REPORT = path.join(ROOT, 'analysis/reorder-92.json');
const FROM = 92, TO = 269, BAND = 0.05;
const PHASES = { primary: { runs: 1200, seed: 17011 }, validation: { runs: 600, seed: 93097 } };
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
// Windows checkouts use CRLF; the same inputs must identify the same measurements on Linux.
const textHash = file => hash(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
const table = f => vm.runInNewContext(fs.readFileSync(f, 'utf8') + ';HARD_LEVELS');
const T = table(BASE), row = lv => T.levels[lv - T.from];
const fingerprint = hash(JSON.stringify({ baseline: textHash(BASE), phases: PHASES,
  engine: textHash(path.join(MODEL, 'hard.js')),
  layouts: textHash(path.join(MODEL, 'layouts.js')),
  personas: NAMES.map(n => profiles[n].persona) }));
const round = x => +x.toFixed(4);
function game(lv) {
  const d = H.unpack(lv, row(lv)), tiles = d.tiles.map(([x, y, z]) => ({ x, y, z }));
  const down = new Uint8Array(tiles.length); d.down.forEach(i => down[i] = 1);
  const o = d.obst, rules = o ? { iceNb: L.iceNeighbors(tiles), ice: o.ice || {},
    locks: new Set(o.locks || []), keys: o.keys || [] } : null;
  return { tiles, nb: L.neighbors(tiles), down, faces: d.faces, rules, clock: d.clock };
}
function measure(lv) {
  const out = { lv, hash: hash(JSON.stringify(row(lv))), big: row(lv)[0].length / 3 > 88 };
  for (const [phase, cfg] of Object.entries(PHASES)) {
    out[phase] = {};
    for (const name of NAMES) {
      const p = { ...H.P, ...profiles[name].persona };
      const r = H.rateChain(game(lv), cfg.runs, cfg.seed + lv * 101, p, p.memory, 4);
      out[phase][name] = { first: r.first, two: r.within[1], four: r.within[3] };
    }
  }
  return out;
}
function ease(measurement, phase = 'primary') {
  return NAMES.reduce((s, name) => { const p = measurement[phase][name];
    return s + 0.5 * p.first + 0.25 * p.two + 0.25 * p.four;
  }, 0) / NAMES.length;
}
function order(rows) {
  const bands = r => Math.floor((1 - ease(r) + 1e-10) / BAND);
  const sorted = big => rows.filter(r => r.lv >= FROM && r.big === big)
    .sort((a, b) => bands(a) - bands(b) || a.lv - b.lv);
  const regular = sorted(false), large = sorted(true), slots = TO - FROM + 1;
  if (large.length !== Array.from({ length: slots }, (_, i) => FROM + i).filter(lv => lv % 10 === 0).length)
    throw Error('Large boards do not match tenth-level slots');
  const moves = [];
  for (let lv = FROM; lv <= TO; lv++) {
    const b = (lv % 10 === 0 ? large : regular).shift();
    if (!b) throw Error('Missing board at ' + lv);
    moves.push({ lv, was: b.lv, big: b.big, band: bands(b), ease: round(ease(b)),
      validationEase: round(ease(b, 'validation')), primary: b.primary, validation: b.validation,
      hash: b.hash });
  }
  // Keep the broad order; smooth each person's path within equal size/band groups.
  // Only primary samples enter this objective. Original order breaks exact ties.
  const boundary = rows.find(r => r.lv === FROM - 1);
  const seq = [boundary, ...moves], rng = L.rng(161026);
  const score = (m, name) => { const p = m.primary[name]; return 0.5 * p.first + 0.25 * p.two + 0.25 * p.four; };
  const edge = (a, b) => NAMES.reduce((s, name) => {
    const d = score(b, name) - score(a, name);
    return s + Math.abs(d) + 5 * Math.max(0, -d - 0.08);
  }, 0);
  const groups = [...new Set(moves.map(m => m.big + ':' + m.band))].map(key =>
    seq.map((m, i) => i && m.big + ':' + m.band === key ? i : null).filter(i => i !== null)).filter(g => g.length > 1);
  for (let k = 0; groups.length && k < 40000; k++) {
    const g = groups[Math.floor(rng() * groups.length)], a = g[Math.floor(rng() * g.length)], b = g[Math.floor(rng() * g.length)];
    if (a === b) continue;
    const edges = [...new Set([a, a + 1, b, b + 1])].filter(i => i > 0 && i < seq.length);
    const before = edges.reduce((s, i) => s + edge(seq[i - 1], seq[i]), 0);
    [seq[a], seq[b]] = [seq[b], seq[a]];
    const after = edges.reduce((s, i) => s + edge(seq[i - 1], seq[i]), 0);
    if (after >= before - 1e-10) [seq[a], seq[b]] = [seq[b], seq[a]];
  }
  return seq.slice(1).map((m, i) => ({ ...m, lv: FROM + i }));
}
function assemble(moves) {
  const next = JSON.parse(JSON.stringify(T));
  next.v = T.v + 1; next.previousVersion = T.v; next.reorderFrom = FROM;
  next.ratingModels = next.levels.map((_, i) => T.from + i >= 106 ? 'strong' : 'focused');
  for (const m of moves) {
    next.levels[m.lv - next.from] = row(m.was);
    next.ratingModels[m.lv - next.from] = m.was >= 106 ? 'strong' : 'focused';
  }
  return next;
}
function summarize(sequence, rows, phase, name = null) {
  const byLv = new Map(rows.map(r => [r.lv, r]));
  const scores = sequence.map(lv => {
    const r = byLv.get(lv);
    if (!name) return ease(r, phase);
    const p = r[phase][name]; return 0.5 * p.first + 0.25 * p.two + 0.25 * p.four;
  });
  const diffs = scores.slice(1).map((v, i) => v - scores[i]);
  return { easierJumpsOver10pp: diffs.filter(d => d > 0.10).length,
    harderJumpsOver10pp: diffs.filter(d => d < -0.10).length,
    maximumEasierJump: round(Math.max(0, ...diffs)), maximumHarderJump: round(-Math.min(0, ...diffs)),
    totalVariation: round(diffs.reduce((a, d) => a + Math.abs(d), 0)) };
}
function apply() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  if (data.fingerprint !== fingerprint || data.rows.length !== TO - FROM + 2) throw Error('Incomplete/stale measurements');
  for (let lv = FROM - 1; lv <= TO; lv++) {
    const r = data.rows.find(r => r.lv === lv);
    if (!r || r.hash !== hash(JSON.stringify(row(lv)))) throw Error('Missing/mismatched board ' + lv);
  }
  const moves = order(data.rows), currentFile = path.join(ROOT, 'www/levels-hard.js'), current = table(currentFile);
  const prior = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT)) : null;
  if (JSON.stringify(current) !== JSON.stringify(T) &&
      !(prior && prior.fingerprint === fingerprint && JSON.stringify(current) === JSON.stringify(assemble(prior.moves))))
    throw Error('Source has additional edits; refusing overwrite');
  const next = assemble(moves);
  const proof = moves.every(m => H.validSolution(game(m.was), H.unpack(m.was, row(m.was)).solution));
  if (!proof || new Set(moves.map(m => m.was)).size !== moves.length) throw Error('Invalid permutation/solution');
  const before = Array.from({ length: TO - FROM + 2 }, (_, i) => FROM - 1 + i);
  const after = [FROM - 1, ...moves.map(m => m.was)];
  const report = { made: new Date().toISOString().slice(0, 10), fingerprint, status: 'unpublished',
    from: FROM, to: TO, simulatorCommit: '316f3b1', phases: PHASES,
    personas: Object.fromEntries(NAMES.map(n => [n, profiles[n].persona])),
    method: { bandWidth: BAND, firstWeight: 0.5, twoWeight: 0.25, fourWeight: 0.25, personWeights: [0.5, 0.5],
      withinBand: 'deterministic smoothing of both personas; initial/tie order is original level order',
      smoothing: { iterations: 40000, seed: 161026, objective: 'sum of each person absolute ease changes plus 5x harder jumps beyond 8pp', samples: 'primary only' },
      largeBoards: 'every tenth level', legacyRowRatings: 'preserved with original board; not used for ordering' },
    boundary: { old91: data.rows.find(r => r.lv === 91), new92: moves[0] },
    checks: { unchangedThrough: 91, boards: moves.length, uniqueBoards: new Set(moves.map(m => m.was)).size,
      validSolutions: proof, generation: next.v, previousGenerationThrough91: next.previousVersion },
    comparison: Object.fromEntries(Object.keys(PHASES).map(p => [p, { before: summarize(before, data.rows, p), after: summarize(after, data.rows, p) }])),
    perPlayerComparison: Object.fromEntries(NAMES.map(name => [name, {
      before: summarize(before, data.rows, 'validation', name), after: summarize(after, data.rows, 'validation', name) }])),
    bands: [[92, 99], [100, 119], [120, 149], [150, 179], [180, 209], [210, 239], [240, 269]].map(([from, to]) => {
      const ms = moves.filter(m => m.lv >= from && m.lv <= to);
      return { from, to, players: Object.fromEntries(NAMES.map(name => [name, Object.fromEntries(['first', 'two', 'four'].map(k =>
        [k, round(ms.reduce((s, m) => s + m.validation[name][k], 0) / ms.length)]))])) };
    }),
    moves };
  // Review the report before a release; validation samples do not decide the order.
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(currentFile, '/* Unpublished reorder of 92–269 with the calibrated honest observer.\n' +
    '   Levels through 91 unchanged. Complete boards preserved; see analysis/reorder-92.json.\n' +
    '   Packed rating fields retain their original calibration and are not the ordering measure. */\n' +
    'const HARD_LEVELS = ' + JSON.stringify(next) + ';\n');
  const names = ['new_level', 'old_level', 'large', 'ease', 'validation_ease', ...NAMES.flatMap(n => [n + '_first', n + '_within2', n + '_within4'])];
  const csv = [names.join(','), ...moves.map(m => [m.lv, m.was, m.big, m.ease, m.validationEase,
    ...NAMES.flatMap(n => [m.validation[n].first, m.validation[n].two, m.validation[n].four].map(round))].join(','))];
  fs.writeFileSync(path.join(ROOT, 'analysis/reorder-92-mapping.csv'), csv.join('\n') + '\n');
  writeReview(report);
  console.log(JSON.stringify({ checks: report.checks, comparison: report.comparison, first: moves.slice(0, 12).map(m => ({ lv: m.lv, was: m.was, ease: m.ease })) }, null, 2));
}
function writeReview(report) {
  const pct = x => Math.round(x * 100) + '%';
  const rows = report.bands.map(b => '| ' + b.from + '–' + b.to + ' | ' + NAMES.map(n => {
    const p = b.players[n]; return [p.first, p.two, p.four].map(pct).join(' / ');
  }).join(' | ') + ' |');
  const val = report.comparison.validation;
  const hardest = report.moves.slice().sort((a, b) => a.validation['Mrs. Doubtfire'].four - b.validation['Mrs. Doubtfire'].four).slice(0, 8);
  const text = ['# Level 92+ reorder — review before publication', '',
    'Status: **unpublished**. Branch: `wip/reorder-levels-92`. Levels 1–91 and the live website are unchanged.', '',
    '## What changed', '',
    'All 178 boards from 92–269 occur exactly once in the new order. Their pictures, geometry, face-down tiles, specials, clocks, complete solutions and legacy rating fields are preserved. Large boards stay at every tenth level; levels beyond 269 repeat the same final range as before.', '',
    'The order uses the calibrated honest observer at `316f3b1`, with equal weight for Dennisisdebeste and Mrs. Doubtfire. Each person contributes 50% first-try success, 25% success within two tries, and 25% within four. Five-point ease bands avoid pretending that tiny differences are exact. Within a size/band group, deterministic swaps reduce the sum of both people\'s difficulty jumps, with extra weight on harder jumps over eight points. Only primary samples drive that smoothing; original order breaks exact ties. Large and regular boards are ordered separately.', '',
    'Each board/persona was measured with 1,200 four-attempt chains for ordering and 600 additional chains with another seed for validation (644,400 chains including the level-91 reference). Validation simulations were not used to choose the order. This checks simulation stability; it is not validation on new human attempts.', '',
    '## Independent validation', '',
    `Combined ease variation between successive levels, including the fixed level-91 boundary: **${val.before.totalVariation} → ${val.after.totalVariation}**. Easier jumps over ten percentage points: **${val.before.easierJumpsOver10pp} → ${val.after.easierJumpsOver10pp}**. Harder jumps over ten points: **${val.before.harderJumpsOver10pp} → ${val.after.harderJumpsOver10pp}**.`, '',
    '| Personal score | Variation before → after | Harder jumps over ten points before → after |', '|---|---|---|',
    ...NAMES.map(n => { const p = report.perPlayerComparison[n]; return `| ${n} | ${p.before.totalVariation} → ${p.after.totalVariation} | ${p.before.harderJumpsOver10pp} → ${p.after.harderJumpsOver10pp} |`; }), '',
    'Expected success: first attempt / within two / within four, averaged over each band. These are model estimates, not real win rates.', '',
    '| New levels | Dennisisdebeste | Mrs. Doubtfire |', '|---|---|---|', ...rows, '',
    '## First twelve placements', '', '| New level | Former level | Large board |', '|---|---|---|',
    ...report.moves.slice(0, 12).map(m => `| ${m.lv} | ${m.was} | ${m.big ? 'yes' : 'no'} |`), '',
    '## Remaining difficult boards', '',
    'Reordering does not make the existing hardest boards easier. The lowest predicted within-four success rates for Mrs. Doubtfire are:', '',
    '| New level | Former level | Mrs. Doubtfire within four | Dennis within four |', '|---|---|---|---|',
    ...hardest.map(m => `| ${m.lv} | ${m.was} | ${pct(m.validation['Mrs. Doubtfire'].four)} | ${pct(m.validation.Dennisisdebeste.four)} |`), '',
    'The fixed level 91 remains difficult. New 92 intentionally starts the reordered progression with an easier board. The two fitted people can disagree on difficulty, and separate large-board slots introduce local rises and falls. Small remaining differences should not be interpreted as precise human rankings.', '',
    '## Compatibility and release', '',
    'Unchanged levels through 91 keep generation-7 saves and recordings. The reordered range uses generation 8, so an old saved board cannot resume under a different level number. Existing stars, player progress, telemetry and recordings are not rewritten. Legacy packed chances retain their original model labels after moving.', '',
    'Current 1.53 dashboard predictions and published files remain unchanged. A separate `reorder-92-predictions.json` draft covers all four people for the new numbering. Before a later release, bind that draft to the actual release version (refresh fits if needed), distinguish old-client predictions by app version, and publish only after Dennis asks. No database writes or publication occurred.', '',
    'See `reorder-92-plan.md`, `reorder-92.json`, `reorder-92-measurements.json`, and `reorder-92-mapping.csv` for the plan, source mapping, measurements and machine-readable checks.', ''];
  fs.writeFileSync(path.join(ROOT, 'analysis/reorder-92-review.md'), text.join('\n'));
}
function forecast() {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  if (report.fingerprint !== fingerprint) throw Error('Forecast requires the current completed reorder');
  const pred = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/dash/predict.json'), 'utf8'));
  if (pred.version !== '1.53') throw Error('Baseline predictions changed; review before rebuilding forecast');
  pred.baseVersion = pred.version; pred.version = 'unpublished-reorder-92'; pred.generation = T.v + 1;
  pred.status = 'draft; bind to the actual new release version before use';
  pred.made = new Date().toISOString().slice(0, 10);
  pred.runsByRange = { through91: 150, from92: PHASES.validation.runs };
  const byLv = new Map(report.moves.map(m => [m.lv, m]));
  for (const p of Object.values(pred.players)) {
    if (!profiles[p.name]) throw Error('No frozen profile for ' + p.name);
    const persona = { ...H.P, ...profiles[p.name].persona };
    for (const key of Object.keys(p.levels)) {
      const lv = +key; if (lv < FROM) continue;
      const m = byLv.get(lv); if (!m) throw Error('Prediction outside reordered range ' + lv);
      let r = m.validation[p.name];
      if (!r) {
        const c = H.rateChain(game(m.was), PHASES.validation.runs,
          PHASES.validation.seed + m.was * 101, persona, persona.memory, 4);
        r = { first: c.first, two: c.within[1], four: c.within[3] };
      }
      const clock = row(m.was)[7];
      p.levels[key] = [r.first, r.two, r.four].map(q => Math.round(q * 100)).concat(clock ? clock[1] : 0);
    }
    console.log('Prepared draft predictions for ' + p.name);
  }
  fs.writeFileSync(path.join(ROOT, 'analysis/reorder-92-predictions.json'), JSON.stringify(pred, null, 2) + '\n');
}
async function main() {
  const command = process.argv[2];
  if (command === 'apply') return apply();
  if (command === 'forecast') return forecast();
  if (command !== 'measure') throw Error('Usage: node reorder_honest.js measure|apply|forecast');
  const data = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : { fingerprint, phases: PHASES, rows: [] };
  if (data.fingerprint !== fingerprint) throw Error('Stale measurement cache; move it aside before remeasurement');
  const queue = Array.from({ length: TO - FROM + 2 }, (_, i) => FROM - 1 + i).filter(lv => !data.rows.some(r => r.lv === lv));
  const count = Math.min(6, queue.length), pending = [], workers = [];
  const persist = () => { data.rows.sort((a, b) => a.lv - b.lv); fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n'); };
  console.log(data.rows.length + '/179 cached; ' + count + ' analysis workers');
  for (let i = 0; i < count; i++) pending.push(new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: true });
    workers.push(w);
    w.on('error', reject); w.on('exit', code => { if (code) reject(Error('Worker exit ' + code)); });
    const next = () => { if (queue.length) w.postMessage(queue.shift()); else { w.postMessage(null); resolve(); } };
    w.on('message', r => { data.rows.push(r); persist(); if (data.rows.length % 10 === 0) console.log(data.rows.length + '/179 measured'); next(); });
    next();
  }));
  try { await Promise.all(pending); }
  catch (e) { await Promise.all(workers.map(w => w.terminate())); throw e; }
  persist(); console.log('Measurements complete. Run apply to create source permutation and review files.');
}
if (!isMainThread) parentPort.on('message', lv => { if (lv === null) parentPort.close(); else parentPort.postMessage(measure(lv)); });
else if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { order, ease, game, fingerprint, PHASES, NAMES, BASE, DATA, REPORT };
