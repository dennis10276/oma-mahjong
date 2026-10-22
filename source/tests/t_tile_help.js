'use strict';
const fs = require('fs'), path = require('path');
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clockMoves: 1, trayPair: 1 };
module.exports = [
  { name: 'tile help: all four animated lessons fit a small phone in both languages and leave the game untouched', async run(t, { startLevel, click, sleep }) {
    for (const lang of ['nl', 'en']) {
      const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 80, sunSeen: true, lang, seenSp: seen } });
      await startLevel(p, 80);
      for (const kind of ['ice', 'lock', 'trayPair', 'clock']) {
        const before = await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], obState(), G.clock]));
        await p.evaluate(k => k === 'clock' ? showClockLesson() : showTileLesson(k), kind);
        t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), kind, 'correct demonstration');
        if (kind === 'ice') t.ok(await p.evaluate(() => {
          const [above, ice, below] = [...$('.lesson-ice-board').children].map(e => e.getBoundingClientRect());
          return above.bottom <= ice.top && ice.bottom <= below.top;
        }), 'ice demonstration includes touching tiles above and below');
        if (kind === 'clock') t.ok(!/hint|schudden|shuffle/i.test(await p.locator('#modalBox').innerText), 'clock explanation does not mention tools');
        t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'lesson and button fit: ' + lang + ' ' + kind);
        await click(p, '.lesson-toggle');
        const step = await p.locator('.lesson-demo').getAttribute('data-step');
        await sleep(2600);
        t.eq(await p.locator('.lesson-demo').getAttribute('data-step'), step, 'pause freezes demonstration');
        await click(p, '.lesson-replay');
        t.eq(await p.locator('.lesson-demo').getAttribute('data-step'), '0', 'replay returns to first step');
        await sleep(2500);
        t.eq(await p.locator('.lesson-demo').getAttribute('data-step'), '1', 'animation advances');
        t.eq(await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], obState(), G.clock])), before, 'demo does not touch game state');
        if (process.env.CAPTURE_TILE_HELP_DIR) {
          fs.mkdirSync(process.env.CAPTURE_TILE_HELP_DIR, { recursive: true });
          await p.screenshot({ path: path.join(process.env.CAPTURE_TILE_HELP_DIR, kind + '-' + lang + '.png') });
        }
        await click(p, '#ntGo');
        t.eq(await p.evaluate(() => lessonTimer), null, 'closing cleans up timer');
      }
      await p.evaluate(() => showTileLesson('ice', null, true));
      t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'ice reminder also fits: ' + lang);
      await click(p, '#ntGo');
      await p.evaluate(() => showIntro()); await click(p, '#mTileHelp');
      t.eq([await p.locator('.cz-pick[data-kind]').count(), await p.locator('.cz-tilepick').count()], [8, 4], 'from level 60 How to play opens the game tips and the tile explanations (js/coach.js)');
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await p.evaluate(() => showTileLesson('trayPair'));
      t.eq(await p.evaluate(() => lessonTimer), null, 'reduced motion starts paused');
    }
  }},
  { name: 'tile help: introduction requires acknowledgment; below level 60 the third loss starts rotating relevant reminders; resume stays quiet', async run(t, { startLevel, click, modal, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 80, sunSeen: true, seenSp: { ...seen, trayPair: 0 } } });
    await startLevel(p, 50);
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), 'trayPair', 'teach the three-slot trick from level 50');
    t.eq(await p.evaluate(() => [G.mv, !!S.seenSp.trayPair]), [0, false], 'intro pauses play before acknowledgment');
    await click(p, '#ntGo');
    t.eq(await p.evaluate(() => !!JSON.parse(localStorage.getItem(STORE)).seenSp.trayPair), true, 'remember acknowledgment');
    await p.evaluate(() => { S.fails.L55 = 2; save(); });
    await startLevel(p, 55); t.eq(await modal(p), null, 'no reminder after two failures');
    await p.evaluate(() => { failTry(); restart(); });
    t.eq(await p.evaluate(() => S.fails.L55), 3, 'loss counted once');
    const kinds = await p.evaluate(() => ['ice', 'lock', 'trayPair'].filter(k => NEW_TILES[k].has()).concat(G.clock ? ['clock'] : []));
    t.ok(kinds.length > 1, 'level includes several teaching topics');
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), kinds[0], 'third failure shows first relevant tip');
    await sleep(1500); t.eq(await p.locator('.lesson-demo').count(), 1, 'delayed tips do not replace reminder');
    await click(p, '#ntGo');
    await p.evaluate(() => { failTry(); restart(); });
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), kinds[1], 'next failure rotates topic');
    await click(p, '#ntGo');
    await p.reload(); await p.waitForFunction(() => window.__mjReady); await startLevel(p, 55, false);
    t.eq(await modal(p), null, 'resuming an unfinished attempt does not repeat reminder');
  }},
  { name: 'tile help: face-down first clears a different pair with three tray tiles; taking a fourth unrelated tile loses', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 20, seenSp: seen } });
    await startLevel(p, 20);
    const result = await p.evaluate(() => {
      const fr = G.tiles.map((_, i) => i).filter(canTake);
      if (fr.length < 5) throw Error('Need five free tiles for the example');
      const [a, b, c, down, twin] = fr;
      [a, b, c].forEach((i, k) => { G.tiles[i].face = k; G.alive[i] = 0; G.tiles[i].el.classList.add('hidden'); });
      G.tray = [a, b, c]; G.tiles[down].face = G.tiles[twin].face = 31;
      G.down[down] = 1; G.down[twin] = 0; G.peek = -1; renderTray();
      __mj.onTap(down);
      const peek = [G.tray.length, !!G.alive[down], G.peek === down, G.mv];
      __mj.onTap(twin);
      return { peek, pair: [G.tray.length, !!G.alive[down], !!G.alive[twin], G.mv, G.busy] };
    });
    t.eq(result.peek, [3, true, true, 0], 'first tap only peeks, no slot or move used');
    t.eq(result.pair, [3, false, false, 2, false], 'different pair clears and tray stays at three');
    await sleep(400);
    await p.evaluate(() => {
      const i = G.tiles.findIndex((_, i) => G.alive[i] && canTake(i));
      G.down[i] = 0; G.tiles[i].face = 33; __mj.onTap(i);
    });
    await sleep(900);
    t.ok(await p.evaluate(() => G.overShown && G.tray.length === 4), 'ordinary fourth unmatched tile still loses');
  }},
];
