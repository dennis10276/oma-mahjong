'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), E = require('./engine.js'), M = require('../factory/meter.js'), F = require('./task11_physics.js');
const median = a => { a = a.filter(Number.isFinite).sort((a, b) => a - b); return a.length ? (a[(a.length - 1) >> 1] + a[a.length >> 1]) / 2 : null; };
const share = (n, d) => d ? n / d : null;
const countBy = (a, field) => a.reduce((out, x) => { const k = typeof field === 'function' ? field(x) : x[field]; out[k] = (out[k] || 0) + 1; return out; }, {});
function analyzer(board, budget) {
  const g = E.game(board.design), states = new Map(), records = [];
  function classify(s) {
    const key = F.stateKey(g, s); if (states.has(key)) return states.get(key);
    const options = E.classify(g, s, budget), value = { id: records.length, ...F.classifySummary(options), options,
      moves: s.moves, preClock: !s.clockTaken, alive: Array.from(s.alive), trayFaces: s.tray.map(i => g.faces[i]) };
    states.set(key, value); records.push(value); return value;
  }
  function known(remembered, i) { return remembered?.[i] === g.faces[i]; }
  function ambiguity(options, decision) {
    const groups = new Map();
    for (const o of options.filter(o => typeof o.move === 'number' && o.result !== 'unknown')) {
      const i = o.move, picture = decision.remembered?.[i] ?? decision.observed.pictures[i], role = decision.observed.roles[i];
      const key = JSON.stringify([picture, role, !!g.down[i]]), a = groups.get(key) || []; a.push(o); groups.set(key, a);
    }
    return [...groups.values()].filter(a => a.some(x => x.result === 'win') && a.some(x => x.result === 'lose')).map(a => a.map(x => ({ move: x.move, result: x.result })));
  }
  function trace(raw) {
    const attempts = [], forks = new Map(), moves = [], mismatches = [], traceErrors = [];
    for (const [campaign, c] of raw.result.results.entries()) {
      const priorErrorStates = new Set(), priorErrorMoves = new Set();
      for (const a of c.attempts) {
        const rows = [], seenForks = new Set(), requestedForks = new Set(); let firstError = null, recovery = false;
        for (const [k, d] of a.decisions.entries()) {
          const next = a.decisions[k + 1]?.state || a.terminal.state, s = F.state(g, d.state), cls = classify(s), ev = F.event(g, d.state, next, d.index, k === a.decisions.length - 1 ? a.why : null);
          const compatible = F.compareTransition(g, s, ev, next), choice = ev.move == null ? null : cls.options.find(o => F.same(o.move, ev.move));
          const chosenResult = !compatible ? 'unknown' : ev.kind === 'peek' ? cls.stateResult : choice?.result || 'unknown';
          const row = { campaign, attempt: a.attempt, tap: k + 1, removalMove: s.moves + 1, movesBefore: s.moves, state: cls.id, preClock: !s.clockTaken,
            event: ev.kind, index: d.index, move: ev.move, result: chosenResult, stateResult: cls.stateResult, legal: cls.legal, wins: cls.win, losses: cls.lose, unknown: cls.unknown,
            realFork: cls.realFork, requestedDecision: cls.requestedDecision, compatible, knownChoice: known(d.remembered, d.index),
            knownRouteShare: share((board.keep?.P || []).filter(i => known(d.remembered, i)).length, board.keep?.P?.length || 0),
            knownAliveShare: share(g.faces.filter((_, i) => s.alive[i] && known(d.remembered, i)).length, s.alive.reduce((a, b) => a + b, 0)),
            chosenVisible: d.observed.pictures[d.index] != null, kind: F.reason(g, s, ev.move, ev.kind),
            depth: choice?.depth ?? null, depthLowerBound: !!choice?.depthMin || choice?.depth >= budget.cap,
            sameAppearanceOppositeOutcomes: ambiguity(cls.options, d),
            knownWinningOptions: cls.options.filter(o => o.result === 'win' && (typeof o.move === 'number' ? known(d.remembered, o.move) : o.move.pair.every(i => known(d.remembered, i)))).length };
          rows.push(row); moves.push(row);
          if (!compatible) mismatches.push({ campaign, attempt: a.attempt, tap: k + 1, event: ev, before: d.state, after: next });
          if (cls.realFork && !s.clockTaken) seenForks.add(cls.id);
          if (cls.requestedDecision && !s.clockTaken) requestedForks.add(cls.id);
          if (cls.realFork && !s.clockTaken) {
            const f = forks.get(cls.id) || { state: cls.id, moves: s.moves, legal: cls.legal, win: cls.win, lose: cls.lose, unknown: cls.unknown, taps: 0, peeks: 0, commits: 0, knownOutcomes: 0, losingPicks: 0, firstTry: { n: 0, lose: 0 }, retries: { n: 0, lose: 0 } };
            f.taps++; if (ev.kind === 'peek') f.peeks++;
            else { f.commits++; if (chosenResult !== 'unknown') { f.knownOutcomes++; if (chosenResult === 'lose') f.losingPicks++; const bin = a.attempt === 1 ? f.firstTry : f.retries; bin.n++; if (chosenResult === 'lose') bin.lose++; } }
            forks.set(cls.id, f);
          }
          if (firstError && cls.stateResult === 'win') recovery = true;
          if (!firstError && compatible && ev.kind !== 'peek' && chosenResult === 'lose' && cls.stateResult === 'win') {
            firstError = { ...row, repeatedErrorState: priorErrorStates.has(cls.id), repeatedSameLosingMove: priorErrorMoves.has(cls.id + ':' + JSON.stringify(ev.move)),
              actualDelayToTerminal: a.terminal.state.moves - s.moves, terminalWhy: a.why,
              rememberedChoice: d.remembered[d.index], observedChoice: d.observed.pictures[d.index],
              prefixTaps: a.actions.slice(0, k + 1), remainingTaps: a.actions.slice(k + 1),
              before: d.state, known: d.remembered, observed: d.observed };
          }
        }
        if (firstError) { priorErrorStates.add(firstError.state); priorErrorMoves.add(firstError.state + ':' + JSON.stringify(firstError.move)); }
        if (recovery) traceErrors.push({ campaign, attempt: a.attempt, kind: 'Recovered from a proved losing state: engine/physical equivalence requires investigation' });
        attempts.push({ campaign, attempt: a.attempt, win: a.win, why: a.why, censored: a.censored, phase: a.phase, moves: a.terminal.state.moves, taps: a.actions.length,
          beforeClockForks: seenForks.size, requestedBeforeClockDecisionStates: requestedForks.size, firstError, recovery,
          knownRouteAtStart: rows[0]?.knownRouteShare ?? null, knownAliveAtStart: rows[0]?.knownAliveShare ?? null,
          unknownChosen: rows.filter(x => x.result === 'unknown').length, engineMismatches: rows.filter(x => !x.compatible).length });
      }
    }
    const firstErrors = attempts.filter(a => a.firstError && !a.recovery).map(a => a.firstError), losses = attempts.filter(a => !a.win && !a.censored);
    const byAttempt = Object.fromEntries([['first', a => a.attempt === 1], ['tries2to5', a => a.attempt >= 2 && a.attempt <= 5], ['tries6to20', a => a.attempt >= 6]].map(([name, filter]) => {
      const x = attempts.filter(filter); return [name, { n: x.length, wins: x.filter(a => a.win).length, errors: x.filter(a => a.firstError).length,
        medianKnownRoute: median(x.map(a => a.knownRouteAtStart)), medianKnownAlive: median(x.map(a => a.knownAliveAtStart)),
        repeatedKnownError: x.filter(a => a.firstError?.repeatedSameLosingMove && a.firstError.knownChoice).length }];
    }));
    const profile = { profile: raw.profile, valid: raw.result.valid, campaigns: raw.result.results.map(c => c.wonOn), attempts: attempts.length, losses: losses.length, wins: attempts.filter(a => a.win).length,
      taps: moves.length, peeks: moves.filter(r => r.event === 'peek').length, commits: moves.filter(r => r.event !== 'peek').length,
      provedFirstErrors: firstErrors.length, unknownChosen: moves.filter(r => r.result === 'unknown').length, engineMismatches: mismatches.length, recoveries: traceErrors.length,
      errorKinds: countBy(firstErrors, 'kind'), lossKinds: countBy(losses, 'why'), medianFirstErrorMove: median(firstErrors.map(r => r.removalMove)),
      medianFirstErrorTap: median(firstErrors.map(r => r.tap)), medianTerminalMove: median(losses.map(a => a.moves)), medianLossTry: median(losses.map(a => a.attempt)),
      medianDelayAfterError: median(firstErrors.map(r => r.actualDelayToTerminal)), medianProvenSurvivalDepth: median(firstErrors.map(r => r.depth)),
      knownFirstErrors: firstErrors.filter(r => r.knownChoice).length, withKnownWinningOption: firstErrors.filter(r => r.knownWinningOptions > 0).length,
      repeatedSameLosingMove: firstErrors.filter(r => r.repeatedSameLosingMove).length, repeatedKnownLosingMove: firstErrors.filter(r => r.repeatedSameLosingMove && r.knownChoice).length,
      firstTryVersusRetries: byAttempt, forkChances: [...forks.values()].map(f => ({ ...f, empiricalLosingCommitChance: share(f.losingPicks, f.knownOutcomes), empiricalLosingTapChance: share(f.losingPicks, f.taps) })), attemptProfiles: attempts };
    const most = Object.entries(profile.errorKinds).sort((a, b) => b[1] - a[1])[0];
    profile.story = `${raw.profile}: ${profile.losses} losses in ${profile.attempts} sampled attempts. ${profile.provedFirstErrors} have a proved first irreversible error; typical error at removal move ${profile.medianFirstErrorMove ?? 'unresolved'}, terminal loss at move ${profile.medianTerminalMove ?? 'none'}. ${most ? 'Most first errors: ' + most[0] + ' (' + most[1] + ').' : 'No proved first-error kind.'} ${profile.repeatedKnownLosingMove} repeat an earlier losing move with its picture remembered. Unknowns and engine mismatches remain separate.`;
    return { profile, moves, mismatches, traceErrors };
  }
  function witness() {
    let s = E.start(g); const out = [], p = board.design.solution;
    for (let k = 0; k < p.length && !s.clockTaken; k++) {
      const cls = classify(s), i = p[k], j = p[k + 1]; let move = i, next = E.step(g, s, move);
      const boundary = g.after && j === g.clock?.i && s.moves + 1 >= g.clock.n;
      if (!next || boundary) {
        const pair = E.legal(g, s).find(a => typeof a === 'object' && a.pair.includes(i) && a.pair.includes(j));
        if (!pair) throw Error('Stored witness cannot be mapped to engine actions'); move = pair; next = E.step(g, s, move); k++;
      }
      if (!next) throw Error('Stored witness loses');
      out.push({ state: cls.id, move, moves: s.moves, ...F.classifySummary(cls.options), options: cls.options }); s = next;
    }
    return { actionsToClock: out.length, removalMovesToClock: s.moves, requestedDecisionPoints: out.filter(x => x.requestedDecision).length,
      realDecisionPoints: out.filter(x => x.realFork).length, statesWithUnknown: out.filter(x => x.unknown).length,
      losingOptions: out.reduce((n, x) => n + x.lose, 0), winningOptions: out.reduce((n, x) => n + x.win, 0),
      ambiguityNote: 'These are omniscient engine removal actions on the stored winning witness. Repeated information-only peeks are separate physical taps.', states: out };
  }
  return { g, classify, trace, witness, records };
}
module.exports = { analyzer, median, share, countBy };
