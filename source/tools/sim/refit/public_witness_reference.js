'use strict';
const assert = require('assert/strict');
const physical = require('./known_tray_plan.js');
const witness = require('./public_witness_search.js');
const { knowledgeChange } = require('./public_information_revision.js');
const FEATURES = ['witnessAction', 'winningWitness', 'safeClockExitWitness', 'clockRoomWitness',
  'knownProgressWitness', 'informationWitness', 'boundedWitness', 'persistentWitness'];

function reference(options = witness.REFERENCE_PARAMETERS, runSearch = witness.search) {
  assert.equal(typeof runSearch, 'function');
  const replanOnInformation = options.replanOnInformation ?? false;
  const replanOnRetryCost = options.replanOnRetryCost ?? false;
  assert.equal(typeof replanOnInformation, 'boolean');
  assert.equal(typeof replanOnRetryCost, 'boolean');
  let choice = null, pending = null, expected = null, expectedPictures = null, expectedDown = null, staged = null;
  const stats = { searches: 0, searchNodes: 0, retainedSteps: 0, winWitnesses: 0, exitWitnesses: 0, unknownFrontiers: 0, boundaries: 0, provedDeadEnds: 0, prunedDeadSuccessors: 0 };
  if (replanOnInformation) stats.informationReplans = 0;
  if (replanOnRetryCost) stats.retryReplans = 0;
  const planning = (game, state, actions) => {
    const signature = witness.keyOf(game, state);
    const preservedKnowledge = expectedPictures?.every((picture, index) => !state.alive[index]
      || (picture === null || state.pictures[index] === picture) && state.down[index] === expectedDown[index]);
    const canRetain = pending?.path.length && expected === signature && preservedKnowledge
      && actions.some(action => action.index === pending.path[0]);
    const informationRevision = canRetain && replanOnInformation && knowledgeChange(expectedPictures, state).gained.length > 0;
    if (informationRevision) stats.informationReplans++;
    const retryRevision = canRetain && !informationRevision && replanOnRetryCost
      && !pending.knownWin && !pending.safeClockExit
      && (!game.clock || !state.alive[game.clock.i] || options.clockRetryLearning === true)
      && typeof game.publicRetryCost === 'function' && game.publicRetryCost(pending.path[0]) > 0;
    if (retryRevision) stats.retryReplans++;
    let report, retained = false;
    if (canRetain && !informationRevision && !retryRevision) {
      report = { ...pending, index: pending.path[0], nodes: 0 }; retained = true; stats.retainedSteps++;
    } else {
      report = runSearch(game, state, actions, options); stats.searches++; stats.searchNodes += report.nodes;
      stats.winWitnesses += +report.knownWin; stats.exitWitnesses += +report.safeClockExit;
      stats.unknownFrontiers += +report.information; stats.boundaries += +report.boundary;
      stats.provedDeadEnds += +report.knownDead;
      stats.prunedDeadSuccessors += report.prunedDeadSuccessors;
      if (report.continuationProof) for (const [key, value] of Object.entries(report.continuationProof)) {
        const field = 'continuationProof' + key[0].toUpperCase() + key.slice(1); stats[field] = (stats[field] || 0) + value;
      }
    }
    const selected = actions.findIndex(action => action.index === report.index); assert(selected >= 0);
    const moved = physical.advance(game, state, report.index);
    const continuation = !moved.uncertain && !moved.lost && report.path.length > 1 ? { ...report, path: report.path.slice(1) } : null;
    staged = { pending: continuation, expected: continuation ? witness.keyOf(game, moved.state) : null,
      pictures: continuation ? moved.state.pictures.slice() : null,
      down: continuation ? moved.state.down.slice() : null };
    choice = { index: selected, report, tiles: actions.map(action => action.index) };
    const features = actions.map((action, index) => index === selected ? [1, +report.knownWin, +report.safeClockExit,
      report.clockRoom / 4, Math.min(1, report.knownProgress / 8), +report.information, +report.boundary, +retained] : FEATURES.map(() => 0));
    return { features, nodes: report.nodes, boundaries: +report.boundary };
  };
  const check = decision => {
    assert.equal(decision.observationVersion, 1, 'Witness reference requires the information-limited observer');
    assert(choice && choice.index < decision.F.length);
  };
  const observe = (decision, selected) => {
    check(decision); assert(Number.isInteger(selected) && selected >= 0 && selected < decision.F.length);
    pending = selected === choice.index ? staged.pending : null;
    expected = selected === choice.index ? staged.expected : null;
    expectedPictures = selected === choice.index ? staged.pictures : null;
    expectedDown = selected === choice.index ? staged.down : null;
  };
  const choose = decision => { check(decision); const selected = choice.index; observe(decision, selected); return selected; };
  choose.probabilities = decision => { check(decision); return decision.F.map((feature, index) => +(index === choice.index)); };
  choose.observe = observe;
  choose.acknowledgeTile = index => {
    assert(choice && Number.isInteger(index));
    const selected = choice.tiles.indexOf(index); assert(selected >= 0, 'Acknowledge only a currently legal physical tile');
    pending = selected === choice.index ? staged.pending : null;
    expected = selected === choice.index ? staged.expected : null;
    expectedPictures = selected === choice.index ? staged.pictures : null;
    expectedDown = selected === choice.index ? staged.down : null;
  };
  choose.physicalTrayPlanning = planning; choose.stats = () => ({ ...stats });
  choose.report = () => choice?.report || null;
  return choose;
}

function referenceFactory(options, runSearch) {
  let active = null;
  const completed = [];
  const factory = () => {
    if (active) completed.push(active.stats());
    active = reference(options, runSearch); return active;
  };
  factory.physicalTrayPlanning = (...args) => { assert(active, 'Initialize the current attempt before public witness planning'); return active.physicalTrayPlanning(...args); };
  factory.stats = () => completed.concat(active ? [active.stats()] : []);
  return factory;
}

module.exports = { FEATURES, reference, referenceFactory };
