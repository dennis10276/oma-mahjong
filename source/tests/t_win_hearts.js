'use strict';

const family = {
  pDen: { name: 'Dennis', avatar: '😊', points: 40000, level: 27, wk: '2026-10-05', wkPts: 4000 },
  pAnna: { name: 'Anna', avatar: '🌷', points: 30000, level: 15, wk: '2026-10-05', wkPts: 3000 },
};
const bounds = p => p.locator('#modalBox').evaluate(el => [el.offsetWidth, el.offsetHeight]);

module.exports = [
  {
    name: 'win hearts: every preset message shows the sent confirmation',
    async run(t, { FakeDB, startLevel, solve, sleep }) {
      const db = new FakeDB({ scores: family });
      const p = await t.phone({ db, state: { name: 'OmaHanny', pid: 'pOma', level: 12 } });
      await startLevel(p, 12); await solve(p, 3500); await sleep(400);
      const size = await bounds(p), expected = ['Goed bezig! 💪', 'Dank je wel! 😊', 'Ik ben bij level 13! 🧩'];
      for (let i = 0; i < expected.length; i++) {
        await p.locator('#wFamily .heart-btn').first().click();
        await p.locator('.msg-pick .mp').nth(i).click();
        await p.waitForSelector('#hsOk');
        t.eq(await p.locator('#modalBox h2').innerText(), 'Berichtje verstuurd! 😊', `preset ${i + 1}: sent popup`);
        const confirmation = await bounds(p);
        t.eq(confirmation[0], size[0], `preset ${i + 1}: same popup width`);
        t.ok(confirmation[1] < size[1], `preset ${i + 1}: shorter confirmation box`);
        const stored = Object.values(db.get('plays/msg-pDen') || {}).at(-1);
        t.eq([stored.m0, stored.m1, stored.m2].filter(Boolean).join(''), expected[i], `preset ${i + 1}: correct message stored`);
        await p.locator('#hsOk').click();
        t.eq(await p.locator('#wNext').count(), 1, `preset ${i + 1}: dismiss returns to win`);
        await p.evaluate(() => { __mj.S.heartsSent = {}; winFamilyRefresh(); }); // fresh fake daily allowance for the next preset
      }
      await p.locator('#wFamily .heart-btn').first().click();
      await p.locator('#hmNone').click(); await p.waitForSelector('#hsOk');
      t.eq(await p.locator('#modalBox h2').innerText(), 'Hartje verstuurd!', 'heart-only confirmation stays accurate');
      t.eq(p.errors, [], 'no errors for any preset');
    },
  },
  {
    name: 'win hearts: same-size picker, custom message, cancel, return and rewards only once',
    async run(t, { FakeDB, startLevel, solve, sleep }) {
      const db = new FakeDB({ scores: family });
      const p = await t.phone({ db, state: { name: 'OmaHanny', pid: 'pOma', avatar: '👵', level: 12 } });
      await startLevel(p, 12); t.ok(await solve(p, 3500), 'won the level');
      await p.waitForFunction(() => document.querySelector('#wPerfect.on'));
      await sleep(400);
      const now = await p.evaluate(() => Date.now());
      db.set('scores/pDen/online', now); db.set('scores/pAnna/online', now - 90001);
      await p.evaluate(async () => { await fetchOnline(); winFamilyRefresh(); });
      t.eq(await p.locator('#wFamily .heart-btn').count(), 2, 'hearts only on other real players');
      t.eq(await p.locator('#wFamily .presence-text').count(), 1, 'only fresh foreground presence is online');
      const initial = await bounds(p);
      const noControls = await p.evaluate(() => {
        const el = document.querySelector('#wFamily'), html = el.innerHTML;
        el.querySelectorAll('.heart-btn,.presence-dot,.presence-text').forEach(n => n.remove());
        el.querySelector('.fam-box').classList.remove('win-family');
        const result = document.querySelector('#modalBox').offsetHeight;
        el.innerHTML = html; winFamilyRefresh(); return result;
      });
      t.eq(initial[1], noControls, 'adding hearts preserves the existing win popup height');
      const progress = await p.evaluate(() => [__mj.S.level, __mj.myPoints(), __mj.S.stats.wins]);
      await p.locator('#wFamily .heart-btn').first().click();
      t.eq(await bounds(p), initial, 'heart picker has the same width and height');
      t.eq(await p.locator('.msg-pick .mp').count(), 3, 'three quick suggestions');
      t.ok(!(await p.locator('#modalBox').innerText()).includes('Ik denk aan je'), 'removed suggestion');
      await p.locator('#hmBack').click();
      t.eq(await bounds(p), initial, 'cancel restores the win screen');
      t.eq(await p.locator('#wNext').count(), 1, 'next level still waits for the player');
      await p.locator('#wFamily .heart-btn').first().click();
      const msg = 'a🌷'.repeat(37); // maximum supported message, including surrogate pairs at piece boundaries
      await p.locator('#hmMessage').fill(msg);
      t.eq(await p.locator('#hmNone b').innerText(), 'Verstuur berichtje 💛', 'send label follows custom text');
      await p.locator('#hmNone').click();
      await p.waitForSelector('#hsOk');
      t.eq(await p.locator('#modalBox h2').innerText(), 'Berichtje verstuurd! 😊', 'success popup confirms the message was sent');
      const confirmation = await bounds(p);
      t.eq(confirmation[0], initial[0], 'success popup preserves the width');
      t.ok(confirmation[1] < initial[1], 'success popup removes unused vertical space');
      t.eq(await p.locator('#wNext').count(), 0, 'confirmation appears before returning to the win screen');
      await p.locator('#hsOk').click();
      await p.waitForSelector('#wNext');
      t.eq(await bounds(p), initial, 'successful send returns to the same-size win popup');
      t.eq(await p.locator('#wFamily .heart-btn.sent').count(), 1, 'sent checkmark on recipient');
      t.eq(await p.evaluate(() => [__mj.S.level, __mj.myPoints(), __mj.S.stats.wins]), progress, 'sending never repeats a win or starts another level');
      const records = Object.values(db.get('plays/msg-pDen') || {});
      t.eq(records.map(m => [m.m0, m.m1, m.m2].filter(Boolean).join('')), [msg], 'custom message saved intact');
      t.eq(db.log.filter(l => l.m === 'PUT' && l.p === '/hearts/pDen/pOma').length, 1, 'heart written once');
      await p.locator('#wFamily .heart-btn.sent').click();
      t.eq(await p.locator('#wNext').count(), 1, 'daily limit leaves the win screen in place');
      await p.locator('#wMenu').click();
      for (let i = 0; i < 16; i++) {
        if (await p.evaluate(() => document.querySelector('#home').classList.contains('active') && document.querySelector('#modal').classList.contains('hidden'))) break;
        const b = p.locator('#modalBox button').filter({ visible: true });
        if (await b.count()) await b.first().click();
        await sleep(500);
      }
      t.ok(await p.evaluate(() => document.querySelector('#home').classList.contains('active')), 'original menu/reward continuation still works');
      t.eq(p.errors, [], 'no runtime errors');
    },
  },
  {
    name: 'win hearts: failed message stays editable and retry sends once',
    async run(t, { FakeDB, startLevel, solve, sleep }) {
      const db = new FakeDB({ scores: family }); let reject = true;
      const p = await t.phone({ db, state: { name: 'OmaHanny', pid: 'pOma', level: 12 }, routes: [['**/plays/msg-pDen.json', r => reject ? r.fulfill({ status: 503, body: 'unavailable', headers: { 'Access-Control-Allow-Origin': '*' } }) : db.handle(r)]] });
      await startLevel(p, 12); await solve(p, 3500); await sleep(400);
      await p.locator('#wFamily .heart-btn').first().click();
      await p.locator('#hmMessage').fill('Nog even doorzetten! 💪');
      await p.locator('#hmNone').click(); await p.waitForSelector('#hmError:not([hidden])');
      t.eq(await p.locator('#hmMessage').inputValue(), 'Nog even doorzetten! 💪', 'failure preserves the message');
      t.eq(db.get('hearts/pDen/pOma'), null, 'no heart is sent without the requested message');
      reject = false;
      await p.locator('#hmNone').dblclick(); await p.waitForSelector('#hsOk');
      t.eq(await p.locator('#modalBox h2').innerText(), 'Berichtje verstuurd! 😊', 'retry shows confirmation only after success');
      await p.locator('#hsOk').click(); await p.waitForSelector('#wNext');
      t.eq(db.log.filter(l => l.m === 'PUT' && l.p === '/hearts/pDen/pOma').length, 1, 'retry and double tap send a single heart');
      t.eq(p.errors, [], 'no runtime errors on retry');
    },
  },
  {
    name: 'win hearts: small English screen and foreground presence lifecycle',
    async run(t, { FakeDB, startLevel, solve, sleep }) {
      const db = new FakeDB({ scores: { ...family, pMe: { name: 'Dennis', avatar: '😊', level: 12, points: 0, t: 1 } } });
      const p = await t.phone({ db, size: [360, 640], state: { name: 'Dennis', pid: 'pMe', level: 12, lang: 'en' } });
      t.ok(db.get('scores/pMe/online') > 0, 'foreground heartbeat is published');
      await p.evaluate(async () => updatePresence(false));
      t.eq(db.get('scores/pMe/online'), 0, 'background clears online status');
      await p.evaluate(async () => updatePresence(true));
      t.ok(db.get('scores/pMe/online') > 0, 'returning refreshes presence');
      await startLevel(p, 12); await solve(p, 3500); await sleep(400);
      const initial = await bounds(p);
      await p.locator('#wFamily .heart-btn').first().click();
      t.eq(await bounds(p), initial, 'English picker matches the small win popup');
      t.ok(await p.locator('#modalBox').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1), 'all controls fit at 360 × 640');
      t.eq(await p.locator('#hmBack').innerText(), '← Back', 'localized back button');
      await p.locator('#hmMessage').fill('Hello!');
      t.eq(await p.locator('#hmNone b').innerText(), 'Send message 💛', 'localized send button');
      await p.evaluate(() => window.handleBack());
      t.eq(await p.locator('#wNext').count(), 1, 'Android back restores the win popup');
      await p.locator('#wFamily .heart-btn').first().click();
      await p.locator('#hmMessage').fill('Hello!');
      await p.locator('#hmNone').click(); await p.waitForSelector('#hsOk');
      t.eq(await p.locator('#modalBox h2').innerText(), 'Message sent! 😊', 'localized success popup');
      const confirmation = await bounds(p);
      t.eq(confirmation[0], initial[0], 'confirmation keeps the small popup width');
      t.ok(confirmation[1] < initial[1], 'small confirmation is shorter than the win popup');
      await p.evaluate(() => window.handleBack());
      t.eq(await p.locator('#wNext').count(), 1, 'Android back from confirmation returns to the completed win');
      t.eq(p.errors, [], 'no runtime errors');
    },
  },
];
