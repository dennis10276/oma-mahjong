/* Hearts between family members (with a fake database shared by two phones). */
'use strict';

module.exports = [
  {
    name: 'hearts: send, pop up after her level, and "gezien" for the sender',
    async run(t, { FakeDB, startLevel, solve, modal, click, sleep }) {
      const db = new FakeDB({ scores: {} });
      const oma = await t.phone({ db, state: { level: 10, pid: 'pOma', name: 'Oma Test', avatar: '👵', wk: { id: '2026-10-05', pts: 9000 }, lvlPts: { 1: 9000 } } });
      const me = await t.phone({ db, state: { level: 3, pid: 'pMe', name: 'Klein Test', avatar: '😊', wk: { id: '2026-10-05', pts: 1400 }, lvlPts: { 1: 1400 } } });
      for (const p of [oma, me]) await p.evaluate(() => __mj.pushScore());
      await sleep(500);
      // the family list comes from the database (test players are shown to test players)
      t.ok(db.get('scores/pOma/points') > 0, 'Oma\'s score in the database', db.get('scores/pOma'));
      await me.evaluate(() => fetchOnline()); await me.evaluate(() => __mj.show('ranking')); await sleep(800);
      t.ok((await me.evaluate(() => document.querySelector('#famBox').innerText)).includes('Oma Test'), 'Oma in the family box');
      // remember what Oma's screen shows when a heart arrives (it may come at home or during the level)
      await oma.evaluate(() => { for (const n of ['showHearts', 'heartPop']) { const f = window[n]; window[n] = function (...a) { const r = f.apply(this, a); setTimeout(() => { window.__heartTexts = (window.__heartTexts || []).concat(document.querySelector(n === 'showHearts' ? '#modalBox' : '#heartPop').innerText); }, 50); return r; }; } });
      await me.evaluate(() => __mj.sendHeart('pOma', 'Oma Test')); await sleep(400);
      const pick = await modal(me);
      t.ok(pick && /Hartje voor Oma Test/.test(pick.title) && /Goed bezig/.test(pick.text), 'choose a message', pick);
      await click(me, '.msg-pick .mp'); await sleep(700);
      t.eq((await modal(me) || {}).title, 'Hartje verstuurd!', 'sent pop-up');
      t.ok(db.get('hearts/pOma/pMe'), 'heart in the database');
      await click(me, '#hsOk');
      // Oma finishes a level and sees the heart
      await startLevel(oma, 10);
      await solve(oma, 3000);
      await click(oma, '#wNext'); await sleep(2500);
      let seen = false, msgSeen = false;
      const steps = [];
      for (let i = 0; i < 8 && !seen; i++) {
        const m = await modal(oma); steps.push(m && m.title);
        if (m && /hartje/i.test(m.text)) { seen = true; msgSeen = /Goed bezig! 💪/.test(m.text) && /Klein Test/.test(m.text); }
        else if (await oma.evaluate(() => !!document.querySelector('#heartPop.on'))) { seen = true; msgSeen = /Goed bezig! 💪/.test(await oma.evaluate(() => document.querySelector('#heartPop').innerText)); }
        else if (m && m.buttons.length) { await click(oma, '#' + (m.buttons.find(b => b !== 'trSee' && b !== 'wMenu') || m.buttons[0])); await sleep(1200); }
        else await sleep(800);
      }
      t.log(steps);
      const texts = await oma.evaluate(() => window.__heartTexts || []);
      if (texts.length) { seen = true; msgSeen = msgSeen || texts.some(x => /Goed bezig! 💪/.test(x) && /Klein Test/.test(x)); }
      const popped = seen || await oma.evaluate(() => !!document.querySelector('#heartPop.on'));
      t.ok(popped, 'Oma sees the heart', steps);
      t.ok(msgSeen, 'and the message with it');
      t.ok(Object.values(db.get('plays/msg-pOma') || {}).some(m => m.from === 'pMe' && m.m0 === 'Goed bezig! 💪'), 'message stored');
      await sleep(1500);
      const h = db.get('hearts/pOma/pMe');
      t.ok(h && h.t < 0, 'marked as seen in the database', h);
      await me.evaluate(() => { __mj.show('home'); }); await sleep(200);
      await me.evaluate(() => checkSentHearts()); await sleep(800);
      await me.evaluate(() => __mj.show('ranking')); await sleep(1500);
      const st = await me.evaluate(() => (document.querySelector('.fam-row .hs') || {}).textContent || '');
      t.ok(/gezien/.test(st), 'sender sees "gezien"', st);
    },
  },
  {
    name: 'hearts: a heart arrives during a level without stopping the game',
    async run(t, { FakeDB, startLevel, sleep }) {
      const db = new FakeDB({ scores: {} });
      const oma = await t.phone({ db, state: { level: 8, pid: 'pOma', name: 'Oma Live' } });
      await startLevel(oma, 8); await sleep(1000);
      const ht = Date.now() + 1000;
      db.set('plays/msg-pOma/-m1', { k: 'msg', t: ht, from: 'pMe', name: 'Klein', m0: 'Je kan het, oma!' });
      db.set('plays/msg-pOma/-m0', { k: 'msg', t: ht - 864e5, from: 'pMe', name: 'Klein', m0: 'Oud berichtje' });
      db.set('hearts/pOma/pMe', { name: 'Klein', t: ht });
      let shown = false;
      for (let i = 0; i < 40 && !shown; i++) { await sleep(250); shown = await oma.evaluate(() => !!document.querySelector('#heartPop.on')); }
      t.ok(shown, 'heart pops up in the level');
      const pop = await oma.evaluate(() => document.querySelector('#heartPop').innerText);
      t.ok(/Je kan het, oma!/.test(pop) && !/Oud berichtje/.test(pop), 'with its own message (not an old one)', pop);
      if (shown) { await oma.evaluate(() => document.querySelector('#heartPop').click()); await sleep(300); }
      t.ok(await oma.evaluate(() => !__mj.G.done), 'level still going');
    },
  },
];
