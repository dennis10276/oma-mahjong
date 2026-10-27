'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { analyzeSurvival } = require('./public_survival_continuation.js');
const { createBranchAgenda } = require('./public_branch_agenda.js');
const { knownRecovery } = require('./public_known_recovery.js');
const { safeClosedInspection } = require('./public_safe_closed_inspection.js');
const { preferKnownRecovery } = require('./public_recovery_priority.js');

function survivalBranchSearch(primarySearch, options = {}) {
  assert.equal(typeof primarySearch, 'function');
  const nodes = options.nodes ?? 2048, milliseconds = options.milliseconds ?? 100, width = options.width ?? 3;
  assert(Number.isInteger(nodes) && nodes > 0);
  assert(Number.isFinite(milliseconds) && milliseconds > 0 && milliseconds <= 250);
  assert(Number.isInteger(width) && width > 0 && width <= 8);
  const backtracking = options.backtracking ?? false; assert.equal(typeof backtracking, 'boolean');
  let agenda = null, size = null, actualActions = null;
  const counters = { calls: 0, graphNodes: 0, forcedPlans: 0, vetoes: 0, knownWins: 0, unresolvedDeadReports: 0,
    incompleteProofs: 0, closedPositions: 0, maximumExtraMs: 0 };
  if (backtracking) Object.assign(counters, { backtrackingPlans: 0, backtrackingNaturalChoices: 0 });
  const validatePath = (game, state, path, deadline) => {
    const prefix = []; let position = state, removed = 0;
    for (const index of path) {
      if (Date.now() >= deadline) break;
      const allowed = legal(game, position);
      if (!allowed.free.includes(index)) break;
      const moved = advance(game, position, index);
      if (moved.uncertain) {
        if (safeClosedInspection(position, index, game.clock, !allowed.uncertain?.includes(index))) prefix.push(index);
        break;
      }
      if (moved.lost) break;
      prefix.push(index); position = moved.state; removed += moved.removed;
    }
    return { path: prefix, state: position, removed };
  };
  return {
    beginAttempt() { assert(actualActions === null); actualActions = []; agenda?.beginAttempt(); },
    acknowledge(index, accepted) { assert(actualActions); agenda?.acknowledge(index, accepted); if (accepted) actualActions.push(index); },
    finish(status) { assert(actualActions); agenda?.recordOutcome(actualActions, status); actualActions = null; },
    search(game, state, actions, settings = {}) {
      const began = Date.now(), primary = primarySearch(game, state, actions, settings);
      if (primary.knownWin || primary.safeClockExit) return primary;
      const deadline = Math.min(settings.deadline ?? Infinity, began + 1800, Date.now() + milliseconds);
      if (Date.now() >= deadline) return primary;
      if (agenda === null) { size = game.tiles.length; agenda = createBranchAgenda(size, { width, backtracking }); agenda.beginAttempt(); }
      assert.equal(game.tiles.length, size, 'A branch agenda belongs to one board and salt');
      const model = Object.fromEntries(['tiles', 'nb', 'rules', 'clock', 'publicFrontier', 'publicExposure',
        'publicRoleExposure', 'publicInformationExposure'].filter(field => game[field] !== undefined).map(field => [field, game[field]]));
      const rootPriority = agenda.priorities(state, actions, primary.index);
      const extraBegan = Date.now(), proof = analyzeSurvival(model, state, actions,
        { nodes, milliseconds, deadline, depthFirst: true, rootPriority });
      const finish = report => { counters.maximumExtraMs = Math.max(counters.maximumExtraMs, Date.now() - extraBegan); return report; };
      counters.calls++; counters.graphNodes += proof.nodes; counters.closedPositions += +proof.knownDead;
      if (!proof.propagationComplete || !proof.completeRootCoverage) { counters.incompleteProofs++; return finish(primary); }
      const viable = proof.rootStatuses.filter(root => root.status !== 'rejected').map(root => root.index);
      let bank = agenda.accept(state, actions, proof, viable.includes(primary.index) ? primary.index : null);
      let requested = null;
      const mayBacktrack = backtracking && state.tray.length <= 2 && (!model.clock || !state.alive[model.clock.i])
        && !proof.knownWin && !proof.necessaryIfSolvable && !preferKnownRecovery(model, state, primary);
      if (mayBacktrack) {
        const choices = [], eligibleChosen = [], allowed = legal(model, state);
        for (const index of viable) {
          const moved = advance(model, state, index);
          const inspection = safeClosedInspection(state, index, model.clock, !allowed.uncertain?.includes(index));
          if (!moved.uncertain && !moved.lost && moved.removed > 0 || inspection) choices.push(index);
          if (inspection || !moved.uncertain && !moved.lost && moved.state.tray.length > state.tray.length) eligibleChosen.push(index);
        }
        if (choices.length >= 2) {
          agenda.noteFork(state, choices, eligibleChosen, actualActions?.length ?? 0);
          requested = agenda.backtrackChoice(state, choices);
          if (requested === primary.index) counters.backtrackingNaturalChoices++;
        }
      }
      let path = null, kind = null;
      if (proof.knownWin) { path = proof.winningPath; kind = 'survivalWin'; }
      else if (proof.necessaryIfSolvable) { path = proof.forcedPath; kind = 'necessaryContinuation'; }
      else if (requested !== null && requested !== primary.index) {
        path = knownRecovery(model, state, 2, deadline, [requested])?.path ?? [requested];
        kind = 'survivalBacktracking'; bank = agenda.accept(state, actions, proof, requested, true);
      }
      else if (proof.discardedRoots.includes(primary.index) && viable.length) {
        const recovery = knownRecovery(model, state, 2, deadline, viable);
        if (recovery) {
          path = recovery.path; kind = 'survivalBranchRecovery';
          bank = agenda.accept(state, actions, proof, path[0], true);
        } else for (const index of bank.active) {
          const allowed = legal(model, state);
          if (safeClosedInspection(state, index, model.clock, !allowed.uncertain?.includes(index))) {
            path = [index]; kind = 'survivalBranchInspection'; break;
          }
        }
      }
      const validated = path?.length ? validatePath(model, state, path, deadline) : null;
      if (!validated?.path.length) {
        if (!primary.knownDead || proof.knownDead) return finish(primary);
        counters.unresolvedDeadReports++;
        const report = { ...primary }; delete report.deadCertificate; delete report.provedDeadRoots; delete report.exclusionProof;
        return finish({ ...report, knownDead: false, boundary: true, goal: 'unresolvedSurvivalBranches',
          survivalBranches: { active: bank.active, deferred: bank.deferred, discarded: proof.discardedRoots,
            broaderModelRemainsUnresolved: true, noWinningContinuationProved: true } });
      }
      const won = proof.knownWin && validated.path.length === path.length
        && !validated.state.alive.some(Boolean) && !validated.state.tray.length;
      const exited = !!model.clock && state.alive[model.clock.i] && !validated.state.alive[model.clock.i];
      counters.knownWins += +won; counters.forcedPlans += +(kind === 'necessaryContinuation');
      counters.vetoes += +(validated.path[0] !== primary.index);
      if (kind === 'survivalBacktracking') counters.backtrackingPlans++;
      const report = { ...primary }; delete report.deadCertificate; delete report.provedDeadRoots; delete report.exclusionProof;
      return finish({ ...report, index: validated.path[0], path: validated.path, goal: kind, knownWin: won, knownDead: false,
        safeClockExit: !!exited, clockRoom: exited ? Math.max(0, model.clock.n - validated.state.moves) : 0,
        knownProgress: validated.removed, information: !won && !exited, boundary: !won && !exited,
        nodes: (primary.nodes ?? 0) + proof.nodes,
        survivalBranches: { active: bank.active, deferred: bank.deferred, discarded: proof.discardedRoots,
          necessaryIfSolvable: kind === 'necessaryContinuation', survivingBranchMayBeUnresolved: !won,
          ...(kind === 'survivalBacktracking' ? { heuristicBacktracking: true, failedPlayDoesNotDisproveBranch: true } : {}),
          selectedKnownPrefix: validated.path.slice(), observedOutcomeNeverRejectsWholeOpening: true } });
    },
    stats() { return { ...counters, agenda: agenda?.stats() ?? null }; },
    outcomes() { return agenda?.outcomes() ?? []; },
  };
}

module.exports = { survivalBranchSearch };
