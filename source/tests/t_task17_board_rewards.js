'use strict';

const player = { name: 'Sanne', pid: 'test-board-rewards', econV: 2, coins: 80 };

module.exports = [
  {
    name: 'Flow purse credits once when clean matches span a level resume',
    async run(t, { startLevel, TODAY }) {
      const p = await t.phone({ state: { ...player, level: 24, tasks: { date: TODAY, list: [
        { id: 'flow', goal: 2, prog: 0, done: false },
        { id: 'pairs', goal: 40, prog: 0, done: false },
        { id: 'daily', goal: 1, prog: 0, done: false },
      ] } } });
      await startLevel(p, 24);
      const pairs = await p.evaluate(() => {
        const alive = G.alive.slice();
        function find(remaining) {
          if (!remaining) return [];
          const freeTiles = G.tiles.map((_, i) => i).filter(i => alive[i] && !G.gold.has(i) && Layouts.isFree(i, alive, G.nb));
          for (const a of freeTiles) for (const b of freeTiles) {
            if (a >= b || faceOf(a) !== faceOf(b)) continue;
            alive[a] = alive[b] = 0;
            const tail = find(remaining - 1);
            alive[a] = alive[b] = 1;
            if (tail) return [[a, b], ...tail];
          }
          return null;
        }
        return find(10);
      });
      if (!t.ok(pairs, 'fixture has ten clean pairs')) return;
      const play = async moves => {
        for (const pair of moves) {
          await p.evaluate(([a, b]) => {
            // The old time-based combo would reset on every move in this fixture.
            G.lastMatch = performance.now() - 20000;
            for (const i of [a, b]) { onTap(i); if (G.alive[i]) onTap(i); }
          }, pair);
          await p.waitForFunction(() => !G.flights);
        }
      };
      await play(pairs.slice(0, 5));
      t.eq(await p.evaluate(() => ({ purse: G.boardCoins, charges: S.stats.flows, wallet: S.coins })),
        { purse: 1, charges: 1, wallet: 80 }, 'the first charge puts one coin in the purse');
      await p.reload();
      await startLevel(p, 24, false);
      await play(pairs.slice(5));
      t.eq(await p.evaluate(() => ({ purse: G.boardCoins, charges: S.stats.flows, task: S.tasks.list[0].prog })),
        { purse: 1, charges: 2, task: 2 }, 'a second charge advances the task without paying a second board coin');
    },
  },
  {
    name: 'Flow task migration preserves completed chores and replaces retired unfinished tasks',
    async run(t, { TODAY }) {
      const p = await t.phone({ state: { ...player, level: 24, tasks: { date: TODAY, list: [
        { id: 'combo', goal: 3, prog: 3, done: true },
        { id: 'points', goal: 1000, prog: 300, done: false },
        { id: 'pairs', goal: 40, prog: 21, done: false },
      ] } } });
      const list = await p.evaluate(() => ensureTasks().list);
      t.eq(list[0], { id: 'combo', goal: 3, prog: 3, done: true }, 'a completed task stays completed for the chest');
      t.ok(list[1].id !== 'points' && list[1].id !== 'combo' && list[1].prog === 0, 'the unfinished task can still be completed today', list[1]);
      t.eq(list[2].prog, 21, 'another task keeps its progress');
    },
  },
  {
    name: 'Bijna-bloem counts a manual restart and a same-day loss only once',
    async run(t, { startLevel, TODAY }) {
      const p = await t.phone({ state: { ...player, level: 84, grit: { petals: 4, lastDay: '2026-10-06' } } });
      await startLevel(p, 84);
      const progress = lost => {
        const left = Math.floor(G.tiles.length * .2);
        G.alive.fill(0);
        G.alive.fill(1, 0, left);
        G.tray = lost ? [left, left + 1, left + 2, left + 3] : [];
      };
      await p.evaluate(progress, false);
      await p.evaluate(() => { G.boardCoins = 3; restart(); });
      t.eq(await p.evaluate(() => ({ grit: S.grit, blooms: S.stats.gritBlooms, wallet: S.coins, purse: G.boardCoins })),
        { grit: { petals: 0, lastDay: TODAY }, blooms: 1, wallet: 95, purse: 0 }, 'fifth petal pays a single bloom and discards the purse');
      await p.evaluate(progress, true);
      await p.evaluate(() => checkStuck());
      await p.waitForSelector('#sRetry');
      t.eq(await p.evaluate(() => ({ grit: S.grit, blooms: S.stats.gritBlooms, wallet: S.coins })),
        { grit: { petals: 0, lastDay: TODAY }, blooms: 1, wallet: 95 }, 'a same-day loss cannot add another petal or coins');
    },
  },
  {
    name: 'Momentum adds one normal pair on the fresh designed level and keeps it on resume',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { ...player, level: 85, winStreak: 3, momentumLevel: 85, stars: { L84: 3 } } });
      await startLevel(p, 84);
      await p.evaluate(() => restart());
      t.eq(await p.evaluate(() => S.winStreak), 3, 'a replay restart preserves the main streak');
      await startLevel(p, 85);
      const extraGold = () => [...G.gold].filter(i => !(G.o.spec.made.gold || []).includes(i));
      const pair = await p.evaluate(extraGold);
      if (!t.eq(pair.length, 2, 'ready-made board has one extra golden pair')) return;
      t.ok(await p.evaluate(([a, b]) => faceOf(a) === faceOf(b) && [a, b].every(i => !G.down[i] && G.clock?.i !== i && !obKind(i)), pair),
        'momentum marks a matching face pair that has no other mechanic');
      await p.reload();
      await startLevel(p, 85, false);
      t.eq(await p.evaluate(extraGold), pair, 'the awarded pair remains the same on resume');
      await p.evaluate(() => restart());
      t.eq(await p.evaluate(extraGold), [], 'a new attempt after breaking the streak has the original gold tiles');
    },
  },
  {
    name: 'Auto-finish saves two board coins once and banks them only on the fresh win',
    async run(t, { startLevel, TODAY }) {
      const p = await t.phone({ state: { ...player, level: 55, tasks: { date: TODAY, list: [
        { id: 'pairs', goal: 40, prog: 0, done: false },
        { id: 'daily', goal: 1, prog: 0, done: false },
        { id: 'flips', goal: 15, prog: 0, done: false },
      ] } } });
      const prepareEnd = () => {
        const route = solveNow(200000);
        G.gold.clear(); // This fixture isolates the two Auto-finish coins from gold pair rewards.
        for (const i of route.slice(0, -2)) { G.alive[i] = 0; G.down[i] = 0; }
        updateObstacles();
        renderBoard(false);
        maybeAutoFinish();
      };
      await startLevel(p, 55);
      await p.evaluate(prepareEnd);
      t.eq(await p.evaluate(() => ({ auto: G.autoFin, purse: G.boardCoins, wallet: S.coins })),
        { auto: true, purse: 2, wallet: 80 }, 'two coins are pending while the board is playing');
      await p.reload();
      await startLevel(p, 55, false);
      await p.waitForSelector('#wNext', { timeout: 5000 });
      t.eq(await p.evaluate(() => S.coins), 86, 'the resumed win banks its two Auto-finish coins once');
      await startLevel(p, 55);
      await p.evaluate(prepareEnd);
      await p.waitForSelector('#wNext', { timeout: 5000 });
      t.eq(await p.evaluate(() => S.coins), 86, 'the already-won replay never banks the purse');
    },
  },
  {
    name: 'the final tap stays resumable until its purse is saved with the win',
    async run(t, { startLevel, TODAY }) {
      const p = await t.phone({ state: { ...player, level: 5, tasks: { date: TODAY, list: [] } } });
      await startLevel(p, 5);
      const saved = await p.evaluate(() => {
        const pair = solveNow(80000).slice(-2);
        G.alive.fill(0);
        G.down.fill(0);
        G.gold.clear();
        G.boardCoins = 1;
        for (const i of pair) G.alive[i] = 1;
        renderBoard(false);
        pair.forEach(i => onTap(i));
        return loadCur();
      });
      t.ok(saved && saved.boardCoins === 1 && saved.alive.every(value => value === 0), 'the saved cleared board carries its purse');
      await p.reload();
      await startLevel(p, 5, false);
      await p.waitForSelector('#wNext', { timeout: 4500 });
      t.eq(await p.evaluate(() => [S.level, S.coins, loadCur()]), [6, 85, null], 'resume settles the last fresh win just once');
    },
  },
  {
    name: 'Lucky highlight is removed when the player changes the proved tray state',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { ...player, level: 25 } });
      await startLevel(p, 25);
      const invalidated = await p.evaluate(() => {
        const choices = G.tiles.map((_, i) => i).filter(i => canTake(i) && !G.down[i] && faceOf(i) < 100);
        const [hint, move] = choices;
        G.lucky = { i: hint, until: Date.now() + 15000 };
        glow(hint, 'lucky', true);
        onTap(move);
        return !G.lucky && !G.tiles[hint].el.classList.contains('lucky');
      });
      t.ok(invalidated, 'a recommendation from before the move no longer glows');
    },
  },
];
