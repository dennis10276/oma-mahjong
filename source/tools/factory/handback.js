'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { assign } = require('./batch_assign.js');
const { verify } = require('./batch_verify.js');
const { atomicJson, boardKey } = require('./meter.js');
const Moves = require('./moves.js');
const Final = require('./final_seed.js');
const Preferences = require('./shape_preferences.js');
const Supports = require('./trap_supports.js');
const Placement = require('./placement_score.js');

function handback(planFile, poolFile, measurements, out) {
  const plan = JSON.parse(fs.readFileSync(planFile)), pool = JSON.parse(fs.readFileSync(poolFile));
  plan.levelTable = path.resolve(path.dirname(planFile), plan.levelTable);
  const read = (row, mode) => {
    const f = path.join(measurements, row.id + '.' + mode + '.json');
    const value = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : null;
    return mode === 'quality' && !Supports.compatible(row, value) ? null : value;
  };
  const rated = pool.map(row => {
    const rate = read(row, 'rate'), quality = read(row, 'quality'), screen = read(row, 'screen');
    const pooled = rate?.train?.valid && rate.validation?.valid ? (rate.train.exp + rate.validation.exp) / 2 : null;
    return { row, rate, quality, screen, pooled, fresh: read(row, 'fresh') };
  });
  const result = assign(plan, pool, measurements, 3000000, false, true), rows = result.rows || [];
  fs.mkdirSync(out, { recursive: true });
  const levelsFile = path.join(out, 'levels.jsonl');
  fs.writeFileSync(levelsFile, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  verify(planFile, levelsFile, { partial: !result.complete });
  atomicJson(path.join(out, 'coverage.json'), { complete: !!result.complete, qualified: rows.length, required: plan.levels.length,
    nodes: result.nodes, capacityUpper: result.capacity, searchLimitReached: result.nodes > 3000000,
    preservedFailure: result.preservedFailure || [], levels: result.coverage, plan: planFile, measurements });
  fs.copyFileSync(path.resolve(path.dirname(planFile), plan.piles), path.join(out, 'candidate-piles.json'));
  fs.copyFileSync(plan.levelTable, path.join(out, 'context-levels.js'));
  atomicJson(path.join(out, 'output-plan.json'), { ...plan, piles: 'candidate-piles.json', levelTable: 'context-levels.js' });
  if (fs.existsSync(Moves.DEFAULT)) fs.copyFileSync(Moves.DEFAULT, path.join(out, 'factory-moves.jsonl'));
  else fs.writeFileSync(path.join(out, 'factory-moves.jsonl'), '');

  const selected = new Map(rows.map(r => [r.level, r])), used = new Set(rows.map(r => r.origin.creationId));
  const nearest = new Map();
  const matching = s => rated.filter(x => x.row.design.tiles.length >= Preferences.minimum(plan) && (x.row.n > 88) === s.big &&
    (!s.keepId||x.row.id===s.keepId) && (!s.keepPattern||Placement.patternKey(x.row.design)===s.keepPattern) &&
    (x.row.origin.intendedLevel == null || x.row.origin.intendedLevel === s.level));
  // Missing slots get distinct diagnostic proposals. They remain explicitly
  // unqualified; no gate is relaxed to make an incomplete batch look complete.
  const pending = plan.levels.filter(s => !selected.has(s.level)).sort((a, b) => matching(a).length - matching(b).length);
  for (const s of pending) {
    const choices = matching(s).filter(x => !used.has(x.row.origin.creationId));
    choices.sort((a, b) => (a.pooled == null ? 100 : Math.abs(a.pooled - s.target)) + Preferences.penalty(a.row.shape, plan) -
      (b.pooled == null ? 100 : Math.abs(b.pooled - s.target)) - Preferences.penalty(b.row.shape, plan));
    if (choices[0]) { nearest.set(s.level, choices[0]); used.add(choices[0].row.origin.creationId); }
  }
  const diagnostics = [], report = [], failureCounts = {};
  const bump = k => { failureCounts[k] = (failureCounts[k] || 0) + 1; };
  const fmt = n => Number.isFinite(n) ? (+n.toFixed(3)).toString() : '—';
  for (const s of plan.levels) {
    const approved = selected.get(s.level), x = approved ? rated.find(x => x.row.id === approved.id) : nearest.get(s.level);
    if (!x) { report.push(`| ${s.level} | ${s.target} | missing | — | — | — | — | — | — | — | — | — | — |`); continue; }
    const { row, rate, quality, pooled } = x, reasons = [];
    if (pooled == null) reasons.push('full two-seed rating unmeasured');
    else {
      if (Math.abs(pooled - s.target) > plan.tolerance) reasons.push('off curve');
      if (Math.abs(rate.train.exp - rate.validation.exp) > plan.maxSeedGap) reasons.push('seed disagreement');
      if (Final.tuned(row) && !Final.qualifies(row, rate, x.fresh, s, plan))
        reasons.push(x.fresh ? 'independent seed failed' : 'independent seed unmeasured');
    }
    if (!quality) reasons.push('quality unmeasured');
    else if (!quality.eligible) {
      if (quality.reason) reasons.push(quality.reason);
      if (quality.skilled?.exp > plan.skilledMax) reasons.push('skilled planner');
      if (quality.skilled?.exp < (plan.skilledMin ?? 0)) reasons.push('skilled too easy');
      if (quality.atTrap < plan.attribution) reasons.push('losses outside traps');
      if (!quality.room?.ok || quality.room.unrelieved > plan.unrelievedMax) reasons.push('luck/relief');
      if (quality.idle?.length) reasons.push('idle ' + quality.idle.join('/'));
      if (quality.grabFirst != null && quality.grabFirst < quality.train.exp + 1) reasons.push('clock-first lesson');
    }
    if (!approved && !reasons.length) reasons.push('batch compatibility / placement');
    reasons.forEach(bump);
    const room = quality?.room || (row.tuning ? null : row.room), specials = quality?.special;
    const components = { ...(specials || {}), ...(quality?.supports || {}) };
    const specialText = Object.keys(components).length ? Object.entries(components).map(([k, v]) => `${k}: ${fmt(v.without)} ${v.matters ? '✓' : '×'}`).join('; ') : 'unmeasured';
    const luck = room?.ok ? `${room.tightBlind}/${Math.max(0, room.tightBlind - room.unrelieved - (room.tightBlind ? 1 : 0))}/${room.unrelieved}` : 'unmeasured';
    const warnings = (quality?.lateShare ?? rate?.lateShare) >= .3 ? ['lateSqueeze'] : [];
    diagnostics.push(approved || { ...row, level: s.level, target: s.target, pass: false, diagnosticOnly: true,
      reviewReasons: reasons, family: { exp: pooled, search: rate?.train?.exp ?? null, validation: rate?.validation?.exp ?? null,
        ...(x.fresh ? { fresh: x.fresh.fresh?.exp, freshSeed: Final.SEED } : {}) },
      skilled: quality?.skilled?.exp ?? null, room, specials, atTrap: quality?.atTrap ?? rate?.atTrap ?? null,
      warnings, placementScore: Placement.score(row.design, row.recipe, row.shape), design: { ...row.design, level: s.level }, boardHash: boardKey(row.design) });
    const skilledText=quality?.skilled?.evidence?`${fmt(quality.skilled.exp)} human (bot ${fmt(quality.skilled.botExp)})`:fmt(quality?.skilled?.exp);
    report.push(`| ${s.level} | ${s.target} | ${approved ? 'qualified' : reasons.join('; ')} | ${fmt(pooled)} (${fmt(rate?.train?.exp)} / ${fmt(rate?.validation?.exp)})${Final.tuned(row) ? '; fresh ' + fmt(x.fresh?.fresh?.exp) : ''} | ${skilledText} | ${luck} | ${fmt(quality?.atTrap ?? rate?.atTrap)} | ${specialText} | ${row.recipe.join(' + ')} | ${row.shape} | ${row.design.tiles.length} | ${fmt(Placement.score(row.design, row.recipe, row.shape).total)} | ${warnings.join(', ') || '—'} |`);
  }
  fs.writeFileSync(path.join(out, 'closest-assignment.jsonl'), diagnostics.sort((a, b) => a.level - b.level).map(r => JSON.stringify(r)).join('\n') + '\n');
  atomicJson(path.join(out, 'rated-candidates.json'), rated.filter(x => x.rate).map(x => ({ ...x.row, measurement: x.rate, quality: x.quality, fresh: x.fresh })));
  const stages = { pool: pool.length, screened: rated.filter(x => x.screen).length, fullRated: rated.filter(x => x.pooled != null).length,
    qualityMeasured: rated.filter(x => x.quality).length, qualityPassed: rated.filter(x => x.quality?.eligible).length };
  const ownTargetMisses = rated.filter(x => x.pooled != null && Math.abs(x.pooled - x.row.target) > plan.tolerance).length;
  const seedMisses = rated.filter(x => x.pooled != null && Math.abs(x.rate.train.exp - x.rate.validation.exp) > plan.maxSeedGap).length;
  let revision = 'unknown'; try { revision = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
  const journal = fs.readFileSync(path.join(out, 'factory-moves.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean);
  const moves = journal.flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
  const largeSteps = moves.filter(m => Math.abs(m.after - m.before) >= 3);
  const text = [
    '# Level factory — levels 200–225', '',
    `**${rows.length}/${plan.levels.length} slots qualified and assigned. ${result.complete ? 'Complete batch.' : 'Incomplete batch; missing slots remain explicit in coverage.json.'}**`, '',
    'The qualified levels file contains only passing, distinct original designs. The closest-assignment file also includes explicitly unqualified diagnostic proposals. Claude retains final selection and release control. No main, game sources, game level tables, Firebase or player data were changed.', '',
    `Curve anchors: ${JSON.stringify(plan.curve)}. Skilled range: ${plan.skilledMin ?? 0}–${plan.skilledMax}. Minimum tiles: ${Preferences.minimum(plan)}. Discouraged shapes: ${(plan.discouragedShapes || ['block']).join(', ')} (fallback only).`, '',
    `Source: ${revision}. Measurements: ${measurements}.`, '',
    '## Per level', '',
    'Pooled = equal mean of the two full family runs (4711 / 18427; 40 campaigns each). Tuned rows (including edits chosen from bot feedback) must also pass seed 29717, 40 campaigns, within 0.5 of the placed target and maximum pairwise seed gap 2. This reserved seed never feeds steering. Luck column = tight blind digs / relieved gaps between tight digs / unrelieved gaps. Specials show the family rating with that special removed and whether the factory deems it meaningful. An em dash means unmeasured.', '',
    'Placement is the 0–100 Dennis round-2 authoring preference score (timing, clarity, visible route, fair clock, temptation opportunity, shape), not a difficulty rating. Details travel with every delivered row.', '',
    '| Level | Target | Status | Pooled (both seeds) | Skilled | Luck/relief/unrelieved | At trap | Specials without | Recipe | Shape | Tiles | Placement | Warnings |',
    '|---|---:|---|---|---:|---|---:|---|---|---|---:|---:|---|', ...report, '',
    '## Yield and failures', '',
    `Pool ${stages.pool}; screened ${stages.screened}; full two-seed ratings ${stages.fullRated}; quality checks ${stages.qualityMeasured}; quality passes ${stages.qualityPassed}.`,
    `${ownTargetMisses} fully rated candidates missed their initial slot target by more than 0.5; ${seedMisses} disagreed by more than two tries between seeds. These counts overlap.`,
    `Assignment explored ${result.nodes} nodes; the relaxed coverage upper bound was ${result.capacity}. ${result.nodes > 3000000 ? 'The search limit was reached; this is the best assignment found, not a proof of maximum coverage.' : 'The bounded search finished.'}`,
    'Diagnostic proposal reasons: ' + JSON.stringify(failureCounts) + '.', '',
    '## Rules and learning', '',
    'All requested acceptance limits were retained. Extra candidate layouts provide alternatives without reusing one creation in multiple slots. Missing coverage was not repaired by weakening the curve, originality or quality checks.',
    `The journal contains ${moves.length} parseable measured changes (${journal.length - moves.length} malformed lines); ${largeSteps.length} changed difficulty by at least three tries. Such cliffs make local steering difficult; the shared graded changes address this. No rule change was made.`, '',
    '## Validation and handoff', '',
    `The ${rows.length} qualified rows were verified against the current calibrated bot cache and the original batch context. Full completion remains ${result.complete ? 'verified' : 'unachieved'}. Preview results and the cloud-tuned input status are recorded below when the run is finished.`, ''
  ].join('\n');
  fs.writeFileSync(path.join(out, 'RESULT.md'), text);
  return { result, rows, stages, out };
}
module.exports = { handback };
if (require.main === module) {
  const r = handback(...process.argv.slice(2, 6)); console.log(r.rows.length + '/26 verified qualified rows handed back to ' + r.out);
}
