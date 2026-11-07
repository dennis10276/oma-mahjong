'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js');
function frozen(dir, name, value) {
  delete value.fingerprint; value.fingerprint = M.digest(value);
  const f = path.join(dir, name); if (fs.existsSync(f) && P.read(f).fingerprint !== value.fingerprint) throw Error('Changed derived plan: ' + name);
  P.save(dir, name, value); return value;
}
function prepare(baseline, primary, rerating, candidateLadder) {
  const d = S.collect(rerating); if (!d.boards.every(b => b.family && b.skilled)) throw Error('Full paired re-rating incomplete');
  const scores = new Map(d.boards.map(b => [M.boardKey(b.design), b])), selection = P.read(path.join(baseline, 'selection-plan.json'));
  const p = frozen(rerating, 'selection-plan.json', { ...selection, reference: selection.fingerprint, bot: d.protocol.bot,
    derivation: 'Same reference60 diagnostic selection; only the exact10 reference key-audit boards are captured here. No outcome-dependent re-selection.' });
  const key = P.read(path.join(baseline, 'key-selection-plan.json'));
  frozen(rerating, 'key-selection-plan.json', { ...key, parent: p.fingerprint, reference: key.fingerprint,
    rule: 'Exact same ten boards and six family campaign seeds as the reference key audit. New explicit bot fingerprint. Full scores updated from paired re-rating; no re-selection.',
    boards: key.boards.map(b => { const r = scores.get(M.boardKey(b.design)); if (!r) throw Error('Key board missing re-rating'); return { ...b, referenceRatings: { family: b.family, skilled: b.skilled }, family: r.family, skilled: r.skilled }; }) });
  const sp = P.read(path.join(primary, 'selection-plan.json'));
  const cp = frozen(candidateLadder, 'selection-plan.json', { ...sp, bot: d.protocol.bot, reference: sp.fingerprint });
  const old = P.read(path.join(primary, 'ladder-readable/plan.json')), proto = { ...P.read(path.join(primary, 'ladder-readable/protocol.json')), bot: d.protocol.bot,
    worker: d.protocol.worker, source: old.fingerprint, rerating: d.plan.fingerprint, note: 'Same physical v3 outputs; full new-version measurements from the frozen combined re-rating.' };
  P.save(path.join(candidateLadder, 'ladder-readable'), 'protocol.json', proto);
  frozen(path.join(candidateLadder, 'ladder-readable'), 'plan.json', { ...old, bot: d.protocol.bot, worker: d.protocol.worker, protocol: M.digest(proto), reference: old.fingerprint, selection: cp.fingerprint });
  const keys = new Set(old.boards.filter(b => !b.fail).map(b => M.boardKey(b.design)));
  for (const [key, r] of d.records) if (keys.has(r.boardKey)) P.save(candidateLadder, 'ladder-readable/measurements/' + key + '.json', r);
  for (const name of ['structures', 'engine-detail/structure']) {
    const dir = path.join(primary, name), dest = path.join(candidateLadder, name); fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.copyFileSync(path.join(dir, f), path.join(dest, f));
  }
  P.save(candidateLadder, 'structural-reuse-protocol.json', { reference: P.read(path.join(primary, 'structural-reuse-protocol.json')), rule: 'Bot-only change; all exact v3 boards and structural engine proofs unchanged.' });
  return require('./task11_report.js').ladder(candidateLadder);
}
function compareMemory(baseline, candidate) {
  const old = P.read(path.join(baseline, 'key-memory.json')), next = P.read(path.join(candidate, 'key-memory.json'));
  const metrics = r => ({ opportunities: r.eligibleTransitions, firstTowardCover: r.firstCommitTowardCover, strictStraight: r.strictStraightCoverDig, reexposed: r.nextTryReexposed, hiddenPictureRecall: r.hiddenPictureRecallShare });
  const rows = old.rows.map(a => { const b = next.rows.find(b => b.boardKey === a.boardKey); if (!b) throw Error('Unpaired key board');
    return { id: a.id, boardKey: a.boardKey, reference: metrics(a), candidate: metrics(b), fullReferenceFamily: a.fullFamily, fullCandidateFamily: b.fullFamily,
      referenceWonOn: a.sampleWonOn, candidateWonOn: b.sampleWonOn }; });
  const out = { reference: metrics(old), candidate: metrics(next), rows,
    note: 'Exact same boards and campaign seeds; policy changes can alter key sightings and which campaigns survive to another retry. Opportunity denominators therefore differ. Descriptive cover shares are not a causal effect conditioned on identical observations. Full ratings are separately paired with fixed seeds.' };
  P.save(candidate, 'memory-comparison.json', out);
  const lines = ['# Observed-key memory: reference and candidate', '', out.note, '',
    '| Policy | opportunities | first commit toward cover | strict straight cover | later re-exposed | hidden-picture recall |', '|---|---:|---:|---:|---:|---:|'];
  for (const [name, r] of Object.entries({ reference: out.reference, candidate: out.candidate })) lines.push(`| ${name} | ${r.opportunities} | ${r.firstTowardCover} (${(100 * r.firstTowardCover / r.opportunities).toFixed(1)}%) | ${r.strictStraight} | ${r.reexposed} | ${r.hiddenPictureRecall} |`);
  lines.push('', '## Per-board full family rating', '', '| Board | reference | candidate | six reference wins | six candidate wins |', '|---|---:|---:|---|---|');
  for (const r of rows) lines.push(`| ${r.id} | ${r.fullReferenceFamily} | ${r.fullCandidateFamily} | ${r.referenceWonOn.join(', ')} | ${r.candidateWonOn.join(', ')} |`);
  fs.writeFileSync(path.join(candidate, 'MEMORY-COMPARISON.md'), lines.concat('').join('\n')); return out;
}
if (require.main === module) {
  const [action, a, b, c, d] = process.argv.slice(2); console.log(action === 'prepare' ? prepare(...[a, b, c, d].map(x => path.resolve(x))).physicalBoards : compareMemory(path.resolve(a), path.resolve(b)).candidate);
}
module.exports = { prepare, compareMemory };
