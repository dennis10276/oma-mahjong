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

function createHumanController(tiles, options = {}) {
  const geometry = { tiles: tiles.map(tile => ({ x: tile.x, y: tile.y, z: tile.z })) };
  geometry.nb = Layouts.neighbors(geometry.tiles);
  for (const field of ['faces', 'down', 'deck', 'seed']) Object.defineProperty(geometry, field, { get() { throw Error('Policy accessed private ' + field); } });
  const pictures = tiles.map(() => null), down = tiles.map(() => null), initialRoles = tiles.map(() => null);
  let attempt = 0, frontier, planner, roleSignature, roles, blocked, blockedAlive, current, clock = null;
  const settings = { ...REFERENCE_PARAMETERS, replanOnInformation: true, ...options };
  const resetPlanner = () => { planner = reference(settings); };
  return {
    beginAttempt() {
      attempt++; frontier = createObstacleFrontier(tiles); roleSignature = null;
      roles = tiles.map(() => null); blocked = new Set(); blockedAlive = null; current = null;
      resetPlanner();
    },
    observe(state, observed) {
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
        if (state.physicalTaps === 0) initialRoles[index] = value;
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
      const iceNb = Layouts.iceNeighbors(tiles);
      geometry.rules = { iceNb, ice: Object.fromEntries(roles.flatMap((role, index) => role?.startsWith('ice')
        ? [[index, (role === 'ice2' ? 2 : 1) + iceNb[index].filter(neighbor => !state.alive[neighbor]).length]] : [])),
        locks: new Set(roles.flatMap((role, index) => role === 'lock' ? [index] : [])),
        keys: roles.flatMap((role, index) => role === 'key' ? [index] : []) };
      geometry.publicFrontier = position => {
        const queried = frontier.query(position.alive);
        const sameBoard = position.alive.join('') === blockedAlive;
        const free = position.relieved ? position.alive.flatMap((alive, index) => alive && Layouts.isFree(index, position.alive, geometry.nb) ? [index] : [])
          : [...queried.free, ...queried.uncertain];
        return { free: free.filter(index => !sameBoard || !blocked.has(index)),
          uncertain: position.relieved ? [] : queried.uncertain.filter(index => !sameBoard || !blocked.has(index)) };
      };
    },
    decide() {
      const actions = geometry.publicFrontier(current).free.map(index => ({ index }));
      if (!actions.length) return null;
      planner.physicalTrayPlanning(geometry, current, actions);
      const plan = planner.report(), predicted = advance(geometry, current, plan.index);
      return { plan: structuredClone(plan), predicted };
    },
    acknowledge(index, accepted) {
      if (accepted) planner.acknowledgeTile(index);
      else {
        assert(geometry.publicFrontier(current).uncertain.includes(index), 'A guaranteed public tap was rejected by production');
        blocked.add(index); resetPlanner();
      }
    },
    known() { return { pictures: pictures.slice(), down: down.slice(), initialRoles: initialRoles.slice() }; },
  };
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
  const replay = { ...decodeGame(encoded), physicalLog: [] }, trace = [];
  let available, cursor = 0;
  const result = Hard.play(replay, { ...parameters(encoded.tiles.length, settings),
    physicalTrayPlanning(game, state, candidates) { available = candidates; return { features: candidates.map(() => []), nodes: 0, boundaries: 0 }; },
    physicalChoice() {
      const requested = actions[cursor++], selected = available.findIndex(action => action.index === requested);
      assert(selected >= 0, JSON.stringify({ message: 'Independent replay rejected a recorded physical action', cursor,
        requested: actions[cursor - 1], available: available.map(action => action.index), total: actions.length })); return selected;
    } }, settings.seed, trace);
  assert.equal(cursor, actions.length);
  assert.deepEqual(result, audit.result); assert.deepEqual(replay.physicalLog, audit.physicalLog); assert.deepEqual(trace, audit.trace);
  return actions.length;
}

function playHumanCampaign(input, options = {}) {
  assert(Object.keys(options).every(key => ['maximumAttempts', 'choiceLimit', 'planning'].includes(key)));
  const settings = { seed: 20261111, choiceLimit: options.choiceLimit ?? 512, tapMs: 1000 };
  const maximumAttempts = options.maximumAttempts ?? 3;
  assert(Number.isInteger(maximumAttempts) && maximumAttempts > 0);
  const encoded = encodeGame(input), game = decodeGame(encoded), controller = createHumanController(game.tiles, options.planning);
  const factory = createSessionFactory(), attempts = [];
  let slowestMs = 0, controls = 0, verifiedTaps = 0, rejected = 0, decision = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
    controller.beginAttempt();
    const session = factory(game, settings), actions = [];
    let status = null, previousTap = -1, lastPlan = null;
    for (;;) {
      const actual = session.view(), state = actual.state;
      if (state.physicalTaps > previousTap) {
        const publicBoard = observeBoard(game.tiles, state, game.clock,
          { picture: index => game.faces[index], role: index => visibleRole(game, state, index) });
        controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
          relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps }, publicBoard);
        previousTap = state.physicalTaps;
      }
      if (actual.type === 'productionPhysicalEnd-v1') break;
      const started = performance.now(), selected = controller.decide(), elapsed = performance.now() - started;
      if (elapsed > slowestMs) { slowestMs = elapsed; decision = { attempt, physicalTaps: state.physicalTaps }; }
      if (!selected) { status = 'unresolvedPublicFrontier'; break; }
      const index = selected.plan.index, accepted = actual.legalTiles.includes(index);
      controller.acknowledge(index, accepted);
      lastPlan = selected.plan;
      if (!accepted) { rejected++; continue; }
      actions.push(index);
      const after = session.tap(index), predicted = selected.predicted;
      if (!predicted.uncertain) {
        for (const field of ['alive', 'tray', 'moves', 'openPeek']) assert.deepEqual(after.state[field], predicted.state[field]);
        controls++;
      }
    }
    const terminal = session.view(), audit = session.audit();
    if (status === null) {
      verifiedTaps += verifyAttempt(encoded, actions, settings, audit);
      status = terminal.computationCensored ? 'unresolvedBudget' : terminal.win ? 'cleared'
        : ['tray', 'clock', 'stuck'].includes(terminal.why) ? 'physicalLoss' : 'unresolved';
    }
    attempts.push({ attempt, status, why: terminal.why ?? status, taps: actions.length,
      left: terminal.state.alive.reduce((sum, alive) => sum + alive, 0), tray: terminal.state.tray,
      last: { alive: terminal.state.alive, openPeek: terminal.state.openPeek, moves: terminal.state.moves,
        pictures: controller.known().pictures, plan: lastPlan }, actions });
    if (status !== 'physicalLoss') break;
  }
  factory.verifySource();
  return { wonOn: attempts.at(-1).status === 'cleared' ? attempts.length : null, status: attempts.at(-1).status,
    slowestMs, decision, attempts, controls, verifiedTaps, rejected,
    note: 'Game-state visibility gate; no pixels or full hidden rules. Search stops at unobserved identities, orientations and roles. Rejected uncertain taps do not advance moves or create retries. Retry pictures/orientations were actually observed; only initial role observations are carried to an initial board. Completed attempts independently replayed through unmodified production. Finite failure is not impossibility.' };
}

module.exports = { createHumanController, playHumanCampaign, visibleRole, verifyAttempt };
