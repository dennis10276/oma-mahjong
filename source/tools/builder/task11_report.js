'use strict';
const fs = require('fs'), path = require('path'), M = require('../factory/meter.js'), P = require('./task11_plan.js'), S = require('./task10_study.js'), A = require('./task11_analyze.js');
const round = x => x == null ? '—' : Number(x.toFixed(3)).toString();
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
function rank(a) { const sorted = a.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x), out = []; for (let i = 0; i < sorted.length;) { let j = i + 1; while (j < sorted.length && sorted[j].x === sorted[i].x) j++; for (let k = i; k < j; k++) out[sorted[k].i] = (i + j - 1) / 2; i = j; } return out; }
function spearman(x, y) {
  const pairs = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)); if (pairs.length < 3) return null;
  const a = rank(pairs.map(p => p[0])), b = rank(pairs.map(p => p[1])), ax = mean(a), bx = mean(b);
  const cross = a.reduce((s, v, i) => s + (v - ax) * (b[i] - bx), 0), variance = Math.sqrt(a.reduce((s, v) => s + (v - ax) ** 2, 0) * b.reduce((s, v) => s + (v - bx) ** 2, 0)); return variance ? cross / variance : null;
}
function jsonFiles(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => P.read(path.join(dir, f))) : []; }
function profiles(root) {
  const rows = jsonFiles(path.join(root, 'profiles'));
  const bands = {};
  for (const band of ['easy', 'middle', 'hard']) {
    const b = rows.filter(r => r.band === band), group = { boards: b.length, stories: [...new Set(b.map(r => r.story))], structure: {}, profiles: {} };
    for (const field of ['way', 'clockDepth', 'maxKeyDistance', 'locks', 'iceTiles', 'necessary', 'realDecisionPoints', 'losingOptionShare', 'meanWinningOptions', 'hiddenOnDig', 'keysShownAtStart', 'movesUntilBothKeysShow']) group.structure[field] = A.median(b.filter(r => !['keysShownAtStart', 'movesUntilBothKeysShow'].includes(field) || r.structure.hasKeys).map(r => r.structure[field]));
    group.keyVisibility = A.countBy(b, r => r.structure.hasKeys ? r.structure.keysShownAtStart : 'no keys');
    for (const label of ['family', 'planner']) {
      const ps = b.map(r => r.profiles.find(p => p.profile === (label === 'family' ? 'family' : r.preferredPlanner)));
      const commits = ps.flatMap(p => p.forkChances), attempts = ps.flatMap(p => p.attemptProfiles), errors = attempts.filter(a => a.firstError && !a.recovery);
      group.profiles[label] = { sampledAttempts: attempts.length, sampledLosses: attempts.filter(a => !a.win && !a.censored).length, provedFirstErrors: errors.length,
        errorKinds: A.countBy(errors.map(a => a.firstError), 'kind'), medianErrorMove: A.median(ps.map(p => p.medianFirstErrorMove)),
        medianDelayAfterError: A.median(ps.map(p => p.medianDelayAfterError)), medianSurvivalDepth: A.median(ps.map(p => p.medianProvenSurvivalDepth)),
        medianForksPerAttempt: A.median(b.map(r => A.median(r.profiles.find(p => p.profile === (label === 'family' ? 'family' : r.preferredPlanner)).attemptProfiles.map(a => a.beforeClockForks)))),
        knownErrorShare: A.share(ps.reduce((n, p) => n + p.knownFirstErrors, 0), ps.reduce((n, p) => n + p.provedFirstErrors, 0)),
        errorsWithKnownWinningOption: ps.reduce((n, p) => n + p.withKnownWinningOption, 0), repeatedKnownErrors: ps.reduce((n, p) => n + p.repeatedKnownLosingMove, 0),
        empiricalLosingCommitChance: A.share(commits.reduce((n, f) => n + f.losingPicks, 0), commits.reduce((n, f) => n + f.knownOutcomes, 0)),
        medianBoardLosingCommitChance: A.median(ps.map(p => A.share(p.forkChances.reduce((n, f) => n + f.losingPicks, 0), p.forkChances.reduce((n, f) => n + f.knownOutcomes, 0)))),
        engineMismatches: ps.reduce((n, p) => n + p.engineMismatches, 0), recoveries: ps.reduce((n, p) => n + p.recoveries, 0), unknownChosen: ps.reduce((n, p) => n + p.unknownChosen, 0),
        taps: ps.reduce((n, p) => n + p.taps, 0), peeks: ps.reduce((n, p) => n + p.peeks, 0) };
    }
    bands[band] = group;
  }
  const correlation = {};
  for (const f of ['way', 'clockDepth', 'maxKeyDistance', 'necessary', 'realDecisionPoints', 'losingOptionShare', 'hiddenOnDig', 'keysShownAtStart', 'movesUntilBothKeysShow']) correlation[f] = spearman(rows.map(r => ['keysShownAtStart', 'movesUntilBothKeysShow'].includes(f) && !r.structure.hasKeys ? null : r.structure[f]), rows.map(r => r.fullRatings.family.exp));
  const summary = { rows: rows.length, bands, correlation, note: 'Board medians keep capped campaigns from dominating descriptions. Empirical pick frequencies include repeated retries; these are not independent policy probabilities. Real forks require both a proved winning and a proved losing removal action. Unknowns and recovery/equivalence failures are explicit. Planner summaries use the style winning its earlier full40+40 rating, never the better sampled prefix.' };
  P.save(root, 'profile-summary.json', summary);
  const lines = ['# Where the bots lose', '', `${rows.length}/60 boards scored. ${summary.note}`, '',
    '| Band | boards | route length | real forks on stored way | known losing-option share | maximum key distance | hidden dig tiles |', '|---|---:|---:|---:|---:|---:|---:|'];
  for (const [b, g] of Object.entries(bands)) { const s = g.structure; lines.push(`| ${b} | ${g.boards} | ${round(s.way)} | ${round(s.realDecisionPoints)} | ${round(s.losingOptionShare)} | ${round(s.maxKeyDistance)} | ${round(s.hiddenOnDig)} |`); }
  lines.push('', '| Band / player | sampled losses / attempts | proved first errors | median error removal move | delay to terminal | empirical losing commitment at a live fork | known-picture error share | repeated known errors | engine mismatches / recoveries |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [b, g] of Object.entries(bands)) for (const [p, s] of Object.entries(g.profiles)) lines.push(`| ${b} / ${p} | ${s.sampledLosses}/${s.sampledAttempts} | ${s.provedFirstErrors} | ${round(s.medianErrorMove)} | ${round(s.medianDelayAfterError)} | ${round(s.empiricalLosingCommitChance)} | ${round(s.knownErrorShare)} | ${s.repeatedKnownErrors} | ${s.engineMismatches}/${s.recoveries} |`);
  lines.push('', '## Per board', '', 'Each profile file has the short loss story, both planner styles, every observed live-fork frequency with its denominator, first errors by attempt and memory coverage. The compressed engine-detail files retain every scored physical tap and every legal-action proof.', '');
  for (const r of rows) { lines.push(`### ${r.id}`, '', `Family ${round(r.fullRatings.family.exp)}, skilled ${round(r.fullRatings.skilled.exp)}. ${r.story}, ${r.shape}; ${r.structure.way} clock moves, spare${r.structure.spare}; ${r.structure.realDecisionPoints} proved live forks on the stored route. Keys showing at start: ${r.structure.hasKeys ? r.structure.keysShownAtStart : 'no keys'}; removal moves until both keys show: ${r.structure.movesUntilBothKeysShow ?? 'not applicable/unresolved'}; before the clock: ${r.structure.bothShownBeforeClock ?? 'not applicable'}.`, ''); for (const p of r.profiles) lines.push(p.story, ''); }
  lines.push('## Interpretation limits', '',
    'A pure peek changes information and openPeek but removes no tile and spends no clock move. It is scored as the same physical state, not as the hypothetical take that might be a fatal fourth tile. A later automatic peek pair is checked as a two-tile action.', '',
    'The engine knows every face. A winning proof does not show that the player had enough information to find that move. Known winning options, hidden pictures and same-picture/role alternatives with opposite results are recorded separately; those alternatives still occupy different geometric positions.', '',
    'Once a proved losing choice has been made, later all-losing states are not new avoidable errors. The requested loose decision definition and genuinely mixed win/loss forks are both retained. Survival depth is the longest bounded continuation after a proved loss, capped at12; capped/budget-limited depths are lower bounds, not exact causal lookahead depths. Actual delay to the observed terminal loss is separate.', '',
    'Later attempts come only from campaigns that have not yet won. Comparisons across attempts are descriptive and subject to survivor selection; changed choices are not a controlled causal memory ablation. Two campaigns per style are a diagnostic sample, not a new rating or a human forecast.', '');
  fs.writeFileSync(path.join(root, 'ERROR-PROFILES.md'), lines.join('\n')); return summary;
}
function ladder(root) {
  const data = S.collect(path.join(root, 'ladder-readable')), structures = new Map(jsonFiles(path.join(root, 'structures')).map(r => [r.boardKey, r]));
  const pairSpecs = P.read(path.join(root, 'selection-plan.json')).ladder.pairs.slice();
  if (fs.existsSync(path.join(root, 'ladder-fallback/plan.json'))) {
    const extra = S.collect(path.join(root, 'ladder-fallback')); data.boards.push(...extra.boards); for (const [k, v] of extra.records) data.records.set(k, v); pairSpecs.push(extra.protocol.pair);
  }
  const rows = data.boards.map(b => ({ id: b.id, cell: b.cell, fail: b.fail || null, readable: b.readable ?? null, boardKey: b.design ? M.boardKey(b.design) : null,
    actualWay: b.card?.clock.fewestMoves ?? null, family: b.family, skilled: b.skilled, card: b.card, structure: structures.get(b.design ? M.boardKey(b.design) : '')?.structure || null }));
  const unique = [...new Map(rows.filter(r => !r.fail && r.family && r.skilled).map(r => [r.boardKey, r])).values()], pairs = [];
  for (const pair of pairSpecs) {
    const x = unique.filter(r => r.cell.story === pair.story && r.cell.layout === pair.layout), out = { ...pair, ratedPhysicalBoards: x.length, spares: {}, adjacentSeedChanges: [] };
    for (const spare of [1, 2]) {
      const group = x.filter(r => r.cell.spare === spare), points = [...new Set(group.map(r => r.actualWay))].sort((a, b) => a - b).map(way => {
        const bs = group.filter(r => r.actualWay === way); return { way, n: bs.length, family: A.median(bs.map(r => r.family.exp)), skilled: A.median(bs.map(r => r.skilled.exp)),
          familySpread: Math.max(...bs.map(r => r.family.exp)) - Math.min(...bs.map(r => r.family.exp)), ids: bs.map(r => r.id) };
      });
      const steps = points.slice(1).map((p, i) => ({ from: points[i].way, to: p.way, gap: p.way - points[i].way, familyDelta: p.family - points[i].family, skilledDelta: p.skilled - points[i].skilled }));
      const cliffs = steps.filter(s => s.gap === 1 && Math.abs(s.familyDelta) > 5), direction = A.share(steps.filter(s => s.familyDelta >= 0).length, steps.length);
      out.spares[spare] = { points, steps, cliffs, nondecreasingShare: direction, verdict: cliffs.length ? 'cliff in adjacent actual-way medians' : points.length >= 4 && direction >= 0.8 ? 'observed gradual nondecreasing slope' : 'no reliable monotone slope' };
      for (const seed of [1, 2, 3]) {
        const bs = rows.filter(r => !r.fail && r.family && r.skilled && r.cell.story === pair.story && r.cell.layout === pair.layout && r.cell.seed === seed && r.cell.spare === spare).sort((a, b) => a.cell.way - b.cell.way);
        for (let i = 1; i < bs.length; i++) {
          const a = bs[i - 1], b = bs[i]; if (b.cell.way - a.cell.way !== 1) continue;
          const change = { seed, spare, from: a.id, to: b.id, requested: [a.cell.way, b.cell.way], actual: [a.actualWay, b.actualWay], sameBoard: a.boardKey === b.boardKey,
            familyDelta: b.family.exp - a.family.exp, skilledDelta: b.skilled.exp - a.skilled.exp, companions: {} };
          for (const f of ['maxKeyDistance', 'clockDepth', 'locks', 'iceTiles', 'dig', 'necessary', 'trayThree', 'realDecisionPoints', 'routeSpanX', 'routeSpanY', 'keysShownAtStart', 'movesUntilBothKeysShow']) change.companions[f] = a.structure && b.structure ? [a.structure[f], b.structure[f]] : null;
          out.adjacentSeedChanges.push(change);
        }
      }
    }
    pairs.push(out);
  }
  const summary = { requests: rows.length, constructed: rows.filter(r => r.card).length, readableRequests: rows.filter(r => !r.fail).length, ratedRequests: rows.filter(r => r.family && r.skilled && !r.fail).length,
    physicalBoards: unique.length, records: data.records.size, invalid: [...data.records.values()].filter(r => !r.valid).length, pairs, rows,
    inBothBands: unique.filter(r => r.family.exp >= 10 && r.family.exp <= 13 && r.skilled.exp >= 2.5 && r.skilled.exp <= 6),
    note: 'Full family4711+18427,40 campaigns each; standard planner,40 per style. No shortened scores. Actual way is within±1 of the requested way; identical physical boards from neighboring requests are counted once in medians. Across requested lengths the builder may change clock/key placement and the matching pattern: this is an observed structural ladder, not a pure causal intervention on one path length. Spare1/2 alone is an exact clock-only pair.' };
  P.save(root, 'ladder-summary.json', summary);
  const lines = ['# Readable way ladder', '', `${summary.ratedRequests}/${summary.readableRequests} readable requests fully rated; ${summary.physicalBoards} unique rated boards; ${summary.invalid} invalid measurements. ${summary.note}`, '',
    '| Story/layout | spare | actual way | unique boards | median family | family spread | median skilled |', '|---|---:|---:|---:|---:|---:|---:|'];
  for (const p of pairs) for (const [spare, s] of Object.entries(p.spares)) {
    for (const x of s.points) lines.push(`| ${p.story}/${p.shape} | ${spare} | ${x.way} | ${x.n} | ${round(x.family)} | ${round(x.familySpread)} | ${round(x.skilled)} |`);
    lines.push(`| ${p.story}/${p.shape} | ${spare} | ${s.verdict} | | | | |`);
  }
  lines.push('', '## Large changes at neighboring requested lengths', '', 'These changes may also change actual length by0 or2. Companion columns expose changed geometry and route pressure; they do not prove a unique cause.', '',
    '| Story/layout | seed / spare | requested | actual | family change | skilled change | key distance | locks | necessary | real forks |', '|---|---|---|---|---:|---:|---|---|---|---|');
  for (const p of pairs) for (const c of p.adjacentSeedChanges.filter(c => !c.sameBoard && Math.abs(c.familyDelta) > 5)) lines.push(`| ${p.story}/${p.shape} | ${c.seed}/${c.spare} | ${c.requested.join('→')} | ${c.actual.join('→')} | ${round(c.familyDelta)} | ${round(c.skilledDelta)} | ${c.companions.maxKeyDistance?.map(round).join('→') || 'unscored'} | ${c.companions.locks?.join('→') || 'unscored'} | ${c.companions.necessary?.join('→') || 'unscored'} | ${c.companions.realDecisionPoints?.join('→') || 'unscored'} |`);
  lines.push('', 'Every failed construction/readability screen, missing measurement, repeated seed, exact card and structural comparison is retained in ladder-summary.json and the frozen plans. A20 is the capped yardstick, not an exact human attempt count.', '');
  fs.writeFileSync(path.join(root, 'WAY-LADDER.md'), lines.join('\n')); return summary;
}
if (require.main === module) { const root = path.resolve(process.argv[2]); if (process.argv[3] === 'profiles') console.log(profiles(root).rows); else console.log(ladder(root).physicalBoards); }
module.exports = { profiles, ladder, spearman };
