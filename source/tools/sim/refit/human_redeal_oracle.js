'use strict';
const assert = require('assert/strict');
const { legal, advance } = require('./known_tray_plan.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { verifyAttempt } = require('./human_reference_campaign.js');
const protocol = require('./human_redeal_winnable_protocol.json');

function replayOraclePath(input, path, factory = createSessionFactory()) {
  const settings = { seed: protocol.oracleSeed, tapMs: protocol.oracleTapMs,
    choiceLimit: Math.max(4096, path.length + 1) };
  const session = factory(input, settings);
  for (const index of path) {
    const view = session.view();
    assert.equal(view.type, 'productionPhysicalFrame-v1');
    assert(view.legalTiles.includes(index), 'Oracle route contains a blocked physical tap');
    session.tap(index);
  }
  return { session, settings, view: session.view() };
}

function oracleStep(game, state, index, prefix, factory) {
  const jokerInteraction = game.faces[index] === 101 && state.tray.length > 0
    || game.faces[index] !== 101 && state.tray.includes(101);
  const moved = jokerInteraction ? { uncertain: true, reason: 'automaticJokerTwin' } : advance(game, state, index);
  if (!moved.uncertain) {
    if (!moved.lost && !moved.win) moved.state.relieved = legal(game, moved.state).relieved;
    return moved;
  }
  assert.equal(moved.reason, 'automaticJokerTwin', 'A fully known oracle transition must be supported');
  const { view } = replayOraclePath(game, prefix.concat(index), factory);
  assert(!view.computationCensored);
  return { state: { ...view.state, pictures: game.faces }, win: !!view.win,
    lost: view.type === 'productionPhysicalEnd-v1' && !view.win,
    productionReplay: true,
    removed: state.alive.reduce((sum, alive, offset) => sum + +(alive && !view.state.alive[offset]), 0) };
}

function solveRedeal(input, { nodeLimit = protocol.oracleNodeLimit } = {}) {
  assert(Number.isInteger(nodeLimit) && nodeLimit > 0);
  const game = decodeGame(encodeGame(input)), factory = createSessionFactory();
  const root = factory(game, { seed: protocol.oracleSeed, tapMs: protocol.oracleTapMs, choiceLimit: 4096 }).view();
  const initial = { ...root.state, pictures: game.faces };
  const signature = state => state.alive.join('') + '|' + state.tray.join(',') + '|' + state.openPeek
    + '|' + +!!state.relieved + '|' + (game.clock && state.alive[game.clock.i] ? state.moves : 0)
    + '|' + (state.arriving || []).join(',');
  const visited = new Set(), stack = [{ state: initial, path: [], actions: null, offset: 0 }];
  let nodes = 0, transitions = 0, jokerReplays = 0;
  const result = (status, path = []) => ({ schema: 'human-redeal-oracle-result-v2', status,
    nodes, transitions, jokerReplays, nodeLimit, path, exhaustive: status === 'lost',
    productionVerified: false, oracleOnly: true });
  const order = state => {
    const available = legal(game, state).free;
    const cone = new Set();
    if (game.clock && state.alive[game.clock.i]) {
      const queue = [game.clock.i]; cone.add(game.clock.i);
      for (let offset = 0; offset < queue.length; offset++) for (const above of game.nb.above[queue[offset]]) {
        if (state.alive[above] && !cone.has(above)) { cone.add(above); queue.push(above); }
      }
    }
    const score = index => +state.tray.includes(game.faces[index]) * 1000
      + +(state.openPeek >= 0 && state.openPeek !== index && game.faces[state.openPeek] === game.faces[index]) * 900
      + +(game.clock && state.alive[game.clock.i] && game.clock.i === index) * 800
      + +cone.has(index) * 300
      + +available.some(other => other !== index && game.faces[other] === game.faces[index]) * 100
      + +(game.rules?.keys?.includes(index)) * 10;
    return available.map(index => ({ index, score: score(index) }))
      .sort((left, right) => right.score - left.score || left.index - right.index).map(row => row.index);
  };
  const verified = path => {
    const replay = replayOraclePath(game, path, factory), audit = replay.session.audit();
    assert(replay.view.win && !replay.view.computationCensored, 'Oracle witness did not clear production');
    const verifiedTaps = verifyAttempt(encodeGame(game), path, replay.settings, audit);
    const engine = factory.verifySource();
    return { ...result('cleared', path), productionVerified: true, verifiedTaps, engine };
  };
  while (stack.length) {
    const frame = stack.at(-1);
    if (frame.actions === null) {
      if (nodes >= nodeLimit) return result('node_cap');
      nodes++; visited.add(signature(frame.state));
      if (!frame.state.alive.some(Boolean) && !frame.state.tray.length) return verified(frame.path);
      frame.actions = order(frame.state);
    }
    if (frame.offset === frame.actions.length) { stack.pop(); continue; }
    const index = frame.actions[frame.offset++]; transitions++;
    const moved = oracleStep(game, frame.state, index, frame.path, factory);
    jokerReplays += +!!moved.productionReplay;
    if (moved.lost) continue;
    const nextPath = frame.path.concat(index);
    if (moved.win) return verified(nextPath);
    if (!visited.has(signature(moved.state))) stack.push({ state: moved.state, path: nextPath, actions: null, offset: 0 });
  }
  factory.verifySource();
  return result('lost');
}

module.exports = { replayOraclePath, oracleStep, solveRedeal };
