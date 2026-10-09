/* English: every text has both languages, the switch in the settings works, and Mama starts in
   English with grandma's extra help. */
'use strict';
const fs = require('fs'), path = require('path');
const MAMA = 'pmv13884fc9vndv';      // in CARE.pids and START_ENGLISH (js/rules.js); the database is fake here
const homeTexts = p => p.evaluate(() => ['#btnPlay b', '#btnLevels b', '#btnThemes b', '#btnRanking b'].map(s => document.querySelector(s).textContent));
const windLetters = p => p.evaluate(() => [27, 28, 29, 30].map(k => (Tiles.faceHTML('classic', k).match(/class="cn"[^>]*>(\w)</) || [])[1]).join(''));

module.exports = [
  {
    name: 'lang: every text used in the game exists in Dutch and English',
    async run(t, { WWW }) {
      const p = await t.phone({});
      const keys = await p.evaluate(() => Object.fromEntries(Object.entries(TEXT).map(([k, v]) => [k, Array.isArray(v) && v.length === 2 && v.every(x => x !== '' && x != null) && typeof v[0] === typeof v[1]])));
      const bad = Object.entries(keys).filter(([, ok]) => !ok).map(([k]) => k);
      t.eq(bad, [], 'every text has a Dutch and an English version of the same kind');
      const src = [path.join(WWW, 'index.html'), path.join(WWW, 'tiles.js'), ...fs.readdirSync(path.join(WWW, 'js')).map(f => path.join(WWW, 'js', f))].map(f => fs.readFileSync(f, 'utf8')).join('\n');
      const used = new Set([...src.matchAll(/\btx\('(\w+)'[,)]/g), ...src.matchAll(/data-t(?:-label)?="(\w+)"/g)].map(m => m[1]));
      const missing = [...used].filter(k => !(k in keys) && k !== 'key');
      t.eq(missing, [], 'no text is missing');
    },
  },
  {
    name: 'lang: switching to English in the settings changes the whole game, and back',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ state: { level: 6, theme: 'classic' } });
      t.eq(await homeTexts(p), ['Spelen', 'Levels', "Thema's", 'Ranglijst'], 'Dutch to start with');
      t.eq(await windLetters(p), 'OZWN', 'Dutch wind letters');
      await click(p, '#btnSettings'); await sleep(250);
      await click(p, '.lp[data-lang="en"]'); await sleep(250);
      t.ok((await p.evaluate(() => document.querySelector('#modalBox').innerText)).includes('Language'), 'the settings are in English right away');
      await p.evaluate(() => document.querySelector('#modal').classList.add('hidden'));
      t.eq(await homeTexts(p), ['Play', 'Levels', 'Themes', 'Leaderboard'], 'home screen in English');
      t.eq(await p.evaluate(() => document.documentElement.lang), 'en', 'page language');
      t.eq(await windLetters(p), 'ESWN', 'English wind letters');
      // it stays English after closing the app
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(300);
      t.eq(await homeTexts(p), ['Play', 'Levels', 'Themes', 'Leaderboard'], 'still English after reopening');
      await startLevel(p, 6);
      t.eq(await p.evaluate(() => [document.querySelector('#gameTitle').textContent, document.querySelector('#btnHint b').textContent, document.querySelector('#btnShuffle b').textContent]), ['Level 6', 'Hint', 'Shuffle'], 'game screen in English');
      // and back to Dutch
      await p.evaluate(() => { __mj.show('home'); setLang('nl'); }); await sleep(250);
      t.eq(await homeTexts(p), ['Spelen', 'Levels', "Thema's", 'Ranglijst'], 'back to Dutch');
    },
  },
  {
    name: 'lang: Mama starts in English with grandma\'s help (the helper, the rescue)',
    async run(t, { startLevel, fillTray, modal, sleep }) {
      const p = await t.phone({ state: { name: 'Mama', pid: MAMA, level: 12 } });
      t.ok(await p.evaluate(() => careMode() && isEn()), 'care mode, in English');
      t.eq(await homeTexts(p), ['Play', 'Levels', 'Themes', 'Leaderboard'], 'home screen in English');
      await startLevel(p, 12);
      t.eq(await p.evaluate(() => __mj.G.ez), 1, 'the gentle deal');
      await fillTray(p);
      const m = await modal(p);
      t.ok(m && m.buttons.includes('rsBack'), 'a full tray offers to put the tiles back', m);
      const txt = await p.evaluate(() => document.querySelector('#modalBox').innerText);
      t.ok(/tiles back/i.test(txt) && !/stenen|terug/i.test(txt), 'the rescue is explained in English', txt);
      // she can still pick Dutch herself
      await p.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); __mj.show('home'); setLang('nl'); }); await sleep(200);
      t.eq((await homeTexts(p))[0], 'Spelen', 'her own choice wins');
      // grandma herself stays Dutch
      const q = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma' } });
      t.ok(await q.evaluate(() => careMode() && !isEn()), 'grandma: care mode, Dutch');
    },
  },
  {
    name: 'lang: the helper makes a pair glow for Mama too',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { name: 'Mama', pid: MAMA, level: 5 }, tune: { HELP: { care: { nudge: { downS: 1, upS: 2 } } } } });
      await startLevel(p, 5);
      await p.evaluate(() => { __mj.G.lastMove = performance.now() - 5000; });
      await p.waitForFunction(() => document.querySelectorAll('.tile.nudge').length >= 1, null, { timeout: 6000 }).catch(() => { });
      t.ok(await p.evaluate(() => document.querySelectorAll('.tile.nudge').length >= 1), 'a pair glows');
    },
  },
];
