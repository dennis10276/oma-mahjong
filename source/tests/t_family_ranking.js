'use strict';

const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const NOW = new Date('2026-10-07T15:00:00').getTime();
const score = (name, level, wkPts, t, online = 0) =>
  ({ name, avatar: '🌷', level, points: 12340, wk: '2026-10-05', wkV: 2, wkPts, t, online });
const me = { name: 'Oma', pid: 'pOma', level: 12 };
const person = (p, scope, name) => p.locator(scope).filter({ hasText: name });
const statuses = row => row.locator('.presence-text, .presence-last').allTextContents();
const settled = p => p.waitForFunction(() => !document.querySelector('#rankViewport')?.classList.contains('rank-moving'));

module.exports = [
  {
    name: 'family ranking: leaving without a win records activity and preserves the score',
    async run(t, { FakeDB }) {
      const existing = score('Oma', 47, 10000, NOW - DAY);
      const db = new FakeDB({ scores: { pOma: existing } });
      const p = await t.phone({ db, state: me });
      t.eq(db.get('scores/pOma'), { ...existing, t: NOW, online: NOW }, 'opening refreshes activity without changing score fields');
      await p.clock.setFixedTime(NOW + MINUTE);
      await p.evaluate(() => updatePresence(false));
      t.eq(db.get('scores/pOma'), { ...existing, t: NOW + MINUTE, online: 0 }, 'leaving clears foreground presence and preserves last seen');
      t.eq(await p.evaluate(() => S.lbOnlineAt), NOW, 'writing presence cannot mark the leaderboard cache as fetched');
    },
  },
  {
    name: 'family ranking: a slow score upload finishes before a later hide',
    async run(t, { FakeDB, sleep }) {
      const db = new FakeDB({ scores: { pOma: score('Oma', 11, 10000, NOW - DAY) } });
      const p = await t.phone({ db, state: me });
      let reached, release;
      const pendingPut = new Promise(resolve => { reached = resolve; });
      const allowPut = new Promise(resolve => { release = resolve; });
      await p.ctx.route(/\/scores\/pOma\.json$/, async route => {
        if (route.request().method() === 'PUT') { reached(); await allowPut; }
        await route.fallback();
      });
      try {
        await p.evaluate(() => { window.scoreUpload = pushScore(); });
        await pendingPut;
        await p.clock.setFixedTime(NOW + MINUTE);
        await p.evaluate(() => { window.hideUpload = updatePresence(false); });
        await sleep(6300);
        t.eq(db.get('scores/pOma/online'), NOW, 'a pending win delays its subsequent hide');
      } finally { release(); }
      await p.evaluate(() => Promise.all([window.scoreUpload, window.hideUpload]));
      t.eq(db.get('scores/pOma/level'), 12, 'full score succeeds on a slow connection');
      t.eq(db.get('scores/pOma/online'), 0, 'hide lands after the completed upload');
      t.eq(db.get('scores/pOma/t'), NOW + MINUTE, 'hide is the newest recorded activity');
    },
  },
  {
    name: 'family ranking: both tabs use fresh activity up to 72 hours and All-time shows levels instead of points',
    async run(t, { FakeDB }) {
      const db = new FakeDB({ scores: {
        pRosa: score('Rosa', 47, 8000, NOW - DAY, NOW - 89999),
        pNoor: score('Noor', 45, 7000, NOW - HOUR, NOW - 90000),
        pIris: score('Iris', 44, 6000, NOW - 18 * MINUTE),
        pLina: score('Lina', 40, 5000, NOW - 2 * HOUR),
        pEmma: score('Emma', 39, 4500, NOW - 26 * HOUR),
        pSara: score('Sara', 35, 4000, NOW - 3 * DAY),
        pMilo: score('Milo', 30, 3000, NOW - 3 * DAY - 1),
        pPuck: score('Puck', 25, 2000, NOW + MINUTE, NOW + MINUTE),
        pBram: score('Bram', 24, 1000, 0),
        pSven: score('Sven', 20, 500, NOW - 4 * DAY),
        pTess: score('Tess', 19, 400, NOW - 5 * DAY),
      }, hearts: { pTess: { pOma: { name: 'Oma', t: -(NOW - 5 * DAY) } } } });
      const p = await t.phone({ db, size: [360, 730], state: {
        ...me, heartsSeen: { pBram: NOW - 4 * MINUTE },
        heartsOut: {
          pTess: { t: NOW - 5 * DAY, seen: 0 }, pSven: { t: NOW - 2 * DAY, seen: NOW - HOUR },
          pLina: { t: NOW - 3 * HOUR, seen: NOW - 2 * HOUR },
        },
      } });
      await p.evaluate(() => checkSentHearts());
      t.eq(await p.evaluate(() => S.heartsOut.pTess.seen), NOW, 'viewer has just discovered a five-day-old receipt');
      await p.locator('#btnRanking').click();
      const row = name => person(p, '#rankList .rrow', name);
      const expected = {
        Rosa: ['online'], Noor: ['zojuist'], Iris: ['18m geleden'], Lina: ['2u geleden'], Emma: ['gisteren'],
        Sara: ['3d geleden'], Milo: [], Puck: [], Bram: ['zojuist'], Sven: ['2d geleden'], Tess: [], Oma: [],
      };
      for (const tab of ['#rkWeek', '#rkAll']) {
        await p.locator(tab).click();
        await settled(p);
        for (const [name, want] of Object.entries(expected)) t.eq(await statuses(row(name)), want, tab + ' status for ' + name);
      }
      t.eq(await row('Rosa').locator('.presence-dot').count(), 1, 'active avatar gets a dot');
      t.eq(await row('Noor').locator('.presence-dot').count(), 0, '90-second heartbeat is no longer online');
      t.eq(await p.locator('#rkAll').innerText(), '🏆 All-time', 'Dutch keeps the existing label');
      t.ok(!/12[.,]340|punten/.test(await row('Lina').innerText()), 'all-time card omits total points');
      t.ok(/level\s*40/i.test(await row('Lina').innerText()), 'all-time card still shows level');
      t.ok(await row('Lina').locator('.heart-btn').count() === 1, 'the heart button stays on the row');
      t.ok(/gezien/.test(await row('Lina').innerText()), 'a seen heart is still told on the row');
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('omamj.lb')).find(e => e.id === 'pSara').t), NOW - 3 * DAY, 'score timestamp survives the cache');
      await p.evaluate(() => { S.lang = 'en'; applyLang(); renderRanking(); });
      for (const [name, want] of [['Noor', 'just now'], ['Iris', '18m ago'], ['Lina', '2h ago'], ['Emma', 'yesterday'], ['Sara', '3d ago']]) {
        t.eq(await statuses(row(name)), [want], 'English status for ' + name);
      }
      await row('Lina').locator('.heart-btn').click();
      t.eq(await statuses(p.locator('.heart-compose')), [], 'the send-heart dialog keeps activity on the ranking card');
    },
  },
  {
    name: 'family ranking: win, climb and passed notifications show the same recent activity',
    async run(t, { FakeDB, startLevel, solve }) {
      const db = new FakeDB({ scores: {
        pRosa: score('Rosa', 47, 100000, NOW, NOW - 1000),
        pNoor: score('Noor', 45, 50000, NOW - 2 * HOUR),
        pMilo: score('Milo', 35, 5000, NOW - 4 * DAY),
      } });
      const p = await t.phone({ db, size: [360, 730], state: me });
      await startLevel(p, 12);
      await solve(p);
      await p.waitForSelector('#wFamily .fam-row');
      const win = name => person(p, '#wFamily .fam-row', name);
      t.eq(await statuses(win('Noor')), ['2u geleden'], 'win standings preserve recent status');
      t.eq(await statuses(win('Milo')), [], 'win standings hide old activity');
      t.ok(await win('Noor').evaluate(row => {
        const status = row.querySelector('.presence-last');
        return status && status.getBoundingClientRect().right <= row.querySelector('.fr-name').getBoundingClientRect().right + 1;
      }), 'win status fits in the narrow name column');
      await p.evaluate(() => { closeModal(); showClimb(0, 60000, () => {}, 'week'); });
      const climb = name => person(p, '.climb .rrow', name);
      t.eq(await statuses(climb('Rosa')), ['online'], 'next climb target is online');
      t.eq(await statuses(climb('Noor')), ['2u geleden'], 'overtaken row shows last online');
      t.eq(await statuses(climb('Milo')), [], 'climb hides old activity');
      await p.evaluate(() => {
        closeModal(); show('home');
        S.famBelow = ['pRosa', 'pNoor', 'pMilo'];
        checkPassed();
      });
      const passed = name => person(p, '.passed-row', name);
      t.eq(await statuses(passed('Rosa')), ['online'], 'passed-by-family row shows online');
      t.eq(await passed('Rosa').locator('.presence-dot').count(), 1, 'passed-by-family avatar gets a dot');
      t.eq(await statuses(passed('Noor')), ['2u geleden'], 'passed-by-family row shows last online');
      t.eq(await statuses(passed('Milo')), [], 'passed-by-family row hides old activity');
      const family = await p.evaluate(() => famHTML('week', undefined, undefined, true, false));
      t.ok(family.includes('2u geleden'), 'ordinary family rows also show activity');
    },
  },
  {
    name: 'family ranking: swiping changes tabs and vertical gestures scroll',
    async run(t, { FakeDB }) {
      const scores = Object.fromEntries(Array.from({ length: 14 }, (_, i) => ['pFam' + i, score('Speler ' + i, i + 20, 1000 + i, NOW)]));
      const p = await t.phone({ db: new FakeDB({ scores }), size: [360, 700], state: me });
      await p.locator('#btnRanking').click();
      const cdp = await p.ctx.newCDPSession(p);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      async function drag(x, y, dx, dy) {
        await touch('touchStart', x, y);
        for (let step = 1; step <= 5; step++) await touch('touchMove', x + dx * step / 5, y + dy * step / 5);
      }
      async function swipe(x, y, dx, dy) {
        await drag(x, y, dx, dy);
        await touch('touchEnd');
        await settled(p);
      }
      const tab = () => p.locator('#ranking .rk-tabs .on').getAttribute('id');
      const geometry = () => p.evaluate(() => {
        const x = sel => document.querySelector(sel).getBoundingClientRect().left;
        const tabs = document.querySelector('#ranking .rk-tabs');
        const highlight = new DOMMatrixReadOnly(getComputedStyle(tabs, '::before').transform);
        const next = document.querySelector('#rankNext');
        return { header: x('#ranking .header'), sky: x('#bg'), tabs: tabs.getBoundingClientRect().left,
          block: x('#rankList'), highlight: highlight.m41, incoming: !!next && !next.hidden && next.inert };
      });
      const begin = await geometry();
      await drag(250, 440, -17, 2);
      const sliding = await geometry();
      t.eq([sliding.header, sliding.sky, sliding.tabs], [begin.header, begin.sky, begin.tabs], 'header, scene and labels stay anchored');
      t.ok(sliding.block < begin.block - 12, 'the standings block follows the finger before release', sliding);
      t.ok(sliding.highlight > begin.highlight + 5, 'the pink tab highlight moves with the drag', sliding);
      t.ok(sliding.incoming, 'adjacent standings are visible during drag and inert');
      t.eq(await tab(), 'rkWeek', 'a drag does not commit before release');
      await touch('touchEnd');
      await settled(p);
      t.eq(await geometry(), begin, 'a tiny drag snaps the block and highlight back');
      await p.evaluate(() => {
        const row = $('#rankList .rrow'), header = $('#ranking .header');
        const first = new Touch({ identifier: 1, target: row, clientX: 250, clientY: 440 });
        const drag = new Touch({ identifier: 1, target: row, clientX: 187, clientY: 440 });
        const second = new Touch({ identifier: 2, target: header, clientX: 100, clientY: 45 });
        row.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [first] }));
        row.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [drag] }));
        header.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [drag, second] }));
        row.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [second], changedTouches: [drag] }));
        header.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [second] }));
      });
      const unstuck = await p.waitForFunction(() => $('#rankNext').hidden, null, { timeout: 1300 }).then(() => true, () => false);
      if (!t.ok(unstuck, 'a second contact outside the standings cannot strand the drag')) { await cdp.detach(); return; }
      t.eq(await geometry(), begin, 'an interrupted drag restores the original standings and highlight');
      await swipe(250, 440, -28, 4);
      t.eq(await tab(), 'rkAll', 'a short left swipe switches to All-time');
      await swipe(105, 440, 28, 4);
      t.eq(await tab(), 'rkWeek', 'a short right swipe returns to Deze week');
      await swipe(220, 520, -50, -145);
      t.eq(await tab(), 'rkWeek', 'mostly vertical gesture keeps tab');
      const scroll = p.locator('#rankList .rl-scroll');
      await p.waitForFunction(() => document.querySelector('#rankList .rl-scroll').scrollTop > 0);
      t.ok(await scroll.evaluate(el => el.scrollTop > 0), 'vertical gesture scrolls the rows of the block');
      await scroll.evaluate(el => { el.scrollTop = 0; });
      // (on a busy machine the tap can land before the switch starts, so settled() alone may return too early:
      // wait up to 3 s for the tab itself; a tap that is really ignored still fails)
      const tabIs = id => p.waitForFunction(id => document.querySelector('#ranking .rk-tabs .on')?.id === id, id, { timeout: 3000 }).catch(() => {});
      await p.locator('#rkAll').tap();
      await tabIs('rkAll'); await settled(p);
      t.eq(await tab(), 'rkAll', 'All-time tap still works');
      await p.locator('#rkWeek').tap();
      await tabIs('rkWeek'); await settled(p);
      t.eq(await tab(), 'rkWeek', 'Deze week tap still works');
      const heart = p.locator('#rankList .heart-btn').first();
      await heart.scrollIntoViewIfNeeded();
      const box = await heart.boundingBox();
      await swipe(box.x + box.width / 2, box.y + box.height / 2, -28, 0);
      t.eq(await tab(), 'rkAll', 'a swipe beginning on a heart still switches tabs');
      t.eq(await p.locator('.heart-compose').count(), 0, 'swiping from a button does not open the heart composer');
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await p.locator('#rkWeek').evaluate(button => button.click());
      t.eq(await tab(), 'rkWeek', 'reduced motion commits tab selection immediately');
      t.ok(!(await geometry()).incoming, 'reduced motion leaves no preview list');
      await cdp.detach();
    },
  },
  {
    name: 'family ranking: the block shows 6 whole rows, scrolls by whole rows and long names fit',
    async run(t, { FakeDB }) {
      const scores = Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['pFam' + i, score('Speler ' + i, 30 + i, 1000 + i, NOW)]));
      scores.pLong = { ...score('Elisabeth-Marie', 31, 195, NOW - 26 * HOUR), avatar: '🧑‍🦳', title: 'ttl_cookie', perfect: true };
      const p = await t.phone({ db: new FakeDB({ scores }), size: [392, 785], state: me });
      await p.locator('#btnRanking').click();
      await p.evaluate(() => document.fonts.ready);
      const rows = () => p.evaluate(() => {
        const b = document.querySelector('#rankList .rl-scroll').getBoundingClientRect();
        return { block: document.querySelector('#rankList .rank-block').clientHeight + 6, inner: b.height,
          inside: [...document.querySelectorAll('#rankList .rrow')].filter(r => { const q = r.getBoundingClientRect(); return q.top >= b.top - 0.5 && q.bottom <= b.bottom + 0.5; }).length };
      });
      const r = await rows();
      t.eq([r.block, r.inner, r.inside], [412, 390, 6], 'top 6 rows are fully inside the block at 392x785', r);
      await p.locator('#rankList .rl-scroll').evaluate(el => { el.scrollTo({ top: 140, behavior: 'instant' }); });
      await p.waitForFunction(() => { const el = document.querySelector('#rankList .rl-scroll'); return el.scrollTop % 66 === 0 && el.scrollTop > 0; }, null, { timeout: 3000 }).catch(() => {});
      const top = await p.locator('#rankList .rl-scroll').evaluate(el => el.scrollTop);
      t.ok(top > 0 && top % 66 === 0, 'the block scrolls by whole rows (scroll 140 snaps to a multiple of 66)', top);
      const fit = await p.locator('#rankList .rrow').filter({ hasText: 'Elisabeth-Marie' }).evaluate(el => {
        const c = document.createElement('canvas').getContext('2d'), width = (n) => { const cs = getComputedStyle(n); c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; return c.measureText(n.textContent).width; };
        const nm = el.querySelector('.nmt'), small = el.querySelector('.rn small'), pf = el.querySelector('.pf');
        return { w: [width(nm), nm.clientWidth, width(small), small.clientWidth, el.querySelector('.rn').clientWidth], name: width(nm) <= nm.clientWidth + 0.5, small: width(small) <= small.clientWidth + 0.5, sticker: !!pf, text: small.textContent };
      });
      t.ok(fit.name && fit.small && fit.sticker, 'long name with PERFECT and Koekjesmonster · gisteren fits', fit);
      t.ok(/Koekjesmonster · gisteren/.test(fit.text), 'the line under the name is the nickname and presence', fit);
    },
  },
  {
    name: 'family ranking: the tiles, my Perfect state, shop titles and a bought frame',
    async run(t, { FakeDB }) {
      const stars = Object.fromEntries(Array.from({ length: 11 }, (_, i) => ['L' + (i + 1), i === 4 ? 2 : 3]));   // the game's own key format
      const scores = { pA: { ...score('Anna', 40, 100, NOW - HOUR), title: 'ttl_cheese', perfect: true, frame: 'frm_tulip' }, pB: score('Bas', 20, 50, NOW - HOUR) };
      const p = await t.phone({ db: new FakeDB({ scores }), size: [392, 785], state: { ...me, level: 12, stars, title: 'ttl_coffee', owned: { frame: ['none', 'frm_sky'] }, frame: 'frm_sky' } });
      await p.locator('#btnRanking').click();
      t.ok(/Weekbeker/.test(await p.locator('#rankList .week-tile').innerText()), 'the week tab starts with the cup tile');
      await p.locator('#rkAll').click(); await settled(p);
      const tile = await p.locator('#rankList .week-tile').innerText();
      t.ok(/Nog 1 level/.test(tile) && /10 van 11 levels/.test(tile), 'one level without 3 stars', tile);
      const mine = p.locator('#rankList .rrow.me');
      t.ok(!(await mine.locator('.pf').count()) && /Koffiepauze/.test(await mine.innerText()), 'not Perfect yet, shows my nickname');
      t.eq(await mine.locator('.ra').evaluate(el => el.className.includes('fr-frm_sky') && getComputedStyle(el).borderTopWidth !== '0px'), true, 'my bought frame is drawn');
      t.eq(await p.locator('#rankList .rrow').filter({ hasText: 'Anna' }).locator('.pf').count(), 1, 'a Perfect family member gets the sticker');
      await p.evaluate(() => { S.stars.L5 = 3; renderRanking(); });
      t.ok(/Jij bent/.test(await p.locator('#rankList .week-tile').innerText()) && await p.locator('#rankList .rrow.me .pf').count() === 1, 'all levels 3 stars: PERFECT tile and sticker');
      await p.locator('#rkPlay').click();
      t.eq(await p.evaluate(() => curScreen), 'levels', 'Speel opens the levels');
    },
  },
  {
    name: 'family ranking: long names and framed avatars fit beside multi-digit ranks on phones',
    async run(t, { FakeDB }) {
      const scores = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['pFam' + i, score('Speler ' + i, 500 + i, 20000 + i, NOW)]));
      scores.pLong = { ...score('rashmiisdebeste', 455, 18000, NOW, NOW - MINUTE), avatar: '🌻', frame: 'crown' };
      const p = await t.phone({ db: new FakeDB({ scores }), size: [392, 730], state: me });
      await p.locator('#btnRanking').click();
      await p.locator('#rkAll').click();
      await settled(p);
      await p.evaluate(() => document.fonts.ready);
      for (const width of [392, 360]) {
        await p.setViewportSize({ width, height: 730 });
        const row = person(p, '#rankList .rrow', 'rashmiisdebeste');
        const layout = await row.evaluate(el => {
          const rank = el.querySelector('.rk');
          const name = el.querySelector('.nmt');
          const cs = getComputedStyle(name), c = document.createElement('canvas').getContext('2d');
          c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
          const title = { width: c.measureText(name.textContent).width };
          const lines = 1;
          const range = new Range();
          range.selectNodeContents(rank);
          const place = range.getBoundingClientRect();
          const avatar = el.querySelector('.ra').getBoundingClientRect();
          return { lines, fits: title.width <= name.clientWidth + 0.5, gap: avatar.left - place.right,
            rank: rank.textContent, rankFits: place.width <= rank.clientWidth + 1 };
        });
        t.eq(layout.rank, '#10', 'multi-digit place at ' + width + ' px');
        t.ok(layout.rankFits && layout.gap >= 4, 'rank stays clear of the framed avatar at ' + width + ' px', layout);
        t.ok(layout.lines === 1 && layout.fits, 'the entire name fits on one line at ' + width + ' px', layout);
      }
    },
  },
];
