'use strict';
// A paired, frozen remeasurement of existing puzzles. Never constructs for slots.
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
const ROOT = path.resolve(__dirname, '../..'), CANDIDATE = require.resolve('../sim/refit/human_bot_key_memory_v1.js');
function prepare(root, baseline, ladder) {
  const file = path.join(root, 'plan.json'); if (fs.existsSync(file)) { const p = P.read(file); S.verifyPlan(p); return p; }
  const fit = P.read(path.join(baseline, 'fit/summary.json')); if (!fit.accepted) throw Error('Candidate has not passed the complete inherited-fit gate');
  const kept = fs.readFileSync(path.join(ROOT, 'analysis/builder/knobs-v1/levels.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const task10 = P.read(path.join(ROOT, 'analysis/builder/knobs-v1/boards.json'));
  const visibility = require('./task11_keys.js'), groups = new Map();
  function add(board, member) {
    const key = M.boardKey(board.design); let b = groups.get(key);
    if (!b) { b = { ...board, id: key, stage: 'rerate', memberships: [] }; groups.set(key, b); }
    b.memberships.push(member);
  }
  for (const b of kept) add(b, { group: 'kept20', level: b.level, target: b.target, reference: { family: b.family.exp, skilled: b.skilled } });
  for (const b of task10.filter(b => !b.fail && b.family && b.skilled && b.design.obst.keys.length && !b.design.obst.keys.some(k => b.design.obst.ice[k]) && visibility.features(b.design).keysShownAtStart < 2))
    add(b, { group: 'task10-hidden-keys', id: b.id, shown: visibility.features(b.design).keysShownAtStart, reference: { family: b.family.exp, skilled: b.skilled.exp } });
  for (const b of S.collect(path.join(ladder, 'ladder-readable')).boards.filter(b => !b.fail && b.design)) {
    if (!b.family || !b.skilled) throw Error('Primary v3 reference ladder must be fully measured first');
    add(b, { group: 'v3-ladder', id: b.id, cell: b.cell, reference: { family: b.family.exp, skilled: b.skilled.exp } });
  }
  const protocol = { schema: 'task11-key-memory-paired-rerating-v1', bot: M.createMeter({ bot: CANDIDATE }).fingerprint,
    worker: M.sourceHash(require.resolve('./task10_worker.js')), fit: fit.plan,
    settings: [{ setting: 'family', seed: 4711, runs: 20, seeds: 2 }, { setting: 'family', seed: 18427, runs: 20, seeds: 2 }, { setting: 'planner', seed: 4711, runs: 20, seeds: 2 }],
    rule: 'Exact kept20, all non-frozen Task10 key boards with fewer than two actual opening key glyphs, and all primary v3 ladder outputs. Deduplicate physical boards. Full new-version ratings, no migration and no outcome-dependent stopping. Targets are the actual frozen kept20 targets inherited from Task9/10.' };
  const p = { schema: protocol.schema, protocol: M.digest(protocol), bot: protocol.bot, worker: protocol.worker, fit: fit.plan, boards: [...groups.values()] };
  p.fingerprint = M.digest(p); P.save(root, 'protocol.json', protocol); P.save(root, 'plan.json', p); return p;
}
async function measure(root, baseline, workers) {
  if (!P.read(path.join(baseline, 'fit/summary.json')).accepted) throw Error('Fit gate not accepted');
  if (M.createMeter().fingerprint !== M.createMeter({ bot: CANDIDATE }).fingerprint) throw Error('Run with HUMAN_BOT set to the candidate entry');
  return S.measure(root, 'all', workers);
}
function skilledReference(board, membership) {
  return { referencePlannerBot: membership.group === 'kept20' ? (board.botSkilled ?? membership.reference.skilled) : membership.reference.skilled,
    approvedHumanSkilled: membership.group === 'kept20' ? board.skilledEvidence?.tries ?? null : null };
}
function report(root) {
  const d = S.collect(root), rows = d.boards.flatMap(b => b.memberships.map(m => ({ ...m, boardKey: M.boardKey(b.design),
    ...skilledReference(b, m),
    candidate: { family: b.family?.exp ?? null, skilled: b.skilled?.exp ?? null, seeds: b.family?.seeds ?? null } })));
  const complete = d.boards.every(b => b.family && b.skilled), kept = rows.filter(r => r.group === 'kept20'), hidden = rows.filter(r => r.group === 'task10-hidden-keys');
  const summary = { complete, physicalBoards: d.boards.length, records: d.records.size, invalid: [...d.records.values()].filter(r => !r.valid).length,
    kept: { n: kept.length, rated: kept.filter(r => r.candidate.family != null).length, referenceWithinOne: kept.filter(r => Math.abs(r.reference.family - r.target) <= 1 + 1e-9).length,
      candidateWithinOne: kept.filter(r => r.candidate.family != null && Math.abs(r.candidate.family - r.target) <= 1 + 1e-9).length },
    hidden: { n: hidden.length, meanFamilyChange: complete ? hidden.reduce((n, r) => n + r.candidate.family - r.reference.family, 0) / hidden.length : null,
      improved: hidden.filter(r => r.candidate.family != null && r.candidate.family < r.reference.family - 1e-9).length,
      worsened: hidden.filter(r => r.candidate.family != null && r.candidate.family > r.reference.family + 1e-9).length },
    planner: { measuredMemberships: rows.filter(r => r.candidate.skilled != null).length,
      maxAbsoluteDriftFromReferenceBot: Math.max(0, ...rows.filter(r => r.candidate.skilled != null).map(r => Math.abs(r.candidate.skilled - r.referencePlannerBot))) }, rows };
  P.save(root, 'rerating-summary.json', summary);
  const lines = ['# Exact-board key-memory re-rating', '', `Complete: ${complete}. ${summary.physicalBoards} physical boards, ${summary.records} full measurements, ${summary.invalid} invalid.`, '',
    `Kept20 within ±1 of their frozen curve: reference ${summary.kept.referenceWithinOne}/20; candidate ${summary.kept.candidateWithinOne}/20 (${summary.kept.rated}/20 family ratings complete). This is a diagnosis of the existing batch, not a replacement level table.`, '',
    `Task10 non-frozen hidden/partly hidden-key boards: ${hidden.length}; mean candidate-minus-reference family change ${summary.hidden.meanFamilyChange}. Improved ${summary.hidden.improved}, worsened ${summary.hidden.worsened}; unchanged reported in JSON.`, '',
    '| Kept level | target | reference family | candidate family | reference / candidate planner | approved human skilled | candidate family seeds |', '|---|---:|---:|---:|---|---:|---|'];
  for (const r of kept.sort((a, b) => a.level - b.level)) lines.push(`| ${r.level} | ${r.target} | ${r.reference.family} | ${r.candidate.family} | ${r.referencePlannerBot} / ${r.candidate.skilled} | ${r.approvedHumanSkilled ?? ''} | ${r.candidate.seeds?.join(' / ')} |`);
  lines.push('', 'The frozen kept rows use approved exact-board human skilled evidence on200 and225 (5 and4), while botSkilled stores their actual reference planner ratings (5.15 and2.08). Compare bot with bot; new offline bot scores do not replace those human wins. No game row or gold pair changes.');
  lines.push('', 'All board memberships and before/after values are in rerating-summary.json. The v3 ladder keeps every request, including neighboring requests that produce the same physical board. Reference/candidate settings and streams are identical; both planner styles were measured under each fingerprint.', '');
  fs.writeFileSync(path.join(root, 'RERATING.md'), lines.join('\n')); return summary;
}
if (require.main === module) {
  const [action, rootArg, baseArg, ladderArg, n] = process.argv.slice(2), root = path.resolve(rootArg), baseline = path.resolve(baseArg || 'source/build/why-hard-v1');
  Promise.resolve(action === 'prepare' ? prepare(root, baseline, path.resolve(ladderArg)) : action === 'measure' ? measure(root, baseline, +(n || 10)) : report(root))
    .then(r => console.log(JSON.stringify({ complete: r.complete, boards: r.boards?.length || r.physicalBoards, kept: r.kept, hidden: r.hidden }))).catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { prepare, measure, report, skilledReference };
