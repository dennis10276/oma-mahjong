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
      t.eq(s, { stars: 5, pts: 400, wk: wk0 + 400, chests: 1 }, 'level 20: +400 points (also for the week) and +2 stars');
      await click(p, '#chOk'); await sleep(300);
      await click(p, '#btnTasks'); await sleep(300);
      t.ok(/Schatkist van vandaag is open/.test((await modal(p) || {}).text), 'only once a day');
    },
  },
  {
    name: 'week: a new week starts at 0 and last week\'s place is shown once',
    async run(t, { modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 10, wk: { id: '2026-09-28', pts: 99999 } } });
      await sleep(900);
      const m = await modal(p);
      t.ok(m && /Vorige week werd je #1/.test(m.title), 'last week\'s result', m);
      t.eq(await p.evaluate(() => [__mj.S.wk, __mj.S.weekWins, __mj.S.stats.weeks]), [{ id: '2026-10-05', pts: 0 }, 1, 1], 'new week at 0, a week won');
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
      t.ok(titles.includes('De hoofdprijs is van jou!') && titles.includes('Nieuwe achtergrond! 🎉'), 'both shown after the level', titles);
      t.eq(await p.evaluate(() => [__mj.S.theme, __mj.S.bg]), ['sunflower', 'sunfield'], '"Gebruik het nu" switches to the prize theme');
    },
  },
  {
    name: 'settings: wiping progress starts at level 1 but keeps sound, display and name',
    async run(t, { modal, click, sleep }) {
      const p = await t.phone({ state: { ...DENNIS, level: 30, stars: { 1: 3, 2: 2 }, bonusStars: 5, sfx: false, music: false, bigTiles: true, contrast: true } });
      await p.evaluate(() => confirmReset()); await click(p, '#rsYes'); await sleep(300);
      const s = await p.evaluate(() => { const S = __mj.S; return { level: S.level, stars: S.stars, bonus: S.bonusStars, sfx: S.sfx, music: S.music, big: S.bigTiles, contrast: S.contrast, name: S.name, pid: S.pid }; });
      t.eq(s, { level: 1, stars: {}, bonus: 0, sfx: false, music: false, big: true, contrast: true, name: 'Dennis', pid: 'test-prog' }, 'progress gone, settings kept');
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
