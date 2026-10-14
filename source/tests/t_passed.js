/* Overtaken by family: told the next time you open the app, with who and where they are now. */
'use strict';
module.exports = [
  {
    name: 'passed: a family member who overtakes you is announced the next time you open the app, with their level',
    async run(t, { FakeDB, sleep, modal }) {
      const db = new FakeDB({ scores: {
        pDoubt: { name: 'Mrs. Doubtfire', avatar: '🧓', level: 85, points: 90000, t: 1 },
        pMama: { name: 'Mama', avatar: '🌷', level: 95, points: 99000, t: 1 },
      } });
      const p = await t.phone({ db, state: { name: 'Dennis', pid: 'test-dennis', level: 90, lvlPts: { 1: 80000 } } });
      await sleep(1500);
      const m0 = await modal(p); t.ok(!m0 || !/ingehaald/i.test(m0.text), 'first time: nothing to tell, the order is remembered', m0 && m0.text);
      t.eq(await p.evaluate(() => __mj.S.famBelow), ['pDoubt'], 'remembered who is below');
      // while the app is closed, Mrs. Doubtfire climbs past
      db.set('scores/pDoubt/level', 92);
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(2500);
      const m = await modal(p);
      t.ok(m && /ingehaald/i.test(m.text) && /Mrs\. Doubtfire/.test(m.text) && /level 92/.test(m.text) && !/Mama/.test(m.text), 'told who passed and where she is now', m && m.text);
      t.ok(m && /3e in de familie/.test(m.text), 'and where you stand', m && m.text);
      await p.evaluate(() => document.querySelector('#psOk').click()); await sleep(300);
      t.ok(Object.values(p.db.get('plays/test-dennis') || {}).some(e => e.k === 'passed'), 'logged for the dashboard');
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await sleep(2000);
      const m2 = await modal(p); t.ok(!m2 || !/ingehaald/i.test(m2.text), 'only once', m2 && m2.text);
      t.eq(p.errors, [], 'no errors');
    },
  },
];
