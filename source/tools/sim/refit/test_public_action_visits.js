'use strict';
const assert = require('assert/strict');
const Layouts = require('../../../www/layouts.js');
const { createPublicActionVisits } = require('./public_action_visits.js');
const { createHumanController, visibleRole, verifyAttempt } = require('./human_reference_campaign.js');
const { observeBoard } = require('./human_board_visibility.js');
const { createSessionFactory } = require('./production_physical_session.js');
const { encodeGame } = require('./personal_game_io.js');

function test() {
  const visits = createPublicActionVisits();
  assert.throws(() => visits.recordActual('state', 'knowledge', 0)); visits.beginAttempt();
  const tiles = Array.from({ length: 14 }, (unused, index) => ({ x: index * 4, y: 0, z: 0 }));
  const actual = { tiles, nb: Layouts.neighbors(tiles), faces: [1, 2, 1, 2, 3, 3, 4, 4, 5, 5, 6, 7, 6, 7],
    down: tiles.map((unused, index) => +[0, 1, 8, 9, 12, 13].includes(index)), rules: null, clock: null };
  const controller = createHumanController(tiles, { exclusiveRoles: true, rememberAcceptedTaps: true,
    rememberClearedRoles: true, usePlacementContract: true }, { boardMode: 'standard' });
  const factory = createSessionFactory(), settings = { seed: 1, tapMs: 1000, choiceLimit: 64 }, session = factory(actual, settings);
  const actions = [];
  const observe = () => {
    const state = session.view().state;
    controller.observe({ alive: state.alive, tray: state.tray, moves: state.moves, openPeek: state.openPeek,
      relieved: state.relieved, arriving: state.arriving, physicalTaps: state.physicalTaps },
    observeBoard(tiles, state, null, { picture: index => actual.faces[index], role: index => visibleRole(actual, state, index) }));
  };
  const take = index => {
    controller.decide(); controller.acknowledge(index, true); session.tap(index); actions.push(index); observe();
  };
  const position = () => {
    const state = controller.state();
    return JSON.stringify(Object.fromEntries(['alive', 'tray', 'moves', 'openPeek', 'relieved', 'arriving'].map(field => [field, state[field]])));
  };
  controller.beginAttempt(); observe();
  for (const index of [10, 11, 0, 1]) take(index);
  const initialPosition = position(), initialKnowledge = controller.knowledgeSignature();
  visits.recordActual(initialPosition, initialKnowledge, 0); take(0);
  visits.recordActual(position(), controller.knowledgeSignature(), 1); take(1);
  assert.equal(position(), initialPosition); assert.equal(controller.knowledgeSignature(), initialKnowledge);
  assert(visits.hasTried(position(), controller.knowledgeSignature(), 0));
  assert(!visits.hasTried(position(), controller.knowledgeSignature(), 2));
  assert.equal(session.view().state.moves, 2, 'The whole revisit added no removal or tray progress');
  take(8); take(1);
  assert.equal(position(), initialPosition); assert.notEqual(controller.knowledgeSignature(), initialKnowledge);
  assert(!visits.hasTried(position(), controller.knowledgeSignature(), 0), 'A genuinely new observed picture permits reconsidering an old action');
  for (const index of [12, 13, 0, 2, 1, 3, 4, 5, 6, 7, 8, 9]) take(index);
  assert(session.view().win);
  assert.equal(verifyAttempt(encodeGame(actual), actions, settings, session.audit()), actions.length);
  visits.beginAttempt(); assert(!visits.hasTried(initialPosition, initialKnowledge, 0), 'A real retry has separate visit bookkeeping');
  assert.throws(() => visits.hasTried('', initialKnowledge, 0));
  assert.throws(() => visits.hasTried(initialPosition, initialKnowledge, -1));
  factory.verifySource();
  console.log('PASS actual production peeks revisit an identical physical/knowledge state without progress, newly observed information permits reconsideration, retry bookkeeping stays separate and the complete physical route independently replays');
}

if (require.main === module) test();
module.exports = test;
