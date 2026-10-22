'use strict';
const path = require('path'), fs = require('fs');
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clockMoves: 1, trayPair: 1 };
const messageText = e => Object.keys(e).filter(k => /^m\d+$/.test(k)).sort((a, b) => +a.slice(1) - +b.slice(1)).map(k => e[k]).join('');
module.exports = [
  { name: 'help messages: exact Dutch and English explanations, acknowledgment, retry, manual help and timeout reach the play log', async run(t, { startLevel, click }) {
    for (const lang of ['nl', 'en']) {
      const pid = 'test-help-msg-' + lang;
      const p = await t.phone({ state: { name: 'Dennis', pid, lang, level: 80, sunSeen: true, seenSp: seen } });
      const drain = async () => { await p.evaluate(() => flushLog()); await p.waitForFunction(() => !flushing && !readQ().length); };
      const messages = () => p.db.plays(pid).filter(e => e.k === 'help_msg');
      await startLevel(p, 80);
      for (const kind of ['ice', 'lock', 'trayPair', 'clock']) {
        await p.evaluate(k => k === 'clock' ? showClockLesson() : showTileLesson(k), kind);
        const expected = await p.evaluate(() => [...$('#modalBox').querySelectorAll('p:not(.lesson-reminder)')].map(p => p.innerText.trim()).filter(Boolean).join('\n\n'));
        await drain();
        const shown = messages().at(-1);
        t.eq([shown.topic, shown.why, shown.action, shown.lang, shown.lv, shown.at], [kind, 'intro', 'shown', lang, 80, 1], 'shown message context');
        t.eq(messageText(shown), expected, 'exact text survives the 40-character database limit');
        t.ok(Object.values(shown).every(v => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' && v.length <= 40), 'message fits existing Firebase rules');
        await click(p, '#ntGo'); await drain();
        const ack = messages().at(-1);
        t.eq([ack.action, ack.mid], ['ack', shown.mid], 'acknowledgment identifies the shown message');
      }
      t.eq(messages().length, 8, 'animation frames do not add feed events');
      await p.evaluate(() => { S.fails.L55 = 3; clearCur(); __mj.startLevel(55); });   // below level 60: reminders; from 60 none (js/coach.js)
      await drain();
      t.eq([messages().at(-1).why, messages().at(-1).fails], ['retry', 3], 'real third-failure reminder is logged when displayed');
      await click(p, '#ntGo');
      await p.evaluate(() => showLessonMenu());
      await click(p, '.cz-pick[data-kind="clockFirst"]'); await drain();
      t.eq(messages().at(-1).why, 'manual', 'manually reopened clock explanation is distinguished');
      await click(p, '#ntGo'); await p.evaluate(() => closeModal());
      await p.evaluate(() => { clearCur(); __mj.startLevel(80); });
      await p.evaluate(() => { G.clock.n = G.mv; checkClock(); });
      await p.waitForSelector('#sMenu', { state: 'visible' }); await drain();
      const timeout = messages().at(-1);
      t.eq([timeout.topic, timeout.why, timeout.action], ['clock', 'timeout', 'shown'], 'clock timeout is logged after its modal appears');
      t.ok(messageText(timeout).includes(lang === 'en' ? 'still there' : 'lag er nog'), 'timeout includes the actual loss explanation');
      await click(p, '#sMenu'); await drain();
      t.eq([messages().at(-1).action, messages().at(-1).mid], ['menu', timeout.mid], 'closing the timeout to the menu is logged');
      await p.evaluate(() => showLessonMenu()); await click(p, '.cz-pick[data-kind="three"]'); await drain();
      t.eq([messages().at(-1).why, messages().at(-1).scr, messages().at(-1).at], ['manual', 'home', undefined], 'help from home is not assigned to an old attempt');
    }
  }},
  { name: 'help messages: live Verloop shows exact escaped text, seconds, language and reason; expanded messages survive updates', async run(t, { serve, FakeDB, browser, WWW }) {
    const site = await serve(path.join(__dirname, '../site'), { '/play/': WWW });
    const now = Date.now(), copy = 'Een aangrenzende steen: ernaast, erboven, erop én eronder. <svg onload="window.__bad=1">';
    const chunks = Object.fromEntries(copy.match(/[\s\S]{1,40}/g).map((v, i) => ['m' + i, v]));
    const base = { k: 'help_msg', v: '1.57', lang: 'nl', lv: 80, at: 4, scr: 'game' };
    const db = new FakeDB({ scores: { pHelp: { name: 'Dennis', level: 80 } }, plays: { pHelp: {
      intro: { ...base, t: now - 9000, mid: 'intro', topic: 'ice', why: 'intro', action: 'shown', title: 'Bevroren stenen', ...chunks },
      ack: { ...base, t: now - 8000, mid: 'intro', topic: 'ice', why: 'intro', action: 'ack' },
      retry: { ...base, t: now - 7000, mid: 'retry', topic: 'lock', why: 'retry', fails: 3, action: 'shown', title: 'Slot en sleutel', ...chunks },
      manual: { ...base, t: now - 6000, mid: 'manual', topic: 'trayPair', why: 'manual', action: 'shown', lang: 'en', title: 'A pair with 3 tiles', ...chunks },
      timeout: { ...base, t: now - 5000, mid: 'timeout', topic: 'clock', why: 'timeout', action: 'shown', title: 'De wekker ging af!', ...chunks },
    } } });
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    try {
      await p.goto(site.url + 'dash/#pHelp');
      await p.waitForSelector('#feed [data-message="intro"]');
      const text = await p.locator('#feed').innerText();
      for (const expected of ['Uitleg getoond: IJs', 'Uitleg bevestigd: IJs', 'eerste uitleg', 'herinnering na 3 mislukte pogingen', 'zelf geopend', 'Engels', 'na afloop van de wekker', 'Level 80 · poging 4']) t.ok(text.includes(expected), 'feed contains ' + expected);
      t.eq(await p.locator('[data-message="intro"] p').textContent(), copy, 'full original message is available');
      t.eq(await p.locator('#feed svg').count(), 0, 'stored markup is escaped');
      t.ok(/^\d\d:\d\d:\d\d$/.test(await p.locator('#feed li').filter({ has: p.locator('[data-message="intro"]') }).locator('.t').innerText()), 'message time includes seconds');
      await p.locator('[data-message="intro"] summary').click();
      await p.evaluate(now => { PLAYS.pHelp.latest = { k: 'show', t: now }; render(); }, now);
      t.ok(await p.locator('[data-message="intro"]').evaluate(e => e.open), 'reading a message survives a live refresh');
      await p.setViewportSize({ width: 390, height: 844 });
      t.ok(await p.locator('#feed').evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'long message wraps on a phone');
      t.eq(errors, [], 'no dashboard errors');
      t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'viewing messages writes no player data');
      if (process.env.CAPTURE_HELP_FEED) { fs.mkdirSync(path.dirname(process.env.CAPTURE_HELP_FEED), { recursive: true }); await p.locator('#feed').screenshot({ path: process.env.CAPTURE_HELP_FEED }); }
    } finally { await ctx.close(); site.close(); }
  }},
];
