'use strict';
const assert = require('assert/strict');
const { createPage } = require('./personal_render_page.js');
const { encodeGame } = require('./personal_game_io.js');

async function createProductionPage(browser, width = 420, height = 720) {
  return createPage(browser, width, height, { productionObstacles: true });
}

async function drawSession(page, game, frame, options = {}) {
  assert(Object.keys(options).every(key => ['theme', 'highlight', 'contrast', 'gold'].includes(key)));
  assert(frame.state.alive.length === game.tiles.length && frame.state.down.length === game.tiles.length);
  assert(!frame.state.relieved, 'Hard relief has not been validated against production obstacle relief; do not silently render a different board');
  const encoded = encodeGame(game);
  await page.evaluate(({ game, frame, options }) => {
    S.theme = options.theme ?? 'classic'; S.highlight = !!options.highlight;
    document.body.classList.toggle('contrast', !!options.contrast);
    G = { tiles: game.tiles.map((tile, index) => ({ ...tile, face: game.faces[index] })), nb: game.nb,
      alive: Uint8Array.from(frame.state.alive), down: Uint8Array.from(frame.state.down),
      peek: frame.state.openPeek, gold: new Set(options.gold || []), clock: game.clock, mv: frame.state.moves };
    setObstacles(game.rules ? { ice: game.rules.ice, locks: game.rules.locks || [], keys: game.rules.keys } : null);
    renderBoard(false); updateObstacles();
  }, { game: encoded, frame, options });
}

module.exports = { createProductionPage, drawSession };
