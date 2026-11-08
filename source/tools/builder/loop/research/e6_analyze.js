#!/usr/bin/env node
'use strict';
// Summarize the completed E6 run without running bots or changing its append-only ledgers.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = path.resolve(__dirname, '../../../../analysis/builder');
const STEPS = ['build', 'dedupe', 'static', 'screen', 'planner', 'curve', 'traces', 'C1', 'C2', 'library'];
const round = n => Math.round(n * 1000) / 1000;
const count = (a, key) => a.reduce((o, r) => { const k = key(r); o[k] = (o[k] || 0) + 1; return o; }, {});
function analyze(runs, gates, rejects, curves = []) {
  const selected = runs.filter(r => !r.dryRun && r.options?.seedBase === 1 && r.range?.[0] < 500);
  const covered = new Set(), steps = Object.fromEntries(STEPS.map(k => [k, { in: 0, pass: 0, fail: 0, unresolved: 0, cpuS: 0, wallS: 0 }]));
  const signatures = new Set();
  for (const r of selected) {
    if (r.range[1] - r.range[0] + 1 !== r.done || r.next !== r.range[1] + 1) throw Error('inconsistent run range');
    signatures.add(JSON.stringify({ options: r.options, fingerprints: r.fingerprints }));
    if (r.errors?.length) throw Error('E6 has unresolved tool errors');
    for (let i = r.range[0]; i <= r.range[1]; i++) {
      if (i < 0 || i >= 500 || covered.has(i)) throw Error('overlapping or out-of-range candidates');
      covered.add(i);
    }
    for (const k of STEPS) for (const f of Object.keys(steps[k])) steps[k][f] += r.steps[k]?.[f] || 0;
  }
  if (signatures.size !== 1) throw Error('mixed pipeline settings or fingerprints');
  if (covered.size !== 500) throw Error('E6 requires exactly 500 covered candidates');
  for (const [k, s] of Object.entries(steps)) {
    if (s.in !== s.pass + s.fail + s.unresolved) throw Error('unbalanced step ' + k);
    for (const f of ['cpuS', 'wallS']) s[f] = round(s[f]);
    s.passRate = s.in ? round(s.pass / s.in) : null;
  }
  const runIds = new Set(selected.map(r => r.run)), refused = rejects.filter(r => runIds.has(r.run));
  const statics = gates.filter(r => r.step === 'static'), traces = gates.filter(r => r.step === 'traces');
  if (statics.length !== steps.static.in || new Set(statics.map(r => r.i)).size !== statics.length) throw Error('static log coverage mismatch');
  if (refused.length !== STEPS.reduce((n, k) => n + (k === 'build' ? 0 : steps[k].fail), 0)) throw Error('reject ledger coverage mismatch');
  const traceBoards = new Set(traces.map(r => r.i));
  if (traceBoards.size !== steps.traces.in) throw Error('trace log coverage mismatch');
  const staticByGate = Object.fromEntries(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9'].map(k => [k, {
    pass: statics.filter(r => r.raw[k] === true).length,
    fail: statics.filter(r => r.raw[k] === false).length,
    notDecided: statics.filter(r => r.raw[k] == null).length,
  }]));
  const traceByGate = Object.fromEntries(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].map(k => [k, {
    failedSpareTests: traces.filter(r => r.gates[k]?.pass === false).length,
    affectedBoards: new Set(traces.filter(r => r.gates[k]?.pass === false).map(r => r.i)).size,
  }]));
  const cpuS = round(selected.reduce((n, r) => n + r.cpuS, 0)), wallS = round(selected.reduce((n, r) => n + r.wallS, 0));
  const libraryCandidates = steps.library.pass;
  return { schema: 'e6-yield-v1', runs: selected.map(r => r.run), builds: covered.size, steps, cpuS, wallS,
    cpuPerBuild: round(cpuS / covered.size), libraryCandidates, finishedLevels: null,
    cpuPerLibraryCandidate: libraryCandidates ? round(cpuS / libraryCandidates) : null,
    cpuPerFinishedLevel: null, supplyKill: libraryCandidates < 3,
    options: selected[0].options, fingerprints: selected[0].fingerprints,
    rejectedByStep: count(refused, r => r.gate), screenReasons: count(refused.filter(r => r.gate === 'screen'), r => r.reason),
    staticByGate, traceByGate, traceSpareTests: traces.length,
    finalists: refused.filter(r => r.gate === 'traces').map(r => ({ index: r.index, briefId: r.briefId, seed: r.seed, key: r.key, reason: r.reason })),
    loggedOriginalCurves: gates.filter(r => r.step === 'curve').length,
    supplementalCurves: curves.length,
    supplemental: { cpuS: round(curves.reduce((s, r) => s + r.cpuS, 0)), wallS: round(curves.reduce((s, r) => s + r.wallS, 0)),
      rows: curves.map(r => ({ index: r.index, key: r.key, points: r.curve.points.map(p => ({ spare: p.spare, D: p.D, valid: p.valid })), shippable: r.curve.shippable, monotone: r.curve.monotone })) },
    limitations: [
      'Library entry is a pre-acceptance candidate; no slot assignment or fresh ACCEPT rating ran.',
      'Original run used spares 0-3, not the requested 0-4, and did not save individual curve rows.',
      'Only five curves reached measurement; the 30-curve dial test is inconclusive.',
      'Static gate counts are conditional: stopEarly leaves later gates unmeasured.',
      'No Dennis labels exist for the five fresh finalists; trace rejection does not prove human dislike.',
      'Screen band 5.4-8.5 is a mock window, not an approved difficulty curve.',
      'CPU is process.cpuUsage for the original single-process runs; supplemental recovery cost is separate.',
    ] };
}
function markdown(r) {
  const n = x => x.toFixed(1);
  return `# E6: end-to-end supply from 500 builds

**The supply stop rule fires: zero library candidates from 500 builds.** No finished level was accepted or assigned. CPU cost per finished level cannot be estimated from zero output. Do not spend another batch on measurement speed; the next experiment should change how visible choices are built.

The original two single-process runs used ${n(r.cpuS / 60)} CPU-minutes and ${n(r.wallS / 60)} wall-minutes (${r.cpuPerBuild} CPU-seconds per attempted build). They covered indices 0-499 once, with no skipped duplicates, errors or unresolved candidates. Source: library/pipeline-runs.jsonl, runs ${r.runs.join(', ')}. The E5 proposal was applied only through the research wrapper; production defaults and ruler pins stay unchanged.

| Stage | Entered | Passed | Failed | CPU seconds |
|---|---:|---:|---:|---:|
${STEPS.map(k => { const s = r.steps[k]; return `| ${k} | ${s.in} | ${s.pass} | ${s.fail} | ${s.cpuS} |`; }).join('\n')}

45 builds returned no board. Of 455 boards, 168 passed static gates. Readability A2 accounts for 273 static failures; A3 for 9, A4 for 3 and A1 for 2. These are ordered first-failure counts, not unconditional quality estimates. A5 and A7 were report-only. The screen passed 32/168, and the planner passed 5/32 at S >= 2.2 (floor 2.5 minus margin 0.3). All five had a shippable curve spare, then lost every eligible spare to trace gates.

| Finalist | Index | Seed | Trace rejection |
|---|---:|---:|---|
${r.finalists.map(x => `| ${x.briefId} | ${x.index} | ${x.seed} | ${x.reason} |`).join('\n')}

Trace gate failures overlap; counts below are spare tests and distinct boards, respectively. Boolean verdicts, not rounded metric values, decide failure (one B6 value displays 0.650 but is slightly above 0.65 before rounding).

| Gate | Failed spare tests | Affected boards |
|---|---:|---:|
${Object.entries(r.traceByGate).map(([k, v]) => `| ${k} | ${v.failedSpareTests} | ${v.affectedBoards} |`).join('\n')}

Sources: process-v1/e6-gates.jsonl (${r.traceSpareTests} spare tests), library/rejects.jsonl. The pinned family and planner fingerprints are stored in e6-yield.json. Regenerate with \`node source/tools/builder/loop/research/e6_analyze.js\`; it validates run coverage, accounting and log coverage before writing.

The supply kill is decisive under this experimental gate set; the dial kill is **inconclusive**. Only five curves ran rather than the intended 30, and the original run used spares 0-3, not 0-4. Individual curve rows were not logged. Supplemental 0-4 curves in e6-curves.jsonl reconstruct these same puzzles by content hash. ${r.supplementalCurves} curves are recovered, costing ${r.supplemental.cpuS} additional CPU-seconds (${r.supplemental.wallS} wall-seconds), with cached ratings reused where available. Their cost and date are separate from the original batch. Do not present these as 30 curves or as evidence that the dial works across the full 6-16 band.

G5 should build visible, fair choices on readable layouts. The original batch used a mock 5.4-8.5 screen and an old S >= 2.2 screening margin; preserve it as historical evidence, not a production policy. Current work starts at 250 with family targets 10-13 and normal skilled 2.5-6, plus Dennis's explicit minimum-2 fallback if really needed. Report comparable baseline and new-builder runs under the same current policy, then fallback supply separately. Keep all rejects and unknowns; do not change the bots, soften gates, or select a favorable seed batch to manufacture yield. Five unlabeled trace failures leave open whether some thresholds reject puzzles Dennis would like; no routine playtesting is required and no unsupported automatic relaxation is justified.

No C1/C2, slot assignment, fresh ACCEPT campaign or special-ablation acceptance was reached. The 60 CPU-minute-per-finished-level rule is unmeasured. No game board, main branch or Firebase record changed.
`;
}
function main() {
  const files = { runs: 'library/pipeline-runs.jsonl', gates: 'process-v1/e6-gates.jsonl', rejects: 'library/rejects.jsonl', curves: 'process-v1/e6-curves.jsonl' };
  const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
  const r = analyze(...Object.values(files).map(f => read(path.join(DIR, f))));
  r.sources = Object.fromEntries(Object.values(files).filter(f => fs.existsSync(path.join(DIR, f))).map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, f))).digest('hex')]));
  fs.writeFileSync(path.join(DIR, 'process-v1/e6-yield.json'), JSON.stringify(r, null, 2) + '\n');
  fs.writeFileSync(path.join(DIR, 'process-v1/e6-yield.md'), markdown(r));
  console.log(JSON.stringify({ builds: r.builds, libraryCandidates: r.libraryCandidates, cpuS: r.cpuS, supplyKill: r.supplyKill }));
}
if (require.main === module) main();
module.exports = { analyze, markdown };
