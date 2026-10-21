'use strict';
const assert = require('assert/strict');
const { chromium } = require('playwright');
const Layouts = require('../../../www/layouts.js');
const { createProductionPage, drawSession } = require('./production_scene_renderer.js');
const { createSession } = require('./production_physical_session.js');
const { createRememberingObserver } = require('./public_pixel_capture.js');

async function test() {
  assert.throws(() => createRememberingObserver({ memory: [2, 4] }));
  assert.throws(() => createRememberingObserver({ actualFaces: [2, 4] }));
  assert.throws(() => createRememberingObserver({ templateMode: 'atlas' }));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
  try {
    const page = await createProductionPage(browser), tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
    const game = { tiles, nb: Layouts.neighbors(tiles), faces: [2, 4], down: [1, 1], rules: null, clock: null };
    const session = createSession(game), observer = createRememberingObserver();
    const read = async () => {
      const frame = session.view(); await drawSession(page, game, frame);
      await page.evaluate(() => { globalThis.memoryTestWorld = G; G = new Proxy({}, { get() { throw Error('Observer read private state'); } }); });
      let banks = 0;
      try {
        const observed = await observer.read(page, frame, async () => { banks++; });
        return { observed, banks };
      } finally { await page.evaluate(() => { G = memoryTestWorld; delete globalThis.memoryTestWorld; }); }
    };
    const initial = await read();
    assert.deepEqual(initial.observed.pictures, [null, null]); assert.equal(initial.banks, 0);
    assert(initial.observed.rows.every(row => row.uninformative === 'back'));
    await assert.rejects(observer.read(page, session.view()), /restart|reread/);
    session.tap(0); const first = await read();
    assert.deepEqual(first.observed.pictures, [2, null]); assert.equal(first.banks, 1);
    assert.equal(first.observed.memory[0].firstObserved.physicalTaps, 1);
    session.tap(1); const second = await read();
    assert.deepEqual(second.observed.pictures, [2, 4]); assert.equal(second.banks, 1);
    assert.equal(second.observed.rows[0].observation, null);
    assert.deepEqual(second.observed.rows[0].recall, first.observed.memory[0]);
    second.observed.memory[0].picture = 8;
    session.tap(0); const third = await read();
    assert.deepEqual(third.observed.pictures, [2, 4]); assert.equal(third.banks, 0);
    assert.deepEqual(third.observed.known, [1, 1]);
    assert.equal(third.observed.memory[0].picture, 2);
    await assert.rejects(observer.read(page, { state: { alive: [1, 1], physicalTaps: 0 } }), /restart|reread/);
    assert.equal(third.observed.observationVersion, 3);
    console.log('PASS picture memory is created only by screenshot singletons, survives closing a peek, distinguishes recall from new recognition, skips hidden backs and rejects seeds/restarts');
  } finally { await browser.close(); }
}

if (require.main === module) test().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = test;
