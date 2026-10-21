'use strict';
const assert = require('assert/strict');
const { chromium } = require('playwright');
const Layouts = require('../../../www/layouts.js');
const { createSession } = require('./production_physical_session.js');
const { createProductionPage, drawSession } = require('./production_scene_renderer.js');

function fixture() {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }];
  return { tiles, nb: Layouts.neighbors(tiles), faces: [2, 3, 1, 3, 2, 1], down: [0, 0, 0, 0, 0, 0],
    clock: { i: 0, n: 6 }, rules: { ice: { 0: 2 }, iceNb: Layouts.iceNeighbors(tiles), locks: new Set([3, 4]), keys: [2, 5] } };
}

async function test() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
  try {
    const page = await createProductionPage(browser), game = fixture(), session = createSession(game), snapshots = [];
    const path = [2, 5, 1, 3, 0, 4];
    for (let position = 0; position <= path.length; position++) {
      const frame = session.view(); await drawSession(page, game, frame);
      const view = await page.evaluate(() => ({ kinds: G.tiles.map((tile, index) => G.alive[index] ? obKind(index) || null : null),
        overlay: G.tiles.map((tile, index) => G.alive[index] ? tile.el.querySelector('.ob')?.dataset.k || null : null),
        legal: G.tiles.flatMap((tile, index) => G.alive[index] && canTake(index) ? [index] : []), obstacle: obState(),
        clock: document.querySelector('#clockBadge b')?.textContent || null }));
      assert.deepEqual(view.kinds, view.overlay); assert.deepEqual(view.legal, frame.legalTiles);
      if (position === 0) assert.deepEqual(view.kinds, ['ice2', null, 'key', 'lock', 'lock', 'key']);
      if (position === 1) assert.deepEqual(view.kinds, ['ice2', null, null, 'lock', 'lock', 'key']);
      if (position === 2) assert.deepEqual(view.kinds, ['ice2', null, null, null, null, null]);
      if (position === 3) assert.equal(view.kinds[0], 'ice');
      if (position >= 4) assert(view.kinds.every(kind => kind === null));
      assert.equal(view.clock, position < 5 ? String(6 - position) : null);
      snapshots.push(view);
      if (position < path.length) session.tap(path[position]);
    }
    assert(session.view().win);
    const before = session.view();
    await assert.rejects(drawSession(page, game, { ...before, state: { ...before.state, relieved: true } }), /relief has not been validated/);
    await assert.rejects(drawSession(page, game, before, { actualPictures: [] }));
    console.log('PASS production scene uses actual obstacle code: keys unlock, thick ice thaws twice, legal taps and clock agree at every physical frame, unvalidated relief stays refused');
    return snapshots;
  } finally { await browser.close(); }
}

if (require.main === module) test().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fixture, test };
