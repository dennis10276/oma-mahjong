'use strict';

const oldWeek = '2026-09-28';
const player = { pid: 'pPodiumMe', name: 'Sanne', level: 24, wk: { id: oldWeek, v: 2, pts: 350 } };
const scores = {
  pRiet: { name: 'Oma Riet', points: 200, level: 25, prevWk: oldWeek, prevWkPts: 290 },
  pEls: { name: 'Tante Els', points: 100, level: 22, wk: oldWeek, wkV: 2, wkPts: 245 },
};

module.exports = [
  {
    name: 'Monday podium awards the winner once with rolled-over and old-week family rows',
    async run(t, { FakeDB }) {
      const db = new FakeDB({ scores });
      const p = await t.phone({ db, state: player });
      await p.waitForSelector('#lwOk');
      t.eq(await p.evaluate(() => [S.weekWins, S.lastWeekAwarded, Boolean(S.trophies.w1)]), [1, oldWeek, true], 'one saved week, crown trophy earned');
      t.eq(await p.locator('#modalBox .fam-row').count(), 3, 'personal score and both family rows');
      await p.reload();
      await p.evaluate(() => window.__mjBoot);
      t.eq(await p.evaluate(() => S.weekWins), 1, 'reopen preserves award once');
      const rec = db.get('scores/pPodiumMe');
      t.eq([rec.prevWk, rec.prevWkPts], [oldWeek, 350], 'other devices can still see the finished week');
    },
  },
  {
    name: 'Monday podium never awards a crown for solo or offline scores',
    async run(t, { FakeDB }) {
      const staleWeek = '2026-09-21';
      const cases = [
        { scores: {} },
        { scores, offline: true },
        { scores: { pRiet: { ...scores.pRiet, prevWk: staleWeek } }, oldWeek: staleWeek },
      ];
      for (const fixture of cases) {
        const p = await t.phone({
          db: new FakeDB({ scores: fixture.scores }), state: {
            ...player, wk: { ...player.wk, id: fixture.oldWeek || oldWeek },
          },
          lb: Object.entries(scores).map(([id, score]) => ({ id, ...score })),
          ...(fixture.offline ? {
            routes: [['**/scores.json', route => route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' })]],
          } : {}),
        });
        await p.waitForSelector('#lwOk');
        t.eq(await p.evaluate(() => [S.weekWins, Boolean(S.trophies.w1)]), [0, false], 'personal summary only');
        t.eq(await p.locator('#modalBox .fam-row').count(), 0, 'cached family points do not appear in the podium');
      }
    },
  },
];
