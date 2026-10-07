/* Rankings: believable computer players, family in front, climbing past others. */
'use strict';
const LVLPTS = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [i + 1, 1100 + (i + 1) * 20]));
const STATE = { level: 14, name: 'Dennis', pid: 'test-bots', since: '2026-10-05', wk: { id: '2026-10-05', pts: 9000 }, lvlPts: LVLPTS, lvlHist: { '2026-10-05': 1, '2026-10-06': 6 } };

module.exports = [
  {
    name: 'ranking: computer players play around your level, points match their level',
    async run(t, { FakeDB }) {
      const p = await t.phone({ state: STATE, db: new FakeDB({ scores: { pz1: { name: 'OmaHanny', avatar: '👵', frame: 'none', points: 10430, level: 10, wk: '2026-10-05', wkPts: 10430, t: 1 } } }) });
      const all = await p.evaluate(() => __mj.ranking(undefined, 'all').map(e => ({ n: e.name, lv: e.level, pts: e.points, bot: !!e.bot, me: !!e.me })));
      const week = await p.evaluate(() => __mj.ranking(undefined, 'week').map(e => ({ n: e.name, pts: e.points, me: !!e.me })));
      t.ok(all.every((e, i) => i === 0 || all[i - 1].lv >= e.lv), 'all-time list is ordered by level', all.map(e => e.lv));
      t.ok(week.every((e, i) => i === 0 || week[i - 1].pts >= e.pts), 'week list is ordered by points');
      const bots = all.filter(e => e.bot);
      t.ok(bots.length >= 10, 'enough computer players', bots.length);
      t.ok(bots.every(b => b.lv >= 1 && b.lv <= 14 + 25), 'computer players stay near your level', bots.map(b => b.lv));
      t.ok(bots.filter(b => Math.abs(b.lv - 14) <= 5).length >= 4, 'several close rivals', bots.map(b => b.lv));
      // a computer player far above you also has clearly more points than you
      const me = all.find(e => e.me);
      t.ok(bots.filter(b => b.lv >= me.lv + 10).every(b => b.pts > me.pts), 'points go with the level');
      t.ok(all.some(e => e.n === 'OmaHanny') && week.some(e => e.n === 'OmaHanny'), 'family is in both lists');
    },
  },
  {
    name: 'ranking: climbing past players after a level',
    async run(t, { sleep }) {
      const lb = [{ id: 'pz1', name: 'Dennis', avatar: '😊', frame: 'rainbow', points: 1450, level: 2, wk: '2026-10-05', wkPts: 1450 }];
      const p = await t.phone({ state: { level: 9, name: 'Oma', pid: 'test-x9' }, lb });
      await p.evaluate(() => __mj.showClimb(7, 9, () => {}, 'all')); await sleep(3500);
      const msg = await p.evaluate(() => document.querySelector('#climbMsg').innerText);
      t.ok(/→/.test(msg) && /voorbij/.test(msg), 'climb message', msg);
      t.ok(/Nog \d+ level/.test(msg) || /bovenaan/.test(msg), 'next target shown', msg);
      await p.evaluate(() => document.querySelector('#clOk').click());
      t.ok(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden')), 'Verder closes it');
    },
  },
];
