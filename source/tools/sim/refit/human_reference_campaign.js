'use strict';
const assert = require('assert/strict');
const { performance } = require('perf_hooks');
const Layouts = require('../../../www/layouts.js');
const Hard = require('../../../www/hard.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { createSessionFactory, parameters } = require('./production_physical_session.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createObstacleFrontier } = require('./public_obstacle_frontier.js');
const { reference } = require('./public_witness_reference.js');
const { REFERENCE_PARAMETERS } = require('./public_witness_search.js');
const { advance } = require('./known_tray_plan.js');
const { aliveSignature } = require('./public_alive_signature.js');

function createHumanController(tiles, options = {}) {
  assert(options.exclusiveRoles === undefined || [false, true, 'clock'].includes(options.exclusiveRoles));
  assert(options.patientSingleCarry === undefined || typeof options.patientSingleCarry === 'boolean');
  const inspectionTrayLimit = options.inspectionTrayLimit ?? 3;
  assert(Number.isInteger(inspectionTrayLimit) && inspectionTrayLimit >= 0 && inspectionTrayLimit <= 3);
  const geometry = { tiles: tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })) };
  geometry.nb = Layouts.neighbors(geometry.tiles);
  const iceNb = Layouts.iceNeighbors(geometry.tiles);
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(geometry, field, { get() { throw Error('Policy accessed private ' + field); } });
  const pictures = tiles.map(() => null), down = tiles.map(() => null), initialRoles = tiles.map(() => null);
  let attempt = 0, frontier, planner, roleSignature, roles, blocked, blockedAlive, current, clock = null, manualChoice = false;
  const frontierCache = new Map();
  const settings = { ...REFERENCE_PARAMETERS, replanOnInformation: true, decisionMs: 1500, ...options };
  const resetPlanner = () => { planner = reference(settings); };
  return {
    beginAttempt() {
      attempt++; frontier = createObstacleFrontier(tiles, { exclusiveRoles: !!options.exclusiveRoles }); roleSignature = null;
      roles = tiles.map(() => null); blocked = new Set(); blockedAlive = null; current = null;
      resetPlanner();
    },
    observe(state, observed) {
      frontierCache.clear();
      assert(attempt > 0);
      assert(!current || state.physicalTaps > current.physicalTaps);
      observed.pictures.forEach((picture, index) => {
        if (picture !== null) { assert(pictures[index] === null || pictures[index] === picture); pictures[index] = picture; }
        if (observed.down[index] !== null) { assert(down[index] === null || down[index] === observed.down[index]); down[index] = observed.down[index]; }
      });
      if (observed.clock) clock = { i: observed.clock.i, n: observed.clock.n };
      const rows = [];
      observed.roles.forEach((role, index) => {
        const value = role ?? (state.physicalTaps === 0 ? initialRoles[index] : null);
        if (value === null || !state.alive[index]) return;
        roles[index] = value;
        let initialRole = state.physicalTaps === 0 ? value : null;
        if (options.exclusiveRoles && ['key', 'lock'].includes(role)) initialRole = role;
        if (options.exclusiveRoles && role?.startsWith('ice')) {
          const initialHits = (role === 'ice2' ? 2 : 1) + iceNb[index].filter(neighbor => !state.alive[neighbor]).length;
          assert(initialHits === 1 || initialHits === 2, 'Observed ice contradicts the declared one/two-hit contract');
          initialRole = initialHits === 2 ? 'ice2' : 'ice';
        }
        if (initialRole !== null) {
          assert(initialRoles[index] === null || initialRoles[index] === initialRole, 'Observed role contradicts learned starting role');
          initialRoles[index] = initialRole;
        }
        rows.push({ index, observation: { roles: [value], knownRole: value } });
      });
      frontier.observe({ alive: state.alive, physicalTaps: state.physicalTaps }, rows);
      current = { ...structuredClone(state), down: down.map((value, index) => state.alive[index] ? value : 0),
        pictures: pictures.map((picture, index) => state.alive[index] ? picture : null) };
      const aliveKey = state.alive.join('');
      if (aliveKey !== blockedAlive) { blocked.clear(); blockedAlive = aliveKey; }
      const signature = roles.join(',');
      if (roleSignature !== signature) resetPlanner();
      roleSignature = signature;
      geometry.clock = clock;
      geometry.rules = { iceNb, ice: Object.fromEntries(roles.flatMap((role, index) => role?.startsWith('ice')
        ? [[index, startingIceHits(role, initialRoles[index], iceNb[index].filter(neighbor => !state.alive[neighbor]).length)]] : [])),
        locks: new Set(roles.flatMap((role, index) => role === 'lock' ? [index] : [])),
        keys: roles.flatMap((role, index) => role === 'key' ? [index] : []) };
      geometry.publicFrontier = position => {
        Object.freeze(position.alive);
        const aliveKey = aliveSignature(position.alive), cacheKey = +!!position.relieved + '|' + aliveKey;
        if (frontierCache.has(cacheKey)) return frontierCache.get(cacheKey);
        const queried = frontier.query(position.alive, options.exclusiveRoles === 'clock'
          ? !!(clock && position.alive[clock.i]) : !!options.exclusiveRoles);
        const sameBoard = aliveKey === blockedAlive;
        const free = position.relieved ? position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, geometry.nb) ? [index] : [])
          : [...queried.free, ...queried.uncertain];
        const result = { free: free.filter(index => !sameBoard || !blocked.has(index)),
          uncertain: position.relieved ? [] : queried.uncertain.filter(index => !sameBoard || !blocked.has(index)) };
        frontierCache.set(cacheKey, result); return result;
      };
    },
    decide() {
      const available = geometry.publicFrontier(current);
      let actions = available.free.map(index => ({ index }));
      if (!actions.length) return null;
      const discoveries = options.inspectBeforeCommit && current.tray.length <= inspectionTrayLimit && !(clock && current.alive[clock.i])
        ? actions.filter(action => current.down[action.index] === 1 && current.openPeek !== action.index && current.pictures[action.index] === null) : [];
      manualChoice = discoveries.length > 0;
      if (manualChoice) {
        const index = discoveries[0].index;
        resetPlanner();
        return { plan: { index, path: [index], goal: 'closedTileDiscovery', knownWin: false, knownDead: false,
          knownProgress: 0, information: true, boundary: true, nodes: 0 }, predicted: advance(geometry, current, index) };
      }
      if (options.patientSingleCarry && current.tray.length === 1 && !(clock && current.alive[clock.i])) {
        const guaranteed = actions.filter(action => !available.uncertain.includes(action.index));
        const ready = guaranteed.filter(action => {
          const picture = current.pictures[action.index];
          return picture !== null && (picture === current.tray[0] || guaranteed.some(partner =>
            partner.index !== action.index && current.pictures[partner.index] === picture));
        });
        if (ready.length) actions = ready;
      }
      planner.physicalTrayPlanning(geometry, current, actions);
      const plan = planner.report(), predicted = advance(geometry, current, plan.index);
      return { plan: structuredClone(plan), predicted };
    },
    acknowledge(index, accepted) {
      if (accepted) { if (!manualChoice) planner.acknowledgeTile(index); }
      else {
        assert(geometry.publicFrontier(current).uncertain.includes(index), 'A guaranteed public tap was rejected by production');
        blocked.add(index); frontierCache.clear(); resetPlanner();
      }
    },
    known() { return { pictures: pictures.slice(), down: down.slice(), initialRoles: initialRoles.slice() }; },
    state() { return structuredClone(current); },
  };
}

function startingIceHits(currentRole, rememberedRole, removedNeighbors) {
  if (rememberedRole?.startsWith('ice')) return rememberedRole === 'ice2' ? 2 : 1;
  return (currentRole === 'ice2' ? 2 : 1) + removedNeighbors;
}

function visibleRole(game, state, index) {
  if (!game.rules || state.relieved) return 'none';
  const rules = game.rules, gone = rules.iceNb[index].filter(neighbor => !state.alive[neighbor]).length;
  const remaining = Math.max(0, (rules.ice[index] || 0) - gone);
  if (remaining) return remaining > 1 ? 'ice2' : 'ice';
  const keysLeft = (rules.keys || []).some(key => state.alive[key]);
  if (keysLeft && rules.locks?.has(index)) return 'lock';
  if (keysLeft && (rules.keys || []).includes(index)) return 'key';
  return 'none';
}

function verifyAttempt(encoded, actions, settings, audit) {
  if (!actions.length) { assert.equal(audit.physicalLog.length, 0); return 0; }
  const replaySettings = audit.result ? settings : { ...settings, choiceLimit: actions.length };
  const replay = { ...decodeGame(encoded), physicalLog: [] }, trace = [];
  let available, cursor = 0;
  const result = Hard.play(replay, { ...parameters(encoded.tiles.length, replaySettings),
    physicalTrayPlanning(game, state, candidates) { available = candidates; return { features: candidates.map(() => []), nodes: 0, boundaries: 0 }; },
    physicalChoice() {
      const requested = actions[cursor++], selected = available.findIndex(action => action.index === requested);
      assert(selected >= 0, JSON.stringify({ message: 'Independent replay rejected a recorded physical action', cursor,
        requested: actions[cursor - 1], available: available.map(action => action.index), total: actions.length })); return selected;
    } }, settings.seed, trace);
  assert.equal(cursor, actions.length);
  if (audit.result) assert.deepEqual(result, audit.result);
  else assert.equal(result.why, 'contextChoiceLimit');
  assert.deepEqual(replay.physicalLog, audit.physicalLog); assert.deepEqual(trace, audit.trace);
  return actions.length;
}

function playHumanCampaign(input, options = {}) {
  assert(Object.keys(options).every(key => ['maximumAttempts', 'choiceLimit', 'planning', 'captureDecisions'].includes(key)));
  const settings = { seed: 20261111, choiceLimit: options.choiceLimit ?? 512, tapMs: 1000 };
  const maximumAttempts = options.maximumAttempts ?? 3;
  assert(Number.isInteger(maximumAttempts) && maximumAttempts > 0);
  const encoded = encodeGame(input), game = decodeGame(encoded), controller = createHumanController(game.tiles, options.planning);
  if (options.planning?.exclusiveRoles && game.rules) {
    const keys = game.rules.keys || [], locks = [...(game.rules.locks || [])];
    const ice = Object.keys(game.rules.ice || {}).filter(index => game.rules.ice[index] > 0).map(Number);
    assert(keys.length === 0 || keys.length === 2, 'Exclusive production-role contract requires zero or two keys');
    const special = [...keys, ...locks, ...ice];
    assert.equal(new Set(special).size, special.length, 'Exclusive production-role contract forbids stacked roles');
    assert(ice.every(index => game.rules.ice[index] <= 2), 'Exclusive production-role contract supports one/two-hit ice');
  }
  const factory = createSessionFactory(), attempts = [];
  let slowestMs = 0, controls = 0, verifiedTaps = 0, rejected = 0, decision = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
    controller.beginAttempt();
    const session = factory(game, settings), actions = [], decisions = [];
    let status = null, previousTap = -1, lastPlan = null;
    for (;;) {
      const started = performance.now(), actual = session.view(), state = actual.state;
      if (state.physicalTaps > previousTap) {
        const publicBoard = observeBoard(game.tiles, state, game.clock,
          { picture: index => game.faces[index], role: index => visibleRole(game, state, index) });
        controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
          relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps }, publicBoard);
        previousTap = state.physicalTaps;
      }
      if (actual.type === 'productionPhysicalEnd-v1') break;
      const selected = controller.decide(), elapsed = performance.now() - started;
      if (elapsed > slowestMs) { slowestMs = elapsed; decision = { attempt, physicalTaps: state.physicalTaps }; }
      if (!selected) { status = 'unresolvedPublicFrontier'; break; }
      const index = selected.plan.index, accepted = actual.legalTiles.includes(index);
      if (options.captureDecisions) decisions.push({ state: controller.state(), index, accepted,
        plan: { goal: selected.plan.goal, path: selected.plan.path, progress: selected.plan.knownProgress,
          boundary: selected.plan.boundary, knownDead: selected.plan.knownDead } });
      controller.acknowledge(index, accepted);
      lastPlan = selected.plan;
      if (!accepted) { rejected++; continue; }
      actions.push(index);
      const after = session.tap(index), predicted = selected.predicted;
      if (!predicted.uncertain) {
        for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(after.state[field], predicted.state[field],
          JSON.stringify({ field, index, publicState: controller.state(), predicted: predicted.state, actual: after.state }));
        controls++;
      }
    }
    const terminal = session.view(), audit = session.audit();
    verifiedTaps += verifyAttempt(encoded, actions, settings, audit);
    if (status === null) {
      status = terminal.computationCensored ? 'unresolvedBudget' : terminal.win ? 'cleared'
        : ['tray', 'clock', 'stuck'].includes(terminal.why) ? 'physicalLoss' : 'unresolved';
    }
    attempts.push({ attempt, status, why: terminal.why ?? status, taps: actions.length,
      left: terminal.state.alive.reduce((sum, alive) => sum + alive, 0), tray: terminal.state.tray,
      last: { alive: terminal.state.alive, openPeek: terminal.state.openPeek, moves: terminal.state.moves,
        pictures: controller.known().pictures, plan: lastPlan }, actions, ...(options.captureDecisions ? { decisions } : {}) });
    if (status !== 'physicalLoss') break;
  }
  factory.verifySource();
  return { wonOn: attempts.at(-1).status === 'cleared' ? attempts.length : null, status: attempts.at(-1).status,
    slowestMs, decision, attempts, controls, verifiedTaps, rejected,
    note: 'Game-state visibility gate; no pixels or full hidden rules. Search stops at unobserved identities, orientations and roles. Rejected uncertain taps do not advance moves or create retries. Retry pictures/orientations were actually observed; starting-role memory uses observations and rule-supported deductions, never late none as starting safety. Completed attempts independently replayed through unmodified production. Finite failure is not impossibility.' };
}

module.exports = { createHumanController, playHumanCampaign, visibleRole, verifyAttempt, startingIceHits };
