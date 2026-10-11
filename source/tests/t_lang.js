/* English: every text has both languages, the switch in the settings works, and Mama starts in
   English with grandma's extra help. */
'use strict';
const fs = require('fs'), path = require('path');
const MAMA = 'pmv13884fc9vndv';      // in START_ENGLISH (js/rules.js); the database is fake here
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
    name: 'lang: Mama starts in English (not in grandma mode); grandma stays Dutch',
    async run(t) {
      const p = await t.phone({ state: { name: 'Mama', pid: MAMA, level: 12 } });
      t.ok(await p.evaluate(() => isEn() && !careMode()), 'English, normal game');
      t.eq(await homeTexts(p), ['Play', 'Levels', 'Themes', 'Leaderboard'], 'home screen in English');
      await p.evaluate(() => { setLang('nl'); __mj.show('home'); });
      t.eq((await homeTexts(p))[0], 'Spelen', 'her own choice wins');
      const q = await t.phone({ state: { name: 'OmaHanny', pid: 'test-oma' } });
      t.ok(await q.evaluate(() => careMode() && !isEn()), 'grandma: care mode, Dutch');
    },
  },
  {
    name: 'lang: Dutch and English have exactly the same layout (home, settings, prizes, how-to-play, tasks), on small and big phones',
    async run(t, { sleep }) {
      const measure = async (lang, size) => {
        const p = await t.phone({ state: { name: 'Dennis', pid: 'test-dennis', level: 12, lang }, size });
        await p.evaluate(() => __mj.show('home')); await sleep(400);
        const home = await p.evaluate(() => ['#btnPlay', '#btnDaily', '#btnLevels', '#btnThemes', '#btnTrophies', '#btnRanking', '#nextUnlock'].map(s => { const e = document.querySelector(s); return [e.offsetTop, e.offsetHeight, e.offsetWidth]; }));   // (offset*: not moved by the pulse animation)
        const fits = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.row2 .mid-btn b')].every(b => b.scrollWidth <= b.clientWidth + 1));
        await p.evaluate(() => document.querySelector('#btnSettings').click()); await sleep(500);
        const rows = await p.evaluate(() => [...document.querySelectorAll('#modalBox .set-row')].map(r => r.offsetHeight));
        const more = {};
        await p.evaluate(() => { document.querySelector('#modal').classList.add('hidden'); __mj.show('trophies'); }); await sleep(300);
        more.trophies = await p.evaluate(() => [...document.querySelectorAll('.trophy')].map(c => c.offsetHeight).join());
        for (const [k, js] of [['intro', 'showIntro()'], ['tasks', "__mj.show('home'); document.querySelector('#btnTasks').click()"]]) {
          await p.evaluate(js); await sleep(500);
          more[k] = await p.evaluate(() => [...document.querySelectorAll('#modalBox > *')].map(e => e.offsetHeight).join());
          await p.evaluate(() => document.querySelector('#modal').classList.add('hidden'));
        }
        await p.ctx.close();
        return { home, rows, fits, more };
      };
      for (const size of [[390, 760], [360, 640]]) {
        const nl = await measure('nl', size), en = await measure('en', size);
        t.eq(en.home, nl.home, `${size[0]}px: home screen buttons in the same place and size`);
        t.eq(en.rows, nl.rows, `${size[0]}px: settings rows the same height`);
        t.ok(nl.fits && en.fits, `${size[0]}px: nothing sticks out of the screen or its button`, { nl: nl.fits, en: en.fits });
        t.eq(en.more, nl.more, `${size[0]}px: prizes, how-to-play and tasks the same`);
      }
    },
  },
];
