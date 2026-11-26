/* Progress outside a single level: daily tasks and the chest, the weekly challenge, unlocking
   backgrounds and the prize theme, wiping progress, and continuing a level after closing the app. */
'use strict';
const DENNIS = { name: 'Dennis', pid: 'test-prog' };
// click through the pop-ups after a level; returns their titles
async function clickThrough(p, modal, click, sleep, n = 10) {
  const titles = [];
  for (let k = 0; k < n; k++) {
    const m = await modal(p);
    if (!m) { await sleep(500); if (!(await modal(p))) break; continue; }
    titles.push(m.title);
    const id = m.buttons.find(b => !['trSee', 'wMenu', 'sunLater'].includes(b));
    if (!id) break;
    await click(p, '#' + id); await sleep(900);
  }
  return titles;
}

module.exports = [
  {
    name: 'tasks: three done give a star each, then the chest gives points and stars',
    async run(t, { modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 20 } });
      const r = await p.evaluate(() => { const T = __mj.ensureTasks(); T.list.forEach(x => __mj.taskProgress(x.id, x.goal, x.id === 'combo')); renderTaskChip(); return { done: T.list.filter(x => x.done).length, stars: __mj.S.bonusStars, chip: document.querySelector('#taskDots').textContent }; });
      t.eq(r, { done: 3, stars: 3, chip: '🎁' }, 'tasks done: +3 stars, the chest is ready');
      const wk0 = await p.evaluate(() => __mj.S.wk.pts);
      await click(p, '#btnTasks'); await sleep(500);
      t.eq((await modal(p) || {}).title, 'Schatkist!', 'the chest opens');
      const s = await p.evaluate(() => ({ stars: __mj.S.bonusStars, pts: __mj.S.bonusPts, wk: __mj.S.wk.pts, chests: __mj.S.stats.chests }));
      t.eq(s, { stars: 5, pts: 400, wk: wk0, chests: 1 }, 'level 20: +400 points (not for the week: that comes from wins) and +2 stars');
      await click(p, '#chOk'); await sleep(300);
      await click(p, '#btnTasks'); await sleep(300);
      t.ok(/Schatkist van vandaag is open/.test((await modal(p) || {}).text), 'only once a day');
    },
  },
  {
    name: 'week: a new week starts at 0 and last week\'s place is shown once',
    async run(t, { modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 10, wk: { id: '2026-09-28', v: 2, pts: 99999 } } });
      await sleep(900);
      const m = await modal(p);
      t.eq(m?.title, 'Vorige week', 'a solo player sees the personal week result');
      t.eq(await p.evaluate(() => [[__mj.S.wk.id, __mj.S.wk.v, __mj.S.wk.pts], __mj.S.weekWins, __mj.S.stats.weeks]), [['2026-10-05', 2, 0], 0, 1], 'new week at 0, no unverified winner');
      await click(p, '#lwOk'); await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(900);
      t.eq(await modal(p), null, 'not shown again');
    },
  },
  {
    name: 'unlocks: stars open a new background, level 20 wins the Zonnebloem theme',
    async run(t, { startLevel, solve, modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 20, bonusStars: 7, toolsSeen: true } });
      const locked = () => p.evaluate(() => [bgLocked(BGS.find(b => b.id === 'sunrise')), sunUnlocked()]);
      t.eq(await locked(), [true, false], 'before: background locked (7 stars), no prize yet');
      await startLevel(p, 20);
      t.ok(await solve(p, 3800), 'level 20 won');
      t.eq(await locked(), [false, true], 'after: 10 stars open the background, the prize is won');
      const titles = await clickThrough(p, modal, click, sleep);
      t.ok(titles.includes('De hoofdprijs is van jou!') && !titles.includes('Nieuwe achtergrond! 🎉'), 'the prize is shown after the level, and no star-based background pop-up (backgrounds are bought now)', titles);
      t.eq(await p.evaluate(() => [__mj.S.theme, __mj.S.bg]), ['sunflower', 'sunfield'], '"Gebruik het nu" switches to the prize theme');
    },
  },
  {
    name: 'unlocks: the Zonnebloem prize is hers the moment it unlocks, also when she taps Later, and for an old save past the level',
    async run(t, { startLevel, solve, modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 20, toolsSeen: true } });
      const owns = () => p.evaluate(() => [ShopEconomy.ownsItem(S, 'tiles', 'sunflower'), ShopEconomy.ownsItem(S, 'bg', 'sunfield')]);
      t.eq(await owns(), [false, false], 'before level 20: not owned');
      await startLevel(p, 20);
      t.ok(await solve(p, 3800), 'level 20 won');
      let later = false;
      for (let k = 0; k < 12 && !later; k++) {
        const m = await modal(p);
        if (!m) { await sleep(500); continue; }
        if (m.buttons.includes('sunLater')) { t.eq(await owns(), [true, true], 'owned as the prize pop-up opens'); await click(p, '#sunLater'); later = true; break; }
        await click(p, '#' + m.buttons.find(b => !['trSee', 'wMenu'].includes(b))); await sleep(700);
      }
      t.ok(later, 'the prize pop-up was shown');
      t.eq(await owns(), [true, true], 'Later still owns both');
      t.eq(await p.evaluate(() => [__mj.S.theme, ShopEconomy.resolveEquippedItem(S, 'bg')]), ['classic', 'jade'], 'Later does not switch the look');
      // an old save already past the level that never owned them: the home screen grants them
      await p.evaluate(() => { S.owned.tiles = S.owned.tiles.filter(x => x !== 'sunflower'); S.owned.bg = S.owned.bg.filter(x => x !== 'sunfield'); S.sunSeen = true; renderHome(); });
      t.eq(await owns(), [true, true], 'an old save past level 20 owns them after the home screen draws');
    },
  },
  {
    name: 'settings: wiping progress starts at level 1 but keeps sound, display and name',
    async run(t, { modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 30, stars: { 1: 3, 2: 2 }, bonusStars: 5, sfx: false, music: false, bigTiles: true, contrast: true } });
      t.ok(await p.evaluate(() => !Object.hasOwn(__mj.S, 'contrast')), 'old contrast preference is discarded when loading saved progress');
      await p.evaluate(() => confirmReset()); await click(p, '#rsYes'); await sleep(300);
      const s = await p.evaluate(() => { const S = __mj.S; return { level: S.level, stars: S.stars, bonus: S.bonusStars, sfx: S.sfx, music: S.music, big: !!S.bigTiles, legacyContrast: Object.hasOwn(S, 'contrast'), name: S.name, pid: S.pid }; });
      t.eq(s, { level: 1, stars: {}, bonus: 0, sfx: false, music: false, big: false, legacyContrast: false, name: 'Dennis', pid: 'test-prog' }, 'progress gone, settings kept');
    },
  },
  {
    name: 'resume: a level continues where it was after closing the app (everyone)',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 10 } });
      await startLevel(p, 10);
      const path = await p.evaluate(() => __mj.solveNow(60000));
      for (const m of path.slice(0, 7)) { await p.evaluate(m => { const G = __mj.G; if (!G.alive[m]) return; __mj.onTap(m); if (G.alive[m]) __mj.onTap(m); }, m); await sleep(300); }
      const snap = () => p.evaluate(() => { const G = __mj.G; return { left: G.alive.reduce((a, b) => a + b, 0), tray: G.tray.map(t => G.tiles[t].face), score: G.score, at: G.attempt, faces: G.tiles.map(t => t.face).join() }; });
      const before = await snap();
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(300);
      t.ok(/Verder met level 10/.test(await p.evaluate(() => document.querySelector('#playLabel').textContent)), 'home says "Verder met level 10"');
      await startLevel(p, 10, false);
      t.eq(await snap(), before, 'same tiles, tray, score and try');
      t.ok(p.db.plays('test-prog').some(e => e.k === 'start' && e.res === true), 'logged as continued');
    },
  },
];
