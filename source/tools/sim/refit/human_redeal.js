'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Layouts = require('../../../www/layouts.js');
const { encodeGame, decodeGame } = require('./personal_game_io.js');
const { tileVisibility, observeBoard } = require('./human_board_visibility.js');
const { visibleRole } = require('./human_reference_campaign.js');
const { advance } = require('./known_tray_plan.js');

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const targetTries = human => { assert(Number.isInteger(human) && human > 0); return Math.max(1, human - 1); };

function sunflowerTheme() {
  const filename = path.resolve(__dirname, '../../../www/tiles.js'), source = fs.readFileSync(filename, 'utf8');
  const tiles = vm.runInNewContext(source + '\nTiles;', {});
  const identities = Array.from(tiles.THEMES.sunflower.faces);
  assert.equal(identities.length, 36); assert.equal(new Set(identities).size, 36);
  return { id: 'sunflower', identities, joker: tiles.faceHTML('sunflower', 101),
    sourceHash: crypto.createHash('sha256').update(source).digest('hex') };
}

function openingState(game) {
  return { alive: game.tiles.map(() => 1), down: Array.from(game.down), tray: [],
    openPeek: -1, moves: 0, relieved: false, arriving: [], physicalTaps: 0 };
}

function openingObservation(game) {
  const state = openingState(game);
  return observeBoard(game.tiles, state, game.clock,
    { picture: index => game.faces[index], role: index => visibleRole(game, state, index) });
}

function makeRedeal(encoded, seed) {
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  const original = decodeGame(encoded), game = decodeGame(encodeGame(original));
  const visibility = tileVisibility(game.tiles, openingState(game), game.clock);
  const hidden = visibility.tiles.flatMap((tile, index) => tile.picture ? [] : [index]);
  const pool = hidden.map(index => game.faces[index]), random = Layouts.rng(seed);
  for (let tail = pool.length - 1; tail > 0; tail--) {
    const other = Math.floor(random() * (tail + 1));
    [pool[tail], pool[other]] = [pool[other], pool[tail]];
  }
  hidden.forEach((index, offset) => { game.faces[index] = pool[offset]; });
  const before = openingObservation(original), after = openingObservation(game);
  assert.deepEqual(after, before, 'A re-deal changed opening-visible information');
  assert.deepEqual(game.faces.slice().sort((left, right) => left - right), original.faces.slice().sort((left, right) => left - right));
  const encodedGame = encodeGame(game);
  const withoutPictures = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'faces'));
  assert.deepEqual(withoutPictures(encodedGame), withoutPictures(encodeGame(original)));
  return { game: encodedGame, hiddenCount: hidden.length,
    changedCount: hidden.filter(index => game.faces[index] !== original.faces[index]).length,
    openingHash: digest(before) };
}

function knownSafeMatches(choice, geometry) {
  if (!choice?.state || !choice.knowledgeSignature) return [];
  const state = choice.state, knowledge = JSON.parse(choice.knowledgeSignature);
  const roles = knowledge.roles;
  if (!Array.isArray(roles) || roles.length !== state.alive.length) return [];
  const free = state.alive.flatMap((alive, index) => alive && Layouts.isFree(index, state.alive, geometry.nb)
    && (state.relieved || ['none', 'key'].includes(roles[index])) ? [index] : []);
  const game = { tiles: geometry.tiles, nb: geometry.nb, clock: geometry.clock,
    publicFrontier: () => ({ free, uncertain: [], relieved: !!state.relieved }) };
  return free.filter(index => {
    if (index === choice.index) return false;
    const moved = advance(game, state, index);
    return !moved.uncertain && !moved.lost && moved.removed > 0 && moved.state.tray.length <= state.tray.length;
  });
}

function classifyLoss(result, geometry) {
  if (result.wonOn !== null && result.status === 'cleared') return null;
  const attempt = result.attempts.at(-1);
  assert(attempt, 'A target miss needs an actual attempt');
  const decisions = attempt.decisions ?? [], choice = decisions.filter(decision => decision.accepted).at(-1) ?? decisions.at(-1);
  const last = attempt.last, unseen = last.pictures.filter((picture, index) => last.alive[index] && picture === null).length;
  const unknownTwins = attempt.tray.filter(picture => !last.pictures.some((known, index) => last.alive[index] && known === picture));
  const safeMatches = knownSafeMatches(choice, geometry);
  let primary;
  if (attempt.why === 'clock') primary = 'clock_expired';
  else if (attempt.why === 'tray') primary = safeMatches.length ? 'missed_known_safe_match'
    : unseen && unknownTwins.length ? 'tray_full_unseen_twins' : 'tray_full_known_or_blocked_twins';
  else if (attempt.why === 'stuck') {
    const roles = choice?.knowledgeSignature ? JSON.parse(choice.knowledgeSignature).roles : [];
    primary = roles?.some((role, index) => last.alive[index] && ['ice', 'ice2', 'lock'].includes(role))
      ? 'stuck_lock_or_ice' : 'stuck_geometry_or_rules';
  } else if (attempt.status === 'unresolvedBudget') {
    const seen = new Set(); let repeated = false;
    for (const decision of decisions.filter(decision => decision.accepted)) {
      const state = decision.state, clockOn = geometry.clock && state.alive[geometry.clock.i];
      const key = JSON.stringify([state.alive, state.tray, state.openPeek, state.relieved, state.arriving,
        clockOn ? state.moves : 0, decision.knowledgeSignature, decision.index]);
      repeated ||= seen.has(key); seen.add(key);
    }
    primary = repeated ? 'repeated_public_choices' : 'decision_cap';
  } else primary = attempt.status === 'unresolvedPublicFrontier' ? 'public_frontier_unresolved' : 'unclassified_target_miss';
  const knowledge = choice?.knowledgeSignature ? JSON.parse(choice.knowledgeSignature) : {};
  return { primary, why: attempt.why, unseenAlive: unseen, unknownTwinPictures: unknownTwins,
    knownSafeMatchIndices: safeMatches,
    witness: choice ? { attempt: attempt.attempt, index: choice.index, state: choice.state,
      roles: knowledge.roles ?? null, initialRoles: knowledge.initialRoles ?? null,
      note: 'Actual public snapshot. A missed immediate safe match is not proof of a full winning line.' } : null };
}

module.exports = { digest, targetTries, sunflowerTheme, openingState, openingObservation, makeRedeal, knownSafeMatches, classifyLoss };
