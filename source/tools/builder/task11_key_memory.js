'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), E = require('./engine.js'), K = require('./task11_keys.js'), P = require('./task11_plan.js'), A = require('./task11_analyze.js');
function analyze(board, raw) {
  const g = E.game(board.design), keys = board.design.obst.keys, opportunities = [], attemptSightings = [];
  function sightings(a) {
    const seen = new Map(); for (const d of a.decisions.concat(a.terminal)) for (const k of keys) if (d.state.alive[k] && d.observed.roles[k] === 'key' && !seen.has(k)) seen.set(k, d.state.moves);
    return seen;
  }
  for (const [campaign, c] of raw.result.results.entries()) {
    for (let t = 0; t < c.attempts.length; t++) {
      const a = c.attempts[t], seen = sightings(a); attemptSightings.push({ campaign, attempt: a.attempt, win: a.win, keysSeen: [...seen.keys()], revealAt: Object.fromEntries(seen) });
      const next = c.attempts[t + 1]; if (!next || !seen.size) continue;
      const targets = [...seen.keys()], corridor = K.coverCorridor(g, targets), frames = next.decisions.concat(next.terminal), nextSeen = sightings(next);
      let showIndex = frames.findIndex(d => targets.some(k => d.state.alive[k] && d.observed.roles[k] === 'key'));
      const reexposed = showIndex >= 0; if (!reexposed) showIndex = frames.length - 1;
      const removed = [], commits = [];
      for (let k = 0; k < showIndex; k++) {
        const a = frames[k].state, b = frames[k + 1].state, off = a.alive.flatMap((v, i) => v && !b.alive[i] ? [i] : []);
        if (off.length) commits.push(off); removed.push(...off);
      }
      const first = commits[0] || [], retained = targets.filter(k => frames[0].remembered?.[k] === g.faces[k]), matching = targets.filter(k => nextSeen.has(k));
      opportunities.push({ campaign, sawOnTry: a.attempt, nextTry: next.attempt, targets, previousRevealAt: Object.fromEntries(seen), nextRevealAt: Object.fromEntries(nextSeen),
        reexposed, nextWin: next.win, nextLoss: next.why, firstRemoved: first, firstCommitTowardCover: first.some(i => corridor.has(i)), firstCommitOnlyCover: first.length > 0 && first.every(i => corridor.has(i)),
        strictStraightCoverDig: reexposed && removed.every(i => corridor.has(i)), removalsBeforeReexposureOrTerminal: removed.length,
        offCoverRemovals: removed.filter(i => !corridor.has(i)).length, coverProgressShare: A.share(removed.filter(i => corridor.has(i)).length, removed.length),
        nextReexposureMoves: reexposed ? frames[showIndex].state.moves : null,
        medianSameKeyRevealChange: A.median(matching.map(k => nextSeen.get(k) - seen.get(k))),
        keyPicturesRetained: retained.length, keysPreviouslyObserved: targets.length,
        pictureRecallShare: retained.length / targets.length, pictureRecallIndices: retained,
        corridor: [...corridor], nextPrefixTaps: next.actions.slice(0, showIndex) });
    }
  }
  return { id: board.id, boardKey: M.boardKey(board.design), fullFamily: board.family.exp, fullSkilled: board.skilled.exp, story: board.brief.story, features: K.features(board.design),
    campaigns: raw.result.results.length, sampleWonOn: raw.result.results.map(c => c.wonOn), attempts: attemptSightings.length,
    attemptsSeeingAnyKey: attemptSightings.filter(a => a.keysSeen.length).length, eligibleTransitions: opportunities.length,
    firstCommitTowardCover: opportunities.filter(x => x.firstCommitTowardCover).length, strictStraightCoverDig: opportunities.filter(x => x.strictStraightCoverDig).length,
    nextTryReexposed: opportunities.filter(x => x.reexposed).length, pictureRecallShare: A.share(opportunities.reduce((n, x) => n + x.keyPicturesRetained, 0), opportunities.reduce((n, x) => n + x.keysPreviouslyObserved, 0)),
    medianReexposureMoves: A.median(opportunities.map(x => x.nextReexposureMoves)), medianRevealChange: A.median(opportunities.map(x => x.medianSameKeyRevealChange)), opportunities, attemptSightings };
}
function report(root) {
  const plan = P.read(path.join(root, 'key-selection-plan.json')), profiles = require('../sim/refit/human_release.js').profiles;
  const rows = plan.boards.map(b => {
    const id = M.digest(['key-memory', b.id, 'family']), meta = P.read(path.join(root, 'key-trace-index', id + '.json'));
    const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, meta.rawFile))));
    if (!meta.valid || M.digest(raw) !== meta.rawHash || raw.boardKey !== M.boardKey(b.design) || raw.bot !== P.read(path.join(root, 'key-capture-protocol.json')).bot || raw.options.runs !== 6) throw Error('Missing or changed key-memory traces');
    return analyze(b, raw);
  });
  const all = rows.flatMap(r => r.opportunities), result = { boards: rows.length, campaigns: rows.reduce((n, r) => n + r.campaigns, 0),
    eligibleTransitions: all.length, boardsWithTransitions: rows.filter(r => r.eligibleTransitions).length,
    firstCommitTowardCover: all.filter(x => x.firstCommitTowardCover).length, strictStraightCoverDig: all.filter(x => x.strictStraightCoverDig).length,
    nextTryReexposed: all.filter(x => x.reexposed).length,
    pictureRecallShare: A.share(all.reduce((n, x) => n + x.keyPicturesRetained, 0), all.reduce((n, x) => n + x.keysPreviouslyObserved, 0)),
    familyKeyIdentityMemoryEnabled: profiles.family.retryKeyIdentityMemory === 1, skilledKeyIdentityMemoryEnabled: profiles.Dennis.retryKeyIdentityMemory === 1,
    note: 'An opportunity is an actual observed key glyph in a lost try with a subsequent try in the same campaign. Picture recall and key identity are separate. Toward-cover means the first removal touches that observed key or its geometric cover ancestors. Strict straight means no removal outside that cover corridor before a previously seen key is re-exposed. This deliberately strict operational definition can penalize useful side clearance or tray relief; it is not a proof of shortest optimal play. Never seeing a key provides no memory opportunity. No bot or profile changed.', rows };
  P.save(root, 'key-memory.json', result);
  const pct = (n, d) => d && n != null ? (100 * n / d).toFixed(1) + '%' : 'unobserved';
  const lines = ['# Hidden-key memory check', '', `${result.boards} boards, ${result.campaigns} sampled family campaigns; ${result.eligibleTransitions} adjacent-try opportunities on ${result.boardsWithTransitions} boards.`, '', result.note, '',
    `First commitment toward the previously observed key's cover: ${result.firstCommitTowardCover}/${all.length} (${pct(result.firstCommitTowardCover, all.length)}). Strict straight cover dig: ${result.strictStraightCoverDig}/${all.length} (${pct(result.strictStraightCoverDig, all.length)}). The next try re-exposes a previously seen key in ${result.nextTryReexposed}/${all.length}. Retained key-picture share at the next try's first observation: ${pct(result.pictureRecallShare, 1)}.`, '',
    `Released family retryKeyIdentityMemory: ${result.familyKeyIdentityMemoryEnabled}; skilled: ${result.skilledKeyIdentityMemoryEnabled}.`, '',
    'Source: human_factory_controller.js beginAttempt resets roles every try. Only the optional createKeyIdentityMemory retains observed static key glyph identities. The released family profile does not enable it, although pictures may survive with retryRetention0.65. decide uses prior key targets only when that memory exists; route keyTiles/needLeft also derives key roles from the current attempt. Pictures remembered at the right location therefore do not by themselves preserve the fact that the tile is a key.', '',
    '| Board | full family / skilled | next-try opportunities | first commit toward cover | strict straight | re-exposed | key picture recalled | median reveal-move change |', '|---|---|---:|---:|---:|---:|---:|---:|'];
  for (const r of rows) lines.push(`| ${r.id} | ${r.fullFamily}/${r.fullSkilled} | ${r.eligibleTransitions} | ${r.firstCommitTowardCover} | ${r.strictStraightCoverDig} | ${r.nextTryReexposed} | ${pct(r.pictureRecallShare, 1)} | ${r.medianRevealChange ?? 'unobserved'} |`);
  lines.push('', '## Scope of the conclusion and proposed repair', '',
    'First-try uncertainty about a genuinely hidden key is real. Continued wandering after its glyph was observed also has a concrete family-bot memory limitation: its static key identity is discarded on retry, independently of retained picture memory. The opportunity counts above measure behavior with the existing bot, not a rating for a repaired bot. A20 must not be interpreted as evidence that a person would also keep failing20 times.', '',
    'The proposed fix is to enable and validate the existing observed-key identity memory for the family, and ensure the clock/key access heuristics consume those remembered targets when their glyphs are covered again. Facts must come only from an actually observed key glyph, never from the engine obstacle list or unseen keys. Check keyTiles/needLeft as well as knownKeys/priorKeyTargets. This would be a changed behavioral bot requiring a new version, cache invalidation and recalibration; it is not a zero-drift speed optimization. No fix or counterfactual rating was applied here.', '',
    'Affected evidence boards are listed above; key-memory.json retains every adjacent-try comparison and prefix. No claim is made that all their full ratings would fall, or by how many tries. Both old and proposed policy paths need a controlled follow-up before changing the yardstick.', '');
  fs.writeFileSync(path.join(root, 'KEY-MEMORY.md'), lines.join('\n')); return result;
}
if (require.main === module) console.log(report(path.resolve(process.argv[2])).eligibleTransitions);
module.exports = { analyze, report };
