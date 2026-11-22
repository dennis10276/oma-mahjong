/* Throwaway: records the ice intro film pop-up (js/intro.js) for Dennis to judge: a video and a few screenshots on a
   phone (390x820) and a tablet (768x1024), each in two themes, as a player meets ice for the first time
   (level 35). On the phone it also makes compare-<theme>.png: the real level 35 after a tap on a frozen tile (its
   touching tiles light up) beside the film at the same kind of moment. Nothing is sent anywhere (a fake database).
   Run from the worktree root:  CHROME=... node source/tools/intro_film_gate.js <output folder> [preview]
   preview: only the phone-classic run, no compare (a quick look before the full gate) */
'use strict';
const fs = require('fs'), path = require('path');
const lib = require('../tests/lib');

const OUT = path.resolve(process.argv[2] || 'intro-ice');
const SEEN = { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 0, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
const RUNS = [
  { name: 'phone-classic', size: [390, 820], theme: 'classic', bg: 'jade', lang: 'nl', compare: true },
  { name: 'phone-fruit', size: [390, 820], theme: 'fruit', bg: 'sunrise', lang: 'nl', compare: true },
  { name: 'tablet-classic', size: [768, 1024], theme: 'classic', bg: 'jade', lang: 'en' },
  { name: 'tablet-fruit', size: [768, 1024], theme: 'fruit', bg: 'sunrise', lang: 'en' },
];
// key moments, in ms after the film opened: each step with its caption (taps at 0.5, 1.8, 2.5, 3.6, 4.7 s; one play is 5.5 s)
const SHOTS = [[1100, '1-tap-shows-thawers'], [3000, '2-diagonal-no-count'], [4100, '3-corner-cracks'], [5200, '4-half-melts'], [6000, '5-done-button']];
const FROZEN_SHOT = 1100;

async function context(r, video) {
  const [w, h] = r.size;
  const ctx = await lib.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ...(video ? { recordVideo: { dir: video, size: { width: w, height: h } } } : {}) });
  const db = new lib.FakeDB({ scores: {} });
  await ctx.route(/^https:\/\/[^/]*firebasedatabase\.app\//, q => db.handle(q));
  await ctx.route('**/news.json*', q => q.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: 4102444800000, items: [] }) }));
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(lib.TODAY + 'T15:00:00'));
  await p.goto(new URL('__blank__', lib.server.url).href);
  const st = { name: 'Dennis', pid: 'test-intro-gate', level: 35, lang: r.lang, theme: r.theme, bg: r.bg, stars: { 1: 3, 2: 3, 3: 3 }, seenIntro: true, seenTray: true, seenDown: true, toolsSeen: true, sunSeen: true,
    sfx: false, music: false, vibrate: false, since: lib.TODAY, giftDay: lib.TODAY, iosTip: true, seenSp: SEEN };
  await p.evaluate(([st, today]) => { localStorage.clear(); localStorage.setItem('omamj.reset', today); localStorage.setItem('omamj.v1', JSON.stringify(st)); }, [st, lib.TODAY]);
  await p.goto(lib.server.url);
  await p.waitForFunction(() => window.__mjReady === true);
  await lib.sleep(400);
  return { ctx, p };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await lib.setup();
  try {
    for (const r of process.argv[3] === 'preview' ? [{ ...RUNS[0], compare: false }] : RUNS) {
      const vids = path.join(OUT, '_video-' + r.name), { ctx, p } = await context(r, vids);
      await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); });
      await p.waitForSelector('#introPanel');
      const t0 = Date.now();
      for (const [ms, label] of SHOTS) {
        await lib.sleep(Math.max(0, t0 + ms - Date.now()));
        await p.screenshot({ path: path.join(OUT, `${r.name}-${label}.png`) });
      }
      // the second play, then a tap on the button: the player's own level comes back
      await lib.sleep(Math.max(0, t0 + 12800 - Date.now()));
      await p.locator('#ntGo').click();
      await lib.sleep(900);
      await p.screenshot({ path: path.join(OUT, `${r.name}-6-level-back.png`) });
      const video = p.video();
      await ctx.close();
      fs.renameSync(await video.path(), path.join(OUT, r.name + '.webm'));
      fs.rmSync(vids, { recursive: true, force: true });
      if (r.compare) await compare(r);
      console.log('done', r.name);
    }
  } finally { await lib.teardown(); }
})();

// the real level 35 with a frozen tile tapped, beside the film at the same kind of moment
async function compare(r) {
  const { ctx, p } = await context(r);
  await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); });
  await p.waitForSelector('#introPanel');
  const t0 = Date.now();
  await lib.sleep(Math.max(0, t0 + FROZEN_SHOT - Date.now()));
  const film = await p.screenshot(), filmTw = await p.evaluate(() => G.tw);
  await lib.sleep(Math.max(0, t0 + 6000 - Date.now()));
  await p.locator('#ntGo').click();
  await lib.sleep(1500);
  const info = await p.evaluate(() => {
    const i = Object.keys(G.ob.left).map(Number).find(k => G.ob.left[k] > 0);
    onTap(i);
    return { tw: G.tw, frozen: i };
  });
  await lib.sleep(300);
  const real = await p.screenshot();
  const [w, h] = r.size, img = b => 'data:image/png;base64,' + b.toString('base64');
  await p.setViewportSize({ width: w * 2 + 30, height: h + 40 });
  await p.setContent(`<body style="margin:0;background:#222;color:#fff;font:600 15px sans-serif;display:flex;gap:10px;padding:5px 5px 0">
    <figure style="margin:0"><figcaption>Level 35, tap on a frozen tile (tile ${info.tw.toFixed(1)} px)</figcaption><img src="${img(real)}" style="width:${w}px;height:${h}px"></figure>
    <figure style="margin:0"><figcaption>Intro film, tap on the frozen tile (tile ${filmTw.toFixed(1)} px)</figcaption><img src="${img(film)}" style="width:${w}px;height:${h}px"></figure></body>`);
  await p.screenshot({ path: path.join(OUT, `compare-${r.theme}.png`) });
  await ctx.close();
}
