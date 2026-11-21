/* Throwaway: records the ice intro film (js/intro.js) for Dennis to judge: a video and a few screenshots on a
   phone (390x820) and a tablet (768x1024), each in two themes, as a player meets ice for the first time
   (level 35). Nothing is sent anywhere (a fake database).
   Run from the worktree root:  CHROME=... node source/tools/intro_film_gate.js <output folder> */
'use strict';
const fs = require('fs'), path = require('path');
const lib = require('../tests/lib');

const OUT = path.resolve(process.argv[2] || 'intro-ice');
const SEEN = { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 0, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
const RUNS = [
  { name: 'phone-classic', size: [390, 820], theme: 'classic', bg: 'jade', lang: 'nl' },
  { name: 'phone-fruit', size: [390, 820], theme: 'fruit', bg: 'sunrise', lang: 'nl' },
  { name: 'tablet-classic', size: [768, 1024], theme: 'classic', bg: 'jade', lang: 'en' },
  { name: 'tablet-fruit', size: [768, 1024], theme: 'fruit', bg: 'sunrise', lang: 'en' },
];
// key moments, in ms after the film opened
const SHOTS = [[600, '1-frozen-tap'], [1650, '2-cracked-above'], [2350, '3-melted-below'], [3100, '4-still-covered'], [5300, '5-done-button']];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, server } = await lib.setup();
  try {
    for (const r of RUNS) {
      const [w, h] = r.size, vids = path.join(OUT, '_video-' + r.name);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, recordVideo: { dir: vids, size: { width: w, height: h } } });
      const db = new lib.FakeDB({ scores: {} });
      await ctx.route(/^https:\/\/[^/]*firebasedatabase\.app\//, q => db.handle(q));
      await ctx.route('**/news.json*', q => q.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: 4102444800000, items: [] }) }));
      const p = await ctx.newPage();
      await p.clock.setFixedTime(new Date(lib.TODAY + 'T15:00:00'));
      await p.goto(new URL('__blank__', server.url).href);
      const st = { name: 'Dennis', pid: 'test-intro-gate', level: 35, lang: r.lang, theme: r.theme, bg: r.bg, stars: { 1: 3, 2: 3, 3: 3 }, seenIntro: true, seenTray: true, seenDown: true, toolsSeen: true, sunSeen: true,
        sfx: false, music: false, vibrate: false, since: lib.TODAY, giftDay: lib.TODAY, iosTip: true, seenSp: SEEN };
      await p.evaluate(([st, today]) => { localStorage.clear(); localStorage.setItem('omamj.reset', today); localStorage.setItem('omamj.v1', JSON.stringify(st)); }, [st, lib.TODAY]);
      await p.goto(server.url);
      await p.waitForFunction(() => window.__mjReady === true);
      await lib.sleep(400);
      await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); });
      await p.waitForSelector('#modalBox .intro-film');
      const t0 = Date.now();
      for (const [ms, label] of SHOTS) {
        await lib.sleep(Math.max(0, t0 + ms - Date.now()));
        await p.screenshot({ path: path.join(OUT, `${r.name}-${label}.png`) });
      }
      // the second play, then a tap on the button
      await lib.sleep(Math.max(0, t0 + 12000 - Date.now()));
      await p.locator('#ntGo').click();
      await lib.sleep(900);
      const video = p.video();
      await ctx.close();
      fs.renameSync(await video.path(), path.join(OUT, r.name + '.webm'));
      fs.rmSync(vids, { recursive: true, force: true });
      console.log('done', r.name);
    }
  } finally { await lib.teardown(); }
})();
