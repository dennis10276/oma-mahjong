'use strict';
const fs = require('fs'), path = require('path'), P = require('./task11_plan.js'), A = require('./task11_analyze.js');
const SOURCE = path.resolve(__dirname, '../..'), BASE = path.join(SOURCE, 'build/why-hard-v1'), OUT = path.join(SOURCE, 'analysis/builder/why-hard-v1'), EXTERNAL = path.resolve(SOURCE, '../../codex-tasks/results/why-hard-v1');
const rounded = (v, n = 2) => Number(v.toFixed(n)), pct = (n, d) => (100 * n / d).toFixed(1) + '%';
function pairedSpare(summary) {
  return summary.pairs.map(pair => {
    const cells = new Map();
    for (const r of summary.rows.filter(r => !r.fail && r.family && r.cell.story === pair.story && r.cell.layout === pair.layout)) {
      const key = r.cell.way + '/' + r.cell.seed, a = cells.get(key) || {}; a[r.cell.spare] = r; cells.set(key, a);
    }
    const pairs = [...cells.values()].filter(a => a[1] && a[2]);
    return { story: pair.story, n: pairs.length, medianFamilyChange: A.median(pairs.map(a => a[2].family.exp - a[1].family.exp)) };
  });
}
function run() {
  const fit = P.read(path.join(BASE, 'fit/summary.json')), marker = P.read(path.join(BASE, 'post-rating-phases.json'));
  const candidate = path.join(SOURCE, 'build/why-hard-key-memory'), rr = P.read(path.join(candidate, 'rerating-summary.json'));
  if (!fit.accepted || !marker.regressionSuitePassed || !marker.keyAuditComplete || !rr.complete || rr.invalid) throw Error('Required final phases are not complete');
  const memory = P.read(path.join(candidate, 'memory-comparison.json')), oldL = P.read(path.join(SOURCE, 'build/why-hard-v3/ladder-summary.json'));
  const newL = P.read(path.join(SOURCE, 'build/why-hard-v3-candidate/ladder-summary.json')), profiles = P.read(path.join(BASE, 'profile-summary.json'));
  const openings = P.read(path.join(BASE, 'visible-key-opening-summary.json')), incidental = P.read(path.join(SOURCE, 'build/why-hard-v3/incidental-candidate.json'));
  const preview = P.read(path.join(BASE, 'preview-evidence.json')); if (preview.errors.length || preview.rows.length !== 3 || preview.rows.some(r => !r.storedRouteWins || !r.fitsPhone)) throw Error('Example verification incomplete');
  if (oldL.physicalBoards !== 148 || newL.physicalBoards !== 148 || oldL.invalid || newL.invalid || newL.records !== 444 || incidental.originalInBothBands) throw Error('Ladder/qualification needs attention');
  const cliffs = l => l.pairs.filter(p => Object.values(p.spares).some(s => s.cliffs.length)).length;
  const off = rr.rows.filter(r => r.group === 'kept20' && Math.abs(r.candidate.family - r.target) > 1 + 1e-9).map(r => r.level);
  const easy = profiles.bands.easy.profiles.family, hard = profiles.bands.hard.profiles.family, a = memory.reference, b = memory.candidate;
  if (rr.planner.maxAbsoluteDriftFromReferenceBot > 1e-9) throw Error('Investigate planner drift before handback');
  const summary = ['# Task 11 done', '',
    'Branch: `wip/codex-why-hard`. Complete evidence is beside this summary and in `codex-tasks/results/why-hard-v1/`.', '',
    `The family bot makes its first proved mistake earlier on brutal boards (typical removal move ${hard.medianErrorMove}, versus ${easy.medianErrorMove} on easy boards). The loss arrives later: another ${hard.medianDelayAfterError} tile removals versus ${easy.medianDelayAfterError}. Route length and fork counts barely separate the bands. Many mistakes take an attractive free pair too early. These are real traps, but a capped 20 is not a human forecast.`, '',
    `The family bot also forgot that a previously seen tile was a key. The separate key-memory version fixes that decision knowledge and passes all inherited human-fit checks. Live family error changes only 2.081→2.079; planner live 1.009 and lab24 1.945 are unchanged. On the same 10 hidden-key boards, first commitments toward an observed key's cover are ${a.firstTowardCover}/${a.opportunities} (${pct(a.firstTowardCover, a.opportunities)}) before and ${b.firstTowardCover}/${b.opportunities} (${pct(b.firstTowardCover, b.opportunities)}) after. Changed policies have different retry opportunities, so these shares alone are not a causal comparison.`, '',
    `The kept batch has ${rr.kept.candidateWithinOne}/20 levels within ±1 of its frozen Task9/10 curve, versus ${rr.kept.referenceWithinOne}/20 before. Off-curve now: ${off.join(', ')}. Exact boards, gold pairs and Dennis's approved 5/4-try results are preserved. The new bot stays an explicit offline option for Claude's review.`, '',
    `Way length is an unreliable difficulty control: ${cliffs(oldL)}/6 reference pairs and ${cliffs(newL)}/6 new-bot pairs show jumps larger than 5 tries between neighboring actual lengths. Longer requests also move keys, clock and matching patterns. The builder should control:`, '',
    '1. **What the player can see and remember:** opening key visibility and when both keys become visible. Hidden-key uncertainty and memory failures dominate many brutal ratings.',
    '2. **Exact deadline and tray pressure:** keep actual minimum-plus-spare proofs. A clock-only spare change is a useful smaller adjustment; changing route length can replace the puzzle.',
    '3. **How a trap communicates its consequence:** deliberately place tempting pairs against a readable safe plan, and control the delay before a bad choice is punished. Counting traps or uniquely safe states alone does not separate easy and brutal boards.', '',
    `No missing slot is claimed. ${incidental.bothBands} new-bot ladder boards reach both broad bands; none passes originality. Three playable examples with exact move numbers are in reference/EXAMPLES.md. See BUILDER-CONTROLS.md, candidate/RERATING.md and candidate/MEMORY-COMPARISON.md for the supporting comparisons.`, ''];
  const spareOld = pairedSpare(oldL), spareNew = pairedSpare(newL);
  const controls = ['# Builder controls supported by Task11', '',
    'These are design recommendations for Claude, not newly calibrated promises of a particular human try count. Mandatory readability and keysShown are already Claude\'s builder v3 changes.', '',
    '## 1. Objective visibility and reveal timing', '',
    'Expose opening actual key glyph count together with route moves until both have appeared. The reference full Task10 medians are19.77/13.00/4.04 for0/1/2 opening key glyphs after excluding all actually frozen keys. This is association, not a one-variable causal effect. Claude\'s keysShown requests also rebuild placements. Use the new bot and paired re-rating before trusting an old20 as human difficulty.', '',
    `Across all117 non-frozen Task10 hidden/partly-hidden-key boards, mean new-minus-old family change is${rounded(rr.hidden.meanFamilyChange, 3)} tries (${rr.hidden.improved} improved,${rr.hidden.worsened} worsened). The exact rows and both family streams are in candidate/rerating-summary.json. The same10-board memory audit preserves observed-fact eligibility and separates key identity from picture retention.`, '',
    '## 2. Actual spare, with verified pressure', '',
    'Keep the exact fewest legal clock moves and spare as authored controls. Spare1→2 changes only clock.n; recompute forced pressure instead of copying its old claim. It makes a smaller adjustment than rebuilding a longer way. These medians use all matched requested-way/seed cells, not only in-band boards.', '',
    '| Story | exact spare pairs | reference median family change | new-bot median family change |', '|---|---:|---:|---:|'];
  for (const r of spareOld) controls.push(`| ${r.story} | ${r.n} | ${rounded(r.medianFamilyChange, 3)} | ${rounded(spareNew.find(n => n.story === r.story).medianFamilyChange, 3)} |`);
  controls.push('', 'Way length is not isolated: clock/key placement, necessary holders, locks, matching and route shape can change. The ladder tables retain every large jump\'s structural companions. In one iceLockClock seed, the actual way stays11 while family changes18.59 tries; length cannot explain that difference.', '',
    '## 3. Readable temptation and consequence delay', '',
    `Compose a tempting free pair with the clock/key/ice route on purpose, and preserve a visible reason for the safer choice. On the brutal reference sample, 400/928 first errors take a free face-up pair too early; 928/928 first errors have a known-picture winning alternative. Knowing a picture does not mean understanding the route. Typical first error is at move ${hard.medianErrorMove}, terminal loss another ${hard.medianDelayAfterError} removals later. Record that delay as a design diagnostic; investigate long-delayed punishment before calling a level fun.`, '',
    `The all16 Task10 brutal both-key-visible opening refinement finds${openings.exactlyOneWinningOpening} uniquely winning openings; every board already has at least2 proved winners. The5 selected brutal both-visible boards have3–9 proved uniquely safe states later, but all11 comparable easy boards also have such states (median4 easy versus5 brutal). Their presence alone is not the cause. Claude's separate newly built v3 one-of16-actions example is a different puzzle and remains compatible with these results.`, '',
    'For fast construction: prove readability, objective reveal, exact spare/forced pressure and a purposeful trap before a full bot run. Preserve original silhouettes and provenance; do not turn this canonical-layout study into smaller or reskinned slot fillers. New-version speed screens require calibration against the new outcomes; old bot thresholds are not automatically validated by these results.', '',
    '## Fixes and verification', '',
    '- New observed-key identity/controller policy, with a new profile, explicit meter version, distinct stable fingerprint, no candidate cache migration and342 valid inherited-fit measurements. Controller/fingerprint/non-migration tests pass. Protected G2 environment files are untouched.',
    '- Capture now executes the same explicit bot entry that its fingerprint declares. A worker test checks actual version/profile, not just the declared hash.',
    '- Key/main capture protocols have separate guarded filenames; a regression test covers coexistence and implementation drift.',
    '- A key cover on the stored winning route is no longer labelled a detour merely because a search hint omitted it.133 first-error labels corrected from saved states; original files, proof hashes and derivation retained. A key-cover fixture covers it.',
    '- Opening checkpoints hash variant IDs so Windows-invalid colons and path punctuation cannot break saving; deterministic safe-filename regression test.',
    '- Re-rating distinguishes approved human skilled wins from bot estimates. A regression test prevents comparing stored human5 with reference planner5.15 as if both were bot scores.', '',
    '- Delay after an error now excludes the erroneous action itself (one take or a two-tile automatic pair); synthetic physical traces cover immediate pair loss and a later clock loss. The original pre-error span, backups and correction hashes are retained.', '',
    'The complete builder/factory/candidate regression output is factory-tests.log. Three phone previews and all three actual-game stored solutions passed. No published game, level table, Firebase or release changed.', '');
  const readme = ['# Task11 done', '', 'Branch: `wip/codex-why-hard`.', '',
    'Start with summary-for-dennis.md and BUILDER-CONTROLS.md.', '',
    '- reference/:60-board error study, every brutal board\'s human/bot interpretation, ten-board memory audit, refined visible-key openings,342 full fit measurements on171 exact benchmark cases, raw diagnostic traces, proof outcomes and numbered examples.',
    '- v3-reference/:primary six-pair readable builder v3 ladder, all252 requests/failures,210 readable outputs,148 physical boards and444 full current-fingerprint cache hits. Exact witnesses/structural inputs verified before proof reuse.',
    '- candidate/:284 physical boards,852 full new-version measurements; kept20,117 hidden-key Task10 memberships, all210 readable ladder memberships; same-ten-board six-campaign memory follow-up and before/after reports.',
    '- v3-candidate/:same exact v3 ladder with the new full ratings and figures. reference/ladder* retains the earlier v2 baseline and failed-pair fallback separately.',
    '- full-api-manifest.json:SHA256-addressed raw meter returns in the external results folder\'s full-api/. Actual capture settings are retained;16 reference kept search calls used tail capture. Raw diagnostic traces are separate and complete for their stated sample sizes.',
    '- factory-tests.log, RUNNING.md and manifest-sha256.json:verification, execution history and artifact checksums.', '',
    'The results-folder reference/playable-examples/ is a complete local game with one-based tile labels and local levels9001–9003. Serve that folder over local HTTP (for example python -m http.server 8087 --directory <folder>) and open localhost:8087. The supplied EXAMPLES.md distinguishes physical taps from removals and identifies the first proved mistake. All three previews fit390×820 and their full stored solutions win. External traffic/progress writes are blocked.', '',
    'The source entry human_bot_key_memory_v1.js remains an explicit candidate. Use createMeter({botVersion:"family-key-memory-v1"}) or HUMAN_BOT pointing to that entry. The released default is unchanged. Source creation-status metadata stays frozen to preserve the measured fingerprint; the completed fit report records validation. Claude reviews adoption. Approved human evidence on200/225 stays separate from planner estimates.', '',
    'Frozen plans and worker hashes are authoritative. The fit/meter-registry-amendment records the post-fit registry-only change without changing either bot fingerprint. Unknown engine outcomes remain unknown; depth caps are lower bounds, not exact lookahead requirements. Repeated retries are not independent human observations. A capped20 is not a human forecast. The top-level Part0 files and CHECKPOINT history are superseded by the complete folders above.', '',
    'No slot claimed; no puzzle built for missing slots. Existing20 designs/gold pairs and the published game table remain unchanged. No release or Firebase action.', ''];
  for (const dir of [OUT, EXTERNAL]) {
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'summary-for-dennis.md'), summary.join('\n'));
    fs.writeFileSync(path.join(dir, 'BUILDER-CONTROLS.md'), controls.join('\n')); fs.writeFileSync(path.join(dir, 'README.md'), readme.join('\n'));
    fs.copyFileSync(path.join(SOURCE, 'build/task11-tests.log'), path.join(dir, 'factory-tests.log'));
  }
  P.save(BASE, 'handback-summary.json', { created: new Date().toISOString(), keptWithinOne: rr.kept, hidden: rr.hidden, memory, referenceCliffPairs: cliffs(oldL), candidateCliffPairs: cliffs(newL), spareOld, spareNew, incidentalOriginal: incidental.originalInBothBands });
  return { kept: rr.kept, hidden: rr.hidden, referenceCliffs: cliffs(oldL), newCliffs: cliffs(newL) };
}
if (require.main === module) console.log(run());
module.exports = { run, pairedSpare };
