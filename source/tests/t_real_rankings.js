/* Real-player ranking regressions. All data uses the local fake database. */
'use strict';
module.exports = [{
  name: 'real rankings: overtaking stays inside the win screen and next level needs no rank popup',
  async run(t, { FakeDB, startLevel, solve, sleep }) {
    const p = await t.phone({ state: { name: 'Oma', pid: 'oma', level: 12, toolsSeen: true, sunSeen: true }, db: new FakeDB({ scores: {
      gerda: { name: 'Gerda', points: 1000, level: 12, wk: '2026-10-05', wkPts: 100 }
    } }) });
    await startLevel(p, 12); await solve(p, 3800);
    t.ok(await p.locator('.win-rank-up').count() === 1, 'rank-up displayed within win');
    t.ok((await p.locator('.win-rank-up').innerText()).includes('Gerda'), 'real overtaken player named');
    t.eq(await p.locator('#wFamily .fam-row').count(), 2, 'real family and self only');
    await p.evaluate(() => document.querySelector('#wNext').click()); await sleep(800);
    t.eq(await p.locator('#clOk').count(), 0, 'no separate ranking popup');
  }
}, {
  name: 'real rankings: larger groups show nearby real players with full leaderboard access',
  async run(t, { FakeDB, startLevel, solve }) {
    const scores = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['fam' + i, { name: 'Family ' + i, points: 50000, level: 25, wk: '2026-10-05', wkPts: 10000 + i }]));
    const p = await t.phone({ size: [375, 560], state: { name: 'Oma', pid: 'oma', level: 12, toolsSeen: true }, db: new FakeDB({ scores }) });
    await startLevel(p, 12); await solve(p, 3800);
    t.eq(await p.locator('#wFamily .fam-row').count(), 3, 'compact nearby standings');
    t.eq(await p.locator('#wFamily .me').count(), 1, 'own row visible');
    t.eq(await p.locator('#wRanking').count(), 1, 'full leaderboard reachable');
    await p.setViewportSize({ width: 390, height: 820 });
    await p.waitForFunction(() => document.querySelectorAll('#wFamily .fam-row').length === 6);
    t.eq(await p.locator('#wFamily .fam-row').count(), 6, 'more room shows more family after resize');
  }
}];
