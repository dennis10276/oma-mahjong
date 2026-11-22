/* Throwaway: records the ice intro film pop-up (js/intro.js) for the owner to judge, in the sunflower theme, as a player
   meets ice for the first time (level 35): on a phone (390x820, Dutch) a video, a still per step and the level after
   it, and compare-sunflower.png (the real level 35 after a tap on a frozen tile beside the film's first tap); on a
   tablet (768x1024, Dutch) a video; on a small phone (360x640, English) a still of the widest caption. Nothing is
   sent anywhere (a fake database).
   Run from the worktree root:  CHROME=... node source/tools/intro_film_gate.js <output folder> [preview] [kind]
   preview: only the first run (phone, sunflower, Dutch), no compare (a quick look before the full gate)
   kind: ice (default), lock, trayPair or clock: the film over the level where it is first met, with a still at rest,
   one per caption and one at the end of a play */
'use strict';
const fs = require('fs'), path = require('path');
const lib = require('../tests/lib');

const OUT = path.resolve(process.argv[2] || 'intro-ice');
const KIND = process.argv[4] || 'ice', LEVEL = { ice: 35, lock: 45, trayPair: 50, clock: 80, menu: 80, tips: 80 }[KIND];
const SEEN = { gold: 1, gift: 1, joker: 1, joker2: 1, ice: +(KIND !== 'ice'), lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
// always in the sunflower theme for the owner (2026-11-22); level 35 is past RULES.sunflower.level, so it is unlocked.
// stills: which of SHOTS to take (all, and the level after it, when not given); video: false for a still only
const RUNS = [
  { name: 'phone-sunflower', size: [390, 820], lang: 'nl', compare: true },
  { name: 'tablet-sunflower', size: [768, 1024], lang: 'nl', stills: [] },
  { name: 'phone360-sunflower-en', size: [360, 640], lang: 'en', stills: ['3-half-cracks'], video: false },   // "Half above counts: ❄️❄️ → ❄️", the widest
];
// key moments, in ms after the film opened: the board at rest, then each step with its caption (taps at 1.3, 2.75, 3.45,
// 4.9, 6.35 s; one play is 7 s)
const SHOTS = [[900, '0-at-rest'], [1900, '1-tap-shows-thawers'], [4050, '2-diagonal-no-count'], [5500, '3-half-cracks'], [6950, '4-corner-thaws'], [7400, '5-done-button']];
const FROZEN_SHOT = 1900;

async function context(r, video) {
  const [w, h] = r.size;
  const ctx = await lib.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ...(video ? { recordVideo: { dir: video, size: { width: w, height: h } } } : {}) });
  const db = new lib.FakeDB({ scores: {} });
  await ctx.route(/^https:\/\/[^/]*firebasedatabase\.app\//, q => db.handle(q));
  await ctx.route('**/news.json*', q => q.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: 4102444800000, items: [] }) }));
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(lib.TODAY + 'T15:00:00'));
  await p.goto(new URL('__blank__', lib.server.url).href);
  const st = { name: 'Anna', pid: 'test-intro-gate', level: LEVEL, lang: r.lang, theme: 'sunflower', bg: 'sunfield', stars: { 1: 3, 2: 3, 3: 3 }, seenIntro: true, seenTray: true, seenDown: true, toolsSeen: true, sunSeen: true,
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
    for (const r of process.argv[3] === 'preview' ? [{ ...RUNS[0], compare: false }] : KIND === 'tips' ? [RUNS[0], RUNS[2]] : RUNS) {
      const vids = r.video !== false && path.join(OUT, '_video-' + r.name), { ctx, p } = await context(r, vids);
      if (KIND === 'menu' || KIND === 'tips') { await (KIND === 'menu' ? menu : tips)(p, r); if (vids) await saveVideo(p, ctx, r, vids); else await ctx.close(); console.log('done', r.name); continue; }
      const shots = KIND === 'ice' ? SHOTS : await openFilm(p);
      if (KIND === 'ice') { await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); }); await p.waitForSelector('#introPanel'); }
      const t0 = Date.now();
      for (const [ms, label] of shots.filter(([, label]) => !r.stills || r.stills.includes(label))) {
        await lib.sleep(Math.max(0, t0 + ms - Date.now()));
        await p.screenshot({ path: path.join(OUT, `${r.name}-${label}.png`) });
      }
      if (!vids) { await ctx.close(); console.log('done', r.name); continue; }
      // the second play, then a tap on the button: the player's own level comes back
      const [ms, plays] = await p.evaluate(k => { const f = INTRO_FILMS[k], parts = f.parts || [f]; return [parts.reduce((a, q) => a + q.ms, 0), f.plays || 2]; }, KIND);
      await lib.sleep(Math.max(0, t0 + plays * ms + (plays - 1) * 1500 + 1800 - Date.now()));
      await p.locator('#ntGo').click();
      await lib.sleep(900);
      if (!r.stills) await p.screenshot({ path: path.join(OUT, `${r.name}-level-back.png`) });
      await saveVideo(p, ctx, r, vids);
      if (r.compare) await compare(r);
      console.log('done', r.name);
    }
  } finally { await lib.teardown(); }
})();

async function saveVideo(p, ctx, r, vids) {
  const video = p.video();
  await ctx.close();
  fs.renameSync(await video.path(), path.join(OUT, r.name + '.webm'));
  fs.rmSync(vids, { recursive: true, force: true });
}
// How to play (settings) and its list of the specials met so far: a film and a card opened from it, and the first-meeting cards
async function menu(p, r) {
  const shot = async (label, ms = 700) => { await lib.sleep(ms); await p.screenshot({ path: path.join(OUT, `${r.name}-${label}.png`) }); };
  await p.evaluate(L => { localStorage.removeItem('omamj.cur'); __mj.startLevel(L); }, LEVEL);
  await p.waitForFunction(L => !document.querySelector('#buildMsg') && G && G.key === 'L' + L && !G.introducing, LEVEL, { timeout: 60000 });
  await lib.sleep(900);
  await p.evaluate(() => openSettings()); await shot('0-settings');
  await p.locator('#mHow').click(); await shot('1-how-to-play');
  await p.locator('#mTileHelp').click(); await shot('2-list');
  await p.locator('.lesson-pick[data-kind="lock"]').click(); await shot('3-lock-film-from-list', 2000);
  await lib.sleep(1500); await p.locator('#ntGo').click(); await shot('4-back-to-list', 1200);
  await p.locator('#mClose').click(); await lib.sleep(500);
}
// the "Wist je dat?" tips: the home card with two different tips (390 px) and two on a 360 px phone
async function tips(p, r) {
  for (const [n, k] of [[1, 'hint'], [2, 'daily'], [3, 'ice'], [4, 'trayPair']].filter(([n]) => r.size[0] === 390 ? n < 3 : n > 2)) {
    await p.evaluate(k => { show('home'); const i = HOME_TIPS.findIndex(t => t[1] === k); const el = $('#homeTip'), t = HOME_TIPS[i], x = tipEl(t[0], t[1], 'home-tip'); el.replaceWith(x); x.id = 'homeTip'; }, k);
    await lib.sleep(800);
    await p.screenshot({ path: path.join(OUT, `${r.name}-home-${k}.png`) });
  }
}
// the other films (not yet shown by the game itself): the level opens, then the film as at the first meeting
async function openFilm(p) {
  await p.evaluate(L => { localStorage.removeItem('omamj.cur'); __mj.startLevel(L); }, LEVEL);
  await p.waitForFunction(L => !document.querySelector('#buildMsg') && G && G.key === 'L' + L && !G.introducing, LEVEL, { timeout: 60000 });
  await lib.sleep(900);
  const film = await p.evaluate(kind => { playIntroFilm(kind, { required: true }); return INTRO_FILMS[kind]; }, KIND);
  // (a film in parts: every part's taps on one clock, and a still at the end of each part but the last)
  const parts = film.parts || [film], start = parts.map((_, p) => parts.slice(0, p).reduce((a, q) => a + q.ms, 0)), ms = start.at(-1) + parts.at(-1).ms;
  const caps = parts.flatMap((part, p) => part.taps.filter(x => x[2]).map(([t, , cap]) => [start[p] + t, cap]));
  const ends = parts.slice(0, -1).map((part, p) => [start[p] + part.ms - 400, `part${p + 1}-end`]);
  return [[900, '0-at-rest'], ...caps.map(([t, cap], k) => [t + 650, `${k + 1}-${cap}`]), ...ends, [ms + 400, `${caps.length + 1}-done-button`]].sort((a, b) => a[0] - b[0]);
}
// the real level 35 with a frozen tile tapped, beside the film at the same kind of moment
async function compare(r) {
  const { ctx, p } = await context(r);
  await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); });
  await p.waitForSelector('#introPanel');
  const t0 = Date.now();
  await lib.sleep(Math.max(0, t0 + FROZEN_SHOT - Date.now()));
  const film = await p.screenshot(), filmTw = await p.evaluate(() => G.tw);
  await lib.sleep(Math.max(0, t0 + 7400 - Date.now()));
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
  await p.screenshot({ path: path.join(OUT, 'compare-sunflower.png') });
  await ctx.close();
}
