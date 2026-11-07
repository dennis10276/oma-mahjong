'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
const { pool } = require('../factory/empirical_workers.js');
const ROOT = path.resolve(__dirname, '../..'), mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
function prepare(root) {
  const dir = path.join(root, 'fit'), file = path.join(dir, 'plan.json'); if (fs.existsSync(file)) { const p = P.read(file); S.verifyPlan(p); return p; }
  const froot = path.join(ROOT, 'analysis/factory'), live = P.read(path.join(froot, 'targets-85-155.json')).levels.filter(r => r.level >= 85 && r.level <= 174);
  const weighted = P.read(path.join(froot, 'family-weighted-tries.json')), lab = fs.readFileSync(path.join(froot, 'planner-eval.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse).filter(r => r.kind === 'factory');
  const plays = P.read(path.join(froot, 'dennis-plays.json')).boards, kept = fs.readFileSync(path.join(ROOT, 'analysis/builder/knobs-v1/levels.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  if (lab.length !== 24) throw Error('Expected the24 archived lab-fit rows');
  const Hard = require('../../www/hard.js'), previous = global.HARD_LEVELS; let benches;
  try {
    global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
    benches = [
      ...Object.entries(weighted).filter(([lv]) => +lv >= 85 && +lv <= 174).map(([lv, target]) => ({ id: 'family-live-' + lv, group: 'family-live-weighted', setting: 'family', level: +lv, target, design: Hard.get(+lv) })),
      ...live.map(r => ({ id: 'planner-live-' + r.level, group: 'planner-live-published-target', setting: 'planner', level: r.level, target: r.target, dennisTries: r.dennis, dennisWon: r.dennisWon, design: Hard.get(r.level) })),
      ...lab.map(r => { const played = plays.find(b => b.key === r.id); if (!played?.board) throw Error('Missing exact lab board: ' + r.id); return { id: r.id, group: 'planner-lab24', setting: 'planner', target: r.target, archivedScore: r.exp, actualTries: played.tries, results: played.results, design: played.board }; }),
      ...[[200, 5], [225, 4]].map(([level, target]) => { const row = kept.find(r => r.level === level); return { id: 'dennis-first-' + level, group: 'planner-first200and225', setting: 'planner', level, target, design: row.design }; })
    ];
  } finally { global.HARD_LEVELS = previous; }
  const p = { schema: 'task11-key-memory-fit-v1', created: new Date().toISOString(), worker: M.sourceHash(require.resolve('./task11_fit_worker.js')),
    versions: { reference: M.createMeter().fingerprint, candidate: M.createMeter({ bot: require.resolve('../sim/refit/human_bot_key_memory_v1.js') }).fingerprint }, benches,
    settings: { seed: 4711, runs: 20, seeds: 2 },
    rule: 'Freeze all exact boards/labels before calls. Full fixed40 campaigns per profile, both planner styles. Candidate must not worsen point-label MAE in ANY of family-weighted live, archived24 lab, published live target, or each first200/225 individual error. These are inherited release datasets, not new held-out validation. Also report actual Dennis tries and censor-aware lab error. No tuning on fit outcomes; if worse, reject this candidate and stop that behavioral change before bulk rerating or adoption.',
    labels: `Archived planner-eval supplies24 lab IDs/targets; dennis-plays supplies their exact boards. targets-85-155 (actually79 rows through174) supplies published Dennis-plus-family-adjusted live targets; family-weighted-tries supplies${benches.filter(b => b.group === 'family-live-weighted').length} capped family-weighted targets. Keep these metrics distinct: the quoted1.05–1.10 historical live error is not assumed to be the family-weighted MAE. Current live boards are snapshotted here, and the original20 kept designs provide200/225.` };
  p.fingerprint = M.digest(p); P.save(dir, 'plan.json', p); console.log('Frozen fit', benches.length, 'benchmark cases,', benches.length * 2, 'profile measurements'); return p;
}
async function measure(root, workers = 10) {
  const dir = path.join(root, 'fit'), p = prepare(root); if (p.worker !== M.sourceHash(require.resolve('./task11_fit_worker.js'))) throw Error('Frozen fit worker changed');
  const jobs = new Map();
  for (const b of p.benches) for (const [version, bot] of Object.entries(p.versions)) { const task = M.digest([bot, M.boardKey(b.design), b.setting, p.settings]); jobs.set(task, { task, version, bot, design: b.design, setting: b.setting }); }
  let done = 0; const queue = [...jobs.values()].filter(j => { const f = path.join(dir, 'measurements', j.task + '.json'); if (fs.existsSync(f) && P.read(f).valid) { done++; return false; } return true; });
  await pool(queue, require.resolve('./task11_fit_worker.js'), r => { P.save(dir, 'measurements/' + r.task + '.json', { ...r, plan: p.fingerprint }); console.log(++done + '/' + jobs.size, r.version, r.setting, r.valid ? r.exp : 'INVALID', Math.round(r.ms / 1000) + 's'); }, workers);
}
function report(root) {
  const dir = path.join(root, 'fit'), p = prepare(root), rows = p.benches.map(b => {
    const values = {}; for (const [version, bot] of Object.entries(p.versions)) { const key = M.digest([bot, M.boardKey(b.design), b.setting, p.settings]), f = path.join(dir, 'measurements', key + '.json'); values[version] = fs.existsSync(f) ? P.read(f) : null; }
    return { ...b, design: undefined, boardKey: M.boardKey(b.design), values };
  });
  const groups = {};
  for (const group of [...new Set(rows.map(r => r.group))]) {
    const bs = rows.filter(r => r.group === group), metrics = {};
    for (const version of ['reference', 'candidate']) {
      const valid = bs.filter(r => r.values[version]?.valid);
      metrics[version] = { n: valid.length, expected: bs.length, mae: mean(valid.map(r => Math.abs(r.values[version].exp - r.target))),
        dennisActualMAE: mean(valid.filter(r => r.dennisTries != null).map(r => Math.abs(r.values[version].exp - r.dennisTries))) };
    }
    groups[group] = { ...metrics, complete: metrics.reference.n === bs.length && metrics.candidate.n === bs.length,
      nonworse: metrics.reference.n === bs.length && metrics.candidate.n === bs.length && metrics.candidate.mae <= metrics.reference.mae + 1e-9 };
  }
  const complete = Object.values(groups).every(g => g.complete), pointCases = rows.filter(r => r.group === 'planner-first200and225');
  const firstNonworse = pointCases.every(r => r.values.reference?.valid && r.values.candidate?.valid && Math.abs(r.values.candidate.exp - r.target) <= Math.abs(r.values.reference.exp - r.target) + 1e-9);
  const result = { plan: p.fingerprint, complete, accepted: complete && Object.values(groups).every(g => g.nonworse) && firstNonworse,
    groups, firstNonworse, rows, decision: !complete ? 'pending' : Object.values(groups).every(g => g.nonworse) && firstNonworse ? 'Passes the registered inherited-fit gate; bulk rerating still required before adoption.' : 'REJECTED: fit worsened. Do not adopt or silently replace the released bot; stop this candidate before bulk rerating.' };
  P.save(dir, 'summary.json', result);
  const lines = ['# Key-memory candidate: inherited release-fit check', '', result.decision, '', p.rule, '', p.labels, '',
    '| Benchmark | reference MAE | candidate MAE | completed / expected | nonworse |', '|---|---:|---:|---|---|'];
  for (const [name, g] of Object.entries(groups)) lines.push(`| ${name} | ${g.reference.mae} | ${g.candidate.mae} | ${g.reference.n}/${g.reference.expected}; ${g.candidate.n}/${g.candidate.expected} | ${g.nonworse} |`);
  lines.push('', '| Board | actual first win | reference planner | candidate planner |', '|---|---:|---:|---:|'); for (const r of pointCases) lines.push(`| ${r.level} | ${r.target} | ${r.values.reference?.exp ?? 'unmeasured'} | ${r.values.candidate?.exp ?? 'unmeasured'} |`);
  lines.push('', 'The candidate fixes only family key-role memory. The skilled profile delegates to the same reference controller and unchanged profile; equal skilled results are expected, and a tap-sequence test verifies that path. This is an explicit experimental entry point and setting, with its own meter fingerprint and no cache migration. The released entry point and protected G2 environment files are unchanged.', '');
  fs.writeFileSync(path.join(dir, 'FIT.md'), lines.join('\n')); return result;
}
if (require.main === module) { const root = path.resolve(process.argv[2]), action = process.argv[3]; Promise.resolve(action === 'prepare' ? prepare(root) : action === 'report' ? report(root) : measure(root, +(process.argv[4] || 10))).catch(e => { console.error(e); process.exitCode = 1; }); }
module.exports = { prepare, measure, report };
